import { Worker, Job } from 'bullmq';
import { redisConnection, queues } from '../queues/index.js';
import { LearningAgent } from '../modules/agent/learning.agent.js';
import { AgentRunTracker } from '../modules/agent/agent-tracker.js';
import { sql } from '../db/client.js';
import { telegramService } from '../modules/notifications/telegram.service.js';
import { formatPerformanceInsight } from '../modules/notifications/telegram.formatter.js';
import { env } from '../config/env.js';

export const createLearningWorker = () => {
  const learningAgent = new LearningAgent();

  const worker = new Worker('learning', async (job: Job) => {
    const { socialAccountId, agentRunId, goalId } = job.data;
    const attemptNumber = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts || 5;

    try {
      console.log(`[LearningWorker] Processing job ${job.id} for account ${socialAccountId}`);

      const result = await learningAgent.runLearning(socialAccountId, agentRunId, attemptNumber, maxAttempts);

      // Telegram: performance insight (only when new observations were generated)
      if ((result?.observationsGenerated ?? 0) > 0) {
        try {
          const userRows = await sql`SELECT user_id FROM social_accounts WHERE id = ${socialAccountId} LIMIT 1`;
          if (userRows.length > 0) {
            await telegramService.send({
              eventType: 'PERFORMANCE_INSIGHT',
              userId: userRows[0]!.userId as string,
              message: formatPerformanceInsight(result.observationsGenerated, env.EVOLVR_DASHBOARD_URL),
              idempotencyKey: `tg:PERFORMANCE_INSIGHT:${agentRunId}`,
              actionUrl: `${env.EVOLVR_DASHBOARD_URL}/dashboard/analytics`,
            });
          }
        } catch (tgErr) {
          console.warn('[LearningWorker] Telegram PERFORMANCE_INSIGHT notification failed:', tgErr);
        }
      }

      // Once learning analysis is done, drop back into orchestrator
      await queues.orchestrator.add('evaluate-next-action', {
        socialAccountId,
        agentRunId,
        goalId,
        attemptNumber: 1
      });

      return { status: 'completed' };
    } catch (err: any) {
      console.error(`[LearningWorker] Failed job ${job.id}`, err);
      
      const { error, stepId } = err;
      const actualError = error || err;
      
      const isRetryable = true;
      
      if (stepId) {
        const tracker = new AgentRunTracker(agentRunId);
        let nextRetryAt;
        if (isRetryable && job.attemptsMade + 1 < maxAttempts) {
            const delay = job.opts.backoff ? 5000 * Math.pow(2, job.attemptsMade + 1) : 5000;
            nextRetryAt = new Date(Date.now() + delay);
        }
        await tracker.failStep(stepId, actualError.message, isRetryable && !!nextRetryAt, nextRetryAt);
      }
      
      throw actualError;
    }
  }, { 
    connection: redisConnection,
    stalledInterval: 300000,
    skipDelayCheck: true,
  });

  return worker;
};
