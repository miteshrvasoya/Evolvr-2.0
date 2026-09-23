-- ─── 014_carousel_order.sql ───────────────────────────────────────────────
-- Add order_index to content_assets for sorting carousel slides

ALTER TABLE content_assets
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
