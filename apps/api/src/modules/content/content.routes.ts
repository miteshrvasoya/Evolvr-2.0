import { FastifyInstance } from 'fastify';
import { sql } from '../../db/client.js';
import { ContentScheduler } from './scheduler.js';
import { LocalStorageAdapter } from '../storage/local.adapter.js';
import path from 'path';
import fs from 'fs';

export default async function contentRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  async function getPrimaryAccount(userId: string) {
    const accounts = await sql`SELECT id FROM social_accounts WHERE user_id = ${userId} LIMIT 1`;
    return accounts[0]?.id;
  }

  app.get('/content/calendar', async (request: any, reply) => {
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);

    if (!accountId) {
      return { 
        success: true, 
        data: {
          scheduled: [], 
          published: [], 
          failed: [], 
          awaitingReview: [], 
          ideas: {} 
        }
      };
    }

    // Fetch posts
    const postsRaw = await sql`SELECT * FROM posts WHERE social_account_id = ${accountId} ORDER BY scheduled_at ASC`;
    const scheduled = postsRaw.filter(p => p.status === 'scheduled');
    const published = postsRaw.filter(p => p.status === 'published');
    const failed = postsRaw.filter(p => p.status === 'failed');
    const awaitingReview = postsRaw.filter(p => p.status === 'awaiting_review' || p.status === 'draft');

    // Fetch ideas
    const ideasRaw = await sql`SELECT * FROM content_ideas WHERE social_account_id = ${accountId}`;
    const ideas: Record<string, any> = {};
    for (const idea of ideasRaw) {
      ideas[idea.id] = idea;
    }

    return {
      success: true,
      data: {
        scheduled,
        published,
        failed,
        awaitingReview,
        ideas
      }
    };
  });

  app.post('/content/posts/:postId/approve', async (request: any, reply) => {
    const { postId } = request.params;
    await sql`UPDATE posts SET status = 'scheduled' WHERE id = ${postId}`;
    return { success: true, data: {} };
  });

  app.post('/content/posts/:postId/reject', async (request: any, reply) => {
    const { postId } = request.params;
    const { reason } = request.body;
    await sql`UPDATE posts SET status = 'failed', failure_reason = ${reason} WHERE id = ${postId}`;
    return { success: true, data: {} };
  });

  // Schedule an idea (turns it into a post)
  app.post('/content/ideas/:ideaId/approve', async (request: any, reply) => {
    const { ideaId } = request.params;
    const { scheduledAt } = request.body;
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);
    
    if (!accountId) throw new Error('Account not found');

    const scheduler = new ContentScheduler();
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : undefined;
    const result = await scheduler.schedulePost(ideaId, accountId, scheduledDate);

    return { success: true, data: result };
  });

  // Edit an idea (e.g. update caption before approval)
  app.patch('/content/ideas/:ideaId', async (request: any, reply) => {
    const { ideaId } = request.params;
    const { caption, hook } = request.body;
    await sql`UPDATE content_ideas SET caption = COALESCE(${caption}, caption), hook = COALESCE(${hook}, hook) WHERE id = ${ideaId}`;
    return { success: true, data: {} };
  });

  // Upload an asset for an idea
  app.post('/content/ideas/:ideaId/asset', async (request: any, reply) => {
    const { ideaId } = request.params;
    const data = await request.file();
    if (!data) throw new Error('No file uploaded');

    const buffer = await data.toBuffer();
    const storageAdapter = new LocalStorageAdapter();
    const ext = path.extname(data.filename) || '.jpg';
    const filename = `manual_${ideaId}_${Date.now()}${ext}`;
    const storageUrl = await storageAdapter.saveFile(filename, buffer);

    // Update or insert asset
    const existingAsset = await sql`SELECT id FROM content_assets WHERE content_idea_id = ${ideaId} LIMIT 1`;
    if (existingAsset.length > 0) {
      await sql`UPDATE content_assets SET storage_url = ${storageUrl}, mime_type = ${data.mimetype} WHERE id = ${existingAsset[0].id}`;
    } else {
      await sql`INSERT INTO content_assets (content_idea_id, asset_type, storage_url, mime_type) VALUES (${ideaId}, 'image', ${storageUrl}, ${data.mimetype})`;
    }

    return { success: true, data: { storageUrl } };
  });

  app.get('/content/drafts', async (request: any, reply) => {
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);
    if (!accountId) return { success: true, data: [] };

    const ideas = await sql`
      SELECT 
        ci.*,
        json_agg(
          json_build_object(
            'id', ca.id,
            'asset_type', ca.asset_type,
            'storage_url', ca.storage_url,
            'prompt', ca.prompt
          )
        ) FILTER (WHERE ca.id IS NOT NULL) as assets
      FROM content_ideas ci
      LEFT JOIN content_assets ca ON ci.id = ca.content_idea_id
      WHERE ci.social_account_id = ${accountId}
      GROUP BY ci.id
      ORDER BY ci.created_at DESC
    `;

    return { success: true, data: ideas };
  });
}
