import { sql } from '../../db/client.js';
import { getLLMProvider } from '../llm/index.js';
import { AgentRunTracker } from './agent-tracker.js';
import { z } from 'zod';

export class LearningAgent {
  private llm = getLLMProvider();

  async runLearning(socialAccountId: string, agentRunId: string, attemptNumber: number, maxAttempts: number) {
    const tracker = new AgentRunTracker(agentRunId);
    const stepId = await tracker.startStep('learning_analysis', attemptNumber, maxAttempts);

    try {
      await tracker.addLog(`Starting learning analysis for account ${socialAccountId}`);

      // 1. Fetch baselines and recent post metrics
      const postsData = await sql`
        WITH recent_metrics AS (
          SELECT p.id,
                 p.media_type,
                 p.source,
                 ci.pillar,
                 ci.format,
                 EXTRACT(DOW FROM p.published_at) as day_of_week,
                 EXTRACT(HOUR FROM p.published_at) as hour_of_day,
                 MAX(pm.reach) as max_reach,
                 MAX(pm.saves) as max_saves
          FROM posts p
          LEFT JOIN content_ideas ci ON p.content_idea_id = ci.id
          JOIN post_metrics pm ON p.id = pm.post_id
          WHERE p.social_account_id = ${socialAccountId} 
          AND p.status = 'published'
          AND p.published_at > NOW() - INTERVAL '30 days'
          GROUP BY p.id, p.media_type, p.source, ci.pillar, ci.format, p.published_at
        ),
        baselines AS (
          SELECT 
            PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY max_reach) as median_reach,
            PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY max_saves) as median_saves
          FROM recent_metrics
        )
        SELECT rm.*, 
               b.median_reach, 
               b.median_saves,
               CASE WHEN rm.max_reach > b.median_reach THEN 'ABOVE_BASELINE' ELSE 'BELOW_BASELINE' END as reach_performance,
               CASE WHEN rm.max_saves > b.median_saves THEN 'ABOVE_BASELINE' ELSE 'BELOW_BASELINE' END as saves_performance
        FROM recent_metrics rm
        CROSS JOIN baselines b
      `;

      if (postsData.length === 0) {
        await tracker.addLog('Not enough data to run learning analysis.');
        await tracker.completeStep(stepId, { observationsGenerated: 0 });
        return { success: true, observationsGenerated: 0 };
      }

      await tracker.addLog(`Synthesizing metrics for ${postsData.length} recent posts against baselines...`);

      // 2. Synthesize with LLM
      const systemPrompt = `You are an expert AI social media strategist. Analyze the provided posts and their performance relative to the account's baseline. Identify structured, evidence-backed patterns. Focus on content pillars, formats, media types, and scheduling times.`;
      
      const userPrompt = `Here is the post performance data for the last 30 days:\n${JSON.stringify(postsData, null, 2)}\n\nIdentify what is working and what is not. Be specific and reference the data.`;

      const outputSchema = z.object({
        observations: z.array(z.object({
          type: z.enum(['TOPIC_PERFORMANCE', 'FORMAT_PERFORMANCE', 'TIME_PERFORMANCE', 'CONTENT_PILLAR', 'AUDIENCE_SIGNAL']),
          observation: z.string(),
          evidence: z.string(), // A short description of the evidence (e.g., "4 of 5 educational carousels were ABOVE_BASELINE in reach")
          confidence: z.number().min(0).max(1),
          source_post_ids: z.array(z.string().uuid()) // Array of post IDs that support this observation
        }))
      });

      const llmResponse = await this.llm.generateStructured({
        systemPrompt,
        userPrompt,
        outputSchema,
        schemaName: 'LearningObservations',
        maxTokens: 2000,
      });

      await tracker.logLlmCall(
        stepId, 
        'Analyzed post metrics and generated learning observations', 
        'learning_analysis', 
        llmResponse.model, 
        llmResponse.latencyMs, 
        llmResponse.inputTokens, 
        llmResponse.outputTokens
      );

      if (!llmResponse.structured) throw new Error('Failed to generate insights');

      const data = llmResponse.structured;

      // 3. Save Learning Observations
      let savedCount = 0;
      
      // Fetch the goal ID for this account (assuming 1 active goal per account for MVP)
      const goals = await sql`SELECT id FROM admin_goals WHERE social_account_id = ${socialAccountId} AND status = 'ACTIVE' LIMIT 1`;
      if (goals.length > 0) {
        const goalId = goals[0]!.id;
        
        for (const obs of data.observations) {
          if (obs.confidence < 0.5) continue; // Only save reasonably confident observations

          await sql`
            INSERT INTO learning_observations (
              goal_id, social_account_id, observation_type, observation, evidence, confidence, source_post_ids, expires_at
            ) VALUES (
              ${goalId}, ${socialAccountId}, ${obs.type}, ${obs.observation}, ${JSON.stringify({ text: obs.evidence })}, ${obs.confidence}, ${JSON.stringify(obs.source_post_ids)}, NOW() + INTERVAL '30 days'
            )
          `;
          savedCount++;
        }
      }

      await tracker.addLog(`Analysis complete. Saved ${savedCount} new learning observations.`);
      await tracker.completeStep(stepId, { observationsGenerated: savedCount });

      return { success: true, observationsGenerated: savedCount };

    } catch (error: any) {
      await tracker.failStep(stepId, error.message, true, new Date(Date.now() + 5000));
      throw { error, stepId };
    }
  }
}
