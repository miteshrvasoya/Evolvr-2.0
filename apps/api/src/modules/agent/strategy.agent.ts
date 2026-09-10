import { randomUUID } from 'crypto';
import { sql } from '../../db/client.js';
import { getLLMProvider } from '../llm/index.js';
import { buildStrategyPrompt, BuildStrategyContext } from '../../prompts/strategy.v1.js';
import { AgentRunTracker } from './agent-tracker.js';

export class StrategyAgent {
  private llm = getLLMProvider();

  async runStrategyRevision(socialAccountId: string, goalId: string) {
    const runId = randomUUID();
    
    // 1. Create agent run record
    await sql`
      INSERT INTO agent_runs (id, run_type, social_account_id, status)
      VALUES (${runId}, 'STRATEGY_REVISION', ${socialAccountId}, 'running')
    `;

    const tracker = new AgentRunTracker(runId);

    try {
      console.log(`[StrategyAgent] Starting Strategy Revision for account ${socialAccountId}...`);
      await tracker.trackStep('Fetching Context', 'running');
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

      const msg1 = `[StrategyAgent] Context fetched successfully. Goal: ${goal.goalType}`;
      console.log(msg1);
      await tracker.addLog(msg1);
      
      await tracker.trackStep('Fetching Context', 'completed');
      await tracker.trackStep('Generating Strategy', 'running');
      
      // 3. Generate Prompt & Call LLM
      const msg2 = `[StrategyAgent] Asking LLM to generate new strategy... (This may take a minute)`;
      console.log(msg2);
      await tracker.addLog(msg2);
      
      const prompt = buildStrategyPrompt(context);
      const llmResponse = await this.llm.generateStructured(prompt);

      if (!llmResponse.structured) {
        throw new Error('LLM failed to return structured strategy data');
      }

      const strategyData = llmResponse.structured;
      const msg3 = `[StrategyAgent] LLM generated strategy successfully. Confidence: ${strategyData.confidence}`;
      console.log(msg3);
      await tracker.addLog(msg3);

      await tracker.trackStep('Generating Strategy', 'completed');
      await tracker.trackStep('Saving Strategy', 'running');
      
      // 4. Save Strategy Version
      const msg4 = `[StrategyAgent] Saving new strategy version to database...`;
      console.log(msg4);
      await tracker.addLog(msg4);
      
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

      const strategyId = insertedStrategy[0].id;

      // 5. Record Decision
      await sql`
        INSERT INTO agent_decisions (id, agent_run_id, decision_type, decision, confidence, reasoning)
        VALUES (
          ${randomUUID()}, ${runId}, 'REVISE_STRATEGY',
          ${sql.json({ strategyId, versionNumber: nextVersion })},
          ${strategyData.confidence}, ${strategyData.rationale}
        )
      `;

      await tracker.trackStep('Saving Strategy', 'completed');

      // 6. Complete Run
      await sql`
        UPDATE agent_runs 
        SET status = 'completed', completed_at = NOW(), output = ${JSON.stringify({ strategyId: insertedStrategy[0].id })}
        WHERE id = ${runId}
      `;

      console.log(`[StrategyAgent] Strategy Revision Complete! New Strategy ID: ${strategyId}`);
      return { success: true, strategyId: insertedStrategy[0].id };

    } catch (error: any) {
      await tracker.completeCurrentStep(); // Will leave it running but actually we want to fail it
      const currentStep = (await sql`SELECT progress FROM agent_runs WHERE id = ${runId}`)[0]?.progress?.find((s: any) => s.status === 'running')?.step;
      if (currentStep) {
        await tracker.trackStep(currentStep, 'failed', error.message);
      }
      
      await sql`
        UPDATE agent_runs 
        SET status = 'failed', completed_at = NOW(), error = ${sql.json({ message: error.message })}
        WHERE id = ${runId}
      `;
      throw error;
    }
  }
}
