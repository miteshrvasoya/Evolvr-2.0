import { Worker, Job } from 'bullmq';
import { redisConnection, queues } from '../queues/index.js';
import { PublishingAgent } from '../modules/agent/publishing.agent.js';
import { AgentRunTracker } from '../modules/agent/agent-tracker.js';

export const createPublishingWorker = () => {
  const publishingAgent = new PublishingAgent();

  const worker = new Worker('publishing', async (job: Job) => {
    const { socialAccountId, agentRunId, goalId, postId } = job.data;
    const attemptNumber = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts || 5;

    try {
      console.log(`[PublishingWorker] Processing job ${job.id} for post ${postId}`);

      await publishingAgent.runPublishing(socialAccountId, postId, agentRunId, attemptNumber, maxAttempts);

      // Once publishing is done, drop back into orchestrator to continue the loop
      await queues.orchestrator.add('evaluate-next-action', {
        socialAccountId,
        agentRunId,
        goalId,
        attemptNumber: 1
      });

      return { status: 'completed' };
    } catch (err: any) {
      console.error(`[PublishingWorker] Failed job ${job.id}`, err);
      
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
