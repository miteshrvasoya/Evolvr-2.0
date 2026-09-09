import { FastifyInstance } from 'fastify';
import { sql } from '../../db/client.js';

export default async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // Helper to get the primary account for the user
  async function getPrimaryAccount(userId: string) {
    const accounts = await sql`SELECT id FROM social_accounts WHERE user_id = ${userId} LIMIT 1`;
    return accounts[0]?.id;
  }

  app.get('/dashboard/overview', async (request: any, reply) => {
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);
    
    if (!accountId) {
      return { 
        success: true, 
        data: { 
          accountMetrics: { followers: 0, reach: 0, profileVisits: 0, impressions: 0 },
          goal: null,
          upcomingPosts: [],
          metricsHistory: []
        } 
      };
    }

    // Fetch latest metrics
    const metrics = await sql`SELECT followers, reach, impressions, profile_visits FROM account_metrics WHERE social_account_id = ${accountId} ORDER BY captured_at DESC LIMIT 1`;
    const am = metrics[0];
    const accountMetrics = am ? {
      followers: am.followers,
      reach: am.reach,
      impressions: am.impressions,
      profileVisits: am.profile_visits
    } : { followers: 0, reach: 0, profileVisits: 0, impressions: 0 };

    // Fetch active goal
    const goals = await sql`SELECT * FROM admin_goals WHERE social_account_id = ${accountId} AND is_active = true LIMIT 1`;
    const g = goals[0];
    const goal = g ? {
      ...g,
      goalType: g.goal_type,
      primaryMetric: g.primary_metric,
      secondaryMetrics: g.secondary_metrics,
      businessOutcome: g.business_outcome,
      autonomyLevel: g.autonomy_level
    } : null;
    
    // Fetch upcoming posts
    const upcomingPostsRaw = await sql`SELECT * FROM posts WHERE social_account_id = ${accountId} AND status = 'scheduled' ORDER BY scheduled_at ASC LIMIT 5`;
    const upcomingPosts = upcomingPostsRaw.map(p => ({
      ...p,
      socialAccountId: p.social_account_id,
      mediaType: p.media_type,
      scheduledAt: p.scheduled_at,
      publishedAt: p.published_at,
      agentRunId: p.agent_run_id
    }));

    // Fetch metric history for chart
    const metricsHistoryRaw = await sql`SELECT followers, reach, impressions, profile_visits, captured_at FROM account_metrics WHERE social_account_id = ${accountId} ORDER BY captured_at ASC LIMIT 7`;
    const metricsHistory = metricsHistoryRaw.map(m => ({
      followers: m.followers,
      reach: m.reach,
      impressions: m.impressions,
      profileVisits: m.profile_visits,
      capturedAt: m.captured_at
    }));

    return {
      success: true,
      data: {
        accountMetrics,
        goal,
        upcomingPosts,
        metricsHistory
      }
    };
  });

  app.get('/agent/status', async (request: any, reply) => {
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);

    if (!accountId) {
      return { success: true, data: { state: 'idle', recentDecisions: [] } };
    }

    const runs = await sql`SELECT run_type, status FROM agent_runs WHERE social_account_id = ${accountId} ORDER BY started_at DESC LIMIT 1`;
    const activeRun = runs[0]?.status === 'running' ? runs[0] : null;
    const state = activeRun ? 'running' : 'idle';

    const recentDecisions = await sql`
      SELECT ad.*, ar.started_at, ar.run_type
      FROM agent_decisions ad
      JOIN agent_runs ar ON ad.agent_run_id = ar.id
      WHERE ar.social_account_id = ${accountId}
      ORDER BY ad.created_at DESC
      LIMIT 10
    `;

    // Fetch scheduled jobs
    const scheduledJobsRaw = await sql`SELECT id, job_type, status, scheduled_for FROM scheduled_jobs ORDER BY scheduled_for ASC LIMIT 5`;
    const scheduledJobs = scheduledJobsRaw.map(j => ({
      id: j.id,
      jobType: j.job_type,
      status: j.status,
      scheduledFor: j.scheduled_for
    }));

    // Fetch recent errors from agent_runs
    const recentErrorsRaw = await sql`
      SELECT error->>'message' as message, started_at as timestamp 
      FROM agent_runs 
      WHERE social_account_id = ${accountId} AND error IS NOT NULL 
      ORDER BY started_at DESC 
      LIMIT 5
    `;
    const recentErrors = recentErrorsRaw.map(e => ({
      message: e.message || 'Unknown error',
      timestamp: e.timestamp
    }));

    return {
      success: true,
      data: {
        state,
        currentRun: activeRun,
        recentDecisions,
        scheduledJobs,
        recentErrors
      }
    };
  });

  app.get('/notifications', async (request: any, reply) => {
    const { id: userId } = request.user;
    const notifications = await sql`
      SELECT * FROM notifications 
      WHERE user_id = ${userId} 
      ORDER BY created_at DESC 
      LIMIT 20
    `;
    
    return {
      success: true,
      data: notifications
    };
  });

  app.get('/strategy', async (request: any, reply) => {
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);

    if (!accountId) {
      return { success: true, data: null };
    }

    const strategies = await sql`
      SELECT * FROM strategy_versions 
      WHERE social_account_id = ${accountId} 
      ORDER BY version_number DESC 
      LIMIT 1
    `;

    return {
      success: true,
      data: strategies[0] || null
    };
  });
}
