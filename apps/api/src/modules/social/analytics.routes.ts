import { FastifyInstance } from 'fastify';
import { sql } from '../../db/client.js';
import { getInstagramAdapter } from './adapters/index.js';
import { decryptToken } from '../common/encryption.js';

export default async function analyticsRoutes(app: FastifyInstance) {
  const igAdapter = getInstagramAdapter();

  app.addHook('onRequest', app.authenticate);

  // Trigger manual account metrics ingestion
  app.post('/accounts/:accountId/analytics/sync', async (request: any, reply) => {
    const { accountId } = request.params;
    const { id: userId } = request.user;

    // Get Account
    const accounts = await sql`
      SELECT id, platform_account_id, access_token_encrypted 
      FROM social_accounts 
      WHERE id = ${accountId} AND user_id = ${userId}
    `;
    
    if (accounts.length === 0) {
      return reply.status(404).send({ error: 'Account not found' });
    }
    
    const account = accounts[0];
    const accessToken = decryptToken(account.accessTokenEncrypted);

    try {
      // 1. Fetch Account Level Insights
      const insights = await igAdapter.getAccountInsights(accessToken, account.platformAccountId);
      
      // Also get current followers
      const profile = await igAdapter.getAccountProfile(accessToken, account.platformAccountId);

      // 2. Insert into account_metrics
      const result = await sql`
        INSERT INTO account_metrics (
          social_account_id, followers, reach, impressions, profile_visits, raw_metrics
        ) VALUES (
          ${accountId}, ${profile.followers}, ${insights.reach}, ${insights.impressions}, ${insights.profile_visits}, ${insights}
        ) RETURNING *
      `;

      return { success: true, metrics: result[0] };
    } catch (error: any) {
      app.log.error(error, 'Failed to sync analytics');
      return reply.status(500).send({ error: 'Failed to sync analytics', message: error.message });
    }
  });
}
