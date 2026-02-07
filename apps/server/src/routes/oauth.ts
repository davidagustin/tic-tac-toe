import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { createRefreshToken } from '../services/auth';
import { config } from '../lib/config';

// Temporary auth codes for OAuth exchange (60s TTL)
const authCodes = new Map<string, { accessToken: string; refreshToken: string; expiresAt: number }>();

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
    const url = googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      prompt: 'consent',
    });

    return reply.redirect(url);
  });

  // ── Step 2: Google calls back with code ───────────
  app.get('/api/auth/google/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code: googleCode } = request.query as { code?: string };

    if (!googleCode) {
      return reply.status(400).send({ success: false, error: 'Missing auth code' });
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

      // For mobile: redirect with temporary auth code (60s TTL)
      // The Expo app will catch this via deep linking and exchange the code for tokens
      const code = generateAuthCode(accessToken, refreshToken);
      const redirectUrl = `tictactoe://auth/callback?code=${code}`;

      return reply.redirect(redirectUrl);
    } catch (error) {
      console.error('Google OAuth error:', error);
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
