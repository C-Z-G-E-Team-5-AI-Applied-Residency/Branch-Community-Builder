-- Event announcements: host posts a short message to everyone viewing the
-- event. Added after several existing databases (including production) were
-- already created, so the table itself never got created there.
-- Run once against an EXISTING database; fresh databases get this from schema.sql.

CREATE TABLE IF NOT EXISTS announcements (
    announcement_id SERIAL PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    host_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    message         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
