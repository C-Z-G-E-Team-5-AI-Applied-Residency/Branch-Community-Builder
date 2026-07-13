-- Profile picture upload: avatar bytes stored in the DB (Render's disk is
-- ephemeral), plus a real default avatar path (the old .png never existed).
-- Run once against an EXISTING database; fresh databases get all of this
-- from schema.sql.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS picture_data BYTEA;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS picture_mime TEXT;

ALTER TABLE profiles ALTER COLUMN profile_picture SET DEFAULT '/images/default_avatar.svg';
UPDATE profiles
SET profile_picture = '/images/default_avatar.svg'
WHERE profile_picture = '/images/default_avatar.png';
