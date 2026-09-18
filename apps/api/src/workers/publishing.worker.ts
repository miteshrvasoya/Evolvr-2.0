/**
 * publishing.worker.ts — Durable, Idempotent Instagram Publishing Worker
 *
 * Processes two job types:
 *   - 'publish-scheduled-post': Fired at scheduled time via BullMQ delayed jobs
 *   - 'publish-post': Legacy job type from orchestrator (backward-compatible)
 *
 * Guarantees:
 *   1. Pre-publish validation before every attempt
 *   2. Idempotency — checks if already published before calling Instagram API
 *   3. Error classification — TRANSIENT/RATE_LIMITED/AUTH/PERMANENT etc.
 *   4. Safe retry — never blindly repeats a successful Instagram call
 *   5. No duplicate posts — checks platform_post_id before re-trying
 *   6. Full activity tracking via AgentRunTracker
 *   7. publish_jobs table kept in sync with actual state
 */
import { Worker, Job } from 'bullmq';
import { redisConnection, queues } from '../queues/index.js';
import { sql } from '../db/client.js';
import { AgentRunTracker } from '../modules/agent/agent-tracker.js';
import { getInstagramAdapter } from '../modules/social/adapters/index.js';
import { decryptToken } from '../modules/common/encryption.js';
import { SchedulingService } from '../modules/scheduling/scheduling.service.js';
import { env } from '../config/env.js';

// ─── Error Classification ─────────────────────────────────────────────────────

type ErrorCode =
  | 'TRANSIENT'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'AUTH_ERROR'
  | 'PERMISSION_ERROR'
  | 'INVALID_MEDIA'
  | 'INVALID_CONTENT'
  | 'PLATFORM_REJECTION'
  | 'DUPLICATE'
  | 'PERMANENT';

function classifyError(err: any): { code: ErrorCode; retryable: boolean; backoffMs: number } {
  const msg = (err?.message ?? '').toLowerCase();
  const status = err?.status ?? err?.statusCode ?? 0;

  if (status === 429 || msg.includes('rate limit') || msg.includes('too many requests')) {
    return { code: 'RATE_LIMITED', retryable: true, backoffMs: 60_000 };
  }
  if (status === 401 || status === 403 || msg.includes('oauth') || msg.includes('token') || msg.includes('expired')) {
    return { code: 'AUTH_ERROR', retryable: false, backoffMs: 0 };
  }
  if (msg.includes('permission') || msg.includes('scope')) {
    return { code: 'PERMISSION_ERROR', retryable: false, backoffMs: 0 };
  }
  if (msg.includes('invalid media') || msg.includes('media url') || msg.includes('image') || msg.includes('video')) {
    return { code: 'INVALID_MEDIA', retryable: false, backoffMs: 0 };
  }
  if (msg.includes('caption') || msg.includes('content') || msg.includes('policy')) {
    return { code: 'INVALID_CONTENT', retryable: false, backoffMs: 0 };
  }
  if (status === 400 && msg.includes('duplicate')) {
    return { code: 'DUPLICATE', retryable: false, backoffMs: 0 };
  }
  if (msg.includes('platform') || (status >= 400 && status < 500)) {
    return { code: 'PLATFORM_REJECTION', retryable: false, backoffMs: 0 };
  }
  if (msg.includes('timeout') || msg.includes('econnreset') || msg.includes('network')) {
    return { code: 'TIMEOUT', retryable: true, backoffMs: 30_000 };
  }
  if (status >= 500) {
    return { code: 'TRANSIENT', retryable: true, backoffMs: 30_000 };
  }

  return { code: 'TRANSIENT', retryable: true, backoffMs: 30_000 };
}

// ─── Worker ───────────────────────────────────────────────────────────────────

const schedulingService = new SchedulingService();

export const createPublishingWorker = () => {
  const worker = new Worker(
    'publishing',
    async (job: Job) => {
      // Support both new job type and legacy orchestrator job type
      const {
        postId,
        publishJobId,
        accountId: jobAccountId,
        contentIdeaId: jobContentIdeaId,
        idempotencyKey: jobIdempotencyKey,
        isRetry = false,
        // Legacy fields
        socialAccountId,
        agentRunId,
        goalId,
      } = job.data;

      const resolvedPostId      = postId;
      const resolvedAccountId   = jobAccountId ?? socialAccountId;
      const resolvedAgentRunId  = agentRunId;

      const attemptNumber = job.attemptsMade + 1;
      const maxAttempts   = job.opts.attempts ?? 5;

      console.log(`[PublishingWorker] Job ${job.id} | Post ${resolvedPostId} | Attempt ${attemptNumber}/${maxAttempts}`);

      const tracker = resolvedAgentRunId ? new AgentRunTracker(resolvedAgentRunId) : null;
      let stepId: string | null = null;
      if (tracker) {
        stepId = await tracker.startStep('publish_post', attemptNumber, maxAttempts);
      }

      const log = async (msg: string, level: 'info' | 'warn' | 'error' = 'info') => {
        console.log(`[PublishingWorker] ${msg}`);
        if (tracker && stepId) await tracker.logEvent(stepId, 'PUBLISH_LOG', level, msg);
      };

      try {
        // ── 1. Lookup publish_job (if present) for idempotency ────────────────
        if (publishJobId) {
          const existingJob = await sql`SELECT status, platform_post_id FROM publish_jobs WHERE id = ${publishJobId}`;
          if (existingJob.length > 0 && existingJob[0].status === 'SUCCEEDED') {
            await log(`Idempotency check: post already published (${existingJob[0].platformPostId}). Skipping.`);
            if (tracker && stepId) await tracker.completeStep(stepId, { skipped: true, reason: 'already_published' });
            return { status: 'skipped', reason: 'already_published' };
          }
          // Mark as PROCESSING
          await sql`
            UPDATE publish_jobs
            SET status = 'PROCESSING', attempts = attempts + 1, started_at = NOW(), updated_at = NOW()
            WHERE id = ${publishJobId}
          `;
        }

        // ── 2. Pre-publish validation ─────────────────────────────────────────
        const validation = await schedulingService.validatePrePublish(resolvedPostId);
        if (!validation.valid) {
          // Check if content is already published (idempotency)
          const postCheck = await sql`SELECT status, platform_post_id FROM posts WHERE id = ${resolvedPostId}`;
          if (postCheck[0]?.status === 'published') {
            await log('Post already published — idempotent return');
            if (tracker && stepId) await tracker.completeStep(stepId, { platformPostId: postCheck[0].platformPostId });
            return { status: 'skipped', reason: 'already_published', platformPostId: postCheck[0].platformPostId };
          }

          const permanentErrors = validation.errors.filter(e =>
            !e.includes('Scheduled time has not yet arrived')
          );
          if (permanentErrors.length > 0) {
            await log(`Pre-publish validation failed: ${permanentErrors.join('; ')}`, 'error');

            const errorCode = permanentErrors.some(e => e.toLowerCase().includes('media'))
              ? 'INVALID_MEDIA'
              : permanentErrors.some(e => e.toLowerCase().includes('token') || e.toLowerCase().includes('disconnected'))
                ? 'AUTH_ERROR'
                : 'INVALID_CONTENT';

            if (publishJobId) {
              await sql`
                UPDATE publish_jobs
                SET status = 'ACTION_REQUIRED', error_code = ${errorCode},
                    last_error_message = ${permanentErrors.join('; ')}, updated_at = NOW()
                WHERE id = ${publishJobId}
              `;
            }
            await sql`
              UPDATE posts
              SET schedule_status = 'MISSED', publish_error_code = ${errorCode},
                  publish_failure_reason = ${permanentErrors.join('; ')}, updated_at = NOW()
              WHERE id = ${resolvedPostId}
            `;

            if (tracker && stepId) await tracker.failStep(stepId, permanentErrors.join('; '), false);
            // Do NOT throw — don't retry validation failures
            return { status: 'validation_failed', errors: permanentErrors };
          }
        }

        // ── 3. Fetch Post + Media + Account ───────────────────────────────────
        const posts = await sql`
          SELECT p.id, p.caption, p.social_account_id,
            ca.storage_url, ca.asset_type,
            p.idempotency_key
          FROM posts p
          LEFT JOIN content_ideas ci ON p.content_idea_id = ci.id
          LEFT JOIN media_requirements mr ON mr.content_idea_id = ci.id
          LEFT JOIN content_assets ca ON ca.media_requirement_id = mr.id AND ca.asset_status = 'ACTIVE'
          WHERE p.id = ${resolvedPostId}
          LIMIT 1
        `;
        const post = posts[0];
        if (!post) throw Object.assign(new Error('Post not found'), { code: 'INVALID_CONTENT' });
        if (!post.storageUrl) throw Object.assign(new Error('No active media asset found'), { code: 'INVALID_MEDIA' });

        await log(`Publishing post ${resolvedPostId} — media: ${post.storageUrl}`);

        // ── 4. Resolve public media URL ───────────────────────────────────────
        let finalMediaUrl = post.storageUrl;
        const isLocal = finalMediaUrl.includes('localhost') || finalMediaUrl.startsWith('./');

        if (env.SIMULATION_MODE || (isLocal && !env.STORAGE_PUBLIC_URL)) {
          await log('Simulation mode / local storage — using placeholder image');
          finalMediaUrl = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80';
        } else if (isLocal && env.STORAGE_PUBLIC_URL) {
          const filename = finalMediaUrl.split('/').pop();
          finalMediaUrl = `${env.STORAGE_PUBLIC_URL}/storage/${filename}`;
        }

        // ── 5. Fetch Credentials ──────────────────────────────────────────────
        const accounts = await sql`
          SELECT platform_account_id, access_token_encrypted
          FROM social_accounts WHERE id = ${post.socialAccountId ?? resolvedAccountId}
        `;
        const account = accounts[0];
        if (!account?.accessTokenEncrypted) {
          throw Object.assign(new Error('Missing access token'), { code: 'AUTH_ERROR' });
        }

        // ── 6. Check for duplicate platform post (pre-retry safety) ───────────
        if (isRetry || attemptNumber > 1) {
          const existingPost = await sql`SELECT platform_post_id FROM posts WHERE id = ${resolvedPostId}`;
          if (existingPost[0]?.platformPostId) {
            await log(`Duplicate guard: post already published as ${existingPost[0].platformPostId}`);
            if (tracker && stepId) await tracker.completeStep(stepId, { platformPostId: existingPost[0].platformPostId });
            return { status: 'skipped', reason: 'already_published', platformPostId: existingPost[0].platformPostId };
          }
        }

        // ── 7. Publish ────────────────────────────────────────────────────────
        const accessToken = decryptToken(account.accessTokenEncrypted);
        const igAdapter   = getInstagramAdapter();
        const start       = Date.now();

        let platformPostId = 'sim_' + Date.now();
        let statusCode = 200;

        if (tracker && stepId) {
          await tracker.logEvent(stepId, 'PUBLISH_STARTED', 'info', `Calling Instagram API for post ${resolvedPostId}`);
        }

        try {
          if (!env.SIMULATION_MODE) {
            const result = await igAdapter.publishPost(
              accessToken,
              account.platformAccountId,
              finalMediaUrl,
              post.caption || '',
            );
            platformPostId = result.platformPostId;
          } else {
            await new Promise(r => setTimeout(r, 1500));
          }
        } catch (igErr: any) {
          statusCode = igErr.status ?? 500;
          const { code: errCode, retryable, backoffMs } = classifyError(igErr);
          const latencyMs = Date.now() - start;

          if (tracker && stepId) {
            await tracker.logToolCall(stepId, `Instagram publish failed: ${igErr.message}`, 'instagram_graph_api', 'https://graph.instagram.com/me/media_publish', statusCode, latencyMs);
            await tracker.logEvent(stepId, 'PUBLISH_FAILED', 'error', `Error: ${igErr.message} | Code: ${errCode} | Retryable: ${retryable}`);
          }

          // Update publish_job
          if (publishJobId) {
            const nextStatus = retryable ? 'RETRYING' : 'ACTION_REQUIRED';
            const nextRetry  = retryable ? new Date(Date.now() + backoffMs) : null;
            await sql`
              UPDATE publish_jobs
              SET status = ${nextStatus}, error_code = ${errCode},
                  last_error_message = ${igErr.message},
                  next_retry_at = ${nextRetry?.toISOString() ?? null},
                  updated_at = NOW()
              WHERE id = ${publishJobId}
            `;
          }

          // Update post
          await sql`
            UPDATE posts
            SET publish_error_code = ${errCode},
                publish_failure_reason = ${igErr.message},
                last_publish_attempt_at = NOW(),
                publish_attempts = publish_attempts + 1,
                updated_at = NOW()
            WHERE id = ${resolvedPostId}
          `;

          if (retryable) {
            throw igErr; // BullMQ will retry
          } else {
            // Non-retryable — don't throw, just return
            if (tracker && stepId) await tracker.failStep(stepId, igErr.message, false);
            return { status: 'failed', errorCode: errCode, message: igErr.message };
          }
        }

        const latencyMs = Date.now() - start;
        if (tracker && stepId) {
          await tracker.logToolCall(stepId, `Published → ${platformPostId}`, 'instagram_graph_api', 'https://graph.instagram.com/me/media_publish', 200, latencyMs);
          await tracker.logEvent(stepId, 'PUBLISH_SUCCEEDED', 'info', `Successfully published post ${platformPostId}`);
        }

        // ── 8. Update DB on success ───────────────────────────────────────────
        await sql.begin(async (trx) => {
          await trx`
            UPDATE posts
            SET status = 'published',
                platform_post_id = ${platformPostId},
                published_at = NOW(),
                schedule_status = 'SCHEDULED',
                last_publish_attempt_at = NOW(),
                publish_attempts = publish_attempts + 1,
                updated_at = NOW()
            WHERE id = ${resolvedPostId}
          `;

          if (publishJobId) {
            await trx`
              UPDATE publish_jobs
              SET status = 'SUCCEEDED',
                  platform_post_id = ${platformPostId},
                  completed_at = NOW(),
                  updated_at = NOW()
              WHERE id = ${publishJobId}
            `;
          }

          // Update content idea status
          await trx`
            UPDATE content_ideas ci
            SET status = 'published', updated_at = NOW()
            FROM posts p
            WHERE p.id = ${resolvedPostId} AND p.content_idea_id = ci.id
          `;
        });

        if (tracker && stepId) {
          await tracker.completeStep(stepId, { platformPostId });
        }

        // ── 9. Queue analytics for published post ─────────────────────────────
        await queues.analytics.add(
          'fetch-post-analytics',
          { postId: resolvedPostId, accountId: post.socialAccountId ?? resolvedAccountId, publishedAt: new Date().toISOString() },
          {
            delay: 24 * 3600 * 1000,           // Fetch analytics 24h after publish
            jobId: `analytics-${resolvedPostId}`,
          },
        );

        // ── 10. Notify orchestrator (legacy support) ──────────────────────────
        if (resolvedAgentRunId && goalId) {
          await queues.orchestrator.add('evaluate-next-action', {
            socialAccountId: resolvedAccountId,
            agentRunId: resolvedAgentRunId,
            goalId,
            attemptNumber: 1,
          });
        }

        return { status: 'published', platformPostId };

      } catch (err: any) {
        console.error(`[PublishingWorker] Job ${job.id} failed:`, err.message ?? err);

        if (tracker && stepId) {
          const nextRetryAt = job.opts.attempts && job.attemptsMade + 1 < (job.opts.attempts ?? 0)
            ? new Date(Date.now() + 30_000)
            : undefined;
          await tracker.failStep(stepId, err.message ?? String(err), true, nextRetryAt);
        }

        throw err;
      }
    },
    {
      connection: redisConnection,
      limiter: { max: 5, duration: 1000 },
    },
  );

  return worker;
};
