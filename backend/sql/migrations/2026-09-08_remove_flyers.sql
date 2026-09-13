-- Remove the event flyer feature. Drops the flyer columns added by
-- 2026-07-20_event_flyers.sql; the upload/template endpoints and UI are gone too.
-- Run once against an EXISTING database; fresh databases get this from schema.sql.

ALTER TABLE events DROP COLUMN IF EXISTS flyer_url;
ALTER TABLE events DROP COLUMN IF EXISTS flyer_data;
ALTER TABLE events DROP COLUMN IF EXISTS flyer_mime;
