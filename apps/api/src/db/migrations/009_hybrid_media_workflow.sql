-- 009_hybrid_media_workflow.sql

-- 1. Create Media Requirements table
CREATE TABLE IF NOT EXISTS media_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_idea_id UUID NOT NULL REFERENCES content_ideas(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL, -- 'IMAGE', 'VIDEO', 'CAROUSEL'
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'GENERATING', 'READY', 'FAILED', 'MANUAL_REQUIRED'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_reqs_content_id ON media_requirements(content_idea_id);

-- 2. Alter Content Assets
ALTER TABLE content_assets
ADD COLUMN IF NOT EXISTS media_requirement_id UUID REFERENCES media_requirements(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS asset_status TEXT NOT NULL DEFAULT 'AVAILABLE', -- 'ACTIVE', 'AVAILABLE', 'REPLACED', 'FAILED'
ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Allow storage_url to be null for pending AI generations where the asset record is created before storage is available
ALTER TABLE content_assets ALTER COLUMN storage_url DROP NOT NULL;

-- 3. Alter Content Asset Prompts
ALTER TABLE content_asset_prompts
ADD COLUMN IF NOT EXISTS media_requirement_id UUID REFERENCES media_requirements(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'AVAILABLE'; -- 'AVAILABLE', 'EXHAUSTED'

-- 4. Alter Posts (Scheduler)
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS schedule_status TEXT NOT NULL DEFAULT 'SCHEDULED'; -- 'SUGGESTED', 'SCHEDULED', 'MISSED', 'CANCELLED'

-- 5. Data Migration (Best effort to link existing assets to requirements)
-- This creates a single media requirement per content_idea_id that already has assets
DO $$ 
DECLARE
    r RECORD;
    req_id UUID;
BEGIN
    FOR r IN (
        SELECT DISTINCT content_idea_id, asset_type 
        FROM content_assets
    ) LOOP
        req_id := gen_random_uuid();
        
        INSERT INTO media_requirements (id, content_idea_id, media_type, status)
        VALUES (req_id, r.content_idea_id, r.asset_type, 'READY');
        
        UPDATE content_assets 
        SET media_requirement_id = req_id, asset_status = 'ACTIVE'
        WHERE content_idea_id = r.content_idea_id AND asset_type = r.asset_type;
        
        UPDATE content_asset_prompts
        SET media_requirement_id = req_id
        WHERE content_idea_id = r.content_idea_id AND asset_type = r.asset_type;
    END LOOP;
END $$;
