import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma';
import { createRefreshToken } from '../services/auth';
import { config } from '../lib/config';

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
    const { code } = request.query as { code?: string };

    if (!code) {
      return reply.status(400).send({ success: false, error: 'Missing auth code' });
    }

    try {
      // Exchange code for tokens
      const { tokens } = await googleClient.getToken(code);
      googleClient.setCredentials(tokens);

      // Get user info
      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token!,
        audience: config.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload()!;
      const { sub: googleId, email, name, picture } = payload;

      if (!email) {
        return reply.status(400).send({ success: false, error: 'Email not provided by Google' });
      }

      // Find or create user
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { email },
            { accounts: { some: { provider: 'google', providerAccountId: googleId! } } },
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
                providerAccountId: googleId!,
              },
            },
          },
          include: { accounts: true },
        });
      } else {
        // Existing user — link Google account if not already linked
        const hasGoogle = user.accounts.some((a) => a.provider === 'google');
        if (!hasGoogle) {
          await prisma.account.create({
            data: {
              userId: user.id,
              provider: 'google',
              providerAccountId: googleId!,
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

      // For mobile: redirect with tokens as URL params
      // The Expo app will catch this via deep linking
      const redirectUrl = `tictactoe://auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`;

      return reply.redirect(redirectUrl);
    } catch (error) {
      console.error('Google OAuth error:', error);
      return reply.status(500).send({ success: false, error: 'OAuth failed' });
    }
  });
}
