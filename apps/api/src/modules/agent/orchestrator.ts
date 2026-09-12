import { sql } from '../../db/client.js';
import { queues } from '../../queues/index.js';
import { randomUUID } from 'crypto';

export class OrchestratorAgent {
  /**
   * Triggers a daily cycle by enqueuing a job to the orchestrator worker.
   */
  async triggerCycle(socialAccountId: string) {
    const goals = await sql`SELECT id FROM admin_goals WHERE social_account_id = ${socialAccountId} AND is_active = true LIMIT 1`;
    const activeGoal = goals[0];

    if (!activeGoal) {
      console.log(`[Orchestrator] No active goal found for ${socialAccountId}. Halting cycle.`);
      return { status: 'halted', reason: 'NO_ACTIVE_GOAL' };
    }

    const runId = randomUUID();
    
    // Create the durable agent run
    await sql`
      INSERT INTO agent_runs (id, run_type, social_account_id, goal_id, status)
      VALUES (${runId}, 'daily_cycle', ${socialAccountId}, ${activeGoal.id}, 'queued')
    `;

    // Dispatch to the orchestrator worker
    await queues.orchestrator.add('evaluate-next-action', {
      socialAccountId,
      agentRunId: runId,
      goalId: activeGoal.id,
      correlationId: runId,
      idempotencyKey: `daily-cycle-${socialAccountId}-${new Date().toISOString().split('T')[0]}`,
      attemptNumber: 1
    });

    return { status: 'started', runId };
  }
}
