-- BRANCH database schema (PostgreSQL + PostGIS)
-- Run once against a fresh database.

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
CREATE TABLE users (
    user_id       SERIAL PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    username      TEXT UNIQUE NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
CREATE TABLE profiles (
    profile_id      SERIAL PRIMARY KEY,
    display_name    TEXT NOT NULL,
    profile_picture TEXT DEFAULT '/images/default_avatar.svg',
    picture_data    BYTEA,           -- uploaded avatar bytes (served at /api/profiles/{id}/picture)
    picture_mime    TEXT,
    bio             TEXT NOT NULL,
    user_id         INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    home_zip_code   TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
CREATE TABLE events (
    event_id        SERIAL PRIMARY KEY,
    title           TEXT NOT NULL,
    event_date      TIMESTAMPTZ NOT NULL,
    event_end_date  TIMESTAMPTZ,
    location        TEXT NOT NULL,
    event_zip_code  INTEGER NOT NULL,
    event_description TEXT NOT NULL,
    event_capacity  INTEGER NOT NULL CHECK (event_capacity > 0),
    status          TEXT NOT NULL DEFAULT 'open',
    host_id         INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    event_image_url TEXT NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    latitude        DOUBLE PRECISION NOT NULL,
    geo             GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS
                        (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED,
    check_in_code   TEXT
);
CREATE INDEX events_geo_idx ON events USING GIST (geo);

-- ---------------------------------------------------------------------------
CREATE TABLE rsvps (
    rsvp_id       SERIAL PRIMARY KEY,
    user_id       INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    event_id      INTEGER REFERENCES events(event_id) ON DELETE CASCADE,
    did_attend    BOOLEAN DEFAULT FALSE,
    status        TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going','cancelled')),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    checked_in_at TIMESTAMPTZ,
    UNIQUE (user_id, event_id)  -- prevents duplicate RSVPs to the same event
);

-- ---------------------------------------------------------------------------
CREATE TABLE neighborhoods (
    neighborhood_id SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    city            TEXT NOT NULL,
    boundary        GEOGRAPHY(MULTIPOLYGON, 4326) NOT NULL
);
CREATE INDEX neighborhoods_boundary_idx ON neighborhoods USING GIST (boundary);

-- ---------------------------------------------------------------------------
CREATE TABLE community_standing (
    standing_id     SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    neighborhood_id INTEGER NOT NULL REFERENCES neighborhoods(neighborhood_id) ON DELETE CASCADE,
    events_hosted   INTEGER NOT NULL DEFAULT 0,
    events_attended INTEGER NOT NULL DEFAULT 0,
    is_leader       BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, neighborhood_id)  -- one standing row per user per neighborhood
);

-- ---------------------------------------------------------------------------
CREATE TABLE tags (
    tag_id SERIAL PRIMARY KEY,
    name   TEXT UNIQUE NOT NULL
);

INSERT INTO tags (name) VALUES
    ('basketball'),
    ('volunteering'),
    ('photography'),
    ('coding'),
    ('music'),
    ('outdoors')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE user_interests (
    tag_id  INTEGER NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, tag_id)
);

CREATE TABLE event_tags (
    event_id INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, tag_id)
);

-- ---------------------------------------------------------------------------
CREATE TABLE recommendations (
    recommendation_id SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    event_id          INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    reason            TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, event_id)  -- one cached recommendation per user/event
);

-----------------------------------------------------------------------------
CREATE TABLE announcements (
    announcement_id SERIAL PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    host_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    message         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
