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
    const accountMetrics = metrics[0] || { followers: 0, reach: 0, profileVisits: 0, impressions: 0 };

    // Fetch active goal
    const goals = await sql`SELECT * FROM admin_goals WHERE social_account_id = ${accountId} AND is_active = true LIMIT 1`;
    const goal = goals[0] || null;
    
    // Fetch upcoming posts
    const upcomingPosts = await sql`SELECT * FROM posts WHERE social_account_id = ${accountId} AND status = 'scheduled' ORDER BY scheduled_at ASC LIMIT 5`;

    // Fetch metric history for chart
    const metricsHistory = await sql`SELECT followers, reach, impressions, profile_visits, captured_at FROM account_metrics WHERE social_account_id = ${accountId} ORDER BY captured_at ASC LIMIT 7`;

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

    const runs = await sql`SELECT run_type, status, started_at FROM agent_runs WHERE social_account_id = ${accountId} ORDER BY started_at DESC LIMIT 1`;
    const r = runs[0];
    const activeRun = r?.status === 'running' ? r : null;
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
    const scheduledJobs = await sql`SELECT id, job_type, status, scheduled_for FROM scheduled_jobs ORDER BY scheduled_for ASC LIMIT 5`;

    // Fetch recent errors from agent_runs
    const recentErrorsRaw = await sql`
      SELECT error, started_at as timestamp 
      FROM agent_runs 
      WHERE social_account_id = ${accountId} AND error IS NOT NULL 
      ORDER BY started_at DESC 
      LIMIT 5
    `;
    const recentErrors = recentErrorsRaw.map(e => {
      let msg = 'Unknown error';
      if (typeof e.error === 'string') {
        try {
          const parsed = JSON.parse(e.error);
          msg = parsed.message || e.error;
        } catch {
          msg = e.error;
        }
      } else if (e.error && typeof e.error === 'object') {
        msg = e.error.message || JSON.stringify(e.error);
      }
      return {
        message: msg,
        timestamp: e.timestamp
      };
    });

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

    const strategiesRaw = await sql`
      SELECT * FROM strategy_versions 
      WHERE social_account_id = ${accountId} 
      ORDER BY version_number DESC 
    `;
    const history = strategiesRaw.map(s => {
      const parseJson = (val: any) => typeof val === 'string' ? JSON.parse(val) : val;
      return {
        ...s,
        objective: parseJson(s.objective),
        contentMix: parseJson(s.contentMix),
        cadence: parseJson(s.cadence),
        experimentPlan: parseJson(s.experimentPlan),
        evidenceIds: parseJson(s.evidenceIds)
      };
    });
    const active = history.find(s => s.status === 'active') || history[0] || null;

    const insights = await sql`SELECT * FROM strategic_insights WHERE social_account_id = ${accountId} ORDER BY created_at DESC LIMIT 10`;

    const experiments = await sql`SELECT * FROM experiments WHERE social_account_id = ${accountId} ORDER BY created_at DESC LIMIT 10`;

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
