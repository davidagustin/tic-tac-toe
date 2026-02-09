import crypto from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { OAuth2Client } from "google-auth-library";
import { config } from "../lib/config";
import { prisma } from "../lib/prisma";
import { getRedis } from "../lib/redis";
import { createRefreshToken } from "../services/auth";

async function generateAuthCode(accessToken: string, refreshToken: string): Promise<string> {
  const code = crypto.randomBytes(32).toString("hex");
  const redis = getRedis();
  await redis.set(`oauth_code:${code}`, JSON.stringify({ accessToken, refreshToken }), "EX", 60);
  return code;
}

async function consumeAuthCode(code: string) {
  const redis = getRedis();
  const raw = await redis.get(`oauth_code:${code}`);
  if (!raw) return null;
  await redis.del(`oauth_code:${code}`);
  return JSON.parse(raw) as { accessToken: string; refreshToken: string };
}

export async function oauthRoutes(app: FastifyInstance) {
  const googleClient = new OAuth2Client(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_CALLBACK_URL,
  );

  // ── Step 1: Redirect to Google ────────────────────
  app.get("/api/auth/google", async (request: FastifyRequest, reply: FastifyReply) => {
    const { platform } = request.query as { platform?: string };
    const randomToken = crypto.randomBytes(32).toString("hex");
    // Encode platform in state so the callback knows where to redirect
    const state = platform === "web" ? `${randomToken}|web` : randomToken;
    const redis = getRedis();
    await redis.set(`oauth_state:${state}`, String(Date.now()), "EX", 300);

    const url = googleClient.generateAuthUrl({
      access_type: "offline",
      scope: ["openid", "email", "profile"],
      prompt: "consent",
      state,
    });

    return reply.redirect(url);
  });

  // ── Step 2: Google calls back with code ───────────
  app.get("/api/auth/google/callback", async (request: FastifyRequest, reply: FastifyReply) => {
    const { code: googleCode, state } = request.query as { code?: string; state?: string };

    if (!googleCode) {
      return reply.status(400).send({ success: false, error: "Missing auth code" });
    }

    // Validate CSRF state parameter and detect platform
    const isWeb = state?.endsWith("|web");

    const redis = getRedis();
    const stateValue = state ? await redis.get(`oauth_state:${state}`) : null;
    if (!state || !stateValue) {
      return reply
        .status(403)
        .send({ success: false, error: "Invalid or missing state parameter" });
    }
    await redis.del(`oauth_state:${state}`);

    try {
      // Exchange code for tokens (use a new client instance to avoid race conditions)
      const callbackClient = new OAuth2Client(
        config.GOOGLE_CLIENT_ID,
        config.GOOGLE_CLIENT_SECRET,
        config.GOOGLE_CALLBACK_URL,
      );
      const { tokens } = await callbackClient.getToken(googleCode);
      callbackClient.setCredentials(tokens);

      // Validate id_token exists
      if (!tokens.id_token) {
        return reply
          .status(400)
          .send({ success: false, error: "No ID token received from Google" });
      }

      // Get user info
      const ticket = await callbackClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        return reply.status(400).send({ success: false, error: "Invalid ID token payload" });
      }

      const { sub: googleId, email, name, picture } = payload;

      if (!googleId) {
        return reply.status(400).send({ success: false, error: "Google ID not provided" });
      }

      if (!email) {
        return reply.status(400).send({ success: false, error: "Email not provided by Google" });
      }

      const normalizedEmail = email.toLowerCase();

      // Find or create user
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: normalizedEmail },
            { accounts: { some: { provider: "google", providerAccountId: googleId } } },
          ],
        },
        include: { accounts: true },
      });

      if (!user) {
        // New user — create account
        user = await prisma.user.create({
          data: {
            email: normalizedEmail,
            name: name || normalizedEmail.split("@")[0],
            avatarUrl: picture,
            accounts: {
              create: {
                provider: "google",
                providerAccountId: googleId,
              },
            },
          },
          include: { accounts: true },
        });
      } else {
        // Existing user — link Google account if not already linked
        const hasGoogle = user.accounts.some((a: { provider: string }) => a.provider === "google");
        if (!hasGoogle) {
          await prisma.account.create({
            data: {
              userId: user.id,
              provider: "google",
              providerAccountId: googleId,
            },
          });
        }
      }

      // Generate tokens
      const accessToken = app.jwt.sign({
        userId: user.id,
        email: user.email,
      });
      const refreshToken = await createRefreshToken(user.id);

      // Redirect with temporary auth code (60s TTL)
      const code = await generateAuthCode(accessToken, refreshToken);

      if (isWeb) {
        const appHost = process.env.APP_HOST || "game-practice-aws.com";
        return reply.redirect(`https://${appHost}/auth/callback?code=${code}`);
      }

      // Mobile: deep link back to Expo app
      return reply.redirect(`tictactoe://auth/callback?code=${code}`);
    } catch (error) {
      request.log.error({ error }, "Google OAuth error");
      return reply.status(500).send({ success: false, error: "OAuth failed" });
    }
  });

  // ── Step 3: Exchange auth code for tokens ─────────
  app.post("/api/auth/oauth/exchange", async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.body as { code?: string };
    if (!code) {
      return reply.status(400).send({ success: false, error: "Authorization code required" });
    }
    const tokens = await consumeAuthCode(code);
    if (!tokens) {
      return reply
        .status(401)
        .send({ success: false, error: "Invalid or expired authorization code" });
    }

    const isProduction = process.env.NODE_ENV === "production";

    // Set httpOnly cookies so the web client can authenticate subsequent requests
    reply.setCookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/api/auth",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    reply.setCookie("accessToken", tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/api",
      maxAge: 15 * 60, // 15 minutes
    });

    const csrfToken = crypto.randomBytes(32).toString("hex");
    reply.setCookie("csrfToken", csrfToken, {
      httpOnly: false,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60,
    });

    return reply.send({
      success: true,
      data: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
    });
  });
}
