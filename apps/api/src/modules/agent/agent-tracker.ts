import { sql } from '../../db/client.js';
import { randomUUID } from 'crypto';

export class AgentRunTracker {
  constructor(private runId: string) {}

  /**
   * Initializes a new step in the database for this agent run.
   * Returns the generated step ID.
   */
  async startStep(stepType: string, attemptNumber: number = 1, maxAttempts: number = 5): Promise<string> {
    const stepId = randomUUID();
    
    // Create the step
    await sql`
      INSERT INTO agent_steps (id, agent_run_id, step_type, status, attempt_number, max_attempts, started_at)
      VALUES (${stepId}, ${this.runId}, ${stepType}, 'running', ${attemptNumber}, ${maxAttempts}, NOW())
    `;

    // Update the run's current step
    await sql`
      UPDATE agent_runs
      SET current_step = ${stepType},
          last_activity_at = NOW(),
          last_heartbeat_at = NOW()
      WHERE id = ${this.runId}
    `;

    await this.logEvent(stepId, `${stepType.toUpperCase()}_STARTED`, 'info', `Started step: ${stepType} (Attempt ${attemptNumber}/${maxAttempts})`);

    return stepId;
  }

  /**
   * Marks a step as completed and updates the run's last activity.
   */
  async completeStep(stepId: string, outputReference?: any) {
    await sql`
      UPDATE agent_steps
      SET status = 'completed',
          completed_at = NOW(),
          output_reference = ${outputReference ? sql.json(outputReference) : null}
      WHERE id = ${stepId}
    `;

    await sql`
      UPDATE agent_runs
      SET last_activity_at = NOW(),
          last_heartbeat_at = NOW()
      WHERE id = ${this.runId}
    `;

    await this.logEvent(stepId, `STEP_COMPLETED`, 'info', `Completed step successfully.`);
  }

  /**
   * Marks a step as failed or retrying.
   */
  async failStep(stepId: string, errorMsg: string, retryable: boolean, nextRetryAt?: Date) {
    const status = retryable ? 'retrying' : 'failed';
    
    await sql`
      UPDATE agent_steps
      SET status = ${status},
          error_message = ${errorMsg},
          retryable = ${retryable},
          next_retry_at = ${nextRetryAt ? nextRetryAt.toISOString() : null},
          completed_at = NOW()
      WHERE id = ${stepId}
    `;

    await sql`
      UPDATE agent_runs
      SET last_activity_at = NOW(),
          last_heartbeat_at = NOW()
      WHERE id = ${this.runId}
    `;

    await this.logEvent(stepId, `STEP_FAILED`, retryable ? 'warn' : 'error', `Step failed: ${errorMsg}`);
  }

  /**
   * Appends an event to the activity log.
   */
  async logEvent(stepId: string | null, eventType: string, level: 'info' | 'warn' | 'error', message: string, metadata: any = {}) {
    try {
      await sql`
        INSERT INTO agent_events (agent_run_id, agent_step_id, event_type, level, message, metadata)
        VALUES (${this.runId}, ${stepId}, ${eventType}, ${level}, ${message}, ${sql.json(metadata)})
      `;
    } catch (e) {
      console.error(`[AgentRunTracker] Failed to persist event for run ${this.runId}`, e);
    }
  }

  /**
   * Convenience alias — appends a plain info log without a specific step context.
   * Workers call this as `tracker.addLog('message')`.
   */
  async addLog(message: string, metadata: any = {}) {
    return this.logEvent(null, 'LOG', 'info', message, metadata);
  }

  /**
   * Logs an LLM generation call, complete with token metrics and latency.
   * This structure is consumed directly by the frontend LLMActivityPanel.
   */
  async logLlmCall(stepId: string | null, message: string, task: string, model: string, latencyMs: number, inputTokens: number, outputTokens: number, isError = false) {
    const metadata = {
      task,
      model,
      latencyMs,
      inputTokens,
      outputTokens,
    };
    return this.logEvent(stepId, 'LLM_CALL', isError ? 'error' : 'info', message, metadata);
  }

  /**
   * Logs an external Tool/API call (e.g. SERP, Instagram API).
   * This structure is consumed directly by the frontend ToolActivityPanel.
   */
  async logToolCall(stepId: string | null, message: string, provider: string, url: string, statusCode: number, latencyMs: number) {
    const metadata = {
      provider,
      url,
      statusCode,
      latencyMs,
    };
    // We categorize >400 as error, otherwise info
    const level = statusCode >= 400 ? 'error' : 'info';
    return this.logEvent(stepId, 'TOOL_CALL', level, message, metadata);
  }

  /**
   * Updates the run heartbeat.
   */
  async heartbeat() {
    await sql`
      UPDATE agent_runs
      SET last_heartbeat_at = NOW()
      WHERE id = ${this.runId}
    `;
  }
}
