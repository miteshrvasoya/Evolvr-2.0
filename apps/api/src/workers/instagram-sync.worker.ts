import { Worker, Job } from 'bullmq';
import { redisConnection, queues } from '../queues/index.js';
import { sql } from '../db/client.js';
import { InstagramAdapter } from '../modules/social/adapters/instagram.adapter.js';
import { telegramService } from '../modules/notifications/telegram.service.js';
import {
  formatInstagramSyncCompleted,
  formatInstagramAuthFailure,
} from '../modules/notifications/telegram.formatter.js';
import { env } from '../config/env.js';

export const createInstagramSyncWorker = () => {
  const adapter = new InstagramAdapter();

  const worker = new Worker('instagram-sync', async (job: Job) => {
    const { socialAccountId, agentRunId, goalId } = job.data;
    
    // Attempt tracking
    const maxAttempts = job.opts.attempts || 3;
    const attemptNumber = job.attemptsMade + 1;

    let syncRunId: string | null = null;
    let nextCursor: string | undefined = undefined;

    try {
      console.log(`[InstagramSyncWorker] Starting sync for account ${socialAccountId}`);

      // 1. Mark as SYNCING in DB
      const existingRuns = await sql`
        SELECT id FROM instagram_sync_runs 
        WHERE social_account_id = ${socialAccountId} AND status = 'SYNCING'
      `;
      if (existingRuns.length > 0) {
        syncRunId = existingRuns[0]!.id;
      } else {
        const result = await sql`
          INSERT INTO instagram_sync_runs (social_account_id, status, started_at)
          VALUES (${socialAccountId}, 'SYNCING', NOW())
          RETURNING id
        `;
        syncRunId = result[0]!.id;
      }

      // 2. Fetch Account Access Token
      const accountRes = await sql`
        SELECT access_token_encrypted, platform_account_id
        FROM social_accounts
        WHERE id = ${socialAccountId}
      `;
      
      if (accountRes.length === 0) throw new Error('Social account not found');
      
      const { access_token_encrypted, platform_account_id } = accountRes[0]!;
      // Note: In a real app we'd decrypt this token using the encryption service.
      // We assume it's directly accessible for this MVP or handled via a central service.
      const accessToken = access_token_encrypted; 

      if (!accessToken) {
        throw new Error('AUTH_REQUIRED: No access token available');
      }

      let hasNextPage = true;
      let newPosts = 0;
      let updatedPosts = 0;
      let insightsFetched = 0;

      // 3. Sync Account Insights
      try {
        const accountInsights = await adapter.getAccountInsights(accessToken, platform_account_id);
        
        await sql`
          INSERT INTO account_metrics (
            social_account_id, captured_at, followers, following, media_count,
            views, likes, comments, shares, saves, replies, reposts,
            accounts_engaged, total_interactions, profile_links_taps, follows, unfollows
          ) VALUES (
            ${socialAccountId}, NOW(), 0, 0, 0,
            ${accountInsights.views}, ${accountInsights.likes}, ${accountInsights.comments},
            ${accountInsights.shares}, ${accountInsights.saves}, ${accountInsights.replies},
            ${accountInsights.reposts}, ${accountInsights.accounts_engaged}, ${accountInsights.total_interactions},
            ${accountInsights.profile_links_taps}, ${accountInsights.follows}, ${accountInsights.unfollows}
          )
        `;
      } catch (err: any) {
        console.warn(`[InstagramSyncWorker] Failed to sync account insights: ${err.message}`);
      }

      // 4. Fetch Posts
      // For this MVP, we will limit the sync to a few pages to avoid rate limits,
      // or we sync everything if doing historical backfill. Let's do max 5 pages.
      let pages = 0;
      while (hasNextPage && pages < 5) {
        pages++;
        const mediaRes = await adapter.getAccountMedia(accessToken, platform_account_id, nextCursor);
        const posts = mediaRes.data;

        for (const item of posts) {
          // Determine source. If it matches a post we already have locally by platform_post_id, keep it.
          // Otherwise, it's EXTERNAL.
          const existingPost = await sql`
            SELECT id, source FROM posts WHERE social_account_id = ${socialAccountId} AND platform_post_id = ${item.id}
          `;

          let postId = '';

          if (existingPost.length > 0) {
            postId = existingPost[0]!.id;
            // Update caption and fetched_at
            await sql`
              UPDATE posts 
              SET caption = ${item.caption || ''}, fetched_at = NOW(), updated_at = NOW()
              WHERE id = ${postId}
            `;
            updatedPosts++;
          } else {
            // New EXTERNAL post
            const insertRes = await sql`
              INSERT INTO posts (
                social_account_id, platform_post_id, caption, media_type, published_at, 
                status, source, fetched_at
              ) VALUES (
                ${socialAccountId}, ${item.id}, ${item.caption || ''}, ${item.media_type},
                ${new Date(item.timestamp)}, 'published', 'EXTERNAL', NOW()
              ) RETURNING id
            `;
            postId = insertRes[0]!.id;
            newPosts++;
          }

          // Fetch insights for the post
          try {
            const insights = await adapter.getPostInsights(accessToken, item.id);
            if (insights) {
              await sql`
                INSERT INTO post_metrics (
                  post_id, captured_at, impressions, reach, views, saves
                ) VALUES (
                  ${postId}, NOW(), ${insights.impressions}, ${insights.reach}, ${insights.views}, ${insights.saves}
                )
              `;
              insightsFetched++;
            }
          } catch (err: any) {
            console.warn(`[InstagramSyncWorker] Failed to fetch insights for post ${item.id}: ${err.message}`);
          }
          
          // Small delay to prevent rate limits
          await new Promise(r => setTimeout(r, 200));
        }

        if (mediaRes.paging && mediaRes.paging.cursors && mediaRes.paging.cursors.after) {
          nextCursor = mediaRes.paging.cursors.after;
        } else {
          hasNextPage = false;
        }
      }

      // 5. Update sync run status
      await sql`
        UPDATE instagram_sync_runs 
        SET status = 'COMPLETED', completed_at = NOW(),
            new_posts = new_posts + ${newPosts},
            updated_posts = updated_posts + ${updatedPosts},
            insights_fetched = insights_fetched + ${insightsFetched},
            last_cursor = ${nextCursor || null}
        WHERE id = ${syncRunId}
      `;

      // 6. Return control to orchestrator to continue its decision loop
      if (agentRunId && goalId) {
        await queues.orchestrator.add('evaluate-next-action', {
          socialAccountId,
          agentRunId,
          goalId,
          attemptNumber: 1
        });
      }

      // Telegram: sync completed
      try {
        const userRows = await sql`SELECT user_id FROM social_accounts WHERE id = ${socialAccountId} LIMIT 1`;
        if (userRows.length > 0) {
          await telegramService.send({
            eventType: 'INSTAGRAM_SYNC_COMPLETED',
            userId: userRows[0]!.userId as string,
            message: formatInstagramSyncCompleted(newPosts, insightsFetched, env.EVOLVR_DASHBOARD_URL),
            idempotencyKey: `tg:INSTAGRAM_SYNC_COMPLETED:${syncRunId}`,
            actionUrl: `${env.EVOLVR_DASHBOARD_URL}/dashboard/analytics`,
          });
        }
      } catch (tgErr) {
        console.warn('[InstagramSyncWorker] Telegram INSTAGRAM_SYNC_COMPLETED notification failed:', tgErr);
      }

      return { status: 'completed', newPosts, updatedPosts, insightsFetched };
    } catch (err: any) {
      console.error(`[InstagramSyncWorker] Failed job ${job.id}`, err);
      
      const isAuthError = err.message.includes('AUTH_REQUIRED');
      const status = isAuthError ? 'AUTH_REQUIRED' : 'FAILED';
      
      if (syncRunId) {
        await sql`
          UPDATE instagram_sync_runs 
          SET status = ${status}, completed_at = NOW(),
              errors = errors || ${JSON.stringify([{ message: err.message, time: new Date() }])}::jsonb
          WHERE id = ${syncRunId}
        `;
      }

      // If it's an auth error, update social account status
      if (isAuthError) {
        await sql`
          UPDATE social_accounts SET connection_status = 'expired' WHERE id = ${socialAccountId}
        `;

        // Telegram: auth failure — critical, notify immediately
        try {
          const userRows = await sql`SELECT user_id FROM social_accounts WHERE id = ${socialAccountId} LIMIT 1`;
          if (userRows.length > 0) {
            await telegramService.send({
              eventType: 'INSTAGRAM_AUTH_FAILURE',
              userId: userRows[0]!.userId as string,
              message: formatInstagramAuthFailure(env.EVOLVR_DASHBOARD_URL),
              idempotencyKey: `tg:INSTAGRAM_AUTH_FAILURE:${socialAccountId}`,
              actionUrl: `${env.EVOLVR_DASHBOARD_URL}/dashboard/settings`,
            });
          }
        } catch (tgErr) {
          console.warn('[InstagramSyncWorker] Telegram INSTAGRAM_AUTH_FAILURE notification failed:', tgErr);
        }
      }

      const isRetryable = !isAuthError;
      
      if (isRetryable && attemptNumber < maxAttempts) {
        throw err; // Let BullMQ retry
      }

      // Final failure logic
      if (agentRunId && goalId) {
        // Return to orchestrator, letting it know sync failed but it can decide what to do next
        await queues.orchestrator.add('evaluate-next-action', {
          socialAccountId,
          agentRunId,
          goalId,
          attemptNumber: 1
        });
      }

      throw err;
    }
  }, { 
    connection: redisConnection,
    limiter: { max: 2, duration: 1000 }
  });

  return worker;
};
