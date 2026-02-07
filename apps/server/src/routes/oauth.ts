import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { createRefreshToken } from '../services/auth';
import { config } from '../lib/config';

// Temporary auth codes for OAuth exchange (60s TTL)
const authCodes = new Map<string, { accessToken: string; refreshToken: string; expiresAt: number }>();

// CSRF state parameters for OAuth flow (5 min TTL)
const oauthStates = new Map<string, number>();

function generateAuthCode(accessToken: string, refreshToken: string): string {
  const code = crypto.randomBytes(32).toString('hex');
  authCodes.set(code, { accessToken, refreshToken, expiresAt: Date.now() + 60_000 });
  return code;
}

function consumeAuthCode(code: string) {
  const entry = authCodes.get(code);
  if (!entry || entry.expiresAt < Date.now()) {
    authCodes.delete(code);
    return null;
  }
  authCodes.delete(code);
  return entry;
}

export async function oauthRoutes(app: FastifyInstance) {
  const googleClient = new OAuth2Client(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_CALLBACK_URL,
  );

  // ── Step 1: Redirect to Google ────────────────────
  app.get('/api/auth/google', async (request: FastifyRequest, reply: FastifyReply) => {
    const { platform } = request.query as { platform?: string };
    const randomToken = crypto.randomBytes(32).toString('hex');
    // Encode platform in state so the callback knows where to redirect
    const state = platform === 'web' ? `${randomToken}|web` : randomToken;
    oauthStates.set(state, Date.now() + 5 * 60 * 1000); // 5 min TTL

    const url = googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      prompt: 'consent',
      state,
    });

    return reply.redirect(url);
  });

  // ── Step 2: Google calls back with code ───────────
  app.get('/api/auth/google/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code: googleCode, state } = request.query as { code?: string; state?: string };

    if (!googleCode) {
      return reply.status(400).send({ success: false, error: 'Missing auth code' });
    }

    // Validate CSRF state parameter and detect platform
    const isWeb = state?.endsWith('|web');

    if (!state || !oauthStates.has(state)) {
      return reply.status(403).send({ success: false, error: 'Invalid or missing state parameter' });
    }

    const stateExpiry = oauthStates.get(state)!;
    oauthStates.delete(state);

    if (stateExpiry < Date.now()) {
      return reply.status(403).send({ success: false, error: 'State parameter expired' });
    }

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
        return reply.status(400).send({ success: false, error: 'No ID token received from Google' });
      }

      // Get user info
      const ticket = await callbackClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        return reply.status(400).send({ success: false, error: 'Invalid ID token payload' });
      }

      const { sub: googleId, email, name, picture } = payload;

      if (!googleId) {
        return reply.status(400).send({ success: false, error: 'Google ID not provided' });
      }

      if (!email) {
        return reply.status(400).send({ success: false, error: 'Email not provided by Google' });
      }

      // Find or create user
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { email },
            { accounts: { some: { provider: 'google', providerAccountId: googleId } } },
          ],
        },
        include: { accounts: true },
      });

      if (!user) {
        // New user — create account
        user = await prisma.user.create({
          data: {
            email,
            name: name || email.split('@')[0],
            avatarUrl: picture,
            accounts: {
              create: {
                provider: 'google',
                providerAccountId: googleId,
              },
            },
          },
          include: { accounts: true },
        });
      } else {
        // Existing user — link Google account if not already linked
        const hasGoogle = user.accounts.some((a: { provider: string }) => a.provider === 'google');
        if (!hasGoogle) {
          await prisma.account.create({
            data: {
              userId: user.id,
              provider: 'google',
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
      const code = generateAuthCode(accessToken, refreshToken);

      if (isWeb) {
        // Web: redirect to the web app's callback page
        const proto = request.headers['x-forwarded-proto'] || 'https';
        const host = request.headers.host || request.hostname;
        return reply.redirect(`${proto}://${host}/auth/callback?code=${code}`);
      }

      // Mobile: deep link back to Expo app
      return reply.redirect(`tictactoe://auth/callback?code=${code}`);
    } catch (error) {
      request.log.error({ error }, 'Google OAuth error');
      return reply.status(500).send({ success: false, error: 'OAuth failed' });
    }
  });

  // ── Step 3: Exchange auth code for tokens ─────────
  app.post('/api/auth/oauth/exchange', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.body as { code?: string };
    if (!code) {
      return reply.status(400).send({ success: false, error: 'Authorization code required' });
    }
    const tokens = consumeAuthCode(code);
    if (!tokens) {
      return reply.status(401).send({ success: false, error: 'Invalid or expired authorization code' });
    }
    return reply.send({
      success: true,
      data: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
    });
  });
}
