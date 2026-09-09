import { sql } from '../../db/client.js';
import { getLLMProvider } from '../llm/index.js';
import { generateInsightPrompt, InsightContext } from '../../prompts/learning.v1.js';

export class LearningAgent {
  private llm = getLLMProvider();

  async evaluateExperiment(experimentId: string) {
    const experiments = await sql`
      SELECT e.*, h.statement as hypothesis_statement
      FROM experiments e
      JOIN hypotheses h ON e.hypothesis_id = h.id
      WHERE e.id = ${experimentId}
    `;
    const exp = experiments[0];
    if (!exp) throw new Error('Experiment not found');

    // In full impl, fetch post metrics aggregated by variant (control vs treatment)
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
      // Complete experiment
      await sql`
        UPDATE experiments 
        SET status = 'completed', conclusion = ${insight.conclusion}, 
            confidence = ${insight.confidence}, end_at = NOW()
        WHERE id = ${experimentId}
      `;

      // Complete hypothesis
      await sql`
        UPDATE hypotheses 
        SET status = ${insight.conclusion}
        WHERE id = ${exp.hypothesisId}
      `;

      // Save global strategic insight
      await sql`
        INSERT INTO strategic_insights (
          social_account_id, category, statement, confidence, scope
        ) VALUES (
          ${exp.socialAccountId}, 'experiment_result', ${insight.insightStatement}, ${insight.confidence}, 'instagram_account'
        )
      `;
    });

    return { insight };
  }
}
