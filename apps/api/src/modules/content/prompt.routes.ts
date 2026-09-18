import { FastifyInstance } from 'fastify';
import { sql } from '../../db/client.js';

export default async function promptRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  async function getPrimaryAccount(userId: string) {
    const accounts = await sql`SELECT id FROM social_accounts WHERE user_id = ${userId} LIMIT 1`;
    return accounts[0]?.id;
  }

  // Get all prompts for the prompt library
  app.get('/prompts', async (request: any, reply) => {
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);
    if (!accountId) return reply.code(400).send({ error: 'No social account connected' });

    const { status, type } = request.query as { status?: string; type?: string };

    let query = sql`
      SELECT 
        cap.id, cap.prompt_text as "promptText", cap.prompt_version as "promptVersion", 
        cap.asset_type as "assetType", cap.source, cap.status, cap.created_at as "createdAt",
        ci.id as "contentIdeaId", ci.concept, ci.format,
        mr.id as "mediaRequirementId", mr.status as "mediaStatus",
        sv.version_number as "strategyVersion"
      FROM content_asset_prompts cap
      JOIN content_ideas ci ON ci.id = cap.content_idea_id
      JOIN strategy_versions sv ON sv.id = ci.strategy_version_id
      LEFT JOIN media_requirements mr ON mr.id = cap.media_requirement_id
      WHERE ci.social_account_id = ${accountId}
    `;

    if (status === 'needs_media') {
      query = sql`${query} AND mr.status IN ('PENDING', 'FAILED')`;
    } else if (status === 'ready') {
      query = sql`${query} AND mr.status = 'READY'`;
    }

    if (type) {
      query = sql`${query} AND cap.asset_type = ${type}`;
    }

    query = sql`${query} ORDER BY cap.created_at DESC LIMIT 100`;

    const prompts = await query;
    return { success: true, data: prompts };
  });

  // Get details of a single prompt
  app.get('/prompts/:id', async (request: any, reply) => {
    const { id } = request.params as { id: string };
    const { id: userId } = request.user;
    
    // Auth validation handled via social account check on the idea
    const prompts = await sql`
      SELECT cap.*, ci.social_account_id
      FROM content_asset_prompts cap
      JOIN content_ideas ci ON ci.id = cap.content_idea_id
      WHERE cap.id = ${id}
    `;

    if (!prompts.length) return reply.code(404).send({ error: 'Not found' });
    const prompt = prompts[0];

    // Auth check
    const accountId = await getPrimaryAccount(userId);
    if (prompt.socialAccountId !== accountId) {
      return reply.code(403).send({ error: 'Unauthorized' });
    }

    // Get generation history
    const history = await sql`
      SELECT * FROM content_asset_generation_attempts
      WHERE content_asset_prompt_id = ${id}
      ORDER BY attempt_number DESC
    `;

    return { success: true, data: { ...prompt, history } };
  });
}
