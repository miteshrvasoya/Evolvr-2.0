import { Worker, Job } from 'bullmq';
import { redisConnection, queues } from '../queues/index.js';
import { sql } from '../db/client.js';
import { AssetGenerationService, shouldRetryError, classifyError } from '../modules/media/asset-generation.service.js';
import { AssetErrorCategory } from '../modules/media/media.interface.js';
import { telegramService } from '../modules/notifications/telegram.service.js';
import { formatMediaGenerationFailed } from '../modules/notifications/telegram.formatter.js';
import { env } from '../config/env.js';

const MAX_ASSET_RETRIES = 3;

// Exponential backoff delays with jitter (in ms)
// Attempt 1 fail → wait ~30s, attempt 2 fail → wait ~2min, attempt 3 fail → mark manual
function getRetryDelayMs(attemptNumber: number): number {
  const base = [30_000, 120_000, 300_000]; // 30s, 2min, 5min
  const delay = base[Math.min(attemptNumber - 1, base.length - 1)] ?? 300_000;
  // Add up to 20% jitter
  const jitter = Math.floor(delay * 0.2 * Math.random());
  return delay + jitter;
}

export const createMediaWorker = () => {
  const assetService = new AssetGenerationService();

  const worker = new Worker(
    'media-generation',
    async (job: Job) => {
      const {
        contentIdeaId,
        promptId,
        assetType,
        attemptNumber = 1,
        idempotencyKey,
        agentRunId,
      } = job.data;

      console.log(`[MediaWorker] Processing job ${job.id} | idea ${contentIdeaId} | ${assetType} | attempt #${attemptNumber}`);

      const result = await assetService.generateAsset({
        contentIdeaId,
        promptId,
        assetType,
        idempotencyKey,
        attemptNumber,
        agentRunId,
      });

      if (result.success) {
        console.log(`[MediaWorker] ✓ Asset generated for ${contentIdeaId}`);

        // Log to agent_events if this run has an agentRunId
        if (agentRunId) {
          await logAgentEvent(agentRunId, 'MEDIA_GENERATED', 'info',
            `${assetType} generated successfully for content idea.`,
            { contentIdeaId, assetId: result.assetId, attemptNumber }
          );
        }
        return { success: true };
      }

      // Generation failed
      const { errorCategory, errorMessage, shouldRetry, attemptId } = result;

      if (agentRunId) {
        await logAgentEvent(agentRunId, 'MEDIA_FAILED', 'warn',
          `${assetType} generation failed: [${errorCategory}] ${errorMessage}`,
          { contentIdeaId, errorCategory, attemptNumber, attemptId }
        );
      }

      if (shouldRetry && attemptNumber < MAX_ASSET_RETRIES) {
        const nextAttempt = attemptNumber + 1;
        const delayMs = getRetryDelayMs(attemptNumber);
        const nextIdempotencyKey = `${contentIdeaId}-${assetType}-${nextAttempt}`;

        console.log(`[MediaWorker] Scheduling retry #${nextAttempt} in ${delayMs}ms for idea ${contentIdeaId}`);

        await queues.mediaGeneration.add(
          'generate-asset',
          {
            contentIdeaId,
            promptId,
            assetType,
            attemptNumber: nextAttempt,
            idempotencyKey: nextIdempotencyKey,
            agentRunId,
          },
          {
            jobId: `asset-${contentIdeaId}-${assetType}-${nextAttempt}`,
            delay: delayMs,
          }
        );

        if (agentRunId) {
          await logAgentEvent(agentRunId, 'MEDIA_RETRY_SCHEDULED', 'info',
            `Automatic retry #${nextAttempt} scheduled in ${Math.round(delayMs / 1000)}s.`,
            { contentIdeaId, nextAttempt, delayMs }
          );
        }
      } else {
        // Max retries hit or non-retryable error
        const reason = !shouldRetry
          ? `Non-retryable error: ${errorCategory}`
          : `Max retries (${MAX_ASSET_RETRIES}) reached`;

        console.warn(`[MediaWorker] ${reason} for idea ${contentIdeaId}. Marking needs_attention.`);

        if (agentRunId) {
          await logAgentEvent(agentRunId, 'MEDIA_MANUAL_REQUIRED', 'warn',
            `${assetType} generation requires manual action. ${reason}. Prompt is preserved.`,
            { contentIdeaId, errorCategory, maxRetries: MAX_ASSET_RETRIES }
          );
        }

        // Send notification
        await sendNeedsAttentionNotification(contentIdeaId, assetType, errorCategory as AssetErrorCategory);
      }

      return { success: false, errorCategory };
    },
    {
      connection: redisConnection,
      stalledInterval: 300000,
    drainDelay: 60000,
      // BullMQ-level retries disabled — we manage our own retry scheduling
      // so we don't accidentally re-run the same attempt multiple times
    }
  );


  return worker;
};

async function logAgentEvent(
  agentRunId: string,
  eventType: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  metadata: Record<string, any> = {}
) {
  try {
    await sql`
      INSERT INTO agent_events (agent_run_id, event_type, level, message, metadata)
      VALUES (${agentRunId}, ${eventType}, ${level}, ${message}, ${sql.json(metadata)})
    `;
  } catch (e) {
    console.error('[MediaWorker] Failed to log agent event:', e);
  }
}

async function sendNeedsAttentionNotification(
  contentIdeaId: string,
  assetType: string,
  errorCategory: AssetErrorCategory
) {
  try {
    // Find user from content idea → social account → user
    const rows = await sql`
      SELECT sa.user_id, ci.caption FROM content_ideas ci
      JOIN social_accounts sa ON ci.social_account_id = sa.id
      WHERE ci.id = ${contentIdeaId}
      LIMIT 1
    `;
    if (!rows.length) return;

    const userId = rows[0]!.userId;
    const caption = (rows[0]!.caption ?? '') as string;

    // In-app notification (existing behaviour preserved)
    await sql`
      INSERT INTO notifications (user_id, type, priority, title, message, action_url, metadata)
      VALUES (
        ${userId},
        'asset_generation_failed',
        'medium',
        ${`${assetType === 'image' ? 'Image' : 'Video'} generation failed`},
        ${`Asset generation requires your attention. Error: ${errorCategory}. The prompt is preserved and ready to use.`},
        ${`/dashboard/content/${contentIdeaId}`},
        ${sql.json({ contentIdeaId, assetType, errorCategory })}
      )
    `;

    // Telegram notification
    await telegramService.send({
      eventType: 'MEDIA_GENERATION_FAILED',
      userId,
      message: formatMediaGenerationFailed(
        caption,
        contentIdeaId,
        assetType,
        env.EVOLVR_DASHBOARD_URL,
      ),
      idempotencyKey: `tg:MEDIA_GENERATION_FAILED:${contentIdeaId}:${assetType}`,
      actionUrl: `${env.EVOLVR_DASHBOARD_URL}/dashboard/content/${contentIdeaId}`,
    });
  } catch (e) {
    console.error('[MediaWorker] Failed to send notification:', e);
  }
}
