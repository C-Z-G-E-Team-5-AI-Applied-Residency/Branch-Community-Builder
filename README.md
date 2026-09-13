# BRANCH

> Moving your community from online to outside. Real connections for a digital generation.

A community-building app that helps people discover local events, RSVP, and verify
they actually showed up. Success is measured by doors walked through, not screen time.

## Features

- **Event creation & management** — hosts create, edit, and delete events, each with a location, capacity, and description.
- **Interactive event map** — an event map (Leaflet) lets users explore and discover nearby events by location, date, status, or tag.
- **RSVP & QR check-in** — users RSVP to events and verify attendance in person via a host-generated QR code, so participation is recorded rather than assumed.
- **AI event matchmaking** — a Gemini-powered recommendation engine suggests events based on a user's interests and attendance history.
- **Weekly community prompts** — a recurring prompt invites users to respond and see how others in the community answered.
- **Event announcements** — hosts can post announcements to everyone who RSVP'd to their event.
- **Community standing & leaderboards** — per-neighborhood standing tracks events hosted and attended, surfacing community leaders.
- **Interests & tags** — users select interest tags, and events are tagged, powering both discovery and recommendations.

## 🚀 Deployment

**Live app:** [https://branch-ql0d.onrender.com](https://branch-ql0d.onrender.com)

## Stack

- **Frontend:** React 18 (Vite), react-router-dom, react-leaflet + Leaflet, qrcode.react, html5-qrcode, react-easy-crop
- **Backend:** Python + FastAPI, Uvicorn, SQLAlchemy + psycopg, GeoAlchemy2, Pydantic + pydantic-settings
- **Auth & sessions:** Starlette `SessionMiddleware` (cookie sessions) + passlib/bcrypt for password hashing
- **File uploads:** python-multipart (profile picture uploads)
- **Database:** PostgreSQL + PostGIS
- **AI:** Google Gemini (`google-genai` SDK) — event matchmaking recommendations and content moderation
- **Geocoding:** Nominatim (OpenStreetMap)
- **Testing:** pytest (backend), Vitest + React Testing Library (frontend)

## Repo layout

```
branch/
├── backend/
│   ├── app/
│   │   ├── core/       config, session/auth helpers
│   │   ├── models/     SQLAlchemy models
│   │   ├── routers/    FastAPI route handlers
│   │   ├── schemas/    Pydantic request/response schemas
│   │   └── services/   business logic (e.g. Gemini recommendations)
│   ├── scripts/        one-off data-loading scripts (e.g. neighborhoods)
│   ├── sql/            schema.sql + seed dumps
│   └── tests/          pytest suite
└── frontend/
    └── src/
        ├── api/         API client calls
        ├── components/  reusable UI components
        ├── context/     React context providers
        ├── pages/       route-level views
        └── styles/      CSS
```

## Getting started

### 1. Database

The app needs a PostgreSQL database with the PostGIS extension. Pick one of the two options below — both end up with the same schema and credentials (`branch` / `branch` / `branch`, matching `backend/.env.example`'s `DATABASE_URL`).

**Option A — Docker (recommended)**

```bash
docker compose up -d          # starts postgres+postgis on :5432 (user/pass/db = branch/branch/branch)
psql "postgresql://branch:branch@localhost:5432/branch" -f backend/sql/schema.sql

# One-time: load the neighborhood polygons (powers community standing / leaderboards)
docker exec -i branch-community-builder-db-1 pg_restore -U branch -d branch \
  < backend/sql/neighborhoods_seed.dump
```

**Option B — local PostgreSQL (no Docker)**

Install PostgreSQL with the PostGIS extension (e.g. `sudo apt install postgresql postgresql-16-postgis-3` on Ubuntu, or `brew install postgresql postgis` on macOS), then:

```bash
sudo -u postgres createuser branch --pwprompt   # set the password to "branch", or your own
sudo -u postgres createdb branch -O branch

psql "postgresql://branch:branch@localhost:5432/branch" -f backend/sql/schema.sql
pg_restore -U branch -d branch -h localhost \
  < backend/sql/neighborhoods_seed.dump
```

If you used different credentials, update `DATABASE_URL` in `backend/.env` (step 2) to match.

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in DATABASE_URL, GEMINI_API_KEY, SESSION_SECRET
uvicorn app.main:app --reload # http://localhost:8000  (docs at /docs)

# Tests
pytest                        # from backend/, with the venv active
```

Notes on the tests: unit tests (`test_moderation.py`, `test_recommendations.py`) need
nothing external. The endpoint tests (`test_events_review.py`) drive the app against the
database in `DATABASE_URL`, but each test runs inside a transaction that is **rolled back**
at the end (see `tests/conftest.py`'s `db_isolation` fixture), so they never commit rows —
you can safely point them at your dev database. They don't call Gemini (moderation is stubbed).

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:8000
npm run dev                   # http://localhost:5173

# Tests (Vitest + React Testing Library, jsdom — no backend or browser needed)
npm test                      # from frontend/
```

## Team

Gabriel Cervantes · Christopher Hackett · Zane Correa · Emily Vu

---

## Project Description

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

## User Personas/Audience

Our intended audience is young adults, similar to us. We want to prioritize making this
application towards people who have more-than-average screen time, and are looking to reduce
it. Additionally, we are looking for an audience of people who may be social online through
social media or messaging platforms, but lack the same community offline. This audience may
have tried to connect with users through their existing applications, but plans never come into
fruition.

## Technical Specifications

For the database schema, API contract, and technology rationale, see [TECHNICAL_SPECIFICATIONS.md](TECHNICAL_SPECIFICATIONS.md).
