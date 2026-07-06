# BRANCH

> Moving your community from online to outside. Real connections for a digital generation.

A community-building app that helps people discover local events, RSVP, and verify
they actually showed up. Success is measured by doors walked through, not screen time.

## Stack
- **Frontend:** React (Vite), react-leaflet, qrcode.react, html5-qrcode
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
