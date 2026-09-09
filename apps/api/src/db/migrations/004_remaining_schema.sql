-- 004_remaining_schema.sql

-- Admin Goals
CREATE TABLE IF NOT EXISTS admin_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL,
  primary_metric TEXT NOT NULL,
  secondary_metrics JSONB NOT NULL DEFAULT '[]',
  target NUMERIC NOT NULL,
  deadline DATE,
  audience TEXT,
  business_outcome TEXT,
  autonomy_level TEXT NOT NULL DEFAULT 'supervised',
  constraints JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_admin_goals_updated_at BEFORE UPDATE ON admin_goals FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Strategy Versions
CREATE TABLE IF NOT EXISTS strategy_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  objective JSONB NOT NULL,
  content_mix JSONB NOT NULL,
  cadence JSONB NOT NULL,
  experiment_plan JSONB NOT NULL DEFAULT '[]',
  rationale TEXT NOT NULL,
  evidence_ids JSONB NOT NULL DEFAULT '[]',
  confidence NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Strategic Insights
CREATE TABLE IF NOT EXISTS strategic_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  statement TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]',
  confidence NUMERIC NOT NULL,
  scope TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_strategic_insights_updated_at BEFORE UPDATE ON strategic_insights FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Hypotheses
CREATE TABLE IF NOT EXISTS hypotheses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  strategy_version_id UUID NOT NULL REFERENCES strategy_versions(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  metric TEXT NOT NULL,
  expected_direction TEXT NOT NULL,
  expected_effect TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'testing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Research Runs
CREATE TABLE IF NOT EXISTS research_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  query JSONB NOT NULL,
  synthesized_findings JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Research Sources
CREATE TABLE IF NOT EXISTS research_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  research_run_id UUID NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  domain TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  excerpt_or_summary TEXT,
  credibility_notes TEXT
);

-- Content Ideas
CREATE TABLE IF NOT EXISTS content_ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  strategy_version_id UUID NOT NULL REFERENCES strategy_versions(id),
  pillar TEXT NOT NULL,
  format TEXT NOT NULL,
  concept TEXT NOT NULL,
  hook TEXT,
  caption TEXT,
  hashtags JSONB NOT NULL DEFAULT '[]',
  script TEXT,
  alt_text TEXT,
  rationale JSONB NOT NULL DEFAULT '{}',
  score JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  policy_decision JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_content_ideas_updated_at BEFORE UPDATE ON content_ideas FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Content Assets
CREATE TABLE IF NOT EXISTS content_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_idea_id UUID NOT NULL REFERENCES content_ideas(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  prompt TEXT,
  generation_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Posts
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  content_idea_id UUID REFERENCES content_ideas(id) ON DELETE SET NULL,
  platform_post_id TEXT,
  caption TEXT,
  media_type TEXT,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled',
  strategy_version_id UUID REFERENCES strategy_versions(id),
  experiment_id UUID, -- FK added later to avoid circular logic or define experiments table first
  failure_reason TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Post Metrics
CREATE TABLE IF NOT EXISTS post_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  profile_visits INTEGER DEFAULT 0,
  follows INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  watch_time_ms INTEGER DEFAULT 0,
  retention_data JSONB DEFAULT '{}',
  engagement_rate NUMERIC,
  share_rate NUMERIC,
  save_rate NUMERIC,
  comment_rate NUMERIC,
  profile_visit_rate NUMERIC,
  follow_conversion_rate NUMERIC,
  raw_metrics JSONB NOT NULL DEFAULT '{}'
);
-- Ensure we don't capture duplicate metrics for same post on same timestamp
CREATE UNIQUE INDEX idx_post_metrics_post_captured ON post_metrics(post_id, captured_at);

-- Account Metrics
CREATE TABLE IF NOT EXISTS account_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  profile_visits INTEGER DEFAULT 0,
  interactions INTEGER DEFAULT 0,
  website_clicks INTEGER DEFAULT 0,
  raw_metrics JSONB NOT NULL DEFAULT '{}'
);

-- Experiments
CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  hypothesis_id UUID REFERENCES hypotheses(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  variable TEXT NOT NULL,
  control_definition TEXT NOT NULL,
  treatment_definition TEXT NOT NULL,
  primary_metric TEXT NOT NULL,
  secondary_metrics JSONB NOT NULL DEFAULT '[]',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  conclusion TEXT,
  confidence NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Add FK back to posts if needed (skip for now to avoid circular dependency in schema setup)

-- Experiment Assignments
CREATE TABLE IF NOT EXISTS experiment_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  content_idea_id UUID NOT NULL REFERENCES content_ideas(id) ON DELETE CASCADE,
  variant TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent Runs
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_type TEXT NOT NULL,
  social_account_id UUID REFERENCES social_accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  input_snapshot JSONB NOT NULL DEFAULT '{}',
  output JSONB,
  error JSONB,
  correlation_id TEXT
);

-- Agent Decisions
CREATE TABLE IF NOT EXISTS agent_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  decision_type TEXT NOT NULL,
  decision JSONB NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]',
  confidence NUMERIC,
  reasoning TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scheduled Jobs
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  platform_comment_id TEXT UNIQUE NOT NULL,
  author_handle TEXT NOT NULL,
  text TEXT NOT NULL,
  sentiment TEXT,
  intent TEXT,
  risk_level TEXT,
  status TEXT NOT NULL DEFAULT 'unprocessed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Engagement Actions
CREATE TABLE IF NOT EXISTS engagement_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  draft_text TEXT,
  executed_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  policy_decision JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'low',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'unread',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- LLM Usage Records
CREATE TABLE IF NOT EXISTS llm_usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL,
  task_type TEXT NOT NULL,
  agent_run_id UUID REFERENCES agent_runs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
