-- 011_r2_storage.sql

ALTER TABLE content_assets
ADD COLUMN IF NOT EXISTS object_key TEXT,
ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'local';

-- Populate object_key from storage_url if not already set (for existing local/S3 URLs)
UPDATE content_assets 
SET object_key = storage_url 
WHERE object_key IS NULL AND storage_url IS NOT NULL;
