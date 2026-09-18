import { randomUUID } from 'crypto';
import { sql } from '../../db/client.js';
import { getMediaProvider } from './index.js';
import { LocalStorageAdapter } from '../storage/local.adapter.js';
import { AssetErrorCategory, MediaGenerationError } from './media.interface.js';

export interface PersistPromptParams {
  contentIdeaId: string;
  mediaRequirementId: string;
  assetType: 'image' | 'video_placeholder' | 'carousel' | 'thumbnail';
  promptText: string;
  provider?: string;
  model?: string;
  source: 'ai_generated' | 'user_edited' | 'improved';
  originalPromptId?: string;
}

export interface GenerateAssetParams {
  contentIdeaId: string;
  promptId: string;
  assetType: 'image' | 'video_placeholder';
  idempotencyKey: string;
  attemptNumber: number;
  agentRunId?: string;
}

export interface GenerationResult {
  success: boolean;
  assetId?: string;
  storageUrl?: string;
  errorCategory?: AssetErrorCategory;
  errorMessage?: string;
  shouldRetry: boolean;
  attemptId: string;
}

/**
 * Determines retry behavior for each error category.
 * Returns true only for errors that are likely transient.
 */
export function classifyError(error: any): AssetErrorCategory {
  // Already classified by provider
  if ((error as MediaGenerationError).errorCategory) {
    return (error as MediaGenerationError).errorCategory;
  }
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('timeout') || msg.includes('abort')) return 'timeout';
  if (msg.includes('rate limit') || msg.includes('429')) return 'rate_limited';
  if (msg.includes('auth') || msg.includes('401') || msg.includes('403')) return 'auth_error';
  if (msg.includes('content policy') || msg.includes('safety')) return 'content_policy';
  if (msg.includes('invalid prompt')) return 'invalid_prompt';
  if (msg.includes('quota') || msg.includes('billing')) return 'quota_exceeded';
  if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('econnreset')) return 'transient';
  return 'provider_error';
}

export function shouldRetryError(category: AssetErrorCategory, attemptNumber: number, maxAttempts: number): boolean {
  if (attemptNumber >= maxAttempts) return false;
  switch (category) {
    case 'transient':
    case 'timeout':
    case 'provider_error':
    case 'rate_limited':
      return true;
    // These require human intervention — no automatic retry
    case 'auth_error':
    case 'content_policy':
    case 'invalid_prompt':
    case 'quota_exceeded':
    case 'permanent':
      return false;
    default:
      return true;
  }
}

export class AssetGenerationService {
  private storageAdapter = new LocalStorageAdapter();

  /**
   * Persist an AI-generated or user-edited prompt as a first-class entity.
   * Always called BEFORE attempting generation so the prompt is never lost.
   * Returns the new prompt's UUID.
   */
  async persistPrompt(params: PersistPromptParams): Promise<string> {
    const { contentIdeaId, mediaRequirementId, assetType, promptText, provider, model, source, originalPromptId } = params;

    // Determine next version number for this content + asset type
    const existing = await sql`
      SELECT COALESCE(MAX(prompt_version), 0) AS max_ver
      FROM content_asset_prompts
      WHERE content_idea_id = ${contentIdeaId} AND asset_type = ${assetType}
    `;
    const nextVersion = Number((existing[0]! as any)?.maxVer || 0) + 1;

    const promptId = randomUUID();
    await sql`
      INSERT INTO content_asset_prompts
        (id, content_idea_id, media_requirement_id, asset_type, prompt_text, prompt_version, provider, model, source, original_prompt_id)
      VALUES
        (${promptId}, ${contentIdeaId}, ${mediaRequirementId}, ${assetType}, ${promptText}, ${nextVersion},
         ${provider || null}, ${model || null}, ${source}, ${originalPromptId || null})
    `;

    console.log(`[AssetGenerationService] Persisted prompt v${nextVersion} (${source}) for idea ${contentIdeaId} [${assetType}]`);
    return promptId;
  }

  /**
   * Check whether a generation is already running for this content + asset type.
   * Used for idempotency — prevents duplicate jobs from concurrent button clicks.
   */
  async isGenerationInProgress(contentIdeaId: string, assetType: string): Promise<boolean> {
    const rows = await sql`
      SELECT id FROM content_asset_generation_attempts
      WHERE content_idea_id = ${contentIdeaId}
        AND asset_type = ${assetType}
        AND status IN ('pending', 'generating')
      LIMIT 1
    `;
    return rows.length > 0;
  }

  /**
   * Create an attempt record (status=pending) and return its ID.
   * The caller (media worker) transitions the record through the lifecycle.
   */
  async createAttempt(params: {
    contentIdeaId: string;
    promptId: string;
    assetType: string;
    provider: string;
    attemptNumber: number;
    idempotencyKey: string;
    jobId?: string;
  }): Promise<string> {
    const { contentIdeaId, promptId, assetType, provider, attemptNumber, idempotencyKey, jobId } = params;
    const attemptId = randomUUID();

    await sql`
      INSERT INTO content_asset_generation_attempts
        (id, content_idea_id, content_asset_prompt_id, asset_type, provider, status, attempt_number, idempotency_key, job_id)
      VALUES
        (${attemptId}, ${contentIdeaId}, ${promptId}, ${assetType}, ${provider},
         'pending', ${attemptNumber}, ${idempotencyKey}, ${jobId || null})
    `;
    return attemptId;
  }

  /**
   * Execute the actual asset generation.
   * Manages the full attempt lifecycle: pending → generating → generated | failed
   */
  async generateAsset(params: GenerateAssetParams): Promise<GenerationResult> {
    const { contentIdeaId, promptId, assetType, idempotencyKey, attemptNumber, agentRunId } = params;
    const MAX_RETRIES = 3;

    // Fetch prompt text
    const prompts = await sql`SELECT * FROM content_asset_prompts WHERE id = ${promptId}`;
    if (!prompts.length) throw new Error(`Prompt ${promptId} not found`);
    const promptRecord = prompts[0]!;
    const mediaRequirementId = promptRecord.mediaRequirementId;

    const provider = getMediaProvider();
    const providerName = (provider as any).constructor?.name?.toLowerCase().replace('mediaprovider', '') || 'unknown';

    // Find or create attempt record (idempotency — if job was restarted)
    let attempt = await sql`
      SELECT id FROM content_asset_generation_attempts WHERE idempotency_key = ${idempotencyKey}
    `;

    let attemptId: string;
    if (attempt.length > 0) {
      attemptId = attempt[0]!.id;
    } else {
      attemptId = await this.createAttempt({
        contentIdeaId,
        promptId,
        assetType,
        provider: providerName,
        attemptNumber,
        idempotencyKey,
      });
    }

    // Mark as generating + record start time
    await sql`
      UPDATE content_asset_generation_attempts
      SET status = 'generating', started_at = NOW(), updated_at = NOW()
      WHERE id = ${attemptId}
    `;

    // Update parent idea status
    await sql`
      UPDATE content_ideas
      SET asset_generation_status = 'generating', updated_at = NOW()
      WHERE id = ${contentIdeaId}
    `;

    const startTime = Date.now();
    try {
      console.log(`[AssetGenerationService] Attempt #${attemptNumber} for idea ${contentIdeaId} [${assetType}]`);

      // Generate
      let mediaResult;
      if (assetType === 'video_placeholder') {
        mediaResult = await provider.generateReelPlaceholder(promptRecord.promptText);
      } else {
        mediaResult = await provider.generateImage(promptRecord.promptText);
      }

      const durationMs = Date.now() - startTime;

      // Validate: buffer must exist and have non-zero length
      if (!mediaResult.buffer || mediaResult.buffer.length === 0) {
        throw new Error('Provider returned empty buffer');
      }

      // Save to storage
      let ext = 'jpg';
      if (mediaResult.mimeType.includes('gif')) ext = 'gif';
      else if (mediaResult.mimeType.includes('png')) ext = 'png';

      const filename = `media_${contentIdeaId}_${attemptId}.${ext}`;
      const storageUrl = await this.storageAdapter.saveFile(filename, mediaResult.buffer);

      // Insert into content_assets
      const assetId = randomUUID();
      await sql`
        INSERT INTO content_assets
          (id, content_idea_id, media_requirement_id, asset_type, storage_url, mime_type, prompt, generation_metadata,
           generation_status, source, generation_attempt_id, asset_status)
        VALUES
          (${assetId}, ${contentIdeaId}, ${mediaRequirementId}, ${assetType}, ${storageUrl}, ${mediaResult.mimeType},
           ${promptRecord.promptText}, ${sql.json({
             ...mediaResult.metadata,
             provider: mediaResult.provider,
             durationMs,
             promptId,
             attemptNumber,
           })},
           'generated', 'ai_generated', ${attemptId}, 'ACTIVE')
      `;

      // Mark attempt as generated
      await sql`
        UPDATE content_asset_generation_attempts
        SET status = 'generated', completed_at = NOW(), duration_ms = ${durationMs},
            asset_id = ${assetId}, updated_at = NOW()
        WHERE id = ${attemptId}
      `;

      // Update idea asset status — check if there are remaining failed/pending assets
      await sql`
        UPDATE content_ideas
        SET asset_generation_status = 'completed',
            needs_attention = false,
            needs_attention_reason = NULL,
            updated_at = NOW()
        WHERE id = ${contentIdeaId}
      `;

      await sql`
        UPDATE media_requirements
        SET status = 'READY', updated_at = NOW()
        WHERE id = ${mediaRequirementId}
      `;

      console.log(`[AssetGenerationService] ✓ Asset generated for idea ${contentIdeaId} in ${durationMs}ms`);
      return { success: true, assetId, storageUrl, shouldRetry: false, attemptId };

    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const errorCategory = classifyError(error);
      const errorMessage = error.message || 'Unknown generation error';

      console.error(`[AssetGenerationService] ✗ Attempt #${attemptNumber} failed for idea ${contentIdeaId}: [${errorCategory}] ${errorMessage}`);

      const retry = shouldRetryError(errorCategory, attemptNumber, MAX_RETRIES);

      // Mark attempt as failed
      await sql`
        UPDATE content_asset_generation_attempts
        SET status = 'failed',
            error_category = ${errorCategory},
            error_message = ${errorMessage},
            error_detail = ${sql.json({ statusCode: error.statusCode, providerDetail: error.providerDetail })},
            completed_at = NOW(),
            duration_ms = ${durationMs},
            updated_at = NOW()
        WHERE id = ${attemptId}
      `;

      // If max retries hit → mark content as needing attention
      if (!retry) {
        const reason = this.humanReadableReason(errorCategory, attemptNumber, MAX_RETRIES);
        await sql`
          UPDATE content_ideas
          SET asset_generation_status = 'needs_attention',
              needs_attention = true,
              needs_attention_reason = ${reason},
              updated_at = NOW()
          WHERE id = ${contentIdeaId}
        `;
        await sql`
          UPDATE media_requirements
          SET status = 'FAILED', updated_at = NOW()
          WHERE id = ${mediaRequirementId}
        `;
      }

      return {
        success: false,
        errorCategory,
        errorMessage,
        shouldRetry: retry,
        attemptId,
      };
    }
  }

  private humanReadableReason(category: AssetErrorCategory, attempt: number, max: number): string {
    const base = attempt >= max ? `Asset generation failed after ${max} attempts. ` : '';
    switch (category) {
      case 'auth_error': return `${base}Provider authentication failed. Check your API keys.`;
      case 'content_policy': return `${base}The prompt was rejected by the provider content policy. Please improve the prompt.`;
      case 'invalid_prompt': return `${base}The provider rejected the prompt as invalid. Please edit and retry.`;
      case 'quota_exceeded': return `${base}Provider quota exceeded. Check your account limits.`;
      case 'timeout': return `${base}The provider timed out repeatedly. Retry when the service is available.`;
      case 'rate_limited': return `${base}Rate limited by provider. Wait before retrying.`;
      default: return `${base}Asset generation failed due to a provider error. You can retry or use the prompt manually.`;
    }
  }
}
