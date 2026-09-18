-- 010_scheduling.sql
-- Intelligent Content Scheduling infrastructure.
-- Introduces:
--   scheduling_preferences   — per-account user-configured scheduling rules
--   schedule_recommendations — AI-generated time recommendations (separate from actual schedule)
--   schedule_versions        — immutable audit trail of every schedule change
--   publish_jobs             — durable record of every BullMQ publishing attempt
-- Also extends: social_accounts (timezone), posts (scheduling metadata)

-- ─── 1. Timezone on Social Accounts ──────────────────────────────────────────
-- IANA timezone string. Defaults to UTC; users are prompted to configure.
ALTER TABLE social_accounts
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

-- ─── 2. Scheduling Preferences ───────────────────────────────────────────────
-- One row per social_account. Stores user-configured scheduling constraints.
CREATE TABLE IF NOT EXISTS scheduling_preferences (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id          UUID NOT NULL UNIQUE REFERENCES social_accounts(id) ON DELETE CASCADE,

  -- IANA timezone (mirrors social_accounts.timezone; kept here so prefs are self-contained)
  timezone            TEXT NOT NULL DEFAULT 'UTC',

  -- Posting frequency: { "type": "per_week"|"per_day", "value": 5 }
  posting_frequency   JSONB NOT NULL DEFAULT '{"type":"per_week","value":5}',

  -- Preferred publishing windows: [{ "label": "morning", "start": "08:00", "end": "10:00" }, ...]
  preferred_windows   JSONB NOT NULL DEFAULT '[
    {"label":"morning","start":"08:00","end":"10:00"},
    {"label":"afternoon","start":"12:00","end":"14:00"},
    {"label":"evening","start":"18:00","end":"21:00"}
  ]',

  -- Minimum gap between posts in hours
  min_gap_hours       INTEGER NOT NULL DEFAULT 4,

  -- Hard cap on posts per calendar day
  max_posts_per_day   INTEGER NOT NULL DEFAULT 2,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduling_prefs_account ON scheduling_preferences(account_id);

DROP TRIGGER IF EXISTS set_scheduling_prefs_updated_at ON scheduling_preferences;
CREATE TRIGGER set_scheduling_prefs_updated_at
  BEFORE UPDATE ON scheduling_preferences
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── 3. Schedule Recommendations ─────────────────────────────────────────────
-- Stores AI-generated publishing time recommendations.
-- Separate from the actual schedule — the user must accept a recommendation
-- before a real schedule is created.
CREATE TABLE IF NOT EXISTS schedule_recommendations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_idea_id     UUID NOT NULL REFERENCES content_ideas(id) ON DELETE CASCADE,
  account_id          UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,

  -- The primary recommended time (stored in UTC)
  recommended_at      TIMESTAMPTZ NOT NULL,

  -- IANA timezone used for display
  timezone            TEXT NOT NULL DEFAULT 'UTC',

  -- Human-readable explanation (safe summary — no internal chain-of-thought exposed)
  reasoning_summary   TEXT,

  -- Raw signals used: engagement windows, strategy cadence, conflict data, etc.
  -- Structure: [{ "type": "engagement_window", "label": "...", "evidence": "..." }, ...]
  supporting_signals  JSONB NOT NULL DEFAULT '[]',

  -- All candidate windows generated before selecting the recommendation
  -- Structure: [{ "scheduledAt": "...", "timezone": "...", "score": 0.8, "label": "..." }, ...]
  candidate_windows   JSONB NOT NULL DEFAULT '[]',

  -- Lifecycle: SUGGESTED → ACCEPTED | REJECTED | EXPIRED | SUPERSEDED
  status              TEXT NOT NULL DEFAULT 'SUGGESTED'
                        CHECK (status IN ('SUGGESTED','ACCEPTED','REJECTED','EXPIRED','SUPERSEDED')),

  -- When this recommendation becomes stale (e.g. the slot was taken)
  expires_at          TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sched_rec_content ON schedule_recommendations(content_idea_id);
CREATE INDEX IF NOT EXISTS idx_sched_rec_account  ON schedule_recommendations(account_id);
CREATE INDEX IF NOT EXISTS idx_sched_rec_status   ON schedule_recommendations(status);

DROP TRIGGER IF EXISTS set_sched_rec_updated_at ON schedule_recommendations;
CREATE TRIGGER set_sched_rec_updated_at
  BEFORE UPDATE ON schedule_recommendations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── 4. Schedule Versions ─────────────────────────────────────────────────────
-- Immutable audit trail. Every change to a post's scheduled time creates a row.
-- Never deleted; preserves full rescheduling/cancellation history.
CREATE TABLE IF NOT EXISTS schedule_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

  -- Monotonically increasing per post
  version         INTEGER NOT NULL DEFAULT 1,

  -- The scheduled time for this version (UTC)
  scheduled_at    TIMESTAMPTZ NOT NULL,

  -- IANA timezone used when user/agent created this version
  timezone        TEXT NOT NULL DEFAULT 'UTC',

  -- Who/what created this version: AGENT | USER | SYSTEM
  source          TEXT NOT NULL DEFAULT 'AGENT'
                    CHECK (source IN ('AGENT','USER','SYSTEM')),

  -- Free-text reason for the change
  reason          TEXT,

  -- Identity of the actor (e.g. user email, 'agent', 'scheduler')
  actor           TEXT,

  -- Status at the time this version was created
  -- (reflects posts.schedule_status at time of creation)
  schedule_status TEXT NOT NULL DEFAULT 'SCHEDULED',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sched_ver_post    ON schedule_versions(post_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_sched_ver_created ON schedule_versions(created_at DESC);

-- ─── 5. Publish Jobs ──────────────────────────────────────────────────────────
-- One row per scheduling decision. Tracks every BullMQ publishing attempt.
-- Separate from posts so publish state does not pollute content/schedule state.
CREATE TABLE IF NOT EXISTS publish_jobs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id             UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content_idea_id     UUID REFERENCES content_ideas(id) ON DELETE SET NULL,
  account_id          UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,

  -- Current lifecycle state
  -- PENDING → PROCESSING → SUCCEEDED | FAILED | CANCELLED | ACTION_REQUIRED
  status              TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN (
                          'PENDING','PROCESSING','SUCCEEDED',
                          'FAILED','RETRYING','CANCELLED','ACTION_REQUIRED'
                        )),

  -- Error classification (for retry decision logic)
  -- TRANSIENT | RATE_LIMITED | TIMEOUT | AUTH_ERROR | PERMISSION_ERROR
  -- | INVALID_MEDIA | INVALID_CONTENT | PLATFORM_REJECTION | DUPLICATE | PERMANENT
  error_code          TEXT,
  last_error_message  TEXT,

  -- BullMQ job ID for cross-referencing
  bullmq_job_id       TEXT,

  -- Total publishing attempts made
  attempts            INTEGER NOT NULL DEFAULT 0,

  -- Idempotency key prevents duplicate effective publishes
  -- Format: publish:{accountId}:{postId}
  idempotency_key     TEXT UNIQUE,

  -- Platform result (set on SUCCEEDED)
  platform_post_id    TEXT,
  platform_response   JSONB,       -- trimmed response metadata (no secrets)

  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  next_retry_at       TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publish_jobs_post       ON publish_jobs(post_id);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_account    ON publish_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_status     ON publish_jobs(status);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_idempotent ON publish_jobs(idempotency_key);

DROP TRIGGER IF EXISTS set_publish_jobs_updated_at ON publish_jobs;
CREATE TRIGGER set_publish_jobs_updated_at
  BEFORE UPDATE ON publish_jobs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── 6. Extend Posts Table ────────────────────────────────────────────────────
-- Link posts back to the recommendation that initiated them.
-- Add publishing diagnostic columns.
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS recommendation_id      UUID REFERENCES schedule_recommendations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS schedule_timezone      TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS publish_attempts       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_publish_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publish_error_code     TEXT,
  ADD COLUMN IF NOT EXISTS publish_failure_reason TEXT;

-- Performance indexes for schedule queries
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at     ON posts(scheduled_at)     WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_schedule_status  ON posts(schedule_status);
CREATE INDEX IF NOT EXISTS idx_posts_account_status   ON posts(social_account_id, status);

-- ─── 7. Backfill schedule_status on existing posts ───────────────────────────
-- Ensure old rows that have scheduled_at set carry the correct schedule_status.
UPDATE posts
SET schedule_status = 'SCHEDULED'
WHERE scheduled_at IS NOT NULL
  AND schedule_status NOT IN ('CANCELLED','MISSED','SUGGESTED');
