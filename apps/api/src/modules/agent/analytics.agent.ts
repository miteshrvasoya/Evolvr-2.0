import { sql } from '../../db/client.js';
import { AgentRunTracker } from './agent-tracker.js';

export class AnalyticsAgent {
  async runAnalytics(socialAccountId: string, agentRunId: string, attemptNumber: number, maxAttempts: number) {
    const tracker = new AgentRunTracker(agentRunId);
    const stepId = await tracker.startStep('performance_analysis', attemptNumber, maxAttempts);

    try {
      await tracker.addLog(`Analyzing performance for account ${socialAccountId}`);

      // Calculate baselines (last 30 days vs previous 30 days, or just rolling 30 days)
      const baselines = await sql`
        WITH recent_metrics AS (
          SELECT p.id,
                 p.media_type,
                 p.source,
                 MAX(pm.reach) as max_reach,
                 MAX(pm.likes + pm.comments + pm.shares + pm.saves) as max_engagement,
                 MAX(pm.saves) as max_saves,
                 MAX(pm.shares) as max_shares
          FROM posts p
          JOIN post_metrics pm ON p.id = pm.post_id
          WHERE p.social_account_id = ${socialAccountId}
            AND p.status = 'published'
            AND p.published_at > NOW() - INTERVAL '30 days'
          GROUP BY p.id, p.media_type, p.source
        )
        SELECT 
          PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY max_reach) as median_reach,
          PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY max_engagement) as median_engagement,
          PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY max_saves) as median_saves,
          PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY max_shares) as median_shares,
          COUNT(*) as post_count
        FROM recent_metrics
      `;

      const baseline = baselines[0] || { median_reach: 0, median_engagement: 0, median_saves: 0, median_shares: 0, post_count: 0 };

      await tracker.addLog(`Calculated baselines across ${baseline.post_count} recent posts: Median Reach: ${baseline.median_reach}, Median Engagement: ${baseline.median_engagement}`);

      // We don't necessarily need to save this to a table if we pass it directly, 
      // but to keep it durable we can just log it and the Learning agent can fetch the same baselines.
      // For now, completing the analytics step means the data is ready for learning.

      await tracker.completeStep(stepId, { 
        baselines: {
          reach: baseline.median_reach,
          engagement: baseline.median_engagement,
          saves: baseline.median_saves,
          shares: baseline.median_shares
        } 
      });

      return { success: true, baselines };
    } catch (error: any) {
      await tracker.failStep(stepId, error.message, true, new Date(Date.now() + 5000));
      throw { error, stepId };
    }
  }
}
