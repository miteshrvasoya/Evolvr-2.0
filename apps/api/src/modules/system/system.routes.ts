import { FastifyInstance } from 'fastify';
import { sql } from '../../db/client.js';
import { redisConnection } from '../../queues/index.js';

export default async function systemRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/system/health', async (request, reply) => {
    let dbStatus = 'ok';
    let redisStatus = 'ok';

    try {
      await sql`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    try {
      if (redisConnection.status !== 'ready') {
        redisStatus = 'disconnected';
      }
    } catch {
      redisStatus = 'error';
    }

    return {
      status: dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded',
      db: dbStatus,
      redis: redisStatus,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  });
}
