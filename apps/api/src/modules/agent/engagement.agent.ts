import { sql } from '../../db/client.js';
import { randomUUID } from 'crypto';
import { getLLMProvider } from '../llm/index.js';
import { generateCommentReplyPrompt, CommentContext } from '../../prompts/learning.v1.js';

export class EngagementAgent {
  private llm = getLLMProvider();

  async processComment(commentId: string) {
    const runId = randomUUID();
    
    // Fetch comment and context
    const comments = await sql`
      SELECT c.*, p.caption, a.id as account_id
      FROM comments c
      JOIN posts p ON c.post_id = p.id
      JOIN social_accounts a ON c.social_account_id = a.id
      WHERE c.id = ${commentId}
    `;
    const comment = comments[0];
    if (!comment) throw new Error('Comment not found');

    const profiles = await sql`SELECT brand_voice, banned_topics FROM account_profiles WHERE social_account_id = ${comment.accountId}`;
    const profile = profiles[0] || {};

    const context: CommentContext = {
      postCaption: comment.caption,
      commentAuthor: comment.authorHandle,
      commentText: comment.text,
      brandVoice: JSON.stringify(profile.brandVoice || {}),
      bannedTopics: profile.bannedTopics || [],
    };

    const prompt = generateCommentReplyPrompt(context);
    const llmResponse = await this.llm.generateStructured(prompt);
    
    if (!llmResponse.structured) throw new Error('Failed to parse comment analysis');
    const analysis = llmResponse.structured;

    await sql.begin(async (sql) => {
      // Update comment analysis
      await sql`
        UPDATE comments 
        SET sentiment = ${analysis.sentiment}, intent = ${analysis.intent}, 
            risk_level = ${analysis.riskLevel}, status = 'processed'
        WHERE id = ${commentId}
      `;

      // Create Engagement Action if reply generated
      if (analysis.suggestedReply && analysis.riskLevel === 'low') {
        // We set status to 'pending' for manual approval, or 'approved' if fully autonomous
        // (Simplified to pending for scaffold)
        await sql`
          INSERT INTO engagement_actions (comment_id, action_type, draft_text, status)
          VALUES (${commentId}, 'reply', ${analysis.suggestedReply}, 'pending')
        `;
      }
    });

    return { analysis };
  }
}
