import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  hashPassword,
  verifyPassword,
  createRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
} from '../services/auth';

// ─── Schemas ───────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(50),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// ─── Routes ────────────────────────────────────────

export async function authRoutes(app: FastifyInstance) {

  // ── Register ──────────────────────────────────────
  app.post('/api/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = registerSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid input',
        details: result.error.flatten().fieldErrors,
      });
    }

    const { email, password, name } = result.data;

    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: 'Email already registered',
      });
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });

    // Generate tokens
    const accessToken = app.jwt.sign(
      { userId: user.id, email: user.email },
    );
    const refreshToken = await createRefreshToken(user.id);

    // Set refresh token as httpOnly cookie
    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return reply.status(201).send({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          rating: user.rating,
          stats: {
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            draws: 0,
          },
        },
      },
    });
  });

  // ── Login ─────────────────────────────────────────
  app.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = loginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid input',
      });
    }

    const { email, password } = result.data;

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Generate tokens
    const accessToken = app.jwt.sign(
      { userId: user.id, email: user.email },
    );
    const refreshToken = await createRefreshToken(user.id);

    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60,
    });

    return {
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          rating: user.rating,
          avatarUrl: user.avatarUrl,
          stats: {
            gamesPlayed: user.gamesPlayed,
            wins: user.wins,
            losses: user.losses,
            draws: user.draws,
          },
        },
      },
    };
  });

  // ── Refresh Token ─────────────────────────────────
  app.post('/api/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies.refreshToken;
    if (!token) {
      return reply.status(401).send({
        success: false,
        error: 'No refresh token',
      });
    }

    const refreshTokenRecord = await validateRefreshToken(token);
    if (!refreshTokenRecord) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid or expired refresh token',
      });
    }

    // Rotate refresh token (invalidate old, create new)
    await revokeRefreshToken(token);
    const newRefreshToken = await createRefreshToken(refreshTokenRecord.userId);

    const accessToken = app.jwt.sign({
      userId: refreshTokenRecord.user.id,
      email: refreshTokenRecord.user.email,
    });

    reply.setCookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60,
    });

    return {
      success: true,
      data: { accessToken },
    };
  });

  // ── Logout ────────────────────────────────────────
  app.post('/api/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies.refreshToken;
    if (token) {
      await revokeRefreshToken(token);
    }

    reply.clearCookie('refreshToken', { path: '/api/auth' });

    return { success: true };
  });

  // ── Get Current User (Protected) ─────────────────
  app.get('/api/auth/me', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.user as { userId: string; email: string };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.status(404).send({
        success: false,
        error: 'User not found',
      });
    }

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        rating: user.rating,
        avatarUrl: user.avatarUrl,
        stats: {
          gamesPlayed: user.gamesPlayed,
          wins: user.wins,
          losses: user.losses,
          draws: user.draws,
        },
      },
    };
  });
}
