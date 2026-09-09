import { randomUUID } from 'crypto';
import { sql } from '../../db/client.js';
import { getLLMProvider } from '../llm/index.js';
import { PolicyEngine } from '../policies/policy.engine.js';
import { 
  generateContentIdeasPrompt, 
  generateCaptionPrompt, 
  ContentIdeationContext,
  CaptionGenerationContext
} from '../../prompts/content.v1.js';

export class ContentAgent {
  private llm = getLLMProvider();
  private policyEngine = new PolicyEngine();

  async generateContentPlan(socialAccountId: string, strategyVersionId: string) {
    const runId = randomUUID();
    
    // 1. Create run record
    await sql`
      INSERT INTO agent_runs (id, run_type, social_account_id, status)
      VALUES (${runId}, 'CONTENT_GENERATION', ${socialAccountId}, 'running')
    `;

    try {
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

      // 3. Generate Ideas
      const ideaPrompt = generateContentIdeasPrompt(ideaContext);
      const ideaResponse = await this.llm.generateStructured(ideaPrompt);
      
      if (!ideaResponse.structured) throw new Error('Failed to generate ideas');
      
      const ideas = ideaResponse.structured.ideas;
      const insertedIdeaIds: string[] = [];

      // 4. Generate Captions & Run Policy Checks for each idea
      for (const idea of ideas) {
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

        // Policy Check
        const policyDecision = await this.policyEngine.evaluate({
          caption: captionData?.caption || '',
          concept: idea.concept,
          bannedTopics: ideaContext.bannedTopics,
          autonomyLevel,
        });

        const ideaId = randomUUID();
        insertedIdeaIds.push(ideaId);

        let initialStatus = 'draft';
        if (policyDecision.decision === 'BLOCK') initialStatus = 'blocked';
        if (policyDecision.decision === 'REVIEW') initialStatus = 'waiting_approval';
        // In full implementation, if ALLOW, it gets scheduled

        // Insert Idea
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
      }

      // 5. Complete run
      await sql`
        UPDATE agent_runs 
        SET status = 'completed', completed_at = NOW(), output = ${JSON.stringify({ generatedIdeas: insertedIdeaIds })}
        WHERE id = ${runId}
      `;

      return { success: true, generatedIdeas: insertedIdeaIds };

    } catch (error: any) {
      await sql`
        UPDATE agent_runs 
        SET status = 'failed', completed_at = NOW(), error = ${JSON.stringify({ message: error.message })}
        WHERE id = ${runId}
      `;
      throw error;
    }
  }
}
