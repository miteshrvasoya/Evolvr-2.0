-- 012_autonomous_agent.sql
-- Evolution to a persistent, autonomous, synchronized Instagram growth agent

-- 1. Update admin_goals
ALTER TABLE admin_goals 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED', 'ERROR')),
  ADD COLUMN IF NOT EXISTS last_agent_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_agent_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS active_strategy_id UUID REFERENCES strategy_versions(id) ON DELETE SET NULL;

-- 2. Update posts (to support external posts and sync)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'EVOLVR' CHECK (source IN ('EVOLVR', 'EXTERNAL')),
  ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ,
  ALTER COLUMN content_idea_id DROP NOT NULL;

-- Ensure strategy_version_id is already nullable, but let's be safe:
ALTER TABLE posts ALTER COLUMN strategy_version_id DROP NOT NULL;

-- Create an index for faster lookups by media id
CREATE INDEX IF NOT EXISTS idx_posts_platform_post_id ON posts(social_account_id, platform_post_id);

-- 3. Create learning_observations
CREATE TABLE IF NOT EXISTS learning_observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES admin_goals(id) ON DELETE CASCADE,
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  observation_type TEXT NOT NULL,
  observation TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}',
  confidence NUMERIC NOT NULL DEFAULT 0.0,
  source_post_ids JSONB NOT NULL DEFAULT '[]',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_observations_account ON learning_observations(social_account_id);

-- 4. Create instagram_sync_runs
CREATE TABLE IF NOT EXISTS instagram_sync_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'SYNCING' CHECK (status IN ('SYNCING', 'COMPLETED', 'FAILED', 'PARTIAL', 'AUTH_REQUIRED')),
  posts_fetched INTEGER DEFAULT 0,
  new_posts INTEGER DEFAULT 0,
  updated_posts INTEGER DEFAULT 0,
  insights_fetched INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  last_cursor TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
