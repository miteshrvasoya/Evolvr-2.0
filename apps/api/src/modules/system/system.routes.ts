import { FastifyInstance } from 'fastify';
import { sql } from '../../db/client.js';
import { redisConnection } from '../../queues/index.js';

export default async function systemRoutes(app: FastifyInstance) {
  // app.addHook('onRequest', app.authenticate);

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
      success: true,
      data: {
        status: dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded',
        db: dbStatus,
        redis: redisStatus,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      }
    };
  });

  app.get('/system/debug', async (request, reply) => {
    const runs = await sql`SELECT id, status, error_message FROM agent_runs ORDER BY id DESC LIMIT 5`;
    const steps = await sql`SELECT id, agent_run_id, step_type, status, error_message, created_at FROM agent_steps ORDER BY created_at DESC LIMIT 10`;
    const events = await sql`SELECT id, agent_run_id, event_type, message, created_at FROM agent_events ORDER BY created_at DESC LIMIT 20`;
    const drafts = await sql`SELECT COUNT(*) as count FROM content_ideas WHERE status = 'draft'`;
    const strats = await sql`SELECT COUNT(*) as count FROM strategy_versions WHERE status = 'active'`;
    return {
      success: true,
      data: { runs, steps, events, drafts: drafts[0]?.count, strategies: strats[0]?.count }
    };
  });
}
