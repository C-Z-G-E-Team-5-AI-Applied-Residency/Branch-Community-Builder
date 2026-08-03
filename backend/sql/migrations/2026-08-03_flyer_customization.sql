-- Structured flyer customization: a host can pick a template plus a
-- background style, text color, and font, rendered live on the frontend
-- rather than baked into a static image. All nullable and independent of
-- flyer_url/flyer_data/flyer_mime (uploaded images stay exactly as-is;
-- these four only apply to the built-in template path).
-- Run once against an EXISTING database; fresh databases get all of this
-- from schema.sql.

ALTER TABLE events ADD COLUMN IF NOT EXISTS flyer_template_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS flyer_background_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS flyer_text_color TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS flyer_font_id TEXT;
