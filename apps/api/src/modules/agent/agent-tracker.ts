import { sql } from '../../db/client.js';
import type { AgentStep } from '@evolvr/types';

export class AgentRunTracker {
  private progress: AgentStep[] = [];

  constructor(private runId: string) {}

  /**
   * Initializes or updates a step in the progress array and saves to DB.
   */
  async trackStep(stepName: string, status: 'pending' | 'running' | 'completed' | 'failed', error?: string) {
    const existingIndex = this.progress.findIndex(s => s.step === stepName);
    
    const step: AgentStep = {
      step: stepName,
      status,
      error,
      timestamp: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      this.progress[existingIndex] = step;
    } else {
      this.progress.push(step);
    }

    await this.persist();
  }

  /**
   * Conclude the current running step (if any) as completed
   */
  async completeCurrentStep() {
    const current = this.progress.find(s => s.status === 'running');
    if (current) {
      current.status = 'completed';
      await this.persist();
    }
  }

  /**
   * Append a log message to the currently running step
   */
  async addLog(message: string) {
    const current = this.progress.find(s => s.status === 'running');
    if (current) {
      if (!current.logs) current.logs = [];
      current.logs.push(message);
      await this.persist();
    } else {
      // If no running step, just log to console
      console.log(`[AgentRunTracker] No running step to attach log: ${message}`);
    }
  }

  private async persist() {
    try {
      await sql`
        UPDATE agent_runs
        SET progress = ${sql.json(this.progress)}
        WHERE id = ${this.runId}
      `;
    } catch (e) {
      console.error(`[AgentRunTracker] Failed to persist progress for run ${this.runId}`, e);
    }
  }
}
