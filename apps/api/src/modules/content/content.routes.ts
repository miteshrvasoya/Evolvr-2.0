import { FastifyInstance } from 'fastify';
import { sql } from '../../db/client.js';
import { ContentScheduler } from './scheduler.js';
import { LocalStorageAdapter } from '../storage/local.adapter.js';
import { AssetGenerationService } from '../media/asset-generation.service.js';
import { queues } from '../../queues/index.js';
import { getLLMProvider } from '../llm/index.js';
import { getStorageAdapter } from '../storage/index.js';
import path from 'path';

export default async function contentRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);
  const assetService = new AssetGenerationService();

  async function getPrimaryAccount(userId: string) {
    const accounts = await sql`SELECT id FROM social_accounts WHERE user_id = ${userId} LIMIT 1`;
    return accounts[0]?.id;
  }

  // ── Content Library ─────────────────────────────────────────────────────────
  // GET /content/ideas?status=&assetStatus=&search=&page=&limit=
  app.get('/content/ideas', async (request: any, reply) => {
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);
    if (!accountId) return { success: true, data: [], total: 0 };

    const {
      status,
      assetStatus,
      search,
      strategyVersionId,
      page = '1',
      limit = '20',
    } = request.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const ideas = await sql`
      SELECT
        ci.id, ci.pillar, ci.format, ci.concept, ci.hook, ci.caption,
        ci.hashtags, ci.status, ci.asset_generation_status, ci.needs_attention,
        ci.needs_attention_reason, ci.strategy_version_id, ci.version_number,
        ci.created_at, ci.updated_at,
        -- Latest asset info
        (SELECT json_build_object(
          'id', ca.id,
          'asset_type', ca.asset_type,
          'storage_url', ca.storage_url,
          'generation_status', ca.generation_status
        ) FROM content_assets ca WHERE ca.content_idea_id = ci.id
          ORDER BY ca.created_at DESC LIMIT 1) AS primary_asset,
        -- Latest prompt info
        (SELECT json_build_object(
          'id', cap.id,
          'prompt_text', cap.prompt_text,
          'prompt_version', cap.prompt_version,
          'asset_type', cap.asset_type,
          'source', cap.source
        ) FROM content_asset_prompts cap WHERE cap.content_idea_id = ci.id
          ORDER BY cap.created_at DESC LIMIT 1) AS latest_prompt
      FROM content_ideas ci
      WHERE ci.social_account_id = ${accountId}
        ${status ? sql`AND ci.status = ${status}` : sql``}
        ${assetStatus === 'failed' ? sql`AND ci.asset_generation_status = 'needs_attention'` :
        assetStatus === 'pending' ? sql`AND ci.asset_generation_status IN ('pending', 'generating')` :
          assetStatus === 'ok' ? sql`AND ci.asset_generation_status = 'completed'` :
            sql``}
        ${strategyVersionId ? sql`AND ci.strategy_version_id = ${strategyVersionId}` : sql``}
        ${search ? sql`AND (ci.hook ILIKE ${'%' + search + '%'} OR ci.caption ILIKE ${'%' + search + '%'} OR ci.concept ILIKE ${'%' + search + '%'})` : sql``}
      ORDER BY ci.created_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const countResult = await sql`
      SELECT COUNT(*) AS c FROM content_ideas ci
      WHERE ci.social_account_id = ${accountId}
        ${status ? sql`AND ci.status = ${status}` : sql``}
        ${assetStatus === 'failed' ? sql`AND ci.asset_generation_status = 'needs_attention'` : sql``}
    `;

    return {
      success: true,
      data: ideas,
      total: Number(countResult[0]?.c || 0),
      page: pageNum,
      limit: limitNum,
    };
  });

  // ── Content Detail ───────────────────────────────────────────────────────────
  app.get('/content/ideas/:id', async (request: any, reply) => {
    const { id: ideaId } = request.params as any;
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);

    const ideas = await sql`
      SELECT ci.*, sv.version_number AS strategy_version_number
      FROM content_ideas ci
      LEFT JOIN strategy_versions sv ON ci.strategy_version_id = sv.id
      WHERE ci.id = ${ideaId} AND ci.social_account_id = ${accountId}
    `;
    if (!ideas.length) return reply.status(404).send({ error: 'Not found' });

    const idea = ideas[0];

    const assets = await sql`
      SELECT ca.*, CONCAT('https://pub-108c4ad3ad144a5abce192ab07cef226.r2.dev/', ca.object_key) AS storageurl, caga.attempt_number, caga.status AS attempt_status,
             caga.error_category, caga.error_message
      FROM content_assets ca
      LEFT JOIN content_asset_generation_attempts caga ON ca.generation_attempt_id = caga.id
      WHERE ca.content_idea_id = ${ideaId}
      ORDER BY ca.created_at DESC
    `;

    const prompts = await sql`
      SELECT * FROM content_asset_prompts
      WHERE content_idea_id = ${ideaId}
      ORDER BY prompt_version DESC
    `;

    const requirements = await sql`
      SELECT * FROM media_requirements
      WHERE content_idea_id = ${ideaId}
    `;

    const versions = await sql`
      SELECT * FROM content_idea_versions
      WHERE content_idea_id = ${ideaId}
      ORDER BY version_number DESC
    `;

    return {
      success: true,
      data: { ...idea, assets, prompts, versions, mediaRequirements: requirements },
    };
  });

  // ── Content Versions ─────────────────────────────────────────────────────────
  app.get('/content/ideas/:id/versions', async (request: any, reply) => {
    const { id: ideaId } = request.params as any;
    const versions = await sql`
      SELECT * FROM content_idea_versions WHERE content_idea_id = ${ideaId}
      ORDER BY version_number DESC
    `;
    return { success: true, data: versions };
  });

  // ── Asset Prompts ─────────────────────────────────────────────────────────────
  app.get('/content/ideas/:id/prompts', async (request: any, reply) => {
    const { id: ideaId } = request.params as any;
    const prompts = await sql`
      SELECT * FROM content_asset_prompts WHERE content_idea_id = ${ideaId}
      ORDER BY created_at DESC
    `;
    return { success: true, data: prompts };
  });

  // ── Generation History ────────────────────────────────────────────────────────
  app.get('/content/ideas/:id/generation-history', async (request: any, reply) => {
    const { id: ideaId } = request.params as any;
    const attempts = await sql`
      SELECT caga.*, cap.prompt_text, cap.prompt_version, cap.source AS prompt_source
      FROM content_asset_generation_attempts caga
      LEFT JOIN content_asset_prompts cap ON caga.content_asset_prompt_id = cap.id
      WHERE caga.content_idea_id = ${ideaId}
      ORDER BY caga.created_at DESC
    `;
    return { success: true, data: attempts };
  });

  // ── Edit Prompt (user-edited version) ─────────────────────────────────────────
  app.patch('/content/prompts/:promptId', async (request: any, reply) => {
    const { promptId } = request.params as any;
    const { promptText } = request.body as any;
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);

    if (!promptText?.trim()) return reply.status(400).send({ error: 'promptText is required' });

    // Verify ownership
    const existing = await sql`
      SELECT cap.*, ci.social_account_id, cap.media_requirement_id
      FROM content_asset_prompts cap
      JOIN content_ideas ci ON cap.content_idea_id = ci.id
      WHERE cap.id = ${promptId} AND ci.social_account_id = ${accountId}
    `;
    if (!existing.length) return reply.status(404).send({ error: 'Prompt not found' });

    const original = existing[0]!;

    // Create a new user-edited version (never overwrite original)
    const newPromptId = await assetService.persistPrompt({
      contentIdeaId: original.contentIdeaId,
      mediaRequirementId: original.media_requirement_id as string,
      assetType: original.assetType,
      promptText: promptText.trim(),
      source: 'user_edited',
      originalPromptId: original.id,
    });

    return { success: true, data: { newPromptId } };
  });

  // ── Improve Prompt via LLM ───────────────────────────────────────────────────
  app.post('/content/ideas/:id/improve-prompt', async (request: any, reply) => {
    const { id: ideaId } = request.params as any;
    const { assetType = 'image', currentPromptId } = request.body as any;
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);

    // Verify ownership
    const ideas = await sql`
      SELECT ci.*, sv.rationale AS strategy_rationale
      FROM content_ideas ci
      LEFT JOIN strategy_versions sv ON ci.strategy_version_id = sv.id
      WHERE ci.id = ${ideaId} AND ci.social_account_id = ${accountId}
    `;
    if (!ideas.length) return reply.status(404).send({ error: 'Content not found' });
    const idea = ideas[0]!;

    // Get current/latest prompt
    const prompts = await sql`
      SELECT * FROM content_asset_prompts
      WHERE content_idea_id = ${ideaId} AND asset_type = ${assetType}
      ORDER BY prompt_version DESC LIMIT 1
    `;
    const latestPrompt = prompts[0];

    // Get last failure reason if any
    const lastAttempt = await sql`
      SELECT error_category, error_message
      FROM content_asset_generation_attempts
      WHERE content_idea_id = ${ideaId} AND asset_type = ${assetType} AND status = 'failed'
      ORDER BY created_at DESC LIMIT 1
    `;

    // Ask LLM to improve the prompt
    const llm = getLLMProvider();
    const systemPrompt = `You are an expert image/video prompt engineer. Your job is to rewrite a media generation prompt that previously failed or underperformed.

Improve the prompt based on:
- The content concept and hook
- The target format
- Previous failure reason (if any)
- What makes effective visual prompts

Rules:
- Return ONLY a JSON object with field "improvedPrompt" (string)
- The improved prompt should be highly detailed, specific, and visually descriptive
- Do NOT include unsafe or policy-violating content
- Keep prompts under 400 characters for best compatibility`;

    const userPrompt = `Content:
Concept: ${idea.concept}
Hook: ${idea.hook}
Format: ${idea.format}
Caption: ${(idea.caption || '').slice(0, 200)}

Current prompt:
${latestPrompt?.promptText || 'No prompt available'}

${lastAttempt.length > 0 ? `Last failure:
Category: ${lastAttempt[0]!.errorCategory}
Reason: ${lastAttempt[0]!.errorMessage}` : ''}

Provide an improved prompt.`;

    const response = await llm.generateStructured({
      systemPrompt,
      userPrompt,
      outputSchema: { type: 'object', properties: { improvedPrompt: { type: 'string' } } } as any,
      schemaName: 'improvedPromptOutput',
    });

    const improvedPromptText = (response.structured as any)?.improvedPrompt
      || latestPrompt?.promptText
      || (idea as any).concept;

    // Save as new 'improved' version
    const newPromptId = await assetService.persistPrompt({
      contentIdeaId: ideaId,
      mediaRequirementId: latestPrompt?.media_requirement_id || (idea as any).mediaRequirementId || null as any,
      assetType: assetType as any,
      promptText: improvedPromptText,
      source: 'improved',
      originalPromptId: latestPrompt?.id,
    });

    return { success: true, data: { newPromptId, improvedPrompt: improvedPromptText } };
  });

  // ── Retry Asset Generation ───────────────────────────────────────────────────
  // Idempotent: returns 409 if generation already in progress
  app.post('/content/assets/:assetType/retry', async (request: any, reply) => {
    const { assetType } = request.params as any;
    const { ideaId } = request.body as any;
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);

    // Verify ownership
    const ideas = await sql`
      SELECT id, asset_generation_status FROM content_ideas
      WHERE id = ${ideaId} AND social_account_id = ${accountId}
    `;
    if (!ideas.length) return reply.status(404).send({ error: 'Content not found' });

    // Idempotency check — prevent duplicate generation
    const inProgress = await assetService.isGenerationInProgress(ideaId, assetType);
    if (inProgress) {
      return reply.status(409).send({
        error: 'Generation already in progress',
        message: 'A generation job is already running for this asset. Please wait.',
      });
    }

    // Get latest prompt for this asset type
    const prompts = await sql`
      SELECT * FROM content_asset_prompts
      WHERE content_idea_id = ${ideaId} AND asset_type = ${assetType}
      ORDER BY prompt_version DESC LIMIT 1
    `;
    if (!prompts.length) return reply.status(400).send({ error: 'No prompt available to retry with' });
    const prompt = prompts[0]!;

    // Determine next attempt number
    const attempts = await sql`
      SELECT COALESCE(MAX(attempt_number), 0) AS max_attempt
      FROM content_asset_generation_attempts
      WHERE content_idea_id = ${ideaId} AND asset_type = ${assetType}
    `;
    const nextAttempt = Number(attempts[0]?.maxAttempt || 0) + 1;
    const idempotencyKey = `${ideaId}-${assetType}-${nextAttempt}`;

    await queues.mediaGeneration.add(
      'generate-asset',
      {
        contentIdeaId: ideaId,
        promptId: prompt.id,
        assetType,
        attemptNumber: nextAttempt,
        idempotencyKey,
      },
      { jobId: `asset-${ideaId}-${assetType}-${nextAttempt}` },
    );

    // Update idea status to pending
    await sql`
      UPDATE content_ideas
      SET asset_generation_status = 'pending', needs_attention = false, updated_at = NOW()
      WHERE id = ${ideaId}
    `;

    return { success: true, data: { queued: true, attemptNumber: nextAttempt } };
  });

  // ── Trigger generation with a specific prompt ─────────────────────────────────
  app.post('/content/ideas/:id/generate-asset', async (request: any, reply) => {
    const { id: ideaId } = request.params as any;
    const { promptId, assetType = 'image' } = request.body as any;
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);

    const ideas = await sql`SELECT id FROM content_ideas WHERE id = ${ideaId} AND social_account_id = ${accountId}`;
    if (!ideas.length) return reply.status(404).send({ error: 'Content not found' });

    const inProgress = await assetService.isGenerationInProgress(ideaId, assetType);
    if (inProgress) {
      return reply.status(409).send({ error: 'Generation already in progress' });
    }

    const prompts = await sql`SELECT * FROM content_asset_prompts WHERE id = ${promptId} AND content_idea_id = ${ideaId}`;
    if (!prompts.length) return reply.status(404).send({ error: 'Prompt not found' });

    const attempts = await sql`
      SELECT COALESCE(MAX(attempt_number), 0) AS max_attempt
      FROM content_asset_generation_attempts
      WHERE content_idea_id = ${ideaId} AND asset_type = ${assetType}
    `;
    const nextAttempt = Number(attempts[0]?.maxAttempt || 0) + 1;
    const idempotencyKey = `${ideaId}-${assetType}-${nextAttempt}`;

    await queues.mediaGeneration.add(
      'generate-asset',
      { contentIdeaId: ideaId, promptId, assetType, attemptNumber: nextAttempt, idempotencyKey },
      { jobId: `asset-${ideaId}-${assetType}-${nextAttempt}` },
    );

    await sql`UPDATE content_ideas SET asset_generation_status = 'pending', updated_at = NOW() WHERE id = ${ideaId}`;

    return { success: true, data: { queued: true, attemptNumber: nextAttempt } };
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Existing routes below (unchanged)
  // ─────────────────────────────────────────────────────────────────────────────

  app.get('/content/calendar', async (request: any, reply) => {
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);

    if (!accountId) {
      return {
        success: true,
        data: { scheduled: [], published: [], failed: [], awaitingReview: [], ideas: {} },
      };
    }

    const postsRaw = await sql`SELECT * FROM posts WHERE social_account_id = ${accountId} ORDER BY scheduled_at ASC`;
    const scheduled = postsRaw.filter(p => p.status === 'scheduled');
    const published = postsRaw.filter(p => p.status === 'published');
    const failed = postsRaw.filter(p => p.status === 'failed');
    const awaitingReview = postsRaw.filter(p => p.status === 'awaiting_review' || p.status === 'draft');

    const ideasRaw = await sql`SELECT * FROM content_ideas WHERE social_account_id = ${accountId}`;
    const ideas: Record<string, any> = {};
    for (const idea of ideasRaw) ideas[idea.id] = idea;

    return { success: true, data: { scheduled, published, failed, awaitingReview, ideas } };
  });

  app.post('/content/posts/:postId/approve', async (request: any, reply) => {
    const { postId } = request.params as any;
    await sql`UPDATE posts SET status = 'scheduled' WHERE id = ${postId}`;
    return { success: true, data: {} };
  });

  app.post('/content/posts/:postId/reject', async (request: any, reply) => {
    const { postId } = request.params as any;
    const { reason } = request.body as any;
    await sql`UPDATE posts SET status = 'failed', failure_reason = ${reason} WHERE id = ${postId}`;
    return { success: true, data: {} };
  });

  app.post('/content/ideas/:ideaId/approve', async (request: any, reply) => {
    const { ideaId } = request.params as any;
    const { scheduledAt } = request.body as any;
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);
    if (!accountId) throw new Error('Account not found');

    const scheduler = new ContentScheduler();
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : undefined;
    const result = await scheduler.schedulePost(ideaId, accountId, scheduledDate);
    return { success: true, data: result };
  });

  // Edit a content idea (creates a new version in content_idea_versions)
  app.patch('/content/ideas/:ideaId', async (request: any, reply) => {
    const { ideaId } = request.params as any;
    const { caption, hook, concept } = request.body as any;
    const { id: userId } = request.user;
    const accountId = await getPrimaryAccount(userId);

    const ideas = await sql`
      SELECT * FROM content_ideas WHERE id = ${ideaId} AND social_account_id = ${accountId}
    `;
    if (!ideas.length) return reply.status(404).send({ error: 'Not found' });
    const idea = ideas[0]!;

    // Update idea
    await sql`
      UPDATE content_ideas
      SET caption = COALESCE(${caption ?? null}, caption),
          hook = COALESCE(${hook ?? null}, hook),
          concept = COALESCE(${concept ?? null}, concept),
          version_number = version_number + 1,
          updated_at = NOW()
      WHERE id = ${ideaId}
    `;

    // Save new version snapshot
    const newVersion = (idea.versionNumber || 1) + 1;
    await sql`
      INSERT INTO content_idea_versions (
        content_idea_id, version_number, pillar, format, concept, hook, caption,
        hashtags, alt_text, changed_by, change_reason
      ) VALUES (
        ${ideaId}, ${newVersion}, ${(idea as any).pillar}, ${(idea as any).format},
        ${concept ?? (idea as any).concept}, ${hook ?? (idea as any).hook}, ${caption ?? (idea as any).caption},
        ${(idea as any).hashtags}, ${(idea as any).altText}, 'user', 'User edited'
      )
    `;

    return { success: true, data: {} };
  });

  // Upload an asset manually (MANUALLY_ADDED status)
  app.post('/content/ideas/:ideaId/asset', async (request: any, reply) => {
    const { ideaId } = request.params as any;
    const data = await request.file();
    if (!data) throw new Error('No file uploaded');

    const buffer = await data.toBuffer();
    const storageAdapter = getStorageAdapter();
    const ext = path.extname(data.filename) || '.jpg';
    const filename = `manual_${ideaId}_${Date.now()}${ext}`;
    const objectKey = `users/${(request as any).user.id}/uploads/${filename}`;
    const storageUrl = await storageAdapter.saveFile(objectKey, buffer);

    const existingAsset = await sql`SELECT id FROM content_assets WHERE content_idea_id = ${ideaId} AND source = 'MANUALLY_ADDED' LIMIT 1`;
    if (existingAsset.length > 0) {
      await sql`UPDATE content_assets SET storage_url = ${storageUrl}, mime_type = ${data.mimetype}, updated_at = NOW() WHERE id = ${existingAsset[0]!.id}`;
    } else {
      await sql`
        INSERT INTO content_assets (content_idea_id, asset_type, storage_url, mime_type, generation_status, source)
        VALUES (${ideaId}, 'image', ${storageUrl}, ${data.mimetype}, 'generated', 'MANUALLY_ADDED')
      `;
    }

    // Clear needs_attention if there's now a manual asset
    await sql`
      UPDATE content_ideas
      SET asset_generation_status = 'completed', needs_attention = false, needs_attention_reason = NULL, updated_at = NOW()
      WHERE id = ${ideaId}
    `;

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
            'prompt', ca.prompt,
            'generation_status', ca.generation_status,
            'source', ca.source
          )
        ) FILTER (WHERE ca.id IS NOT NULL) as assets,
        (SELECT cap.prompt_text FROM content_asset_prompts cap
         WHERE cap.content_idea_id = ci.id ORDER BY cap.prompt_version DESC LIMIT 1) AS latest_prompt
      FROM content_ideas ci
      LEFT JOIN content_assets ca ON ci.id = ca.content_idea_id
      WHERE ci.social_account_id = ${accountId}
      GROUP BY ci.id
      ORDER BY ci.created_at DESC
    `;

    return { success: true, data: ideas };
  });

  // ── Ungenerated Prompts grouped by Agent Run ──────────────────────────────
  // GET /content/ungenerated-prompts
  // Returns every AI-generated prompt that hasn't produced a successful asset,
  // grouped by the agent_run that triggered the content generation job.
  app.get('/content/ungenerated-prompts', async (request: any, reply) => {
    const userId = request.user?.id;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized', message: 'Missing user' });

    const accountId = await getPrimaryAccount(userId);
    if (!accountId) return { success: true, data: [] };

    // Fetch all content ideas that have prompts but no successfully generated asset
    const rawIdeas = await sql`
      SELECT
        ci.id,
        ci.pillar,
        ci.format,
        ci.concept,
        ci.hook,
        ci.caption,
        ci.status,
        ci.asset_generation_status,
        ci.needs_attention,
        ci.needs_attention_reason,
        ci.strategy_version_id,
        ci.created_at,
        -- All prompts for this idea
        json_agg(
          json_build_object(
            'id', cap.id,
            'asset_type', cap.asset_type,
            'prompt_text', cap.prompt_text,
            'prompt_version', cap.prompt_version,
            'source', cap.source,
            'provider', cap.provider,
            'model', cap.model,
            'created_at', cap.created_at
          )
          ORDER BY cap.asset_type, cap.prompt_version DESC
        ) FILTER (WHERE cap.id IS NOT NULL) AS prompts,
        -- Latest failure info per idea
        (SELECT json_build_object(
          'error_category', caga.error_category,
          'error_message', caga.error_message,
          'attempt_number', caga.attempt_number
        )
        FROM content_asset_generation_attempts caga
        WHERE caga.content_idea_id = ci.id AND caga.status = 'failed'
        ORDER BY caga.created_at DESC LIMIT 1) AS last_failure
      FROM content_ideas ci
      LEFT JOIN content_asset_prompts cap ON cap.content_idea_id = ci.id
      WHERE ci.social_account_id = ${accountId}
        AND ci.needs_attention = true
      GROUP BY ci.id
      ORDER BY ci.created_at DESC
    `;

    // For each content idea, get the agent run that generated it by matching timestamps
    const ideaIds = rawIdeas.map((r: any) => r.id);
    const ideaToRun = new Map<string, any>();

    if (ideaIds.length > 0) {
      // Find the agent_run that was active when the content_idea was created
      const correlations = await sql`
        SELECT DISTINCT ON (ci.id)
          ci.id AS idea_id,
          ar.id AS run_id,
          ar.run_type,
          ar.status,
          ar.started_at,
          ar.completed_at,
          ar.error_message,
          sv.id AS strategy_version_id,
          sv.version_number AS strategy_version_number
        FROM content_ideas ci
        JOIN strategy_versions sv ON ci.strategy_version_id = sv.id
        JOIN agent_runs ar ON ar.social_account_id = ci.social_account_id
        WHERE ci.id IN ${sql(ideaIds)}
          AND ar.started_at <= ci.created_at
          AND (ar.completed_at IS NULL OR ar.completed_at >= ci.created_at - INTERVAL '5 minutes')
        ORDER BY ci.id, ar.started_at DESC
      `;

      for (const row of correlations) {
        ideaToRun.set(row.ideaId, {
          id: row.runId,
          runType: row.runType,
          status: row.status,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
          errorMessage: row.errorMessage,
          strategyVersionId: row.strategyVersionId,
          strategyVersionNumber: row.strategyVersionNumber,
        });
      }
    }

    // Group ideas by agent run
    const grouped = new Map<string, { run: any; ideas: any[] }>();
    const ungroupedKey = 'unlinked';

    for (const idea of rawIdeas) {
      const run = ideaToRun.get(idea.id);
      const key = run ? run.id : ungroupedKey;

      if (!grouped.has(key)) {
        grouped.set(key, {
          run: run ?? {
            id: ungroupedKey,
            runType: 'unknown',
            status: 'unknown',
            startedAt: null,
            strategyVersionId: idea.strategyVersionId,
          },
          ideas: [],
        });
      }
      grouped.get(key)!.ideas.push(idea);
    }

    // Convert map to array, sorted by run startedAt descending
    const result = Array.from(grouped.values()).sort((a, b) => {
      if (!a.run.startedAt) return 1;
      if (!b.run.startedAt) return -1;
      return new Date(b.run.startedAt).getTime() - new Date(a.run.startedAt).getTime();
    });

    const totalPrompts = rawIdeas.reduce((sum: number, idea: any) => sum + (idea.prompts?.length ?? 0), 0);

    const responseData = {
      groups: result,
      totalIdeas: rawIdeas.length,
      totalPrompts
    };

    console.log('[ungenerated-prompts] RETURNING:', { success: true, data: { totalIdeas: rawIdeas.length, groupsLength: result.length }, accountId });

    return {
      success: true,
      data: responseData
    };
  });
}

