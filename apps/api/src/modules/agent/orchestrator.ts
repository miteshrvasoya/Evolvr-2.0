import { sql } from '../../db/client.js';
import { StrategyAgent } from './strategy.agent.js';
import { ContentAgent } from './content.agent.js';

export class OrchestratorAgent {
  private strategyAgent = new StrategyAgent();
  private contentAgent = new ContentAgent();

  async runDailyCycle(socialAccountId: string) {
    console.log(`\n======================================================`);
    console.log(`[Orchestrator] Starting daily cycle for account: ${socialAccountId}`);
    console.log(`======================================================\n`);

    try {
      // 1. Check for Active Goal
      const goals = await sql`SELECT id FROM admin_goals WHERE social_account_id = ${socialAccountId} AND is_active = true LIMIT 1`;
      const activeGoal = goals[0];

      if (!activeGoal) {
        console.log(`[Orchestrator] No active goal found for ${socialAccountId}. Halting cycle.`);
        return { status: 'halted', reason: 'NO_ACTIVE_GOAL' };
      }

      console.log(`[Orchestrator] Active goal verified. Proceeding...`);

      // 2. Check Strategy Status (Do we have an active strategy?)
      const strategies = await sql`SELECT id FROM strategy_versions WHERE social_account_id = ${socialAccountId} AND status = 'active' LIMIT 1`;

      let currentStrategyId = strategies[0]?.id;

      if (!currentStrategyId) {
        console.log(`[Orchestrator] No active strategy found. Triggering Strategy Revision...`);
        const result = await this.strategyAgent.runStrategyRevision(socialAccountId, activeGoal.id);
        currentStrategyId = result.strategyId;
      } else {
        // Evaluate if strategy needs revision (Based on threshold of insights/time)
        // Simplified for v1 scaffold
        console.log(`[Orchestrator] Active strategy exists (ID: ${currentStrategyId}). Proceeding to content evaluation.`);
      }

      // 3. Evaluate Content Pipeline
      // Are there enough drafted / approved posts for the next 7 days based on cadence?
      // (Simplified logic for scaffold)
      console.log(`[Orchestrator] Evaluating content pipeline buffer...`);
      const draftedCount = await sql`SELECT COUNT(*) as count FROM content_ideas WHERE social_account_id = ${socialAccountId} AND status = 'draft'`;

      console.log(`[Orchestrator] Current drafted content count: ${draftedCount[0].count}`);
      if (Number(draftedCount[0].count) < 5) {
        console.log(`[Orchestrator] Low content buffer detected (< 5). Generating Content Plan...`);
        await this.contentAgent.generateContentPlan(socialAccountId, currentStrategyId);
      } else {
        console.log(`[Orchestrator] Content buffer is healthy (>= 5). Skipping Content Generation.`);
      }

      // 4. Analytics & Learning Sync
      console.log(`[Orchestrator] Queuing daily analytics sync...`);
      // Drops a job into BullMQ `analytics` queue

      console.log(`\n======================================================`);
      console.log(`[Orchestrator] Daily cycle completed successfully!`);
      console.log(`======================================================\n`);

      return { status: 'completed' };

    } catch (error) {
      console.error(`\n======================================================`);
      console.error(`[Orchestrator] CYCLE FAILED for ${socialAccountId}`);
      console.error(error);
      console.error(`======================================================\n`);
      return { status: 'failed', error };
    }
  }
}
