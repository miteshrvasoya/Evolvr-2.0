import { sql } from '../../db/client.js';
import { StrategyAgent } from './strategy.agent.js';

export class OrchestratorAgent {
  private strategyAgent = new StrategyAgent();

  async runDailyCycle(socialAccountId: string) {
    console.log(`[Orchestrator] Starting daily cycle for account: ${socialAccountId}`);
    
    try {
      // 1. Check for Active Goal
      const goals = await sql`SELECT id FROM admin_goals WHERE social_account_id = ${socialAccountId} AND is_active = true LIMIT 1`;
      const activeGoal = goals[0];

      if (!activeGoal) {
        console.log(`[Orchestrator] No active goal for ${socialAccountId}. Halting cycle.`);
        return { status: 'halted', reason: 'NO_ACTIVE_GOAL' };
      }

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
        console.log(`[Orchestrator] Active strategy exists. Proceeding to content evaluation.`);
      }

      // 3. Evaluate Content Pipeline
      // Are there enough drafted / approved posts for the next 7 days based on cadence?
      // (Simplified logic for scaffold)
      
      const draftedCount = await sql`SELECT COUNT(*) as count FROM content_ideas WHERE social_account_id = ${socialAccountId} AND status = 'draft'`;
      if (Number(draftedCount[0].count) < 5) {
        console.log(`[Orchestrator] Low content buffer. Queuing Content Generation job.`);
        // In full implementation, this drops a job into BullMQ `content-generation` queue
      }

      // 4. Analytics & Learning Sync
      console.log(`[Orchestrator] Queuing daily analytics sync.`);
      // Drops a job into BullMQ `analytics` queue

      return { status: 'completed' };

    } catch (error) {
      console.error(`[Orchestrator] Cycle failed for ${socialAccountId}:`, error);
      return { status: 'failed', error };
    }
  }
}
