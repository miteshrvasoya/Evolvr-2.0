import { sql } from '../../db/client.js';
import { randomUUID } from 'crypto';

export class ContentScheduler {
  
  async schedulePost(contentIdeaId: string, accountId: string) {
    // 1. Fetch Idea
    const ideas = await sql`SELECT * FROM content_ideas WHERE id = ${contentIdeaId} AND status = 'draft'`;
    const idea = ideas[0];
    
    if (!idea) throw new Error('Valid draft content idea not found');

    // 2. Determine best time window
    // (Simplified logic: schedule 1 day from now at 10 AM)
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + 1);
    scheduledAt.setHours(10, 0, 0, 0);

    // 3. Create Post Record
    const postId = randomUUID();
    const idempotencyKey = `publish:${accountId}:${idea.id}:${scheduledAt.getTime()}`;

    await sql.begin(async (sql) => {
      // Update Idea status
      await sql`UPDATE content_ideas SET status = 'scheduled' WHERE id = ${idea.id}`;

      // Insert Post
      await sql`
        INSERT INTO posts (
          id, social_account_id, content_idea_id, caption, media_type, scheduled_at, status, strategy_version_id, idempotency_key
        ) VALUES (
          ${postId}, ${accountId}, ${idea.id}, ${idea.caption}, ${idea.format}, ${scheduledAt}, 'scheduled', ${idea.strategyVersionId}, ${idempotencyKey}
        )
      `;

      // 4. Enqueue BullMQ Job
      // In full implementation:
      // await queues.publishing.add('publish', { postId }, { delay: scheduledAt.getTime() - Date.now() })
    });

    return { success: true, postId, scheduledAt };
  }
}
