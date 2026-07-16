# BRANCH

> Moving your community from online to outside. Real connections for a digital generation.

A community-building app that helps people discover local events, RSVP, and verify
they actually showed up. Success is measured by doors walked through, not screen time.

## 🚀 Deployment

**Live app:** [https://branch-ql0d.onrender.com](https://branch-ql0d.onrender.com)

## Stack
- **Frontend:** React (Vite), react-router-dom, react-leaflet, qrcode.react, html5-qrcode
- **Backend:** Python + FastAPI, SQLAlchemy + psycopg, GeoAlchemy2
- **Database:** PostgreSQL + PostGIS
- **AI:** Google Gemini (Event Matchmaker)
- **Geocoding:** Nominatim (OpenStreetMap)

## Repo layout
```
branch/
├── backend/    FastAPI app, schema, data-loading scripts
└── frontend/   React (Vite) client
```

## Getting started

### 1. Database
```bash
docker compose up -d          # postgres + postgis on :5432
psql "$DATABASE_URL" -f backend/sql/schema.sql

# One-time: load the neighborhood polygons (powers community standing / leaderboards)
docker exec -i branch-community-builder-db-1 pg_restore -U branch -d branch \
  < backend/sql/neighborhoods_seed.dump
```

### 2. Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in DATABASE_URL, GEMINI_API_KEY, SESSION_SECRET
uvicorn app.main:app --reload # http://localhost:8000  (docs at /docs)
```

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:8000
npm run dev                   # http://localhost:5173
```

## Team
Gabriel Cervantes · Christopher Hackett · Zane Correa · Emily Vu

---

# Product Specification

## Part I — Project Proposal

### Project Description

We live in an age where anyone can have thousands of followers and still feel like they have no
one to call.

Young adults today are more connected than ever online and yet lonelier than ever in person.
**BRANCH** is a community-building application designed to bridge that gap, giving users a way
to discover local events, connect with people who share their interests, and show up for their
communities in a real, meaningful way. At its core, **BRANCH** believes that the best
relationships are built face-to-face, and that technology should be a bridge to those moments
and not a replacement for them. Users can explore an interactive map of nearby events and
free community resources, RSVP and check in to prove they actually showed up, and build a
profile that reflects who they are beyond a screen. The impact of BRANCH will be measured not
in likes or followers, but in the number of events created, doors walked through, and
communities strengthened — one real-world connection at a time.

### User Personas/Audience

Our intended audience is young adults, similar to us. We want to prioritize making this
application towards people who have more-than-average screentime, and are looking to reduce
it. Additionally, we are looking for an audience of people who may be social online through
social media or messaging platforms, but lack the same community offline. This audience may
have tried to connect with users through their existing applications, but plans never come into
fruition.

### User Stories

**MVP (Without these features, the application will not be useful)**

1. As a User, I can create and manage events I created so others in my community can discover and attend them.
2. As a User, I can interact with the event map so I can discover and learn about nearby events.
3. As a User, I can RSVP to an event so others know I plan to attend.
4. As a User, I can verify that I "showed up" to an event so that my attendance is recorded.
5. As a User, I can receive personalized event recommendations based on my profile information and attendance history.

**Stretch Features (When time is running short, these features will get cut)**

1. As a User, I can respond to a weekly community prompt which can lead to a chat/thread with other community members.
2. As a User, I can hard verify event attendance as a user posting an event.
3. As a User, I can give announcements/notifications regarding my events to everyone rsvp'd.

## Part II — Technical Specifications

### Schema Design

**users table**

| Field | Constraints |
| --- | --- |
| user_id | SERIAL PRIMARY KEY |
| email | TEXT UNIQUE NOT NULL |
| password_hash | TEXT NOT NULL |
| username | TEXT UNIQUE NOT NULL |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

**profiles table**

| Field | Constraints |
| --- | --- |
| profile_id | SERIAL PRIMARY KEY |
| display_name | TEXT NOT NULL |
| profile_picture | TEXT DEFAULT /images/default_avatar.svg |
| picture_data | BYTEA — uploaded avatar bytes (nullable; unset when using the default avatar) |
| picture_mime | TEXT — MIME type of `picture_data` (nullable) |
| bio | TEXT NOT NULL |
| user_id | INTEGER REFERENCES users(user_id) ON DELETE CASCADE |
| home_zip_code | TEXT NOT NULL |

**events table**

| Field | Constraints |
| --- | --- |
| event_id | SERIAL PRIMARY KEY |
| title | TEXT NOT NULL |
| event_date | TIMESTAMPTZ NOT NULL |
| event_end_date | TIMESTAMPTZ — nullable for events created before this column existed; required going forward (enforced by `EventCreate`, not a DB constraint) |
| location | TEXT NOT NULL |
| event_zip_code | INT NOT NULL |
| event_description | TEXT NOT NULL |
| event_capacity | INTEGER NOT NULL CHECK (event_capacity > 0) |
| status | TEXT NOT NULL DEFAULT 'open' |
| host_id | INTEGER REFERENCES users(user_id) ON DELETE CASCADE |
| created_at | TIMESTAMPTZ DEFAULT NOW() |
| event_image_url | TEXT NOT NULL |
| geo | GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED |
| longitude | DOUBLE PRECISION NOT NULL |
| latitude | DOUBLE PRECISION NOT NULL |
| check_in_code | TEXT |

**rsvps table**

| Field | Constraints |
| --- | --- |
| rsvp_id | SERIAL PRIMARY KEY |
| user_id | INTEGER REFERENCES users(user_id) ON DELETE CASCADE |
| event_id | INTEGER REFERENCES events(event_id) ON DELETE CASCADE |
| did_attend | BOOLEAN DEFAULT FALSE |
| status | TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going','cancelled')) |
| created_at | TIMESTAMPTZ DEFAULT NOW() |
| checked_in_at | TIMESTAMPTZ |
| UNIQUE(user_id, event_id) | Prevents duplicate RSVPs to the same event |

**neighborhoods table**

| Field | Constraints |
| --- | --- |
| neighborhood_id | SERIAL PRIMARY KEY |
| name | TEXT NOT NULL |
| city | TEXT NOT NULL |
| boundary | GEOGRAPHY(MULTIPOLYGON, 4326) NOT NULL |

**community_standing table**

| Field | Constraints |
| --- | --- |
| standing_id | SERIAL PRIMARY KEY |
| user_id | INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE |
| neighborhood_id | INTEGER NOT NULL REFERENCES neighborhoods(neighborhood_id) ON DELETE CASCADE |
| events_hosted | INTEGER NOT NULL DEFAULT 0 |
| events_attended | INTEGER NOT NULL DEFAULT 0 |
| is_leader | BOOLEAN NOT NULL DEFAULT FALSE |
| updated_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() |
| UNIQUE (user_id, neighborhood_id) | One standing row per user per neighborhood |

**tags table**

| Field | Constraints |
| --- | --- |
| tag_id | SERIAL PRIMARY KEY |
| name | TEXT UNIQUE NOT NULL |

**user_interests table**

| Field | Constraints |
| --- | --- |
| tag_id | INTEGER NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE |
| user_id | INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE |
| PRIMARY KEY (user_id, tag_id) | Composite key |

**event_tags table**

| Field | Constraints |
| --- | --- |
| event_id | INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE |
| tag_id | INTEGER NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE |
| PRIMARY KEY (event_id, tag_id) | Composite key |

**recommendations table**

| Field | Constraints |
| --- | --- |
| recommendation_id | SERIAL PRIMARY KEY |
| user_id | INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE |
| event_id | INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE |
| reason | TEXT NOT NULL |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() |
| UNIQUE (user_id, event_id) | One cached recommendation per user/event |

### API Contract

#### Auth

**POST /api/auth/signup**

Creates a new user account and starts a session immediately.

- **Request Body:** `{ email, password, username }`
  - `email`, `password`, and `username` are required.
- **Response:**
  - Success: `{ user_id, email, username, created_at, has_profile }` 201
  - Error, Validation: `{ message }` 400
  - Error, Conflict (email or username taken): `{ message }` 409

**POST /api/auth/login**

Authenticates a user and starts a session.

- **Request Body:** `{ email, password }`
- **Response:**
  - Success: `{ user_id, email, username, has_profile }` 200
  - Error, Invalid Credentials: `{ message }` 401

**POST /api/auth/logout**

Ends the current user session.

- **Request Body:** None
- **Response:**
  - Success: `{ message }` 200

#### Users

**GET /api/users/:user_id**

Returns a single user's public info.

- **Request Body:** None
- **Response:**
  - Success: `{ user_id, username, created_at }` 200
  - Error, Not Found: `{ message }` 404

#### Profiles

**GET /api/profiles/:user_id**

Returns the profile associated with a given user, including their interest tags.

- **Request Body:** None
- **Response:**
  - Success: `{ profile_id, display_name, profile_picture, bio, home_zip_code, user_id, interests: [{ tag_id, name }, ...] }` 200
  - Error, Not Found: `{ message }` 404

**POST /api/profiles**

Creates a profile for the authenticated user.

- **Request Body:** `{ display_name, bio, home_zip_code, profile_picture="/images/default_avatar.png" }`
  - `display_name`, `bio`, and `home_zip_code` are required. `profile_picture` defaults if not provided.
- **Response:**
  - Success: `{ profile_id, display_name, profile_picture, bio, home_zip_code, user_id, interests: [{ tag_id, name }, ...] }` 201
  - Error, Not Authenticated: `{ message }` 401
  - Error, Conflict (profile already exists): `{ message }` 409

**PATCH /api/profiles/:user_id**

Updates an existing profile. Only the owner may update it.

- **Request Body:** `{ display_name, bio, profile_picture, home_zip_code }` (all optional — only included fields are updated)
- **Response:**
  - Success: `{ profile_id, display_name, profile_picture, bio, home_zip_code, user_id, interests: [{ tag_id, name }, ...] }` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found: `{ message }` 404

#### Events

**GET /api/events**

Returns events, with optional filtering by zip code, proximity, date, status, or tag.

- **Request Body:** None
- **Optional Query Strings:**
  - `?zip_code=` filter by `event_zip_code`
  - `?lat=&lng=&radius=` filter by distance using the `geo` column (radius in miles, default 10)
  - `?status=` filter by event `status`
  - `?after=` filter for events on/after a given ISO date
  - `?tag_id=` filter to events tagged with a given tag
- **Response:**
  - Success: `[{ event_id, title, event_date, event_end_date, location, event_zip_code, event_description, event_capacity, status, host_id, event_image_url, latitude, longitude, tags: [{ tag_id, name }, ...] }, ...]` 200

**GET /api/events/:event_id**

Returns a single event's details. When the requester is the event's host, the response also includes `check_in_code`.

- **Request Body:** None
- **Response:**
  - Success: `{ event_id, title, event_date, event_end_date, location, event_zip_code, event_description, event_capacity, status, host_id, event_image_url, latitude, longitude, tags: [{ tag_id, name }, ...] }` 200
  - Error, Not Found: `{ message }` 404

**POST /api/events**

Creates a new event hosted by the authenticated user. The server generates a random `check_in_code` for the event and returns it to the host.

- **Request Body:** `{ title, event_date, event_end_date, location, event_zip_code, event_description, event_capacity, event_image_url, latitude, longitude, status="open", tag_ids=[] }`
  - `title`, `event_date`, `event_end_date`, `location`, `event_zip_code`, `event_description`, `event_capacity`, `event_image_url`, `latitude`, and `longitude` are required. `event_capacity` must be greater than 0. `status` is optional, defaulting to `"open"`. `tag_ids` is optional, defaulting to an empty list.
- **Response:**
  - Success: `{ event_id, title, event_date, event_end_date, location, event_zip_code, event_description, event_capacity, status, host_id, event_image_url, latitude, longitude, check_in_code, tags: [{ tag_id, name }, ...] }` 201
  - Error, Not Authenticated: `{ message }` 401
  - Error, Validation: `{ message }` 400

**PATCH /api/events/:event_id**

Updates an event. Only the host may update it.

- **Request Body:** `{ title, event_date, event_end_date, location, event_zip_code, event_description, event_capacity, status, event_image_url, latitude, longitude }` (all optional — only included fields are updated)
- **Response:**
  - Success: `{ event_id, title, event_date, event_end_date, location, event_zip_code, event_description, event_capacity, status, host_id, event_image_url, latitude, longitude, tags: [{ tag_id, name }, ...] }` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found: `{ message }` 404

**DELETE /api/events/:event_id**

Deletes an event. Only the host may delete it. Cascades to associated RSVPs, event_tags, and recommendations.

- **Request Body:** None
- **Response:**
  - Success: `{ message }` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found: `{ message }` 404

#### Event Tags

**GET /api/events/:event_id/tags**

Returns the tags attached to a given event.

- **Request Body:** None
- **Response:**
  - Success: `[{ tag_id, name }, ...]` 200

**POST /api/events/:event_id/tags**

Attaches a tag to an event. Only the host may add tags.

- **Request Body:** `{ tag_id }`
  - `tag_id` is required.
- **Response:**
  - Success: `{ event_id, tag_id }` 201
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Conflict (tag already attached): `{ message }` 409

**DELETE /api/events/:event_id/tags/:tag_id**

Removes a tag from an event. Only the host may remove tags.

- **Request Body:** None
- **Response:**
  - Success: `{ message }` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found: `{ message }` 404

#### RSVPs

**GET /api/events/:event_id/rsvps**

Returns all RSVPs for a given event. Intended for the host to view attendees.

- **Request Body:** None
- **Optional Query Strings:**
  - `?status=going` or `?status=cancelled` filter by RSVP status
  - `?did_attend=true` or `?did_attend=false` filter by attendance status
- **Response:**
  - Success: `[{ rsvp_id, user_id, event_id, status, did_attend, created_at, checked_in_at, username }, ...]` 200
  - Error, Not Found: `{ message }` 404

**GET /api/users/:user_id/rsvps**

Returns all RSVPs (and therefore events) a given user has made, ordered by event date. Each RSVP embeds a summary of its event.

- **Request Body:** None
- **Response:**
  - Success: `[{ rsvp_id, user_id, event_id, status, did_attend, created_at, checked_in_at, event: { event_id, title, event_date, location, status, event_image_url } }, ...]` 200

**POST /api/events/:event_id/check-in**

Marks the authenticated attendee as having attended, by presenting the host's QR code value.

- **Request Body:** `{ code }`
  - `code` is required — the string decoded from the host's QR.
- **Response:**
  - Success: `{ rsvp_id, user_id, event_id, status, did_attend, created_at, checked_in_at }` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Invalid Code: `{ message }` 400
  - Error, Check-In Not Open Yet (check-in opens `CHECK_IN_OPENS_BEFORE_HOURS` (1h) before `event_date`, with no upper bound): `{ message }` 400
  - Error, Not Found (event doesn't exist, or no RSVP for this event): `{ message }` 404
  - Error, Already Checked In: `{ message }` 409

**POST /api/events/:event_id/rsvps**

Creates an RSVP for the authenticated user to the given event. The RSVP is always created with status `"going"`; use `PATCH /api/rsvps/:rsvp_id` to cancel.

- **Request Body:** None
- **Response:**
  - Success: `{ rsvp_id, user_id, event_id, status, did_attend, created_at, checked_in_at }` 201
  - Error, Not Authenticated: `{ message }` 401
  - Error, Event Ended (`now` is past `event_end_date`, falling back to `event_date` for events with no end date set): `{ message }` 400
  - Error, Conflict (user already RSVP'd — unique on user_id, event_id): `{ message }` 409
  - Error, Not Found (event doesn't exist): `{ message }` 404

**PATCH /api/rsvps/:rsvp_id**

Updates an RSVP. Used by the RSVP owner to cancel/re-confirm (`status`), or by the event host to verify attendance (`did_attend`). Setting `did_attend` to true stamps `checked_in_at` and counts toward the attendee's community standing, same as a QR check-in.

- **Request Body:** `{ status, did_attend }` (both optional — only included fields are updated)
- **Response:**
  - Success: `{ rsvp_id, user_id, event_id, status, did_attend, created_at, checked_in_at }` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized (not the host or the RSVP owner, or attempting a field you don't have permission to change): `{ message }` 403
  - Error, Not Found: `{ message }` 404

**DELETE /api/rsvps/:rsvp_id**

Permanently removes an RSVP record. Only the RSVP owner may delete it.

- **Request Body:** None
- **Response:**
  - Success: `{ message }` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found: `{ message }` 404

#### Neighborhoods

**GET /api/neighborhoods**

Returns all neighborhoods, optionally filtered by point-in-boundary lookup.

- **Request Body:** None
- **Optional Query Strings:**
  - `?lat=&lng=` returns the neighborhood whose `boundary` contains the given point
  - `?city=` filter by city
- **Response:**
  - Success: `[{ neighborhood_id, name, city }, ...]` 200

**GET /api/neighborhoods/:neighborhood_id**

Returns a single neighborhood's details.

- **Request Body:** None
- **Response:**
  - Success: `{ neighborhood_id, name, city }` 200
  - Error, Not Found: `{ message }` 404

#### Community Standing

**GET /api/neighborhoods/:neighborhood_id/standings**

Returns the community standing leaderboard for a given neighborhood, ordered by `events_hosted` and `events_attended`.

- **Request Body:** None
- **Optional Query Strings:**
  - `?is_leader=true` filter to leaders only
- **Response:**
  - Success: `[{ standing_id, user_id, username, neighborhood_id, events_hosted, events_attended, is_leader, updated_at }, ...]` 200
  - Error, Not Found: `{ message }` 404

**GET /api/users/:user_id/standings**

Returns a given user's community standing across all neighborhoods they're active in.

- **Request Body:** None
- **Response:**
  - Success: `[{ standing_id, user_id, neighborhood_id, neighborhood_name, city, events_hosted, events_attended, is_leader, updated_at }, ...]` 200

Note: `community_standing` rows are created and updated server-side (incrementing `events_hosted` on event creation and `events_attended` when `did_attend` is set to true on an RSVP, then recalculating `is_leader`), so there is no public POST/PATCH endpoint for this resource.

#### Tags

**GET /api/tags**

Returns all available tags (a global, predefined list used for both user interests and event tags).

- **Request Body:** None
- **Response:**
  - Success: `[{ tag_id, name }, ...]` 200

#### User Interests

**GET /api/users/:user_id/interests**

Returns the interest tags a given user has selected.

- **Request Body:** None
- **Response:**
  - Success: `[{ tag_id, name }, ...]` 200

**POST /api/users/:user_id/interests**

Adds an interest tag to the authenticated user's profile.

- **Request Body:** `{ tag_id }`
  - `tag_id` is required.
- **Response:**
  - Success: `{ user_id, tag_id }` 201
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Conflict (tag already added): `{ message }` 409

**DELETE /api/users/:user_id/interests/:tag_id**

Removes an interest tag from the authenticated user's profile.

- **Request Body:** None
- **Response:**
  - Success: `{ message }` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found: `{ message }` 404

#### Recommendations

**GET /api/users/:user_id/recommendations**

Returns cached AI-generated event recommendations for a given user. Each recommendation embeds a summary of its event.

- **Request Body:** None
- **Response:**
  - Success: `[{ recommendation_id, user_id, event_id, reason, created_at, event: { event_id, title, event_date, location, status, event_image_url, latitude, longitude } }, ...]` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403

**POST /api/users/:user_id/recommendations/refresh**

Triggers a fresh AI recommendation pass for the user (based on `user_interests` and `rsvps` history) and overwrites the cached results.

- **Request Body:** None
- **Response:**
  - Success: `[{ recommendation_id, user_id, event_id, reason, created_at, event: { event_id, title, event_date, location, status, event_image_url, latitude, longitude } }, ...]` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403

### Core Technologies, 3rd-Party APIs and New Libraries

This project will make use of the following technologies, 3rd-Party APIs, and new libraries.

**Core Technologies**

- **React** for the frontend user interface
- **Python and FastAPI** for the server
- **PostgreSQL** for the database
- **PostGIS** (PostgreSQL extension) — enables the `GEOGRAPHY` columns on `events.geo` and `neighborhoods.boundary`, the `ST_MakePoint`/`ST_SetSRID` generated column, and the `ST_Contains` / `ST_DWithin` queries that power neighborhood resolution and map-radius search. Enabled with `CREATE EXTENSION postgis;`

**3rd Party APIs**

- **Nominatim (OpenStreetMap) Geocoding API** — converts a host-entered address into coordinates at event creation (called client-side from the Create Event form).
  - Endpoint: `GET https://nominatim.openstreetmap.org/search?q={address}&format=json&limit=1`
  - Values used: `lat` and `lon` from the first result, stored as `events.latitude` and `events.longitude` (which in turn generate `events.geo`).
- **Google Gemini API** — powers the AI Event Matchmaker.
  - Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
  - Model: `gemini-2.5-flash` (free tier; fast and sufficient for ranking events)
  - Values sent: the user's interest tags + a list of nearby events. The request sets `generationConfig.responseMimeType: "application/json"` (and optionally a `responseSchema`) so the model returns a structured array of `{ "eventId", "reason" }`. Called from `POST /api/users/:user_id/recommendations/refresh`, with results written to the `recommendations` table.

**Libraries**

- **google-genai (Python SDK)** — wraps the Gemini calls on the FastAPI backend via `client.models.generate_content(...)`. (This is Google's current unified SDK; you install it with `pip install google-genai`.)
- **Leaflet / react-leaflet** — renders the interactive event map. Uses `<MapContainer>`, a `<TileLayer>` pointed at OpenStreetMap tiles (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`), and a `<Marker>` per event returned by `GET /api/events?lat=&lng=&radius=`.
- **SQLAlchemy + psycopg** — ORM and driver connecting FastAPI to Postgres; **GeoAlchemy2** lets SQLAlchemy understand the PostGIS `GEOGRAPHY` types (or you can drop to raw SQL for the spatial queries — either is fine).
- **passlib[bcrypt]** — hashes passwords into `users.password_hash` at signup and verifies them at login.
- **qrcode.react** — renders the host's check-in QR code on-screen from the event's `check_in_code`. Runs entirely client-side; no API or key.
- **html5-qrcode** — lets an attendee scan the host's QR through their device camera; the decoded code is posted to `POST /api/events/:event_id/check-in` to verify attendance. Also fully client-side.

**Data Source**

- **Zillow Neighborhood Boundaries** — free neighborhood polygons (CC BY-SA), loaded once into the `neighborhoods.boundary` column. The current deployment seeds the New York state shapefile only (266 neighborhoods, shipped as `backend/sql/neighborhoods_seed.dump`); events outside NY still work but don't map to a neighborhood, so community standing is only tracked for NY events. The shapefile's `Name` and `City` fields populate `neighborhoods.name` and `neighborhoods.city`, imported via `backend/scripts/load_neighborhoods.py`. Attribution ("provided by Zillow") is included per the license. This is a one-time data-loading task, not an API called at runtime.
