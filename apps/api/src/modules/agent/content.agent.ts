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

export class ContentAgent {
  private llm = getLLMProvider();
  private policyEngine = new PolicyEngine();

  async generateContentPlan(socialAccountId: string, strategyVersionId: string) {
    const runId = randomUUID();
    const tracker = new AgentRunTracker(runId);
    
    // 1. Create run record
    await sql`
      INSERT INTO agent_runs (id, run_type, social_account_id, status)
      VALUES (${runId}, 'CONTENT_GENERATION', ${socialAccountId}, 'running')
    `;

    try {
      console.log(`[ContentAgent] Starting Content Generation Plan for account ${socialAccountId}...`);
      await tracker.trackStep('Fetching Context', 'running');
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

      const msg1 = `[ContentAgent] Context fetched. Found ${activePillars.length} active content pillars.`;
      console.log(msg1);
      await tracker.addLog(msg1);
      
      await tracker.trackStep('Fetching Context', 'completed');
      await tracker.trackStep('Generating Ideas', 'running');

      // 3. Generate Ideas
      const msg2 = `[ContentAgent] Asking LLM to brainstorm new content ideas...`;
      console.log(msg2);
      await tracker.addLog(msg2);
      
      const ideaPrompt = generateContentIdeasPrompt(ideaContext);
      const ideaResponse = await this.llm.generateStructured(ideaPrompt);
      
      if (!ideaResponse.structured) throw new Error('Failed to generate ideas');
      
      const ideas = ideaResponse.structured.ideas;
      const msg3 = `[ContentAgent] Brainstorming complete! Generated ${ideas.length} new content ideas.`;
      console.log(msg3);
      await tracker.addLog(msg3);
      
      await tracker.trackStep('Generating Ideas', 'completed');
      await tracker.trackStep('Drafting Captions', 'running');
      
      const insertedIdeaIds: string[] = [];

      // 4. Generate Captions & Run Policy Checks for each idea
      for (const idea of ideas) {
        const msg4 = `[ContentAgent] Drafting caption for idea: "${idea.concept}"...`;
        console.log(msg4);
        await tracker.addLog(msg4);
        
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

        const msg5 = `[ContentAgent] Running policy check for drafted caption...`;
        console.log(msg5);
        await tracker.addLog(msg5);
        
        // Policy Check
        const policyDecision = await this.policyEngine.evaluate({
          caption: captionData?.caption || '',
          concept: idea.concept,
          bannedTopics: ideaContext.bannedTopics,
          autonomyLevel,
        });
        
        const msg6 = `[ContentAgent] Policy Check result: ${policyDecision.decision}`;
        console.log(msg6);
        await tracker.addLog(msg6);

        const ideaId = randomUUID();
        insertedIdeaIds.push(ideaId);

        let initialStatus = 'draft';
        if (policyDecision.decision === 'BLOCK') initialStatus = 'blocked';
        if (policyDecision.decision === 'REVIEW') initialStatus = 'waiting_approval';
        // In full implementation, if ALLOW, it gets scheduled

        // Insert Idea
        const msg7 = `[ContentAgent] Saving draft ${ideaId} to database...`;
        console.log(msg7);
        await tracker.addLog(msg7);
        
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
      
      const msg8 = `[ContentAgent] Content generation cycle complete. ${insertedIdeaIds.length} drafts saved.`;
      console.log(msg8);
      await tracker.addLog(msg8);

      await tracker.trackStep('Drafting Captions', 'completed');

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
