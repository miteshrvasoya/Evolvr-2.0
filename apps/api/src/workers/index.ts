import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queues/index.js';
import { createOrchestratorWorker } from './orchestrator.worker.js';
import { createStrategyWorker } from './strategy.worker.js';
import { createContentWorker } from './content.worker.js';
import { createResearchWorker } from './research.worker.js';
import { createAnalyticsWorker } from './analytics.worker.js';
import { createLearningWorker } from './learning.worker.js';

const workers: Worker[] = [];

export function startWorkers() {
  console.log('👷 Starting BullMQ Workers...');

  // Publishing Worker
  const publishingWorker = new Worker('publishing', async (job: Job) => {
    console.log(`[PublishingWorker] Processing job ${job.id}`, job.data);
    const { postId } = job.data;
    
    // In full implementation, fetch post and account, get access token, call adapter:
    // const post = await sql\`SELECT * FROM posts WHERE id = \${postId}\`;
    // const igAdapter = getInstagramAdapter();
    // const result = await igAdapter.publishPost(accessToken, accountId, mediaUrl, caption);
    
    // Simulate work for scaffold
    await new Promise(r => setTimeout(r, 2000));
    
    // Update DB
    // await sql\`UPDATE posts SET status = 'published', platform_post_id = 'sim_123', published_at = NOW() WHERE id = \${postId}\`;
    
    return { status: 'published', platformPostId: 'sim_123' };
  }, { connection: redisConnection });
  
  workers.push(publishingWorker);
  workers.push(createOrchestratorWorker());
  workers.push(createStrategyWorker());
  workers.push(createContentWorker());
  workers.push(createResearchWorker());
  workers.push(createAnalyticsWorker());
  workers.push(createLearningWorker());

  // Add more workers (content-generation, analytics, etc) here as needed...

  publishingWorker.on('completed', (job) => {
    console.log(`[PublishingWorker] Job ${job.id} completed!`);
  });

  publishingWorker.on('failed', (job, err) => {
    console.error(`[PublishingWorker] Job ${job?.id} failed:`, err);
  });
}

export async function stopWorkers() {
  console.log('🛑 Stopping workers...');
  await Promise.all(workers.map(w => w.close()));
}
