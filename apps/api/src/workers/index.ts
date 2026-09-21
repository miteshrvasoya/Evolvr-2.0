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
import { createInstagramSyncWorker } from './instagram-sync.worker.js';
import { telegramService } from '../modules/notifications/telegram.service.js';
import { formatAgentPermanentlyFailed } from '../modules/notifications/telegram.formatter.js';
import { env } from '../config/env.js';
import { sql } from '../db/client.js';

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
  workers.push(createInstagramSyncWorker());

  // Add more workers (content-generation, analytics, etc) here as needed...
  
  // Central failure handler for all workers
  workers.forEach(worker => {
    worker.on('failed', async (job, err) => {
      console.error(`[Worker ${worker.name}] Job ${job?.id} failed:`, err.message);
      
      if (job && job.data && job.data.agentRunId) {
        // If this is the final attempt
        const isFinalAttempt = !job.opts.attempts || job.attemptsMade >= job.opts.attempts;
        if (isFinalAttempt) {
          try {
            const errorMsg = err?.message || String(err) || 'Unknown error';
            await sql`
              UPDATE agent_runs 
              SET status = 'failed', error_message = ${errorMsg}, completed_at = NOW() 
              WHERE id = ${job.data.agentRunId}
            `;

            // Telegram: agent permanently failed
            const socialAccountId = job.data.socialAccountId ?? job.data.accountId;
            if (socialAccountId) {
              const userRows = await sql`SELECT user_id FROM social_accounts WHERE id = ${socialAccountId} LIMIT 1`;
              if (userRows.length > 0) {
                await telegramService.send({
                  eventType: 'AGENT_PERMANENTLY_FAILED',
                  userId: userRows[0].userId as string,
                  message: formatAgentPermanentlyFailed(
                    worker.name,
                    errorMsg,
                    env.EVOLVR_DASHBOARD_URL,
                  ),
                  idempotencyKey: `tg:AGENT_PERMANENTLY_FAILED:${job.data.agentRunId}:${worker.name}`,
                  actionUrl: `${env.EVOLVR_DASHBOARD_URL}/dashboard/activity`,
                });
              }
            }
          } catch (dbErr) {
            console.error('[Worker Failed Handler] Error:', dbErr);
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
