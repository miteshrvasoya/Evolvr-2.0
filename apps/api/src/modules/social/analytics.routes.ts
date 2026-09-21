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
    
    const account = accounts[0]!;
    const accessToken = decryptToken(account.accessTokenEncrypted);

    try {
      const insights = await igAdapter.getAccountInsights(accessToken, (account as any).platformAccountId);
      const profile = await igAdapter.getAccountProfile(accessToken, (account as any).platformAccountId);

      const result = await sql`
        INSERT INTO account_metrics (
          social_account_id, followers, following,
          reach, impressions, profile_visits,
          views, accounts_engaged, likes, comments, shares,
          saves, replies, reposts, total_interactions,
          profile_links_taps, follows, unfollows,
          raw_metrics
        ) VALUES (
          ${accountId},
          ${(profile as any).followers || 0},
          ${(profile as any).following || 0},
          ${(insights as any).reach || 0},
          ${(insights as any).views || 0},
          ${(insights as any).profile_links_taps || 0},
          ${(insights as any).views || 0},
          ${(insights as any).accounts_engaged || 0},
          ${(insights as any).likes || 0},
          ${(insights as any).comments || 0},
          ${(insights as any).shares || 0},
          ${(insights as any).saves || 0},
          ${(insights as any).replies || 0},
          ${(insights as any).reposts || 0},
          ${(insights as any).total_interactions || 0},
          ${(insights as any).profile_links_taps || 0},
          ${(insights as any).follows || 0},
          ${(insights as any).unfollows || 0},
          ${sql.json(insights as any)}
        ) RETURNING *
      `;

      return { success: true, metrics: result[0] };
    } catch (error: any) {
      app.log.error(error, 'Failed to sync analytics');
      return reply.status(500).send({ error: 'Failed to sync analytics', message: error.message });
    }
  });

  app.get('/analytics', async (request: any, reply) => {
    const { range } = request.query as { range?: string };
    const { id: userId } = request.user;
    
    // Get Account
    const accounts = await sql`
      SELECT id FROM social_accounts WHERE user_id = ${userId} LIMIT 1
    `;
    if (accounts.length === 0) {
      return {
        success: true,
        data: {
          accountHistory: [],
          topPosts: [],
          formatPerformance: [],
          pillarPerformance: [],
          timeWindowPerformance: []
        }
      };
    }
    const accountId = accounts[0]?.id;
    
    // Determine date limit
    let days = 30;
    if (range === '7d') days = 7;
    else if (range === '90d') days = 90;
    
    // accountHistory
    const accountHistory = await sql`
      SELECT * FROM account_metrics 
      WHERE social_account_id = ${accountId} 
      AND captured_at >= NOW() - interval '1 day' * ${days}
      ORDER BY captured_at ASC
    `;
    
    // topPosts
    const topPostsRaw = await sql`
      SELECT p.*, row_to_json(pm.*) as metrics
      FROM posts p
      LEFT JOIN post_metrics pm ON p.id = pm.post_id
      WHERE p.social_account_id = ${accountId}
      AND p.status = 'published'
      ORDER BY pm.reach DESC NULLS LAST
      LIMIT 5
    `;
    
    const topPosts = topPostsRaw.map(p => {
      const { metrics, ...postData } = p;
      return { ...postData, metrics };
    });
    
    // Format Performance
    const formatPerformance = await sql`
      SELECT 
        p.media_type as format,
        AVG(pm.engagement_rate) as avg_engagement_rate,
        AVG(pm.reach) as avg_reach,
        COUNT(p.id)::int as count
      FROM posts p
      JOIN post_metrics pm ON p.id = pm.post_id
      WHERE p.social_account_id = ${accountId}
      GROUP BY p.media_type
    `;
    
    // Pillar Performance
    const pillarPerformance = await sql`
      SELECT 
        ci.pillar,
        AVG(pm.reach) as avg_reach,
        AVG(pm.engagement_rate) as avg_engagement_rate,
        COUNT(p.id)::int as count
      FROM posts p
      JOIN post_metrics pm ON p.id = pm.post_id
      JOIN content_ideas ci ON p.content_idea_id = ci.id
      WHERE p.social_account_id = ${accountId}
      GROUP BY ci.pillar
    `;
    
    // Time Window Performance
    const timeWindowPerformance = await sql`
      SELECT 
        EXTRACT(HOUR FROM p.published_at) as hour,
        AVG(pm.engagement_rate) as avg_engagement_rate,
        COUNT(p.id)::int as count
      FROM posts p
      JOIN post_metrics pm ON p.id = pm.post_id
      WHERE p.social_account_id = ${accountId}
      AND p.published_at IS NOT NULL
      GROUP BY EXTRACT(HOUR FROM p.published_at)
    `;
    
    return {
      success: true,
      data: {
        accountHistory,
        topPosts,
        formatPerformance,
        pillarPerformance,
        timeWindowPerformance
      }
    };
  });
}
