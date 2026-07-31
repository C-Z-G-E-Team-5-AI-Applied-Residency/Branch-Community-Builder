-- Intent-based matchmaking, part 1 (schema only).
--   * profiles.intent    — user's free-text "what I want to do offline"
--   * events.why         — host's stated purpose of the event
--   * events.review_*     — mission guardrail: held-for-review status + AI summary/reason
--   * tags.status / usage_count / created_by_event_id — emergent (LLM-suggested) vocabulary
-- Existing rows default to 'approved' so nothing already live is disturbed.
-- Run once against an EXISTING database; fresh databases get this from schema.sql.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS intent TEXT;

ALTER TABLE events ADD COLUMN IF NOT EXISTS why TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS review_status  TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE events ADD COLUMN IF NOT EXISTS review_summary TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS review_reason  TEXT;

ALTER TABLE tags ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE tags ADD COLUMN IF NOT EXISTS created_by_event_id INTEGER
                     REFERENCES events(event_id) ON DELETE SET NULL;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0;
