import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import IORedis from 'ioredis';

// Create a reused Redis connection for BullMQ
export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const queues = {
  research: new Queue('research', { connection: redisConnection }),
  strategy: new Queue('strategy', { connection: redisConnection }),
  contentGeneration: new Queue('content-generation', { connection: redisConnection }),
  mediaGeneration: new Queue('media-generation', { connection: redisConnection }),
  qualityCheck: new Queue('quality-check', { connection: redisConnection }),
  publishing: new Queue('publishing', { connection: redisConnection }),
  analytics: new Queue('analytics', { connection: redisConnection }),
  engagement: new Queue('engagement', { connection: redisConnection }),
  learning: new Queue('learning', { connection: redisConnection }),
  notifications: new Queue('notifications', { connection: redisConnection }),
};

export async function closeQueues() {
  await Promise.all(Object.values(queues).map((q) => q.close()));
  redisConnection.disconnect();
}
