import { FastifyInstance } from 'fastify';
import { sql } from '../../db/client.js';
import { LocalStorageAdapter } from '../storage/local.adapter.js';
import { randomUUID } from 'crypto';
import path from 'path';

export default async function mediaRoutes(app: FastifyInstance) {
  const storageAdapter = new LocalStorageAdapter();

  app.addHook('onRequest', app.authenticate);

  app.post('/media/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const { contentIdeaId, mediaRequirementId } = (data.fields as any);
    
    if (!contentIdeaId?.value || !mediaRequirementId?.value) {
      data.file.resume(); // consume stream to prevent hang
      return reply.code(400).send({ error: 'Missing contentIdeaId or mediaRequirementId' });
    }

    // Validate the media requirement belongs to this user
    const reqs = await sql`
      SELECT mr.*, ci.social_account_id
      FROM media_requirements mr
      JOIN content_ideas ci ON ci.id = mr.content_idea_id
      JOIN social_accounts sa ON sa.id = ci.social_account_id
      WHERE mr.id = ${mediaRequirementId.value} AND sa.user_id = ${(request as any).user.id}
    `;

    if (!reqs.length) {
      data.file.resume(); // consume stream to prevent hang
      return reply.code(404).send({ error: 'Media requirement not found or unauthorized' });
    }

    const req = reqs[0];
    const buffer = await data.toBuffer();
    
    // Determine extension
    const ext = path.extname(data.filename) || (data.mimetype.includes('video') ? '.mp4' : '.jpg');
    const filename = `media_manual_${req.id}_${Date.now()}${ext}`;

    const storageUrl = await storageAdapter.saveFile(filename, buffer);
    const assetId = randomUUID();

    await sql.begin(async (sql) => {
      // 1. Mark existing active assets as REPLACED for this requirement
      await sql`
        UPDATE content_assets 
        SET asset_status = 'REPLACED'
        WHERE media_requirement_id = ${req.id} AND asset_status = 'ACTIVE'
      `;

      // 2. Insert new asset
      await sql`
        INSERT INTO content_assets
          (id, content_idea_id, media_requirement_id, asset_type, storage_url, mime_type, 
           generation_status, source, asset_status, uploaded_by)
        VALUES
          (${assetId}, ${req.contentIdeaId}, ${req.id}, ${req.mediaType}, ${storageUrl}, ${data.mimetype},
           'generated', 'USER_UPLOADED', 'ACTIVE', ${(request as any).user.id})
      `;

      // 3. Mark requirement as READY
      await sql`
        UPDATE media_requirements
        SET status = 'READY', updated_at = NOW()
        WHERE id = ${req.id}
      `;

      // 4. Mark content idea as ready
      await sql`
        UPDATE content_ideas
        SET asset_generation_status = 'completed',
            needs_attention = false,
            needs_attention_reason = NULL,
            updated_at = NOW()
        WHERE id = ${req.contentIdeaId}
      `;

      // 5. Audit log
      await sql`
        INSERT INTO agent_events (
          agent_run_id, agent_step_id, event_type, level, message, metadata
        ) VALUES (
          NULL, NULL, 'USER_MEDIA_UPLOADED', 'info', 
          'User manually uploaded media to satisfy requirement',
          ${sql.json({ assetId, mediaRequirementId: req.id })}
        )
      `;
    });

    // Note: Auto-scheduling trigger logic will be handled later in the flow
    // or by a webhook/background job depending on the exact architecture.

    return { success: true, assetId, storageUrl };
  });

  app.get('/media/requirements/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const reqs = await sql`
      SELECT mr.*, 
        json_agg(
          json_build_object(
            'id', ca.id,
            'source', ca.source,
            'status', ca.asset_status,
            'storageUrl', ca.storage_url,
            'createdAt', ca.created_at
          ) ORDER BY ca.created_at DESC
        ) FILTER (WHERE ca.id IS NOT NULL) as assets
      FROM media_requirements mr
      LEFT JOIN content_assets ca ON ca.media_requirement_id = mr.id
      WHERE mr.id = ${id}
      GROUP BY mr.id
    `;

    if (!reqs.length) return reply.code(404).send({ error: 'Not found' });
    
    return { success: true, data: reqs[0] };
  });

  app.post('/media/:id/activate', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const assets = await sql`SELECT * FROM content_assets WHERE id = ${id}`;
    if (!assets.length) return reply.code(404).send({ error: 'Asset not found' });
    
    const reqId = assets[0].mediaRequirementId;

    await sql.begin(async (sql) => {
      await sql`
        UPDATE content_assets 
        SET asset_status = 'REPLACED'
        WHERE media_requirement_id = ${reqId} AND asset_status = 'ACTIVE'
      `;
      
      await sql`
        UPDATE content_assets 
        SET asset_status = 'ACTIVE'
        WHERE id = ${id}
      `;
    });

    return { success: true };
  });
}
