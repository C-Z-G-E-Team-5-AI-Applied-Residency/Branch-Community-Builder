# BRANCH — Architecture Overview

A community app: users discover local events on a map, RSVP, and check in via QR code to prove
they actually showed up. There's also an AI "event matchmaker" using Gemini.

**Status note:** as of this writing, this is a fully-designed *skeleton*, not a working app yet.
The database schema, ORM models, request/response contracts, and route signatures are all written
out — but almost every route handler body is `raise NotImplementedError`, and the frontend pages
have `{/* TODO */}` where API calls should go. Treat what follows as "the intended design."

## Backend: FastAPI + SQLAlchemy + PostGIS

**FastAPI** (`backend/app/main.py`) is the web framework — like Express, but routes are declared
with decorators (`@app.get("/path")`) and it auto-generates interactive API docs at `/docs` from
type annotations. `main.py` wires up two middlewares (session cookies + CORS) and mounts 7 routers.

**Pydantic** (`backend/app/schemas/`) is FastAPI's validation layer — think TypeScript interfaces
that are actually *enforced at runtime*. Every endpoint declares a `*Create`/`*Update` schema for
what it accepts and a `*Out` schema for what it returns; FastAPI validates incoming JSON against
these automatically and rejects bad requests with a 422 before your code even runs.

**SQLAlchemy** (`backend/app/models/`) is the ORM — Python classes that map 1:1 to the tables in
`backend/sql/schema.sql`. `backend/app/database.py` sets up a `get_db()` dependency that hands each
request its own DB session and closes it afterward — the standard FastAPI pattern for "one
connection per request."

**GeoAlchemy2 + PostGIS** is the interesting part given SQL background but no geo experience. The
`events` table has a **generated column**:

```sql
geo GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS
    (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED
```

You write plain `latitude`/`longitude` floats; Postgres automatically derives a real spatial point
from them, indexed with a GIST index for fast "find things within N meters" queries (`ST_DWithin`).
Same idea for `neighborhoods.boundary`, a polygon column used for "which neighborhood is this point
inside" lookups (`ST_Contains`) — that's how the "community standing / leaderboard per
neighborhood" feature is meant to work.

**Auth** is cookie-based sessions, not JWT: `backend/app/core/security.py` hashes passwords with
bcrypt, and on login the intended code sets `request.session["user_id"]`. Starlette's
`SessionMiddleware` (in `main.py`) transparently signs that into a cookie. The frontend must send
`credentials: "include"` on every fetch for this to work — and it does, in `api/client.js`.

**AI integration** (`backend/app/services/recommendations.py`) calls Gemini (`gemini-2.0-flash`
via the `google-genai` SDK), feeding it the user's interest tags + nearby events, and forces a
structured JSON response (`[{eventId, reason}]`) that gets cached in a `recommendations` table.

**Geocoding** (`backend/app/services/geocoding.py`) turns a free-text address into lat/lng via the
free Nominatim (OpenStreetMap) API, server-side, when a user creates an event.

## Database schema (`backend/sql/schema.sql`)

- `users` / `profiles` — account + display info (1:1)
- `events` — title/date/location/host/capacity/status, lat+lng, the generated `geo` point, and a
  `check_in_code` for QR verification
- `rsvps` — join of user↔event, unique per pair, tracks `status` and `did_attend`/`checked_in_at`
- `neighborhoods` — polygon boundaries (loaded from Zillow's public shapefiles via
  `backend/scripts/load_neighborhoods.py`, not run automatically)
- `community_standing` — per (user, neighborhood) counts of events hosted/attended, plus an
  `is_leader` flag
- `tags`, `user_interests`, `event_tags` — a global tag catalog with many-to-many joins to both
  users and events
- `recommendations` — cached Gemini output

## Frontend (React + Vite)

Routing is `react-router-dom` v6, all declared in `frontend/src/App.jsx`. Pages: SignIn/SignUp,
Discover (map + list + AI recs), CreateEvent, EventDetail, HostCheckIn, Profile.

Notable libraries beyond plain React: `react-leaflet` (interactive map with OpenStreetMap tiles,
in `EventMap.jsx`), `qrcode.react` (renders the host's check-in QR code), `html5-qrcode` (scans QR
codes via device camera for attendee check-in).

All backend calls funnel through one file, `frontend/src/api/client.js`: a thin `fetch` wrapper
reading `VITE_API_URL` from env, always sending `credentials: "include"` so the session cookie
round-trips.

## How it fits together (example flow)

Create event → `CreateEvent.jsx` posts to `POST /api/events` → backend geocodes the address if
needed, inserts into `events` (Postgres auto-derives the `geo` point) → `Discover.jsx` queries
`GET /api/events?lat=&lng=&radius=`, which is meant to run a PostGIS `ST_DWithin` radius search →
results render on the Leaflet map and as cards. RSVP and QR check-in flow similarly into the
`rsvps` table, bumping `community_standing` counters.

## Setup

```bash
docker compose up -d                              # postgres + postgis on :5432
psql "$DATABASE_URL" -f backend/sql/schema.sql

cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                              # fill in DATABASE_URL, GEMINI_API_KEY, SESSION_SECRET
uvicorn app.main:app --reload                     # http://localhost:8000 (docs at /docs)

cd ../frontend
npm install
cp .env.example .env                              # VITE_API_URL=http://localhost:8000
npm run dev                                       # http://localhost:5173
```
