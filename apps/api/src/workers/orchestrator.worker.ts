import { Worker, Job } from 'bullmq';
import { redisConnection, queues } from '../queues/index.js';
import { sql } from '../db/client.js';
import { AgentRunTracker } from '../modules/agent/agent-tracker.js';
import { SchedulingService } from '../modules/scheduling/scheduling.service.js';
import { SchedulingAgent } from '../modules/scheduling/scheduling.agent.js';

const schedulingService = new SchedulingService();
const schedulingAgent   = new SchedulingAgent();

export const createOrchestratorWorker = () => {
  const worker = new Worker('orchestrator', async (job: Job) => {
    const { socialAccountId, agentRunId, goalId } = job.data;
    const tracker = new AgentRunTracker(agentRunId);

    // Mark the agent run as running if it was queued
    await sql`UPDATE agent_runs SET status = 'running' WHERE id = ${agentRunId} AND status = 'queued'`;

    const stepId = await tracker.startStep('evaluate_next_action', job.attemptsMade, job.opts.attempts || 5);

    try {
      console.log(`[OrchestratorWorker] Evaluating next action for account ${socialAccountId}`);

      // ── Pre-Phase: Goal Health ────────────────────────────────────────────
      const goals = await sql`
        SELECT status, autonomy_level FROM admin_goals 
        WHERE id = ${goalId} AND social_account_id = ${socialAccountId}
      `;
      if (goals.length === 0 || goals[0].status !== 'ACTIVE') {
        await tracker.addLog(`Goal is not ACTIVE. Current status: ${goals[0]?.status}. Stopping orchestrator.`);
        await tracker.completeStep(stepId, { action: 'none' });
        await sql`UPDATE agent_runs SET status = 'completed', completed_at = NOW() WHERE id = ${agentRunId}`;
        return { action: 'none' };
      }
      const autonomyLevel = goals[0].autonomy_level;

      // ── Phase 1: SYNC ─────────────────────────────────────────────────────
      // Has Instagram been synced recently? (e.g. in the last 12 hours)
      const recentSyncs = await sql`
        SELECT id FROM instagram_sync_runs 
        WHERE social_account_id = ${socialAccountId}
          AND status = 'COMPLETED'
          AND completed_at > NOW() - INTERVAL '12 hours'
        ORDER BY completed_at DESC LIMIT 1
      `;
      
      const failedSyncs = await sql`
        SELECT id FROM instagram_sync_runs 
        WHERE social_account_id = ${socialAccountId}
          AND status IN ('SYNCING', 'AUTH_REQUIRED')
        ORDER BY started_at DESC LIMIT 1
      `;

      if (failedSyncs.length === 0 && recentSyncs.length === 0) {
        await tracker.addLog('Instagram sync is outdated. Enqueuing Instagram Sync.');
        await queues.instagramSync.add('sync-account', { socialAccountId, agentRunId, goalId, attemptNumber: 1 }, { jobId: `${agentRunId}-sync` });
        await tracker.completeStep(stepId, { action: 'queued_sync' });
        return { action: 'queued_sync' };
      }

      // ── Phase 2: ANALYZE ──────────────────────────────────────────────────
      // Are there posts published > 24 hours ago that lack metrics in the last 24 hours?
      const postsNeedingMetrics = await sql`
        SELECT p.id FROM posts p
        LEFT JOIN post_metrics pm ON p.id = pm.post_id 
          AND pm.captured_at > NOW() - INTERVAL '24 hours'
        WHERE p.social_account_id = ${socialAccountId} 
        AND p.status = 'published'
        AND p.published_at < NOW() - INTERVAL '24 hours'
        AND pm.id IS NULL
        LIMIT 1
      `;
      if (postsNeedingMetrics.length > 0) {
        await tracker.addLog('Discovered published posts needing metrics. Enqueuing Analytics.');
        await queues.analytics.add('fetch-analytics', { socialAccountId, agentRunId, goalId, attemptNumber: 1 }, { jobId: `${agentRunId}-analytics` });
        await tracker.completeStep(stepId, { action: 'queued_analytics' });
        return { action: 'queued_analytics' };
      }

      // ── Phase 3: LEARN ────────────────────────────────────────────────────
      // Has it been > 3 days since the last learning observation?
      const recentLearning = await sql`
        SELECT id FROM learning_observations 
        WHERE goal_id = ${goalId}
        AND created_at > NOW() - INTERVAL '3 days'
        LIMIT 1
      `;
      const totalMetrics = await sql`
        SELECT COUNT(*) as c FROM post_metrics pm
        JOIN posts p ON pm.post_id = p.id
        WHERE p.social_account_id = ${socialAccountId}
      `;
      if (recentLearning.length === 0 && totalMetrics[0] && Number(totalMetrics[0].c) > 5) {
        await tracker.addLog('Sufficient metrics found but no recent learning observations. Enqueuing Learning Analysis.');
        await queues.learning.add('run-learning', { socialAccountId, agentRunId, goalId, attemptNumber: 1 }, { jobId: `${agentRunId}-learning` });
        await tracker.completeStep(stepId, { action: 'queued_learning' });
        return { action: 'queued_learning' };
      }

      // ── Phase 4: DECIDE (Strategy) ────────────────────────────────────────
      const strategies = await sql`SELECT id FROM strategy_versions WHERE social_account_id = ${socialAccountId} AND status = 'active' LIMIT 1`;
      let currentStrategy = strategies[0];

      if (!currentStrategy) {
        await tracker.addLog('No active strategy found. Enqueuing Strategy Revision.');
        await queues.strategy.add('revise-strategy', { socialAccountId, agentRunId, goalId, attemptNumber: 1 }, { jobId: `${agentRunId}-strategy` });
        await tracker.completeStep(stepId, { action: 'queued_strategy' });
        return { action: 'queued_strategy' };
      }

      // ── Phase 5: OBSERVE (Research) ───────────────────────────────────────
      const recentResearch = await sql`
        SELECT id FROM research_runs 
        WHERE social_account_id = ${socialAccountId}
        AND created_at > NOW() - INTERVAL '7 days'
        LIMIT 1
      `;
      if (recentResearch.length === 0) {
        await tracker.addLog('Research is outdated (> 7 days). Enqueuing Research phase.');
        await queues.research.add('run-research', { socialAccountId, agentRunId, goalId, attemptNumber: 1 }, { jobId: `${agentRunId}-research` });
        await tracker.completeStep(stepId, { action: 'queued_research' });
        return { action: 'queued_research' };
      }

      // ── Phase 6: EXECUTE (Content Generation) ─────────────────────────────
      // Check content buffer
      const draftedCount = await sql`
        SELECT COUNT(*) as count FROM content_ideas 
        WHERE social_account_id = ${socialAccountId} AND status = 'draft'
      `;
      if (draftedCount[0] && Number(draftedCount[0].count) < 5) {
        await tracker.addLog(`Content buffer has ${draftedCount[0].count} drafts. Enqueuing Content generation.`);
        await queues.contentGeneration.add('generate-content', {
          socialAccountId,
          agentRunId,
          strategyVersionId: currentStrategy.id,
          attemptNumber: 1
        }, { jobId: `${agentRunId}-content` });
        await tracker.completeStep(stepId, { action: 'queued_content' });
        return { action: 'queued_content' };
      }

      // ── Phase 7: SCHEDULE ─────────────────────────────────────────────────
      if (autonomyLevel === 'autonomous') {
        const readyContent = await sql`
          SELECT ci.id FROM content_ideas ci
          WHERE ci.social_account_id = ${socialAccountId}
            AND ci.status IN ('draft')
            AND ci.asset_generation_status = 'completed'
            AND NOT EXISTS (
              SELECT 1 FROM posts p
              WHERE p.content_idea_id = ci.id
                AND p.schedule_status IN ('SCHEDULED', 'SUGGESTED')
            )
          LIMIT 3
        `;

        if (readyContent.length > 0) {
          await tracker.addLog(`Autonomous mode: generating schedules for ${readyContent.length} ready content items`);
          const ideaIds = readyContent.map((r: any) => r.id);
          await schedulingAgent.generateBulkRecommendations(socialAccountId, ideaIds, agentRunId, stepId);

          // Auto-accept
          for (const ideaId of ideaIds) {
            try {
              const recs = await sql`
                SELECT * FROM schedule_recommendations
                WHERE content_idea_id = ${ideaId} AND status = 'SUGGESTED'
                ORDER BY created_at DESC LIMIT 1
              `;
              if (recs.length > 0) {
                const rec = recs[0];
                await schedulingService.createSchedule({
                  contentIdeaId: ideaId,
                  accountId: socialAccountId,
                  scheduledAt: new Date(rec.recommendedAt),
                  timezone: rec.timezone,
                  source: 'AGENT',
                  actor: 'agent',
                  reason: 'Autonomous agent scheduled based on recommendation',
                  recommendationId: rec.id,
                });
                await tracker.logEvent(stepId, 'SCHEDULE_ACCEPTED', 'info',
                  `Autonomous: scheduled content ${ideaId} for ${rec.recommendedAt}`,
                  { contentIdeaId: ideaId, recommendedAt: rec.recommendedAt });
              }
            } catch (schedErr: any) {
              await tracker.addLog(`Autonomous scheduling failed for ${ideaId}: ${schedErr.message}`);
            }
          }

          await tracker.completeStep(stepId, { action: 'autonomous_scheduling', scheduled: ideaIds.length });
          return { action: 'autonomous_scheduling' };
        }
      }

      // ── Phase 8: PUBLISH ──────────────────────────────────────────────────
      const postsToPublish = await sql`
        SELECT id FROM posts 
        WHERE social_account_id = ${socialAccountId} 
        AND status = 'scheduled' 
        AND scheduled_at <= NOW()
        ORDER BY scheduled_at ASC
        LIMIT 1
      `;
      if (postsToPublish.length > 0 && postsToPublish[0]) {
        await tracker.addLog(`Found scheduled post due for publishing. Enqueuing Publishing.`);
        await queues.publishing.add('publish-post', { socialAccountId, agentRunId, goalId, postId: postsToPublish[0].id, attemptNumber: 1 }, { jobId: `${agentRunId}-publish-${postsToPublish[0].id}` });
        await tracker.completeStep(stepId, { action: 'queued_publishing' });
        return { action: 'queued_publishing' };
      }

      // All phases healthy
      await tracker.addLog('All systems healthy. No immediate autonomous action required.');
      await tracker.completeStep(stepId, { action: 'none' });

      // Update run to completed if no actions were taken.
      await sql`UPDATE agent_runs SET status = 'completed', completed_at = NOW() WHERE id = ${agentRunId}`;

      return { action: 'none' };

    } catch (error: any) {
      console.error(`[OrchestratorWorker] Failed job ${job.id}`, error);
      const isRetryable = true;

      let nextRetryAt;
      if (isRetryable && job.opts.attempts && job.attemptsMade < job.opts.attempts) {
        const delay = job.opts.backoff ? 5000 * Math.pow(2, job.attemptsMade) : 5000;
        nextRetryAt = new Date(Date.now() + delay);
      }

      await tracker.failStep(stepId, error.message, isRetryable && !!nextRetryAt, nextRetryAt);
      throw error;
    }
  }, {
    connection: redisConnection,
    limiter: { max: 10, duration: 1000 }
  });


  return worker;
};
