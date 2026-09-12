import { sql } from '../../db/client.js';
import { AgentRunTracker } from './agent-tracker.js';
import { getInstagramAdapter } from '../social/adapters/index.js';
import { decryptToken } from '../common/encryption.js';
import { env } from '../../config/env.js';

export class PublishingAgent {
  async runPublishing(socialAccountId: string, postId: string, agentRunId: string, attemptNumber: number, maxAttempts: number) {
    const tracker = new AgentRunTracker(agentRunId);
    const stepId = await tracker.startStep('publish_post', attemptNumber, maxAttempts);

    try {
      await tracker.addLog(`Starting publishing phase for post ${postId}`);

      // 1. Fetch Post and associated Media
      const posts = await sql`
        SELECT p.id, p.caption, ca.storage_url, ca.asset_type
        FROM posts p
        JOIN content_ideas ci ON p.content_idea_id = ci.id
        LEFT JOIN content_assets ca ON ci.id = ca.content_idea_id
        WHERE p.id = ${postId} AND p.social_account_id = ${socialAccountId}
        LIMIT 1
      `;
      const post = posts[0];
      
      if (!post) throw new Error('Post not found or lacks media asset');
      if (!post.storageUrl) throw new Error('Post does not have an associated media URL');

      await tracker.addLog(`Found post with asset: ${post.storageUrl}`);

      // 2. Determine Media URL
      // Since Instagram requires a publicly accessible URL, if SIMULATION_MODE is true, 
      // or we use local storage without a tunnel, we need to mock it or use a placeholder.
      let finalMediaUrl = post.storageUrl;
      const isLocal = finalMediaUrl.includes('localhost') || finalMediaUrl.startsWith('./');
      
      if (env.SIMULATION_MODE || (isLocal && !env.STORAGE_PUBLIC_URL)) {
        await tracker.addLog(`Simulation mode active or local storage without tunnel. Using generic placeholder image for Meta API.`);
        // Must be a public image for Instagram API to accept it
        finalMediaUrl = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
      } else if (isLocal && env.STORAGE_PUBLIC_URL) {
        // Map local path to public ngrok tunnel
        const filename = finalMediaUrl.split('/').pop();
        finalMediaUrl = `${env.STORAGE_PUBLIC_URL}/storage/${filename}`;
      }

      // 3. Fetch Credentials
      const accounts = await sql`
        SELECT platform_account_id, access_token_encrypted 
        FROM social_accounts 
        WHERE id = ${socialAccountId}
      `;
      const account = accounts[0];
      if (!account || !account.accessTokenEncrypted) {
        throw new Error('Social account lacks access token');
      }
      
      const accessToken = decryptToken(account.accessTokenEncrypted);
      const igAdapter = getInstagramAdapter();

      // 4. Publish via Adapter
      await tracker.addLog(`Uploading media and publishing to Instagram...`);
      const start = Date.now();
      
      let platformPostId = 'sim_123';
      let statusCode = 200;

      try {
        if (!env.SIMULATION_MODE) {
          const result = await igAdapter.publishPost(accessToken, account.platformAccountId, finalMediaUrl, post.caption || '');
          platformPostId = result.platformPostId;
        } else {
          // Simulate latency
          await new Promise(r => setTimeout(r, 2500));
        }
      } catch (err: any) {
        statusCode = err.status || 500;
        const latencyMs = Date.now() - start;
        await tracker.logToolCall(stepId, `Failed to publish post: ${err.message}`, 'instagram_graph_api', 'https://graph.instagram.com/me/media_publish', statusCode, latencyMs);
        throw err;
      }

      const latencyMs = Date.now() - start;
      await tracker.logToolCall(stepId, `Successfully published post ${platformPostId}`, 'instagram_graph_api', 'https://graph.instagram.com/me/media_publish', statusCode, latencyMs);

      // 5. Update Database
      await sql`
        UPDATE posts 
        SET status = 'published', platform_post_id = ${platformPostId}, published_at = NOW() 
        WHERE id = ${postId}
      `;

      await tracker.completeStep(stepId, { platformPostId });

      return { success: true, platformPostId };

    } catch (error: any) {
      await tracker.failStep(stepId, error.message, true, new Date(Date.now() + 5000));
      throw { error, stepId };
    }
  }
}
