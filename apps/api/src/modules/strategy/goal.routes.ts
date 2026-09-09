import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql } from '../../db/client.js';

const goalSchema = z.object({
  goalType: z.string(),
  primaryMetric: z.string(),
  secondaryMetrics: z.any().default([]),
  target: z.number(),
  deadline: z.string().optional(),
  audience: z.string().optional(),
  businessOutcome: z.string().optional(),
  autonomyLevel: z.enum(['manual', 'supervised', 'autonomous']).default('supervised'),
  constraints: z.any().default({}),
  isActive: z.boolean().default(true),
});

export default async function goalRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // Get active goal for account
  app.get('/accounts/:accountId/goals/active', async (request: any, reply) => {
    const { accountId } = request.params;
    const { id: userId } = request.user;

    const accounts = await sql`SELECT id FROM social_accounts WHERE id = ${accountId} AND user_id = ${userId}`;
    if (accounts.length === 0) return reply.status(404).send({ error: 'Account not found' });

    const goals = await sql`SELECT * FROM admin_goals WHERE social_account_id = ${accountId} AND is_active = true ORDER BY created_at DESC LIMIT 1`;
    return { goal: goals[0] || null };
  });

  // Create new goal (deactivates previous)
  app.post('/accounts/:accountId/goals', async (request: any, reply) => {
    const { accountId } = request.params;
    const { id: userId } = request.user;

    const accounts = await sql`SELECT id FROM social_accounts WHERE id = ${accountId} AND user_id = ${userId}`;
    if (accounts.length === 0) return reply.status(404).send({ error: 'Account not found' });

    const parseResult = goalSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Bad Request', issues: parseResult.error.issues });
    }

    const g = parseResult.data;

    const result = await sql.begin(async (sql) => {
      // Deactivate old goals
      await sql`UPDATE admin_goals SET is_active = false WHERE social_account_id = ${accountId}`;
      
      // Insert new goal
      const newGoal = await sql`
        INSERT INTO admin_goals (
          social_account_id, goal_type, primary_metric, secondary_metrics, target, deadline,
          audience, business_outcome, autonomy_level, constraints, is_active
        ) VALUES (
          ${accountId}, ${g.goalType}, ${g.primaryMetric}, ${g.secondaryMetrics}, ${g.target}, ${g.deadline || null},
          ${g.audience || null}, ${g.businessOutcome || null}, ${g.autonomyLevel}, ${g.constraints}, ${g.isActive}
        ) RETURNING *
      `;
      return newGoal[0];
    });

    return { goal: result };
  });
}
