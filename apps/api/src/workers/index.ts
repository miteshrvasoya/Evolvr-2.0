import { Worker } from 'bullmq';
import { createPublishingWorker } from './publishing.worker.js';
import { redisConnection } from '../queues/index.js';
import { createOrchestratorWorker } from './orchestrator.worker.js';
import { createStrategyWorker } from './strategy.worker.js';
import { createContentWorker } from './content.worker.js';
import { createResearchWorker } from './research.worker.js';
import { createAnalyticsWorker } from './analytics.worker.js';
import { createLearningWorker } from './learning.worker.js';
import { createMediaWorker } from './media.worker.js';

const workers: Worker[] = [];

export function startWorkers() {
  console.log('👷 Starting BullMQ Workers...');

  // Initialize workers
  workers.push(createPublishingWorker());
  workers.push(createOrchestratorWorker());
  workers.push(createStrategyWorker());
  workers.push(createContentWorker());
  workers.push(createResearchWorker());
  workers.push(createAnalyticsWorker());
  workers.push(createLearningWorker());
  workers.push(createMediaWorker());

  // Add more workers (content-generation, analytics, etc) here as needed...
  
  // Central failure handler for all workers
  workers.forEach(worker => {
    worker.on('failed', async (job, err) => {
      console.error(`[Worker ${worker.name}] Job ${job?.id} failed:`, err.message);
      
      if (job && job.data && job.data.agentRunId) {
        // If this is the final attempt
        if (!job.opts.attempts || job.attemptsMade >= job.opts.attempts) {
          try {
            const { sql } = await import('../db/client.js');
            await sql`
              UPDATE agent_runs 
              SET status = 'failed', error_message = ${err.message}, completed_at = NOW() 
              WHERE id = ${job.data.agentRunId}
            `;
          } catch (dbErr) {
            console.error('[Worker Failed Handler] DB Update Error:', dbErr);
          }
        }
      }
    });
  });

}

export async function stopWorkers() {
  console.log('🛑 Stopping workers...');
  await Promise.all(workers.map(w => w.close()));
}
