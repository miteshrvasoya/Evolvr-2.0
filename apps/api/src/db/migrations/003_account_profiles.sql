-- Migration: 003_account_profiles.sql
-- Description: Create account_profiles table, constraints, and indexes.

CREATE TABLE IF NOT EXISTS account_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    social_account_id UUID NOT NULL UNIQUE REFERENCES social_accounts(id) ON DELETE CASCADE,
    niche TEXT NOT NULL DEFAULT '',
    value_proposition TEXT NOT NULL DEFAULT '',
    audience_definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    brand_voice JSONB NOT NULL DEFAULT '{}'::jsonb,
    visual_guidelines JSONB NOT NULL DEFAULT '{}'::jsonb,
    publishing_constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
    business_goals JSONB NOT NULL DEFAULT '[]'::jsonb,
    conversion_goals JSONB NOT NULL DEFAULT '[]'::jsonb,
    allowed_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
    banned_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
    competitor_accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
    preferred_cta_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
    approval_policy JSONB NOT NULL DEFAULT '{"mode": "supervised", "requireApprovalForMediumRisk": true, "requireApprovalForHighRisk": true}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_profiles_social_account_id ON account_profiles(social_account_id);

DROP TRIGGER IF EXISTS set_account_profiles_updated_at ON account_profiles;
CREATE TRIGGER set_account_profiles_updated_at
    BEFORE UPDATE ON account_profiles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();
