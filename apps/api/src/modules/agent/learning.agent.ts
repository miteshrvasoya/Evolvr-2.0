import { sql } from '../../db/client.js';
import { getLLMProvider } from '../llm/index.js';
import { generateInsightPrompt, InsightContext } from '../../prompts/learning.v1.js';
import { AgentRunTracker } from './agent-tracker.js';
import { z } from 'zod';

export class LearningAgent {
  private llm = getLLMProvider();

  async runLearning(socialAccountId: string, agentRunId: string, attemptNumber: number, maxAttempts: number) {
    const tracker = new AgentRunTracker(agentRunId);
    const stepId = await tracker.startStep('learning_analysis', attemptNumber, maxAttempts);

    try {
      await tracker.addLog(`Starting learning analysis for account ${socialAccountId}`);

      // 1. Fetch recent metrics & content ideas
      const recentPosts = await sql`
        SELECT p.id, p.platform_post_id, p.published_at, 
               pm.likes, pm.comments, pm.shares, pm.saves, pm.reach,
               ci.pillar, ci.format, ci.concept, ci.caption
        FROM posts p
        JOIN post_metrics pm ON p.id = pm.post_id
        JOIN content_ideas ci ON p.content_idea_id = ci.id
        WHERE p.social_account_id = ${socialAccountId} 
        AND p.status = 'published'
        ORDER BY p.published_at DESC
        LIMIT 20
      `;

      if (recentPosts.length === 0) {
        await tracker.addLog('Not enough data to run learning analysis.');
        await tracker.completeStep(stepId, { insightsGenerated: 0 });
        return { success: true, insightsGenerated: 0 };
      }

      await tracker.addLog(`Analyzing metrics for ${recentPosts.length} recent posts...`);

      // 2. Synthesize with LLM
      const systemPrompt = `You are an expert AI social media strategist. Analyze the following post metrics and identify strategic insights. What is working well? What is not working? Give actionable advice.`;
      const userPrompt = `Here are the latest posts and their metrics: \n${JSON.stringify(recentPosts, null, 2)}`;

      const outputSchema = z.object({
        insights: z.array(z.object({
          type: z.enum(['audience_behavior', 'content_performance', 'format_effectiveness', 'optimal_timing']),
          observation: z.string(),
          recommendation: z.string(),
          confidence: z.number().min(0).max(1)
        })),
        overallHealth: z.string(),
      });

      const llmResponse = await this.llm.generateStructured({
        systemPrompt,
        userPrompt,
        outputSchema,
        schemaName: 'LearningInsights',
        maxTokens: 1500,
      });

      await tracker.logLlmCall(
        stepId, 
        'Analyzed post metrics and generated insights', 
        'learning_analysis', 
        llmResponse.model, 
        llmResponse.latencyMs, 
        llmResponse.inputTokens, 
        llmResponse.outputTokens
      );

      if (!llmResponse.structured) throw new Error('Failed to generate insights');

      const data = llmResponse.structured;

      // 3. Save Insights
      let savedCount = 0;
      for (const insight of data.insights) {
        if (insight.confidence < 0.6) continue;

        await sql`
          INSERT INTO strategic_insights (social_account_id, insight_type, observation, recommendation, confidence, status)
          VALUES (${socialAccountId}, ${insight.type}, ${insight.observation}, ${insight.recommendation}, ${insight.confidence}, 'active')
        `;
        savedCount++;
      }

      await tracker.addLog(`Analysis complete. Saved ${savedCount} new insights (Health: ${data.overallHealth}).`);
      await tracker.completeStep(stepId, { insightsGenerated: savedCount });

      return { success: true, insightsGenerated: savedCount };

    } catch (error: any) {
      await tracker.failStep(stepId, error.message, true, new Date(Date.now() + 5000));
      throw { error, stepId };
    }
  }

  // Original experiment evaluation
  async evaluateExperiment(experimentId: string) {
    const experiments = await sql`
      SELECT e.*, h.statement as hypothesis_statement
      FROM experiments e
      JOIN hypotheses h ON e.hypothesis_id = h.id
      WHERE e.id = ${experimentId}
    `;
    const exp = experiments[0];
    if (!exp) throw new Error('Experiment not found');

    const mockControlMetrics = JSON.stringify({ avg_reach: 5000, avg_engagement_rate: 0.05 });
    const mockVariantMetrics = JSON.stringify({ avg_reach: 5200, avg_engagement_rate: 0.08 });

    const context: InsightContext = {
      hypothesis: exp.hypothesisStatement,
      controlMetrics: mockControlMetrics,
      variantMetrics: mockVariantMetrics,
    };

    const prompt = generateInsightPrompt(context);
    const llmResponse = await this.llm.generateStructured(prompt);
    
    if (!llmResponse.structured) throw new Error('Failed to generate insight');
    const insight = llmResponse.structured;

    await sql.begin(async (sql) => {
      await sql`
        UPDATE experiments 
        SET status = 'completed', conclusion = ${insight.conclusion}, 
            confidence = ${insight.confidence}, end_at = NOW()
        WHERE id = ${experimentId}
      `;
      await sql`
        UPDATE hypotheses 
        SET status = ${insight.conclusion}
        WHERE id = ${exp.hypothesisId}
      `;
      // Note: insight_type maps to category conceptually, but DB schema expects insight_type
      await sql`
        INSERT INTO strategic_insights (
          social_account_id, insight_type, observation, recommendation, confidence, status
        ) VALUES (
          ${exp.socialAccountId}, 'content_performance', ${insight.insightStatement}, ${insight.conclusion}, ${insight.confidence}, 'active'
        )
      `;
    });

    return { insight };
  }
}
