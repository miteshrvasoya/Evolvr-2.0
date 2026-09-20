import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { Redis } from 'ioredis';

// Create a reused Redis connection for BullMQ
export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const defaultOpts = { defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5000 } } };

export const queues = {
  orchestrator: new Queue('orchestrator', { connection: redisConnection, ...defaultOpts }),
  research: new Queue('research', { connection: redisConnection, ...defaultOpts }),
  strategy: new Queue('strategy', { connection: redisConnection, ...defaultOpts }),
  contentGeneration: new Queue('content-generation', { connection: redisConnection, ...defaultOpts }),
  /** Dedicated queue for asset generation jobs (image/video). Uses its own worker with backoff. */
  mediaGeneration: new Queue('media-generation', { connection: redisConnection }),
  qualityCheck: new Queue('quality-check', { connection: redisConnection, ...defaultOpts }),
  publishing: new Queue('publishing', { connection: redisConnection, ...defaultOpts }),
  analytics: new Queue('analytics', { connection: redisConnection, ...defaultOpts }),
  engagement: new Queue('engagement', { connection: redisConnection, ...defaultOpts }),
  learning: new Queue('learning', { connection: redisConnection, ...defaultOpts }),
  notifications: new Queue('notifications', { connection: redisConnection, ...defaultOpts }),
  instagramSync: new Queue('instagram-sync', { connection: redisConnection, ...defaultOpts }),
};

export async function closeQueues() {
  await Promise.all(Object.values(queues).map((q) => q.close()));
  redisConnection.disconnect();
}
