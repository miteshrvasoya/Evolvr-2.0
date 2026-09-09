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
  noPolitics: z.boolean().optional(),
  noControversialContent: z.boolean().optional()
});

export default async function settingsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  async function getPrimaryAccount(userId: string) {
    const accounts = await sql`SELECT id FROM social_accounts WHERE user_id = ${userId} LIMIT 1`;
    return accounts[0]?.id;
  }

  app.post('/settings/goal', async (request: any, reply) => {
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);

    if (!accountId) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'No primary account found' } });
    }

    const parseResult = goalSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid data' } });
    }

    const g = parseResult.data;

    const result = await sql.begin(async (sql) => {
      // Deactivate old goals
      await sql`UPDATE admin_goals SET is_active = false WHERE social_account_id = ${accountId}`;
      
      const constraints = {
        noPolitics: g.noPolitics,
        noControversialContent: g.noControversialContent,
        ...g.constraints
      };

      // Insert new goal
      const newGoal = await sql`
        INSERT INTO admin_goals (
          social_account_id, goal_type, primary_metric, secondary_metrics, target, deadline,
          audience, business_outcome, autonomy_level, constraints, is_active
        ) VALUES (
          ${accountId}, ${g.goalType}, ${g.primaryMetric}, ${g.secondaryMetrics}, ${g.target}, ${g.deadline || null},
          ${g.audience || null}, ${g.businessOutcome || null}, ${g.autonomyLevel}, ${constraints}, ${g.isActive}
        ) RETURNING *
      `;
      return newGoal[0];
    });

    return { success: true, data: result };
  });

  app.post('/settings/llm/test', async (request, reply) => {
    return { success: true, data: { status: 'ok' } };
  });

  app.post('/settings/llm', async (request, reply) => {
    return { success: true, data: { status: 'ok' } };
  });

  app.patch('/settings/profile', async (request, reply) => {
    return { success: true, data: { status: 'ok' } };
  });
}
