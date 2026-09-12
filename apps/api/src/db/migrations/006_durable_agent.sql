-- 006_durable_agent.sql

-- Add columns to agent_runs
ALTER TABLE agent_runs
ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES admin_goals(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS current_step TEXT,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_code TEXT,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add trigger for updated_at on agent_runs
DROP TRIGGER IF EXISTS set_agent_runs_updated_at ON agent_runs;
CREATE TRIGGER set_agent_runs_updated_at BEFORE UPDATE ON agent_runs FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Agent Steps Table
CREATE TABLE IF NOT EXISTS agent_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, running, completed, failed, blocked, retrying
  attempt_number INTEGER NOT NULL DEFAULT 1,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  input_reference JSONB,
  output_reference JSONB,
  error_code TEXT,
  error_message TEXT,
  retryable BOOLEAN DEFAULT true,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add trigger for updated_at on agent_steps
DROP TRIGGER IF EXISTS set_agent_steps_updated_at ON agent_steps;
CREATE TRIGGER set_agent_steps_updated_at BEFORE UPDATE ON agent_steps FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Agent Events Table (Activity Log)
CREATE TABLE IF NOT EXISTS agent_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_run_id UUID REFERENCES agent_runs(id) ON DELETE CASCADE,
  agent_step_id UUID REFERENCES agent_steps(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info', -- info, warn, error
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
