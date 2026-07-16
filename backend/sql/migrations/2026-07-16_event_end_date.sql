-- Close RSVPs once the event ends (BR-40): events had no end-time marker,
-- only event_date (the start). Nullable for now since existing rows have no
-- end date; the app falls back to event_date for those until backfilled.
-- Run once against an EXISTING database; fresh databases get this from schema.sql.

ALTER TABLE events ADD COLUMN IF NOT EXISTS event_end_date TIMESTAMPTZ;
