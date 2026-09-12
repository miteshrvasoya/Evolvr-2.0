import { Worker } from 'bullmq';
import { createPublishingWorker } from './publishing.worker.js';
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

  // Initialize workers
  workers.push(createPublishingWorker());
  workers.push(createOrchestratorWorker());
  workers.push(createStrategyWorker());
  workers.push(createContentWorker());
  workers.push(createResearchWorker());
  workers.push(createAnalyticsWorker());
  workers.push(createLearningWorker());

  // Add more workers (content-generation, analytics, etc) here as needed...


}

export async function stopWorkers() {
  console.log('🛑 Stopping workers...');
  await Promise.all(workers.map(w => w.close()));
}
