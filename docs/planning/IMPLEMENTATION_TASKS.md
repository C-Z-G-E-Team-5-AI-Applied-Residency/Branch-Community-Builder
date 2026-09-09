# BRANCH — Intent Matchmaking: Ordered Implementation Tasks

Companion to [INTENT_MATCHMAKING_PLAN.md](./INTENT_MATCHMAKING_PLAN.md). Do phases in order;
each is independently demoable. Branch: `chris/interest-framing`. Model: `gemini-3.1-flash-lite`.

Conventions discovered in the repo:
- **DB changes go in two places:** `backend/sql/schema.sql` (source of truth for *fresh* DBs) **and**
  a dated migration `backend/sql/migrations/YYYY-MM-DD_name.sql` (for the *existing* deployed DB).
  Migrations are applied manually: `psql "$DATABASE_URL" -f backend/sql/migrations/<file>`.
- **ORM models** (`backend/app/models/`) must gain matching columns or SQLAlchemy won't read them.
- **Auth:** `require_user(request) -> user_id` in `backend/app/core/security.py`. Build `require_admin`
  next to it.
- **AI services** follow `services/recommendations.py`: lazy client from `settings`, graceful no-op
  (return safe default) when the key is missing.

---

## Phase 0 — Schema + config (no user-visible change; ship first)

**DB**
- [ ] New migration `backend/sql/migrations/2026-07-27_intent_and_review.sql`:
  ```sql
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS intent TEXT;
  ALTER TABLE events   ADD COLUMN IF NOT EXISTS why TEXT;
  ALTER TABLE events   ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'approved';
  ALTER TABLE events   ADD COLUMN IF NOT EXISTS review_summary TEXT;
  ALTER TABLE events   ADD COLUMN IF NOT EXISTS review_reason TEXT;
  ALTER TABLE tags     ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';
  ALTER TABLE tags     ADD COLUMN IF NOT EXISTS created_by_event_id INT
                            REFERENCES events(event_id) ON DELETE SET NULL;
  ALTER TABLE tags     ADD COLUMN IF NOT EXISTS usage_count INT NOT NULL DEFAULT 0;
  -- backfill is implicit: DEFAULTs mark all existing events/tags 'approved'.
  ```
- [ ] Mirror the same column definitions into `backend/sql/schema.sql` (in the `events`, `profiles`,
      `tags` CREATE TABLE blocks) so fresh DBs match.
- [ ] Apply the migration: `psql "$DATABASE_URL" -f backend/sql/migrations/2026-07-27_intent_and_review.sql`.

**ORM models**
- [ ] `backend/app/models/profile.py` — add `intent: Mapped[str | None]`.
- [ ] `backend/app/models/event.py` — add `why`, `review_status`, `review_summary`, `review_reason`.
- [ ] `backend/app/models/tag.py` — add `status`, `created_by_event_id`, `usage_count` to `Tag`.

**Config**
- [ ] `backend/app/config.py` — add `admin_emails: str = ""` (comma-separated) and a helper, e.g.
      `def admin_email_set(self) -> set[str]: return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}`.
- [ ] `backend/.env.example` — add `ADMIN_EMAILS=you@example.com` with a comment.
- [ ] `backend/.env` (local, not committed) — add your team's real emails.

**Verify**
- [ ] Backend boots, `/health` OK, existing endpoints unaffected (all rows now `review_status='approved'`).

---

## Phase 1 — Intent capture + matchmaker enrichment (visible win, low risk)

**Backend**
- [ ] `backend/app/schemas/profile.py` — add `intent: str | None` to `ProfileOut`, `ProfileCreate`,
      `ProfileUpdate`.
- [ ] `backend/app/routers/profiles.py` — persist/return `intent` on create & PATCH.
- [ ] `backend/app/schemas/event.py` — add `why: str | None` to `EventCreate` (and `EventOut`;
      also add to `EventUpdate` if hosts should edit it).
- [ ] `backend/app/routers/events.py` `create_event` — store `body.why` on the `Event`.
- [ ] `backend/app/services/recommendations.py` — thread the user's `intent` and each event's `why`
      into `PROMPT_TEMPLATE`. Update `refresh_user_recommendations` in `routers/users.py` to fetch
      `profile.intent` and include `why` in the per-event dict.

**Frontend**
- [ ] `frontend/src/pages/SignUp.jsx` — interests step: add an `intent` textarea ("What do you want
      to do more of, offline?"); include it in the profile create call.
- [ ] `frontend/src/pages/Profile.jsx` — show/edit `intent`.
- [ ] `frontend/src/pages/CreateEvent.jsx` — add a **"Why this event?"** textarea → `why` in the
      create payload.
- [ ] `frontend/src/api/client.js` — ensure profile create/update and event create send the new fields.

**Verify**
- [ ] Create a profile with intent + an event with a why; run `POST .../recommendations/refresh`;
      confirm the reasons reflect intent, not just the 6 tags.

---

## Phase 2 — Mission guardrail + admin review (the safety story)

**Backend — admin gating (do first; everything else depends on it)**
- [ ] `backend/app/core/security.py` — add:
  ```python
  def require_admin(request: Request, db: Session = Depends(get_db)) -> int:
      user_id = require_user(request)
      user = db.get(User, user_id)
      if not user or user.email.lower() not in settings.admin_email_set():
          raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins only")
      return user_id
  ```
- [ ] `backend/app/routers/users.py` (or auth) — `GET /api/me/is-admin` → `{is_admin: bool}` using the
      same email check (no 403 — just returns the boolean for UI).

**Backend — moderation service**
- [ ] New `backend/app/services/moderation.py` — `review_event(title, description, why, tags)`:
  - Lazy Gemini client (mirror `recommendations._get_client`); no key → return
    `{"status": "approved", "summary": "", "reason": ""}`.
  - Prompt encodes BRANCH's mission (real, in-person, safe, community-building; flag ads / MLM /
    scams / purely-online / unsafe). Force JSON:
    `{"status": "approved"|"pending", "summary": "<one neutral sentence>", "reason": "<why flagged, empty if approved>"}`.
  - Validate/coerce fields; default to `pending` on parse failure (fail safe, not open).

**Backend — wire into creation + review endpoints**
- [ ] `backend/app/routers/events.py` `create_event` — after building the event, call `review_event(...)`
      and set `review_status` / `review_summary` / `review_reason`. Return `review_status` so the
      frontend can show the "held" banner.
- [ ] Event listing queries (`events.py`, Discover path) — default filter to `review_status='approved'`;
      still let a host see their *own* pending events.
- [ ] `GET /api/events?review_status=pending` — admin-gated moderation queue.
- [ ] `PATCH /api/events/{id}/review` (admin-gated) — body `{decision: 'approve'|'reject', note?: str}`;
      sets `review_status` and appends `note` to `review_reason`.

**Frontend**
- [ ] `frontend/src/api/client.js` — `getIsAdmin()`, `listPendingEvents()`, `reviewEvent(id, decision, note)`.
- [ ] `frontend/src/pages/CreateEvent.jsx` — if response `review_status==='pending'`, show a gentle
      "held for review" banner instead of treating it as failure.
- [ ] New `frontend/src/pages/Review.jsx` — one card per pending event: **summary**, **why it was
      flagged**, **Approve / Reject** buttons. Keep it plain.
- [ ] `frontend/src/App.jsx` — add `/review` route.
- [ ] Nav (wherever the app nav lives) — show the Review link only if `getIsAdmin()` is true.

**Verify**
- [ ] As a non-admin: `PATCH .../review` → 403; no Review link.
- [ ] As an admin: create an off-mission event ("Buy my crypto course, Zoom link") → lands `pending`,
      appears in the queue with an AI summary + flag reason; Approve moves it to Discover, Reject hides it.
- [ ] A normal in-person event auto-approves and skips the queue.

---

## Phase 3 — Emergent vocabulary (kills the 6-tag restriction)

**Backend**
- [ ] New `backend/app/services/tagging.py` — `suggest_tags(title, description, why, existing_tags)`:
  - Gemini call, given the current **approved** tag names, instructed to *reuse* when a tag fits and
    only *propose new* when nothing fits. Return `[{"name": str, "is_new": bool}]`. No key → `[]`.
- [ ] `backend/app/routers/events.py` `create_event` — call `suggest_tags(...)`; for each:
  - existing approved tag → attach via `EventTag`;
  - new → insert `Tag(name, status='pending', created_by_event_id=…)`, then attach.
  - **Also validate any client-supplied `tag_ids` exist** (fix the current IntegrityError-on-bad-id gap).
  - Increment `usage_count` on attached tags.
- [ ] `backend/app/routers/tags.py` — `GET /api/tags?status=pending` (admin) and
      `PATCH /api/tags/{id}` (admin) to approve / rename / merge.

**Frontend**
- [ ] `frontend/src/pages/CreateEvent.jsx` — replace the 6 fixed checkboxes with **AI-suggested tag
      chips** derived from title/description/why; user can remove or add free-text chips.
- [ ] `frontend/src/pages/Review.jsx` — add a **pending tags** section (approve / rename / merge).
- [ ] `frontend/src/api/client.js` — `listPendingTags()`, `updateTag(id, …)`.

**Verify**
- [ ] Create an event whose theme isn't in the 6 tags (e.g. "sunrise hike") → AI suggests a sensible
      tag; a genuinely new one lands `pending`; approving it makes it reusable/filterable.
- [ ] Tag list grows past 6; taxonomy sprawl controlled via reuse + merge in Review.

---

## Success measurement (build alongside, per client's "we define success")
- [ ] Track **check-in conversion of recommended events**: of a user's recommendations, the fraction
      RSVP'd *and* checked in (`checked_in_at` / `community_standing.events_attended`).
- [ ] Compare before/after Phase 1–3 (or A/B the old vs. new matchmaker prompt).
- [ ] Secondary: tag count over time; % events auto-approved vs. held.

---

## Cross-cutting reminders
- Every new AI service must **fail safe with no key** (recommendations → `[]`, moderation → `pending`,
  tagging → `[]`) so local dev without a key still works.
- `create_event` now makes up to **2 LLM calls** (tagging + moderation) — fine at capstone scale on
  `gemini-3.1-flash-lite`'s free quota; note it. If latency bites, run moderation async and leave the
  event `pending` until it returns.
- Keep commits phase-scoped on `chris/interest-framing` for clean capstone checkpoints.
