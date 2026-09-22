import { Worker, Job } from 'bullmq';
import { redisConnection, queues } from '../queues/index.js';
import { StrategyAgent } from '../modules/agent/strategy.agent.js';
import { AgentRunTracker } from '../modules/agent/agent-tracker.js';
import { sql } from '../db/client.js';
import { telegramService } from '../modules/notifications/telegram.service.js';
import { formatStrategyGenerated } from '../modules/notifications/telegram.formatter.js';
import { env } from '../config/env.js';

export const createStrategyWorker = () => {
  const strategyAgent = new StrategyAgent();

  const worker = new Worker('strategy', async (job: Job) => {
    const { socialAccountId, agentRunId, goalId } = job.data;
    const attemptNumber = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts || 5;

    try {
      console.log(`[StrategyWorker] Processing job ${job.id} for account ${socialAccountId}`);

      const result = await strategyAgent.runStrategyRevision(socialAccountId, goalId, agentRunId, attemptNumber, maxAttempts);

      // Telegram: strategy generated
      try {
        const userRows = await sql`SELECT user_id FROM social_accounts WHERE id = ${socialAccountId} LIMIT 1`;
        const goalRows = await sql`SELECT goal_type FROM admin_goals WHERE id = ${goalId} LIMIT 1`;
        if (userRows.length > 0 && goalRows.length > 0) {
          // Fetch the new version number from the result
          const versionRows = await sql`SELECT version_number FROM strategy_versions WHERE id = ${result?.strategyId} LIMIT 1`;
          const versionNumber = versionRows[0]?.versionNumber ?? 1;
          await telegramService.send({
            eventType: 'STRATEGY_GENERATED',
            userId: userRows[0]!.userId as string,
            message: formatStrategyGenerated(
              versionNumber,
              goalRows[0]!.goalType as string,
              env.EVOLVR_DASHBOARD_URL,
            ),
            idempotencyKey: `tg:STRATEGY_GENERATED:${agentRunId}`,
            actionUrl: `${env.EVOLVR_DASHBOARD_URL}/dashboard/strategy`,
          });
        }
      } catch (tgErr) {
        console.warn('[StrategyWorker] Telegram STRATEGY_GENERATED notification failed:', tgErr);
      }

      // Once strategy is revised, we drop back into the orchestrator to decide the next step
      await queues.orchestrator.add('evaluate-next-action', {
        socialAccountId,
        agentRunId,
        goalId,
        attemptNumber: 1
      });

      return { status: 'completed' };
    } catch (err: any) {
      console.error(`[StrategyWorker] Failed job ${job.id}`, err);
      
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
    stalledInterval: 300000,
  });

  return worker;
};
