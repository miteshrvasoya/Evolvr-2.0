import { FastifyInstance } from 'fastify';
import { sql } from '../../db/client.js';
import { OrchestratorAgent } from './orchestrator.js';

export default async function agentRoutes(app: FastifyInstance) {
  const orchestrator = new OrchestratorAgent();

  app.addHook('onRequest', app.authenticate);

  // Trigger manual daily cycle (for admin dashboard 'Run Now' button)
  app.post('/accounts/:accountId/agent/trigger', async (request: any, reply) => {
    const { accountId } = request.params;
    const { id: userId } = request.user;

    // Verify ownership
    const accounts = await sql`SELECT id FROM social_accounts WHERE id = ${accountId} AND user_id = ${userId}`;
    if (accounts.length === 0) return reply.status(404).send({ error: 'Account not found' });

    // Run async so we don't block the request if it takes long, or await if we want immediate feedback
    // We will await for the scaffold so UI gets immediate feedback
    const result = await orchestrator.runDailyCycle(accountId);

    return { success: true, result };
  });

  // Get Agent Decisions (for the Thinking Page)
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
}
