import { Worker, Job } from 'bullmq';
import { redisConnection, queues } from '../queues/index.js';
import { ResearchAgent } from '../modules/agent/research.agent.js';
import { AgentRunTracker } from '../modules/agent/agent-tracker.js';

export const createResearchWorker = () => {
  const researchAgent = new ResearchAgent();

  const worker = new Worker('research', async (job: Job) => {
    const { socialAccountId, agentRunId, goalId } = job.data;
    const attemptNumber = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts || 5;

    try {
      console.log(`[ResearchWorker] Processing job ${job.id} for account ${socialAccountId}`);

      await researchAgent.runResearch(socialAccountId, goalId, agentRunId, attemptNumber, maxAttempts);

      // Once research is generated, drop back into orchestrator
      await queues.orchestrator.add('evaluate-next-action', {
        socialAccountId,
        agentRunId,
        goalId,
        attemptNumber: 1
      });

      return { status: 'completed' };
    } catch (err: any) {
      console.error(`[ResearchWorker] Failed job ${job.id}`, err);
      
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
