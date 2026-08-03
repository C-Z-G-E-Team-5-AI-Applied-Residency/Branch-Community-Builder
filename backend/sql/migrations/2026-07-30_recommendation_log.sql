-- Append-only log of which events were ever recommended to which users.
-- The `recommendations` table is a cache (delete-then-insert on every refresh), so
-- it can't measure success over time. This log records the first time each event
-- was recommended to each user (UNIQUE + ON CONFLICT DO NOTHING on write), giving a
-- stable denominator for the recommendation -> RSVP -> check-in conversion metric.
-- Run once against an EXISTING database; fresh databases get this from schema.sql.

CREATE TABLE IF NOT EXISTS recommendation_log (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    event_id     INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    recommended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, event_id)  -- one row per (user, event) ever recommended
);
