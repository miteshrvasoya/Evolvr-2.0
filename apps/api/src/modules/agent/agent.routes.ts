import { FastifyInstance } from 'fastify';
import { sql } from '../../db/client.js';
import { OrchestratorAgent } from './orchestrator.js';

export default async function agentRoutes(app: FastifyInstance) {
  const orchestrator = new OrchestratorAgent();

  app.addHook('onRequest', app.authenticate);

  async function getPrimaryAccount(userId: string) {
    const accounts = await sql`SELECT id FROM social_accounts WHERE user_id = ${userId} LIMIT 1`;
    return accounts[0]?.id;
  }

  // Trigger manual daily cycle
  app.post('/agent/trigger', async (request: any, reply) => {
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);

    if (!accountId) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'No primary account found' } });
    }

    const result = await orchestrator.triggerCycle(accountId);
    return { success: true, data: result };
  });

  // Get Agent Decisions
  app.get('/accounts/:accountId/agent/decisions', async (request: any, reply) => {
    const { accountId } = request.params;
    const { id: userId } = request.user;

    const accounts = await sql`SELECT id FROM social_accounts WHERE id = ${accountId} AND user_id = ${userId}`;
    if (accounts.length === 0) return reply.status(404).send({ error: 'Account not found' });

    const decisions = await sql`
      SELECT ad.*, ar.started_at, ar.run_type
      FROM agent_decisions ad
      JOIN agent_runs ar ON ad.agent_run_id = ar.id
      WHERE ar.social_account_id = ${accountId}
      ORDER BY ad.created_at DESC
      LIMIT 50
    `;

    return { decisions };
  });

  // Get Agent Runs for an account
  app.get('/accounts/:accountId/agent/runs', async (request: any, reply) => {
    const { accountId } = request.params;
    const runs = await sql`
      SELECT * FROM agent_runs 
      WHERE social_account_id = ${accountId}
      ORDER BY created_at DESC LIMIT 20
    `;
    return { runs };
  });

  // Get specific Agent Run
  app.get('/agent/runs/:id', async (request: any, reply) => {
    const { id } = request.params;
    const run = await sql`SELECT * FROM agent_runs WHERE id = ${id}`;
    if (!run.length) return reply.status(404).send({ error: 'Run not found' });
    return { run: run[0] };
  });

  // Get Steps for a run
  app.get('/agent/runs/:id/steps', async (request: any, reply) => {
    const { id } = request.params;
    const steps = await sql`
      SELECT * FROM agent_steps 
      WHERE agent_run_id = ${id}
      ORDER BY created_at ASC
    `;
    return { steps };
  });

  // Get Events for a run (Activity Log)
  app.get('/agent/runs/:id/events', async (request: any, reply) => {
    const { id } = request.params;
    const events = await sql`
      SELECT * FROM agent_events 
      WHERE agent_run_id = ${id}
      ORDER BY created_at DESC
      LIMIT 100
    `;
    return { events };
  });

  // Manual Retry for a step
  app.post('/agent/steps/:id/retry', async (request: any, reply) => {
    const { id } = request.params;
    // In a full implementation, this would look up the step's queue and enqueue a new job
    // for this scaffold, we just mark it as queued
    await sql`UPDATE agent_steps SET status = 'queued', attempt_number = attempt_number + 1 WHERE id = ${id}`;
    
    // We would also push to BullMQ here:
    // await queues[stepType].add(...)
    
    return { success: true, message: 'Step retry queued' };
  });

  // Pause a run
  app.post('/agent/runs/:id/pause', async (request: any, reply) => {
    const { id } = request.params;
    await sql`UPDATE agent_runs SET status = 'paused' WHERE id = ${id}`;
    return { success: true };
  });

  // Resume a run
  app.post('/agent/runs/:id/resume', async (request: any, reply) => {
    const { id } = request.params;
    await sql`UPDATE agent_runs SET status = 'running' WHERE id = ${id}`;
    return { success: true };
  });

  // Cancel a run
  app.post('/agent/runs/:id/cancel', async (request: any, reply) => {
    const { id } = request.params;
    await sql`UPDATE agent_runs SET status = 'cancelled' WHERE id = ${id}`;
    return { success: true };
  });

  // ── SSE stream: real-time agent events ──────────────────────────────────────
  // GET /api/agent/runs/:id/stream?lastEventId=<uuid>
  // Streams agent_events as Server-Sent Events.  Supports reconnect gap-fill
  // via the `lastEventId` query param (picks up from that event's created_at).
  app.get('/agent/runs/:id/stream', async (request: any, reply) => {
    const { id: runId } = request.params;
    const lastEventId = (request.query as any).lastEventId as string | undefined;

    // Verify the run belongs to the authenticated user
    const { id: userId } = request.user;
    const runRows = await sql`
      SELECT ar.id FROM agent_runs ar
      JOIN social_accounts sa ON ar.social_account_id = sa.id
      WHERE ar.id = ${runId} AND sa.user_id = ${userId}
    `;
    if (!runRows.length) {
      return reply.status(404).send({ error: 'Run not found' });
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Determine starting cursor
    let afterCreatedAt: Date | null = null;
    if (lastEventId) {
      const pivot = await sql`SELECT created_at FROM agent_events WHERE id = ${lastEventId}`;
      if (pivot.length) afterCreatedAt = new Date(pivot[0].createdAt as string);
    }

    // Poll DB every 2 seconds and stream new events
    const intervalMs = 2000;
    let pingCount = 0;
    const interval = setInterval(async () => {
      try {
        let newEvents;
        if (afterCreatedAt) {
          newEvents = await sql`
            SELECT id, agent_run_id, agent_step_id, event_type, level, message, metadata, created_at
            FROM agent_events
            WHERE agent_run_id = ${runId} AND created_at > ${afterCreatedAt.toISOString()}
            ORDER BY created_at ASC
            LIMIT 50
          `;
        } else {
          newEvents = await sql`
            SELECT id, agent_run_id, agent_step_id, event_type, level, message, metadata, created_at
            FROM agent_events
            WHERE agent_run_id = ${runId}
            ORDER BY created_at ASC
            LIMIT 100
          `;
          afterCreatedAt = new Date(); // only new events from this point
        }

        for (const evt of newEvents) {
          send('agent.event', {
            id: evt.id,
            runId: evt.agentRunId,
            stepId: evt.agentStepId,
            eventType: evt.eventType,
            level: evt.level,
            message: evt.message,
            metadata: evt.metadata,
            createdAt: evt.createdAt,
          });
          afterCreatedAt = new Date(evt.createdAt as string);
        }

        // Send a ping every ~10 seconds to keep connection alive
        if (++pingCount % 5 === 0) {
          reply.raw.write(': ping\n\n');
        }

        // Stop streaming when run reaches a terminal state
        const runState = await sql`SELECT status FROM agent_runs WHERE id = ${runId}`;
        const status = runState[0]?.status as string;
        if (['completed', 'failed', 'cancelled'].includes(status)) {
          send('agent.completed', { status });
          clearInterval(interval);
          reply.raw.end();
        }
      } catch {
        // Silently continue — DB hiccup should not kill the stream
      }
    }, intervalMs);

    // Clean up when the client disconnects
    request.raw.on('close', () => {
      clearInterval(interval);
    });

    // Keep the handler open (SSE)
    await new Promise(() => {});
  });
}
