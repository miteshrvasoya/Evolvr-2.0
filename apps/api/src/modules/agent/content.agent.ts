import { randomUUID } from 'crypto';
import { sql } from '../../db/client.js';
import { getLLMProvider } from '../llm/index.js';
import { PolicyEngine } from '../policies/policy.engine.js';
import { AgentRunTracker } from './agent-tracker.js';
import {
  generateContentIdeasPrompt,
  generateCaptionPrompt,
  ContentIdeationContext,
  CaptionGenerationContext,
} from '../../prompts/content.v1.js';
import { AssetGenerationService } from '../media/asset-generation.service.js';
import { queues } from '../../queues/index.js';
import { env } from '../../config/env.js';

export class ContentAgent {
  private llm = getLLMProvider();
  private policyEngine = new PolicyEngine();
  private assetService = new AssetGenerationService();

  async generateContentPlan(
    socialAccountId: string,
    strategyVersionId: string,
    runId: string,
    attemptNumber: number,
    maxAttempts: number,
  ) {
    const tracker = new AgentRunTracker(runId);
    const stepId = await tracker.startStep('content_generation', attemptNumber, maxAttempts);

    try {
      console.log(`[ContentAgent] Starting Content Generation Plan for account ${socialAccountId}...`);

      // Fetch context
      const profiles = await sql`SELECT * FROM account_profiles WHERE social_account_id = ${socialAccountId}`;
      const profile = profiles[0] || {};

      const strategies = await sql`SELECT * FROM strategy_versions WHERE id = ${strategyVersionId}`;
      const strategy = strategies[0];
      if (!strategy) throw new Error('Strategy not found');

      const goals = await sql`SELECT autonomy_level FROM admin_goals WHERE social_account_id = ${socialAccountId} AND is_active = true`;
      const autonomyLevel = goals[0]?.autonomyLevel || 'supervised';

      const contentMix = strategy.contentMix as Record<string, number>;
      const activePillars = Object.keys(contentMix).filter(k => contentMix[k] > 0);

      const ideaContext: ContentIdeationContext = {
        niche: profile.niche || 'General',
        audienceDefinition: JSON.stringify(profile.audienceDefinition || {}),
        brandVoice: JSON.stringify(profile.brandVoice || {}),
        activePillars,
        recentPosts: '[]',
        bannedTopics: profile.bannedTopics || [],
      };

      await tracker.logEvent(stepId, 'CONTEXT_FETCHED', 'info',
        `Context fetched. Found ${activePillars.length} active content pillars.`);

      // Generate ideas
      await tracker.logEvent(stepId, 'LLM_IDEATION_STARTED', 'info',
        'Asking LLM to brainstorm new content ideas...');

      const ideaPrompt = generateContentIdeasPrompt(ideaContext);
      ideaPrompt.model = env.OPENROUTER_STRONG_MODEL;
      const ideaResponse = await this.llm.generateStructured(ideaPrompt);

      await tracker.logLlmCall(
        stepId,
        'Brainstorming complete! Generated new content ideas.',
        'content_ideation',
        ideaResponse.model,
        ideaResponse.latencyMs,
        ideaResponse.inputTokens,
        ideaResponse.outputTokens,
      );

      if (!ideaResponse.structured) throw new Error('Failed to generate ideas');

      const ideas = ideaResponse.structured.ideas;
      const insertedIdeaIds: string[] = [];

      // Generate captions & run policy checks for each idea
      for (const idea of ideas) {
        await tracker.logEvent(stepId, 'DRAFTING_CAPTION', 'info',
          `Drafting caption for idea: "${idea.concept}"...`);

        const captionContext: CaptionGenerationContext = {
          brandVoice: ideaContext.brandVoice,
          concept: idea.concept,
          hook: idea.hook,
          format: idea.format,
          preferredCtaPatterns: profile.preferredCtaPatterns || [],
          bannedTopics: ideaContext.bannedTopics,
        };

        const capPrompt = generateCaptionPrompt(captionContext);
        capPrompt.model = env.OPENROUTER_STRONG_MODEL;
        const capResponse = await this.llm.generateStructured(capPrompt);
        const captionData = capResponse.structured;

        await tracker.logLlmCall(
          stepId,
          `Generated caption for idea: "${idea.concept}"`,
          'caption_generation',
          capResponse.model,
          capResponse.latencyMs,
          capResponse.inputTokens,
          capResponse.outputTokens,
        );

        await tracker.logEvent(stepId, 'POLICY_CHECK_STARTED', 'info',
          'Running policy check for drafted caption...');

        const policyDecision = await this.policyEngine.evaluate({
          caption: captionData?.caption || '',
          concept: idea.concept,
          bannedTopics: ideaContext.bannedTopics,
          autonomyLevel,
        });

        await tracker.logEvent(stepId, 'POLICY_CHECK_COMPLETED', 'info',
          `Policy Check result: ${policyDecision.decision}`);

        const ideaId = randomUUID();
        insertedIdeaIds.push(ideaId);

        let initialStatus = 'draft';
        if (policyDecision.decision === 'BLOCK') initialStatus = 'blocked';
        if (policyDecision.decision === 'REVIEW') initialStatus = 'waiting_approval';

        // Save current version number for content versioning
        const initialVersionNumber = 1;

        // Insert content idea
        await tracker.logEvent(stepId, 'SAVING_DRAFT', 'info',
          `Saving draft ${ideaId} to database...`);

        await sql`
          INSERT INTO content_ideas (
            id, social_account_id, strategy_version_id, pillar, format, concept, hook, caption,
            hashtags, alt_text, rationale, policy_decision, status, version_number, asset_generation_status
          ) VALUES (
            ${ideaId}, ${socialAccountId}, ${strategyVersionId}, ${idea.pillar}, ${idea.format},
            ${idea.concept}, ${idea.hook}, ${captionData?.caption || null},
            ${JSON.stringify(captionData?.hashtags || [])},
            ${captionData?.altText || null},
            ${JSON.stringify({ reason: idea.rationale })},
            ${JSON.stringify(policyDecision)},
            ${initialStatus},
            ${initialVersionNumber},
            'none'
          )
        `;

        // Save initial content version snapshot for version history
        await sql`
          INSERT INTO content_idea_versions (
            content_idea_id, version_number, pillar, format, concept, hook, caption,
            hashtags, alt_text, changed_by, change_reason
          ) VALUES (
            ${ideaId}, 1, ${idea.pillar}, ${idea.format}, ${idea.concept}, ${idea.hook},
            ${captionData?.caption || null}, ${JSON.stringify(captionData?.hashtags || [])},
            ${captionData?.altText || null}, 'agent', 'Initial generation'
          )
        `;

        // ── PROMPT PERSISTENCE: Always save prompt BEFORE attempting generation ──
        // Even if generation fails later, the prompt remains accessible.
        if (initialStatus !== 'blocked' && captionData?.imagePrompt) {
          const imagePromptText = captionData.imagePrompt;
          const assetType = (idea.format === 'reel' || idea.format === 'story')
            ? 'video_placeholder'
            : 'image';

          await tracker.logEvent(stepId, 'PROMPT_PERSISTED', 'info',
            `Persisting ${assetType} prompt for idea ${ideaId} (before generation)...`);

          const promptId = await this.assetService.persistPrompt({
            contentIdeaId: ideaId,
            assetType: assetType as any,
            promptText: imagePromptText,
            source: 'ai_generated',
          });

          // Update asset_generation_status to pending — generation queued but not yet started
          await sql`
            UPDATE content_ideas
            SET asset_generation_status = 'pending', updated_at = NOW()
            WHERE id = ${ideaId}
          `;

          // ── ENQUEUE async media generation job ──
          // This decouples content creation from asset generation.
          // Content exists and is usable regardless of whether this job succeeds.
          const idempotencyKey = `${ideaId}-${assetType}-1`;
          await queues.mediaGeneration.add(
            'generate-asset',
            {
              contentIdeaId: ideaId,
              promptId,
              assetType,
              attemptNumber: 1,
              idempotencyKey,
              agentRunId: runId,
            },
            {
              jobId: `asset-${ideaId}-${assetType}-1`,
              // Small delay so content is fully committed before worker picks it up
              delay: 500,
            },
          );

          await tracker.logEvent(stepId, 'MEDIA_GENERATION_QUEUED', 'info',
            `Media generation job queued for idea ${ideaId} [${assetType}]. Generation will proceed asynchronously.`);
        }
      }

      await tracker.logEvent(stepId, 'CYCLE_COMPLETE', 'info',
        `Content generation cycle complete. ${insertedIdeaIds.length} drafts saved.`);

      await tracker.completeStep(stepId, { generatedIdeas: insertedIdeaIds });

      return { success: true, generatedIdeas: insertedIdeaIds };

    } catch (error: any) {
      throw { error, stepId };
    }
  }
}
