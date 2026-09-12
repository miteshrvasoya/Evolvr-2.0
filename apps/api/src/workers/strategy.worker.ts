import { Worker, Job } from 'bullmq';
import { redisConnection, queues } from '../queues/index.js';
import { StrategyAgent } from '../modules/agent/strategy.agent.js';
import { AgentRunTracker } from '../modules/agent/agent-tracker.js';

export const createStrategyWorker = () => {
  const strategyAgent = new StrategyAgent();

  const worker = new Worker('strategy', async (job: Job) => {
    const { socialAccountId, agentRunId, goalId } = job.data;
    const attemptNumber = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts || 5;

    try {
      console.log(`[StrategyWorker] Processing job ${job.id} for account ${socialAccountId}`);

      await strategyAgent.runStrategyRevision(socialAccountId, goalId, agentRunId, attemptNumber, maxAttempts);

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
        await tracker.failStep(stepId, actualError.message, isRetryable, nextRetryAt);
      }
      
      throw actualError;
    }
  }, { 
    connection: redisConnection,
    limiter: { max: 5, duration: 1000 }
  });

  return worker;
};
