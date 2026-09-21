import { Worker, Job } from 'bullmq';
import { redisConnection, queues } from '../queues/index.js';
import { ContentAgent } from '../modules/agent/content.agent.js';
import { AgentRunTracker } from '../modules/agent/agent-tracker.js';
import { sql } from '../db/client.js';
import { telegramService } from '../modules/notifications/telegram.service.js';
import { formatContentBatchGenerated } from '../modules/notifications/telegram.formatter.js';
import { env } from '../config/env.js';

export const createContentWorker = () => {
  const contentAgent = new ContentAgent();

  const worker = new Worker('content-generation', async (job: Job) => {
    const { socialAccountId, agentRunId, strategyVersionId } = job.data;
    const attemptNumber = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts || 5;

    try {
      console.log(`[ContentWorker] Processing job ${job.id} for account ${socialAccountId}`);

      const result = await contentAgent.generateContentPlan(socialAccountId, strategyVersionId, agentRunId, attemptNumber, maxAttempts);

      // Telegram: content batch generated
      try {
        const userRows = await sql`SELECT user_id FROM social_accounts WHERE id = ${socialAccountId} LIMIT 1`;
        if (userRows.length > 0 && result?.generatedIdeas?.length > 0) {
          await telegramService.send({
            eventType: 'CONTENT_BATCH_GENERATED',
            userId: userRows[0]!.userId as string,
            message: formatContentBatchGenerated(result.generatedIdeas.length, env.EVOLVR_DASHBOARD_URL),
            idempotencyKey: `tg:CONTENT_BATCH_GENERATED:${agentRunId}`,
            actionUrl: `${env.EVOLVR_DASHBOARD_URL}/dashboard/content`,
          });
        }
      } catch (tgErr) {
        console.warn('[ContentWorker] Telegram CONTENT_BATCH_GENERATED notification failed:', tgErr);
      }

      // Once content is generated, drop back into orchestrator
      await queues.orchestrator.add('evaluate-next-action', {
        socialAccountId,
        agentRunId,
        attemptNumber: 1
      });

      return { status: 'completed' };
    } catch (err: any) {
      console.error(`[ContentWorker] Failed job ${job.id}`, err);
      
      const { error, stepId } = err;
      const actualError = error || err;
      
      const isRetryable = true; // Assume LLM/Network errors are retryable
      
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
    limiter: { max: 5, duration: 1000 }
  });

  return worker;
};
