import { FastifyInstance } from 'fastify';
import { sql } from '../../db/client.js';
import { getInstagramAdapter } from '../social/adapters/index.js';
import { decryptToken } from '../common/encryption.js';

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
    const metrics = await sql`SELECT * FROM account_metrics WHERE social_account_id = ${accountId} ORDER BY captured_at DESC LIMIT 1`;
    let accountMetrics = metrics[0] || { followers: 0, reach: 0, profile_visits: 0, impressions: 0 };
    
    // Auto-sync if no metrics or older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (!metrics[0] || new Date(metrics[0].captured_at) < oneHourAgo) {
      try {
        const accounts = await sql`SELECT platform_account_id, access_token_encrypted FROM social_accounts WHERE id = ${accountId}`;
        if (accounts.length > 0 && accounts[0] && accounts[0].accessTokenEncrypted) {
          const acc = accounts[0];
          const accessToken = decryptToken(acc.accessTokenEncrypted);
          const igAdapter = getInstagramAdapter();
          const insights = await igAdapter.getAccountInsights(accessToken, acc.platformAccountId);
          const profile = await igAdapter.getAccountProfile(accessToken, acc.platformAccountId);
          
          const result = await sql`
            INSERT INTO account_metrics (
              social_account_id, followers, following, reach, impressions, profile_visits, raw_metrics
            ) VALUES (
              ${accountId}, ${profile.followers || 0}, ${profile.following || 0}, ${insights.reach || 0}, ${insights.impressions || 0}, ${insights.profile_views || 0}, ${sql.json(insights)}
            ) RETURNING *
          `;
          accountMetrics = result[0] || accountMetrics;
        }
      } catch (err) {
        app.log.error(err, 'Failed to auto-sync account metrics on dashboard load');
      }
    }

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
        accountId,
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
      return { success: true, data: { state: 'IDLE', recentDecisions: [], scheduledJobs: [], recentErrors: [], recentApiLogs: [], currentStep: null, nextAction: null, upcomingActions: [] } };
    }

    // Get most recent run (not just last 1 — also check currently running)
    const runs = await sql`
      SELECT id, run_type, status, current_step, started_at, completed_at,
             last_activity_at, last_heartbeat_at, error_code, error_message, retry_count
      FROM agent_runs
      WHERE social_account_id = ${accountId}
      ORDER BY started_at DESC LIMIT 1
    `;
    const r = runs[0];

    let activeRun = null;
    let currentStep: any = null;

    if (r) {
      const stepsRaw = await sql`
        SELECT id, step_type, status, attempt_number, max_attempts,
               started_at, completed_at, error_message, retryable, next_retry_at
        FROM agent_steps
        WHERE agent_run_id = ${r.id}
        ORDER BY created_at ASC
      `;

      const events = await sql`
        SELECT id, agent_step_id, event_type, level, message, metadata, created_at
        FROM agent_events
        WHERE agent_run_id = ${r.id}
        ORDER BY created_at ASC
      `;

      const steps = stepsRaw.map((step: any) => ({
        id: step.id,
        step: step.stepType,
        status: step.status,
        attemptNumber: step.attemptNumber,
        maxAttempts: step.maxAttempts,
        timestamp: step.startedAt,
        completedAt: step.completedAt,
        error: step.errorMessage,
        retryable: step.retryable,
        nextRetryAt: step.nextRetryAt,
        logs: events.filter((e: any) => e.agentStepId === step.id).map((e: any) => e.message),
      }));

      // Derive the current active step
      const running = stepsRaw.find((s: any) => s.status === 'running');
      const retrying = stepsRaw.find((s: any) => s.status === 'retrying');
      const activeStep = running ?? retrying ?? stepsRaw[stepsRaw.length - 1] ?? null;

      if (activeStep) {
        const elapsedMs = activeStep.startedAt
          ? Date.now() - new Date(activeStep.startedAt).getTime()
          : 0;
        currentStep = {
          stepType: activeStep.stepType,
          status: activeStep.status,
          attemptNumber: activeStep.attemptNumber,
          maxAttempts: activeStep.maxAttempts,
          startedAt: activeStep.startedAt,
          errorMessage: activeStep.errorMessage,
          retryable: activeStep.retryable,
          nextRetryAt: activeStep.nextRetryAt,
          elapsedSeconds: Math.floor(elapsedMs / 1000),
        };
      }

      activeRun = {
        id: r.id,
        runType: r.runType,
        status: r.status,
        currentStep: r.currentStep,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        lastActivityAt: r.lastActivityAt,
        lastHeartbeatAt: r.lastHeartbeatAt,
        errorMessage: r.errorMessage,
        retryCount: r.retryCount,
        progress: steps,
      };
    }

    // Derive semantic state from run status
    const runStatus = r?.status ?? 'IDLE';
    const state: string = (() => {
      if (!r) return 'IDLE';
      switch (runStatus) {
        case 'running':    return 'RUNNING';
        case 'waiting':    return 'WAITING';
        case 'paused':     return 'PAUSED';
        case 'retrying':   return 'RETRYING';
        case 'blocked':    return 'BLOCKED';
        case 'failed':     return 'FAILED';
        case 'completed':  return 'COMPLETED';
        case 'cancelled':  return 'CANCELLED';
        case 'queued':     return 'QUEUED';
        default:           return 'IDLE';
      }
    })();

    const recentDecisions = await sql`
      SELECT ad.*, ar.started_at, ar.run_type
      FROM agent_decisions ad
      JOIN agent_runs ar ON ad.agent_run_id = ar.id
      WHERE ar.social_account_id = ${accountId}
      ORDER BY ad.created_at DESC
      LIMIT 10
    `;

    // Scheduled jobs — use for upcoming + next action
    const upcomingJobsRaw = await sql`
      SELECT id, job_type, status, scheduled_for
      FROM scheduled_jobs
      WHERE status IN ('pending', 'running')
      ORDER BY scheduled_for ASC
      LIMIT 6
    `;

    const nextAction = upcomingJobsRaw[0]
      ? { jobType: upcomingJobsRaw[0].jobType, scheduledFor: upcomingJobsRaw[0].scheduledFor, status: upcomingJobsRaw[0].status }
      : null;
    const upcomingActions = upcomingJobsRaw.slice(0, 5).map((j: any) => ({
      id: j.id, jobType: j.jobType, scheduledFor: j.scheduledFor, status: j.status,
    }));

    // Legacy scheduledJobs (same data, kept for backward compat)
    const scheduledJobs = upcomingJobsRaw;

    // Recent errors
    const recentErrorsRaw = await sql`
      SELECT error_message, started_at as timestamp
      FROM agent_runs
      WHERE social_account_id = ${accountId} AND error_message IS NOT NULL
      ORDER BY started_at DESC
      LIMIT 5
    `;
    const recentErrors = recentErrorsRaw.map((e: any) => {
      let msg = 'Unknown error';
      if (typeof e.errorMessage === 'string') {
        try { msg = JSON.parse(e.errorMessage)?.message ?? e.errorMessage; } catch { msg = e.errorMessage; }
      } else if (e.errorMessage && typeof e.errorMessage === 'object') {
        msg = (e.errorMessage as any).message ?? JSON.stringify(e.errorMessage);
      }
      return { message: msg, timestamp: e.timestamp };
    });

    // Recent outward API logs
    const recentApiLogs = await sql`
      SELECT method, url, status_code, latency_ms, created_at
      FROM api_logs
      WHERE direction = 'outward'
      ORDER BY created_at DESC
      LIMIT 20
    `;

    return {
      success: true,
      data: {
        state,
        currentRun: activeRun,
        currentStep,
        nextAction,
        upcomingActions,
        recentDecisions,
        scheduledJobs,
        recentErrors,
        recentApiLogs,
        lastUpdated: new Date().toISOString(),
      },
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
    const active = history.find((s: any) => s.status === 'active') || history[0] || null;

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
