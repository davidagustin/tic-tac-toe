import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { config } from './lib/config';
import { healthRoutes } from './routes/health';

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
      ? true  // Allow all in dev
      : ['https://yourdomain.com'],
    credentials: true,
  });

  await app.register(cookie);

  await app.register(jwt, {
    secret: config.JWT_ACCESS_SECRET,
    sign: { expiresIn: config.JWT_ACCESS_EXPIRY },
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // ─── Routes ────────────────────────────────────────
  await app.register(healthRoutes);
  // Auth routes added in Step 7
  // Game routes added in Phase 2

  // ─── Start ─────────────────────────────────────────
  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    console.log(`\nServer running at http://localhost:${config.PORT}`);
    console.log(`Health check: http://localhost:${config.PORT}/api/health\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
