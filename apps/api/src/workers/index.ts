import { Worker } from 'bullmq';
import { createPublishingWorker } from './publishing.worker.js';
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
import { queues } from '../queues/index.js';
import { WorkerLifecycleManager } from './worker-manager.js';

// Central failure handler for all workers
function attachFailureHandler(worker: Worker) {
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
                userId: userRows[0]!.userId as string,
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
  return worker;
}

const workerManagers: Record<string, WorkerLifecycleManager> = {
  'publishing': new WorkerLifecycleManager('publishing', queues.publishing, () => attachFailureHandler(createPublishingWorker())),
  'orchestrator': new WorkerLifecycleManager('orchestrator', queues.orchestrator, () => attachFailureHandler(createOrchestratorWorker())),
  'strategy': new WorkerLifecycleManager('strategy', queues.strategy, () => attachFailureHandler(createStrategyWorker())),
  'contentGeneration': new WorkerLifecycleManager('content-generation', queues.contentGeneration, () => attachFailureHandler(createContentWorker())),
  'research': new WorkerLifecycleManager('research', queues.research, () => attachFailureHandler(createResearchWorker())),
  'analytics': new WorkerLifecycleManager('analytics', queues.analytics, () => attachFailureHandler(createAnalyticsWorker())),
  'learning': new WorkerLifecycleManager('learning', queues.learning, () => attachFailureHandler(createLearningWorker())),
  'mediaGeneration': new WorkerLifecycleManager('media-generation', queues.mediaGeneration, () => attachFailureHandler(createMediaWorker())),
  'instagramSync': new WorkerLifecycleManager('instagram-sync', queues.instagramSync, () => attachFailureHandler(createInstagramSyncWorker())),
};

// Monkey-patch the queues to seamlessly start workers when jobs are added
for (const [key, manager] of Object.entries(workerManagers)) {
  const queue = queues[key as keyof typeof queues];
  if (queue) {
    const originalAdd = queue.add.bind(queue);
    queue.add = async (...args) => {
      const result = await originalAdd(...args);
      manager.ensureWorkerRunning().catch(console.error);
      return result;
    };
    
    const originalAddBulk = queue.addBulk.bind(queue);
    queue.addBulk = async (...args) => {
      const result = await originalAddBulk(...args);
      manager.ensureWorkerRunning().catch(console.error);
      return result;
    };
  }
}

export async function ensureWorkerRunning(queueKey: keyof typeof queues) {
  const manager = workerManagers[queueKey];
  if (manager) {
    await manager.ensureWorkerRunning();
  }
}

export async function stopWorkers() {
  console.log('🛑 Stopping on-demand workers...');
  await Promise.all(Object.values(workerManagers).map(manager => manager.stopWorker()));
}

// Ensure workers are started for queues that might already have delayed jobs on boot
export async function bootstrapOnDemandWorkers() {
  console.log('👷 Bootstrapping on-demand workers...');
  const promises = [];
  for (const manager of Object.values(workerManagers)) {
    // If a queue has delayed jobs, we must start the worker so it can process them when they're ready.
    promises.push(manager.ensureWorkerRunning().catch(console.error));
  }
  await Promise.all(promises);
}
