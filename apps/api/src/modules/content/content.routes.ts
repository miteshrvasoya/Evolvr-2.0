import { FastifyInstance } from 'fastify';
import { sql } from '../../db/client.js';

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
}
