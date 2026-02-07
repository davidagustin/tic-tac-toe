import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/api/health", async (_request, reply) => {
    try {
      // Check DB connection
      await prisma.$queryRaw`SELECT 1`;

      return {
        status: "ok",
      };
    } catch (_error) {
      reply.status(503);
      return {
        status: "error",
        message: "Database connection failed",
      };
    }
  });
}
