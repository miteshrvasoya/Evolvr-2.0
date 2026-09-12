import { randomUUID } from 'crypto';
import { sql } from '../../db/client.js';
import { getLLMProvider } from '../llm/index.js';
import { PolicyEngine } from '../policies/policy.engine.js';
import { AgentRunTracker } from './agent-tracker.js';
import { 
  generateContentIdeasPrompt, 
  generateCaptionPrompt, 
  ContentIdeationContext,
  CaptionGenerationContext
} from '../../prompts/content.v1.js';
import { getMediaProvider } from '../media/index.js';
import { LocalStorageAdapter } from '../storage/local.adapter.js';

export class ContentAgent {
  private llm = getLLMProvider();
  private policyEngine = new PolicyEngine();

  async generateContentPlan(socialAccountId: string, strategyVersionId: string, runId: string, attemptNumber: number, maxAttempts: number) {
    const tracker = new AgentRunTracker(runId);
    const stepId = await tracker.startStep('content_generation', attemptNumber, maxAttempts);

    try {
      console.log(`[ContentAgent] Starting Content Generation Plan for account ${socialAccountId}...`);
      
      // 2. Fetch Context
      const profiles = await sql`SELECT * FROM account_profiles WHERE social_account_id = ${socialAccountId}`;
      const profile = profiles[0] || {};
      
      const strategies = await sql`SELECT * FROM strategy_versions WHERE id = ${strategyVersionId}`;
      const strategy = strategies[0];
      if (!strategy) throw new Error('Strategy not found');

      const goals = await sql`SELECT autonomy_level FROM admin_goals WHERE social_account_id = ${socialAccountId} AND is_active = true`;
      const autonomyLevel = goals[0]?.autonomyLevel || 'supervised';

      // Get Active Pillars from Content Mix
      const contentMix = strategy.contentMix as Record<string, number>;
      const activePillars = Object.keys(contentMix).filter(k => contentMix[k] > 0);

      const ideaContext: ContentIdeationContext = {
        niche: profile.niche || 'General',
        audienceDefinition: JSON.stringify(profile.audienceDefinition || {}),
        brandVoice: JSON.stringify(profile.brandVoice || {}),
        activePillars,
        recentPosts: '[]', // In full impl, fetch last 10 posts
        bannedTopics: profile.bannedTopics || [],
      };

      await tracker.logEvent(stepId, 'CONTEXT_FETCHED', 'info', `Context fetched. Found ${activePillars.length} active content pillars.`);

      // 3. Generate Ideas
      await tracker.logEvent(stepId, 'LLM_IDEATION_STARTED', 'info', `Asking LLM to brainstorm new content ideas...`);
      
      const ideaPrompt = generateContentIdeasPrompt(ideaContext);
      const ideaResponse = await this.llm.generateStructured(ideaPrompt);
      
      await tracker.logLlmCall(
        stepId, 
        'Brainstorming complete! Generated new content ideas.', 
        'content_ideation', 
        ideaResponse.model, 
        ideaResponse.latencyMs, 
        ideaResponse.inputTokens, 
        ideaResponse.outputTokens
      );

      if (!ideaResponse.structured) throw new Error('Failed to generate ideas');
      
      const ideas = ideaResponse.structured.ideas;
      
      const insertedIdeaIds: string[] = [];

      // 4. Generate Captions & Run Policy Checks for each idea
      for (const idea of ideas) {
        await tracker.logEvent(stepId, 'DRAFTING_CAPTION', 'info', `Drafting caption for idea: "${idea.concept}"...`);
        
        // Generate Caption
        const captionContext: CaptionGenerationContext = {
          brandVoice: ideaContext.brandVoice,
          concept: idea.concept,
          hook: idea.hook,
          format: idea.format,
          preferredCtaPatterns: profile.preferredCtaPatterns || [],
          bannedTopics: ideaContext.bannedTopics,
        };

        const capPrompt = generateCaptionPrompt(captionContext);
        const capResponse = await this.llm.generateStructured(capPrompt);
        const captionData = capResponse.structured;

        await tracker.logLlmCall(
          stepId, 
          `Generated caption for idea: "${idea.concept}"`, 
          'caption_generation', 
          capResponse.model, 
          capResponse.latencyMs, 
          capResponse.inputTokens, 
          capResponse.outputTokens
        );

        await tracker.logEvent(stepId, 'POLICY_CHECK_STARTED', 'info', `Running policy check for drafted caption...`);
        
        // Policy Check
        const policyDecision = await this.policyEngine.evaluate({
          caption: captionData?.caption || '',
          concept: idea.concept,
          bannedTopics: ideaContext.bannedTopics,
          autonomyLevel,
        });
        
        await tracker.logEvent(stepId, 'POLICY_CHECK_COMPLETED', 'info', `Policy Check result: ${policyDecision.decision}`);

        const ideaId = randomUUID();
        insertedIdeaIds.push(ideaId);

        let initialStatus = 'draft';
        if (policyDecision.decision === 'BLOCK') initialStatus = 'blocked';
        if (policyDecision.decision === 'REVIEW') initialStatus = 'waiting_approval';

        // Insert Idea
        await tracker.logEvent(stepId, 'SAVING_DRAFT', 'info', `Saving draft ${ideaId} to database...`);
        
        await sql`
          INSERT INTO content_ideas (
            id, social_account_id, strategy_version_id, pillar, format, concept, hook, caption,
            hashtags, alt_text, rationale, policy_decision, status
          ) VALUES (
            ${ideaId}, ${socialAccountId}, ${strategyVersionId}, ${idea.pillar}, ${idea.format},
            ${idea.concept}, ${idea.hook}, ${captionData?.caption || null}, ${JSON.stringify(captionData?.hashtags || [])},
            ${captionData?.altText || null}, ${JSON.stringify({ reason: idea.rationale })}, ${JSON.stringify(policyDecision)}, ${initialStatus}
          )
        `;

        if (initialStatus !== 'blocked') {
          await tracker.logEvent(stepId, 'GENERATING_MEDIA', 'info', `Generating media asset for idea ${ideaId}...`);
          
          try {
            const mediaProvider = getMediaProvider();
            const storageAdapter = new LocalStorageAdapter();
            
            let mediaResult;
            let assetType = 'image';
            
            if (idea.format === 'reel' || idea.format === 'story') {
              mediaResult = await mediaProvider.generateReelPlaceholder(captionData?.imagePrompt || idea.concept);
              assetType = 'video_placeholder';
            } else {
              mediaResult = await mediaProvider.generateImage(captionData?.imagePrompt || idea.concept);
            }
            
            // Save to local storage
            const filename = `media_${ideaId}_${Date.now()}.gif`; // Currently GIF from stub
            const storageUrl = await storageAdapter.saveFile(filename, mediaResult.buffer);
            
            const mediaMetadata = {
              ...mediaResult.metadata,
              videoScript: captionData?.videoScript,
              imagePrompt: captionData?.imagePrompt
            };
            
            // Link to content_ideas
            await sql`
              INSERT INTO content_assets (
                content_idea_id, asset_type, storage_url, mime_type, prompt, generation_metadata
              ) VALUES (
                ${ideaId}, ${assetType}, ${storageUrl}, ${mediaResult.mimeType}, ${captionData?.imagePrompt || null}, ${JSON.stringify(mediaMetadata)}
              )
            `;
            await tracker.logEvent(stepId, 'MEDIA_GENERATED', 'info', `Media asset generated and saved to ${storageUrl}.`);
          } catch (mediaError: any) {
            await tracker.logEvent(stepId, 'MEDIA_FAILED', 'warn', `Warning: Failed to generate media asset: ${mediaError.message}`);
          }
        }
      }
      
      await tracker.logEvent(stepId, 'CYCLE_COMPLETE', 'info', `Content generation cycle complete. ${insertedIdeaIds.length} drafts saved.`);

      // 5. Complete run
      await tracker.completeStep(stepId, { generatedIdeas: insertedIdeaIds });

      return { success: true, generatedIdeas: insertedIdeaIds };

    } catch (error: any) {
      throw { error, stepId };
    }
  }
}
