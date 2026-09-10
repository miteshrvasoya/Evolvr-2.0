CREATE TYPE log_direction AS ENUM ('inward', 'outward');

CREATE TABLE IF NOT EXISTS api_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  direction log_direction NOT NULL,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  status_code INTEGER,
  request_payload JSONB,
  response_payload JSONB,
  latency_ms INTEGER,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  context JSONB,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_logs_created_at ON api_logs(created_at);
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at);
