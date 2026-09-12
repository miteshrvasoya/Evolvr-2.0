import { Worker, Job } from 'bullmq';
import { redisConnection, queues } from '../queues/index.js';
import { sql } from '../db/client.js';
import { AgentRunTracker } from '../modules/agent/agent-tracker.js';

export const createOrchestratorWorker = () => {
  const worker = new Worker('orchestrator', async (job: Job) => {
    const { socialAccountId, agentRunId, goalId } = job.data;
    const tracker = new AgentRunTracker(agentRunId);
    
    // Mark the agent run as running if it was queued
    await sql`UPDATE agent_runs SET status = 'running' WHERE id = ${agentRunId} AND status = 'queued'`;

    const stepId = await tracker.startStep('evaluate_next_action', job.attemptsMade, job.opts.attempts || 5);

    try {
      console.log(`[OrchestratorWorker] Evaluating next action for account ${socialAccountId}`);

      // STATE MACHINE:
      // We evaluate phases in order of dependency. If a phase needs work, we enqueue it and stop evaluating.
      // Phase 1: PUBLISH - Check if there are posts scheduled to be published right now.
      // Phase 2: MEASURE - Check if recent posts need analytics fetched.
      // Phase 3: LEARN - Check if new analytics exist that haven't been synthesized into insights.
      // Phase 4: ADAPT - Check if strategy is missing or needs revision based on new insights.
      // Phase 5: OBSERVE - Check if recent research exists (e.g. within last 7 days).
      // Phase 6: CREATE - Check if content buffer is low.

      // We use simple heuristic rules for this scaffold.

      // Phase 1: Publish
      // (Skipping actual scheduling logic for brevity, assuming PublishingWorker is manually triggered via dashboard for now)

      // Phase 2: Measure (Analytics)
      // Are there posts published > 24 hours ago that lack metrics in the last 24 hours?
      const postsNeedingMetrics = await sql`
        SELECT p.id FROM posts p
        LEFT JOIN post_metrics pm ON p.id = pm.post_id 
          AND pm.recorded_at > NOW() - INTERVAL '24 hours'
        WHERE p.social_account_id = ${socialAccountId} 
        AND p.status = 'published'
        AND p.published_at < NOW() - INTERVAL '24 hours'
        AND pm.id IS NULL
        LIMIT 1
      `;
      if (postsNeedingMetrics.length > 0) {
        await tracker.addLog('Discovered published posts needing metrics. Enqueuing Analytics.');
        await queues.analytics.add('fetch-analytics', { socialAccountId, agentRunId, goalId, attemptNumber: 1 });
        await tracker.completeStep(stepId, { action: 'queued_analytics' });
        return { action: 'queued_analytics' };
      }

      // Phase 3: Learn
      // Has it been > 3 days since the last strategic insight was generated?
      const recentInsights = await sql`
        SELECT id FROM strategic_insights 
        WHERE social_account_id = ${socialAccountId}
        AND created_at > NOW() - INTERVAL '3 days'
        LIMIT 1
      `;
      // Check if we have any metrics at all to learn from
      const totalMetrics = await sql`
        SELECT COUNT(*) as c FROM post_metrics pm
        JOIN posts p ON pm.post_id = p.id
        WHERE p.social_account_id = ${socialAccountId}
      `;
      if (recentInsights.length === 0 && totalMetrics[0] && Number(totalMetrics[0].c) > 5) {
        await tracker.addLog('Sufficient metrics found but no recent insights. Enqueuing Learning Analysis.');
        await queues.learning.add('run-learning', { socialAccountId, agentRunId, goalId, attemptNumber: 1 });
        await tracker.completeStep(stepId, { action: 'queued_learning' });
        return { action: 'queued_learning' };
      }

      // Phase 4: Adapt (Strategy)
      const strategies = await sql`SELECT id, created_at FROM strategy_versions WHERE social_account_id = ${socialAccountId} AND status = 'active' LIMIT 1`;
      let currentStrategy = strategies[0];

      if (!currentStrategy) {
        await tracker.addLog('No active strategy found. Enqueuing Strategy Revision.');
        await queues.strategy.add('revise-strategy', { socialAccountId, agentRunId, goalId, attemptNumber: 1 });
        await tracker.completeStep(stepId, { action: 'queued_strategy' });
        return { action: 'queued_strategy' };
      }

      // Phase 5: Observe (Research)
      const recentResearch = await sql`
        SELECT id FROM research_runs 
        WHERE social_account_id = ${socialAccountId}
        AND created_at > NOW() - INTERVAL '7 days'
        LIMIT 1
      `;
      if (recentResearch.length === 0) {
        await tracker.addLog('Research is outdated (> 7 days). Enqueuing Research phase.');
        await queues.research.add('run-research', { socialAccountId, agentRunId, goalId, attemptNumber: 1 });
        await tracker.completeStep(stepId, { action: 'queued_research' });
        return { action: 'queued_research' };
      }

      // Phase 6: Create (Content Generation)
      const draftedCount = await sql`SELECT COUNT(*) as count FROM content_ideas WHERE social_account_id = ${socialAccountId} AND status = 'draft'`;
      if (draftedCount[0] && Number(draftedCount[0].count) < 5) {
        await tracker.addLog(`Low content buffer detected (${draftedCount[0].count} < 5). Enqueuing Content generation.`);
        await queues.contentGeneration.add('generate-content', {
          socialAccountId,
          agentRunId,
          strategyVersionId: currentStrategy.id,
          attemptNumber: 1
        });
        await tracker.completeStep(stepId, { action: 'queued_content' });
        return { action: 'queued_content' };
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
      
      await tracker.failStep(stepId, error.message, isRetryable, nextRetryAt);
      throw error; 
    }
  }, { 
    connection: redisConnection,
    limiter: { max: 10, duration: 1000 }
  });

  worker.on('failed', async (job, err) => {
    if (job && (!job.opts.attempts || job.attemptsMade >= job.opts.attempts)) {
       await sql`UPDATE agent_runs SET status = 'failed', error_message = ${err.message}, completed_at = NOW() WHERE id = ${job.data.agentRunId}`;
    }
  });

  return worker;
};
