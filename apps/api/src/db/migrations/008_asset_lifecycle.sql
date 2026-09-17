-- 008_asset_lifecycle.sql
-- Adds first-class asset lifecycle tracking:
--   content_asset_prompts             — persisted AI/user prompts, versioned
--   content_asset_generation_attempts — every generation attempt with full status
--   content_idea_versions             — content version history
--   Alter content_ideas               — asset_generation_status, needs_attention
--   Alter content_assets              — generation_status, source, generation_attempt_id

-- ─── Content Idea Versions ────────────────────────────────────────────────────
-- Stores every saved version of a content idea (caption, hook, hashtags, etc.)
CREATE TABLE IF NOT EXISTS content_idea_versions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_idea_id     UUID NOT NULL REFERENCES content_ideas(id) ON DELETE CASCADE,
  version_number      INTEGER NOT NULL,
  pillar              TEXT,
  format              TEXT,
  concept             TEXT,
  hook                TEXT,
  caption             TEXT,
  hashtags            JSONB NOT NULL DEFAULT '[]',
  alt_text            TEXT,
  script              TEXT,
  changed_by          TEXT NOT NULL DEFAULT 'agent', -- 'agent' | 'user'
  change_reason       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_idea_versions_idea ON content_idea_versions(content_idea_id, version_number DESC);

-- ─── Content Asset Prompts ────────────────────────────────────────────────────
-- Every AI-generated or user-edited prompt for asset generation.
-- Persisted BEFORE any generation attempt — so it is never lost on failure.
CREATE TABLE IF NOT EXISTS content_asset_prompts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_idea_id     UUID NOT NULL REFERENCES content_ideas(id) ON DELETE CASCADE,
  asset_type          TEXT NOT NULL,   -- 'image' | 'video_placeholder' | 'carousel' | 'thumbnail'
  prompt_text         TEXT NOT NULL,
  prompt_version      INTEGER NOT NULL DEFAULT 1,
  provider            TEXT,            -- intended provider (e.g. 'pollinations', 'lmstudio')
  model               TEXT,
  source              TEXT NOT NULL DEFAULT 'ai_generated', -- 'ai_generated' | 'user_edited' | 'improved'
  original_prompt_id  UUID REFERENCES content_asset_prompts(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_content_asset_prompts_updated_at
  BEFORE UPDATE ON content_asset_prompts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_cap_content_idea ON content_asset_prompts(content_idea_id);
CREATE INDEX IF NOT EXISTS idx_cap_asset_type   ON content_asset_prompts(content_idea_id, asset_type);

-- ─── Content Asset Generation Attempts ───────────────────────────────────────
-- One row per generation attempt (including automatic retries and manual retries).
CREATE TABLE IF NOT EXISTS content_asset_generation_attempts (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_idea_id        UUID NOT NULL REFERENCES content_ideas(id) ON DELETE CASCADE,
  content_asset_prompt_id UUID REFERENCES content_asset_prompts(id) ON DELETE SET NULL,
  asset_type             TEXT NOT NULL,
  provider               TEXT,
  model                  TEXT,
  -- Status lifecycle: pending → generating → generated | failed
  -- Failed may transition to: retrying (if auto-retry scheduled)
  status                 TEXT NOT NULL DEFAULT 'pending',
  -- Error classification for retry decision logic
  error_category         TEXT,   -- 'transient' | 'rate_limited' | 'timeout' | 'provider_error'
                                  -- | 'auth_error' | 'invalid_prompt' | 'content_policy'
                                  -- | 'quota_exceeded' | 'permanent'
  error_message          TEXT,
  error_detail           JSONB,   -- Full provider error payload (internal, never exposed to frontend verbatim)
  attempt_number         INTEGER NOT NULL DEFAULT 1,
  started_at             TIMESTAMPTZ,
  completed_at           TIMESTAMPTZ,
  duration_ms            INTEGER,
  -- FK to produced asset (set on success)
  asset_id               UUID REFERENCES content_assets(id) ON DELETE SET NULL,
  -- Idempotency key prevents duplicate jobs for the same attempt
  idempotency_key        TEXT UNIQUE,
  -- BullMQ job ID for cross-referencing
  job_id                 TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_caga_updated_at
  BEFORE UPDATE ON content_asset_generation_attempts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_caga_content_idea  ON content_asset_generation_attempts(content_idea_id);
CREATE INDEX IF NOT EXISTS idx_caga_status        ON content_asset_generation_attempts(status);
CREATE INDEX IF NOT EXISTS idx_caga_asset_type    ON content_asset_generation_attempts(content_idea_id, asset_type);

-- ─── Alter content_ideas ──────────────────────────────────────────────────────
ALTER TABLE content_ideas
  ADD COLUMN IF NOT EXISTS asset_generation_status TEXT NOT NULL DEFAULT 'none',
  -- 'none' | 'pending' | 'generating' | 'partial' | 'completed' | 'needs_attention'
  ADD COLUMN IF NOT EXISTS needs_attention         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_attention_reason  TEXT,
  ADD COLUMN IF NOT EXISTS version_number          INTEGER NOT NULL DEFAULT 1;

-- ─── Alter content_assets ─────────────────────────────────────────────────────
ALTER TABLE content_assets
  ADD COLUMN IF NOT EXISTS generation_status     TEXT NOT NULL DEFAULT 'generated',
  -- 'generated' | 'failed' | 'manually_added'
  ADD COLUMN IF NOT EXISTS source                TEXT NOT NULL DEFAULT 'ai_generated',
  -- 'ai_generated' | 'manually_added'
  ADD COLUMN IF NOT EXISTS generation_attempt_id UUID REFERENCES content_asset_generation_attempts(id) ON DELETE SET NULL;

-- Back-fill: any existing row in content_assets is treated as 'generated' by 'ai_generated'
-- (defaults handle this — no explicit UPDATE needed)
