import { randomUUID } from 'crypto';
import { sql } from '../../db/client.js';
import { getLLMProvider } from '../llm/index.js';
import { buildStrategyPrompt, BuildStrategyContext } from '../../prompts/strategy.v1.js';

export class StrategyAgent {
  private llm = getLLMProvider();

  async runStrategyRevision(socialAccountId: string, goalId: string) {
    const runId = randomUUID();
    
    // 1. Create agent run record
    await sql`
      INSERT INTO agent_runs (id, run_type, social_account_id, status)
      VALUES (${runId}, 'STRATEGY_REVISION', ${socialAccountId}, 'running')
    `;

    try {
      // 2. Fetch Context
      // Fetch Account Profile
      const profiles = await sql`SELECT * FROM account_profiles WHERE social_account_id = ${socialAccountId}`;
      const profile = profiles[0] || {};
      
      // Fetch Goal
      const goals = await sql`SELECT * FROM admin_goals WHERE id = ${goalId}`;
      const goal = goals[0];
      if (!goal) throw new Error('Goal not found');

      // (Skipping full analytics/insights fetches for brevity in the scaffold)
      const context: BuildStrategyContext = {
        niche: profile.niche || 'General',
        valueProposition: profile.valueProposition || '',
        audienceDefinition: JSON.stringify(profile.audienceDefinition || {}),
        brandVoice: JSON.stringify(profile.brandVoice || {}),
        bannedTopics: profile.bannedTopics || [],
        goal: goal.goalType,
        primaryMetric: goal.primaryMetric,
        target: String(goal.target),
        deadline: String(goal.deadline),
        accountMetrics: '[]', // Mock
        strategicInsights: '[]', // Mock
        researchFindings: '[]', // Mock
        experimentResults: '[]', // Mock
      };

      // 3. Generate Prompt & Call LLM
      const prompt = buildStrategyPrompt(context);
      const llmResponse = await this.llm.generateStructured(prompt);

      if (!llmResponse.structured) {
        throw new Error('LLM failed to return structured strategy data');
      }

      const strategyData = llmResponse.structured;

      // 4. Save Strategy Version
      const existingVersions = await sql`SELECT COUNT(*) as count FROM strategy_versions WHERE social_account_id = ${socialAccountId}`;
      const nextVersion = Number(existingVersions[0].count) + 1;

      // Deactivate old strategies
      await sql`UPDATE strategy_versions SET status = 'superseded' WHERE social_account_id = ${socialAccountId}`;

      const insertedStrategy = await sql`
        INSERT INTO strategy_versions (
          social_account_id, version_number, objective, content_mix, cadence,
          experiment_plan, rationale, evidence_ids, confidence, status
        ) VALUES (
          ${socialAccountId}, ${nextVersion}, ${JSON.stringify({ primaryMetric: goal.primaryMetric, target: goal.target })},
          ${strategyData.contentMix}, ${strategyData.cadence}, ${strategyData.experimentPlan},
          ${strategyData.rationale}, ${strategyData.evidenceIds}, ${strategyData.confidence}, 'active'
        ) RETURNING id
      `;

      // 5. Save Decision Log
      await sql`
        INSERT INTO agent_decisions (
          agent_run_id, decision_type, decision, evidence, confidence, reasoning
        ) VALUES (
          ${runId}, 'CREATE_STRATEGY_VERSION', ${strategyData}, ${strategyData.evidenceIds}, 
          ${strategyData.confidence}, ${strategyData.rationale}
        )
      `;

      // 6. Complete Run
      await sql`
        UPDATE agent_runs 
        SET status = 'completed', completed_at = NOW(), output = ${JSON.stringify({ strategyId: insertedStrategy[0].id })}
        WHERE id = ${runId}
      `;

      return { success: true, strategyId: insertedStrategy[0].id };

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
