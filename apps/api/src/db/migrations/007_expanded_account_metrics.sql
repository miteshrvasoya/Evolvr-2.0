-- 007_expanded_account_metrics.sql
-- Adds comprehensive Instagram insight columns to account_metrics.
-- Non-breaking: all columns default to 0, existing rows are unaffected.

ALTER TABLE account_metrics
  ADD COLUMN IF NOT EXISTS views              INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes             INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves             INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replies           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reposts           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accounts_engaged  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_interactions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_links_taps INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS follows           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unfollows         INTEGER NOT NULL DEFAULT 0;
