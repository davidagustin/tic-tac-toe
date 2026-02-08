import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { config } from "./lib/config";
import { closeRedis, getRedis } from "./lib/redis";
import socketioPlugin from "./plugins/socketio";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import { oauthRoutes } from "./routes/oauth";
import { chessEngine } from "./services/engines/chessEngine";
import { registerEngine } from "./services/engines/registry";
import { tttEngine } from "./services/engines/tttEngine";

async function main() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "development" ? "info" : "warn",
      transport:
        config.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // ─── Plugins ───────────────────────────────────────
  await app.register(cors, {
    origin: config.NODE_ENV === "development" ? true : ["https://game-practice-aws.com"],
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
    timeWindow: "1 minute",
  });

  // ─── Game Engines ────────────────────────────────────
  registerEngine(tttEngine);
  registerEngine(chessEngine);

  // ─── Redis ─────────────────────────────────────────
  getRedis(); // Initialize Redis connection

  // ─── Socket.IO ─────────────────────────────────────
  await app.register(socketioPlugin);

  // ─── Auth Decorator ────────────────────────────────
  app.decorate("authenticate", async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (_err) {
      reply.status(401).send({ success: false, error: "Unauthorized" });
    }
  });

  // ─── Routes ────────────────────────────────────────
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(oauthRoutes);

  // ─── Graceful Shutdown ─────────────────────────────
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down...`);
      await closeRedis();
      await app.close();
      process.exit(0);
    });
  }

  // ─── Start ─────────────────────────────────────────
  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`Server running at http://localhost:${config.PORT}`);
    app.log.info(`Health: http://localhost:${config.PORT}/api/health`);
    app.log.info(`Socket.IO path: /api/socket.io/`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
