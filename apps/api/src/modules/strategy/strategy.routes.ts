import { FastifyInstance } from 'fastify';
import { sql } from '../../db/client.js';

export default async function strategyRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  async function getPrimaryAccount(userId: string) {
    const accounts = await sql`SELECT id FROM social_accounts WHERE user_id = ${userId} LIMIT 1`;
    return accounts[0]?.id;
  }

  app.get('/strategy', async (request: any, reply) => {
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);

    if (!accountId) {
      return { success: true, data: { active: null, history: [], insights: [], experiments: [] } };
    }

    const strategies = await sql`
      SELECT * FROM strategy_versions 
      WHERE social_account_id = ${accountId}
      ORDER BY version_number DESC
    `;
    
    const active = strategies.find(s => s.status === 'active') || strategies[0] || null;
    const history = strategies.filter(s => s.id !== active?.id);

    const insights = await sql`
      SELECT * FROM strategic_insights 
      WHERE social_account_id = ${accountId}
      ORDER BY created_at DESC
    `;

    const experiments = await sql`
      SELECT * FROM experiments 
      WHERE social_account_id = ${accountId}
      ORDER BY created_at DESC
    `;

    return {
      success: true,
      data: {
        active,
        history,
        insights,
        experiments
      }
    };
  });
}
