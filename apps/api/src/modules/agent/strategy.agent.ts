import { randomUUID } from 'crypto';
import { sql } from '../../db/client.js';
import { getLLMProvider } from '../llm/index.js';
import { buildStrategyPrompt, BuildStrategyContext } from '../../prompts/strategy.v1.js';
import { AgentRunTracker } from './agent-tracker.js';

export class StrategyAgent {
  private llm = getLLMProvider();

  async runStrategyRevision(socialAccountId: string, goalId: string, runId: string, attemptNumber: number, maxAttempts: number) {
    const tracker = new AgentRunTracker(runId);
    const stepId = await tracker.startStep('strategy_revision', attemptNumber, maxAttempts);

    try {
      console.log(`[StrategyAgent] Starting Strategy Revision for account ${socialAccountId}...`);
      
      // 2. Fetch Context
      const profiles = await sql`SELECT * FROM account_profiles WHERE social_account_id = ${socialAccountId}`;
      const profile = profiles[0] || {};
      
      const goals = await sql`SELECT * FROM admin_goals WHERE id = ${goalId}`;
      const goal = goals[0];
      if (!goal) throw new Error('Goal not found');

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
        accountMetrics: '[]',
        strategicInsights: '[]',
        researchFindings: '[]',
        experimentResults: '[]',
      };

      await tracker.logEvent(stepId, 'CONTEXT_FETCHED', 'info', `Context fetched successfully. Goal: ${goal.goalType}`);
      
      // 3. Generate Prompt & Call LLM
      await tracker.logEvent(stepId, 'LLM_GENERATION_STARTED', 'info', `Asking LLM to generate new strategy...`);
      
      const prompt = buildStrategyPrompt(context);
      const llmResponse = await this.llm.generateStructured(prompt);

      if (!llmResponse.structured) {
        throw new Error('LLM failed to return structured strategy data');
      }

      const strategyData = llmResponse.structured;
      await tracker.logLlmCall(
        stepId, 
        `LLM generated strategy successfully. Confidence: ${strategyData.confidence}`, 
        'strategy_generation', 
        llmResponse.model, 
        llmResponse.latencyMs, 
        llmResponse.inputTokens, 
        llmResponse.outputTokens
      );

      // 4. Save Strategy Version
      await tracker.logEvent(stepId, 'SAVING_STRATEGY', 'info', `Saving new strategy version to database...`);
      
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

      const strategyId = insertedStrategy[0]?.id;

      // 5. Record Decision
      await sql`
        INSERT INTO agent_decisions (id, agent_run_id, decision_type, decision, confidence, reasoning)
        VALUES (
          ${randomUUID()}, ${runId}, 'REVISE_STRATEGY',
          ${sql.json({ strategyId, versionNumber: nextVersion })},
          ${strategyData.confidence}, ${strategyData.rationale}
        )
      `;

      // 6. Complete Run
      await tracker.completeStep(stepId, { strategyId });

      console.log(`[StrategyAgent] Strategy Revision Complete! New Strategy ID: ${strategyId}`);
      return { success: true, strategyId };

    } catch (error: any) {
      console.error(`[StrategyAgent] CYCLE FAILED for ${socialAccountId}`, error);
      throw { error, stepId };
    }
  }
}
