-- 013_telegram_notifications.sql
-- Extends the existing notifications infrastructure with:
--   1. Telegram delivery tracking columns on notifications table
--   2. A notification_preferences table for per-user channel settings

-- 1. Telegram delivery tracking on existing notifications table
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS telegram_message_id  TEXT,
  ADD COLUMN IF NOT EXISTS telegram_status      TEXT
                              CHECK (telegram_status IN ('sent','failed','skipped','duplicate')),
  ADD COLUMN IF NOT EXISTS telegram_sent_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS telegram_error       TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key      TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_notifications_idempotency ON notifications(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_telegram_status ON notifications(telegram_status)
  WHERE telegram_status IS NOT NULL;

-- 2. Per-user notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id                  UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  telegram_enabled         BOOLEAN NOT NULL DEFAULT true,
  telegram_event_overrides JSONB NOT NULL DEFAULT '{}',
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_notification_prefs_updated_at ON notification_preferences;
CREATE TRIGGER set_notification_prefs_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
