-- Event flyers: flyer bytes stored in the DB (Render's disk is ephemeral),
-- with flyer_url pointing at either a prebuilt template asset or the
-- flyer endpoint once bytes are uploaded. All nullable: unlike profile
-- pictures there's no single default flyer.
-- Run once against an EXISTING database; fresh databases get all of this
-- from schema.sql.

ALTER TABLE events ADD COLUMN IF NOT EXISTS flyer_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS flyer_data BYTEA;
ALTER TABLE events ADD COLUMN IF NOT EXISTS flyer_mime TEXT;
