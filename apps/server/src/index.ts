import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import formbody from '@fastify/formbody';
import rateLimit from '@fastify/rate-limit';
import { config } from './lib/config';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { oauthRoutes } from './routes/oauth';

async function main() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'development' ? 'info' : 'warn',
      transport: config.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // ─── Plugins ───────────────────────────────────────
  await app.register(cors, {
    origin: config.NODE_ENV === 'development'
      ? true
      : ['https://yourdomain.com'],
    credentials: true,
  });

  await app.register(cookie);
  await app.register(formbody);

  await app.register(jwt, {
    secret: config.JWT_ACCESS_SECRET,
    sign: { expiresIn: config.JWT_ACCESS_EXPIRY },
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // ─── Auth Decorator ────────────────────────────────
  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
  });

  // ─── Routes ────────────────────────────────────────
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(oauthRoutes);

  // ─── Start ─────────────────────────────────────────
  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    console.log(`\nServer running at http://localhost:${config.PORT}`);
    console.log(`Health: http://localhost:${config.PORT}/api/health\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
