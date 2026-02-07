import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async (request, reply) => {
    try {
      // Check DB connection
      await prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
      };
    } catch (error) {
      reply.status(503);
      return {
        status: 'error',
        message: 'Database connection failed',
      };
    }
  });
}
