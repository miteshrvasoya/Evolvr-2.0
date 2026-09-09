-- Migration: 002_social_accounts.sql
-- Description: Create social_accounts table, constraints, and indexes.

CREATE TABLE IF NOT EXISTS social_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'twitter', 'linkedin', 'tiktok', 'youtube')),
    platform_account_id TEXT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    profile_image_url TEXT,
    access_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    connection_status TEXT NOT NULL DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'expired', 'error')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_social_accounts_platform_account UNIQUE (platform, platform_account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);

DROP TRIGGER IF EXISTS set_social_accounts_updated_at ON social_accounts;
CREATE TRIGGER set_social_accounts_updated_at
    BEFORE UPDATE ON social_accounts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();
