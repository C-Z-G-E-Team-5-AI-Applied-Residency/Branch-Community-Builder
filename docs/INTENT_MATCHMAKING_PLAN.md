# BRANCH — Intent-Based Matchmaking Plan

## The idea in one line

Stop constraining events by *what category* they are (6 fixed tags). Constrain them
by *why they exist* — do they fit BRANCH's mission of getting people offline, together,
safely? Capture user + host **intent** as first-class data, let the tag vocabulary grow
from real events, and add one LLM guardrail on the write path to keep out misuse.

This works because the matchmaker (`services/recommendations.py`) is *already* an LLM
reasoning over free text — it never needed a fixed vocabulary.

---

## Three parts

1. **Intent capture** — users and hosts express *why*, in their words, as real fields.
2. **Emergent vocabulary** — an LLM suggests/creates tags from event text; the `tags`
   table becomes a living taxonomy instead of 6 hardcoded rows.
3. **Mission guardrail** — an LLM checks each new event against BRANCH's mission;
   off-mission events are **flagged for review** (created but held) rather than blocked.

---

## Data model changes

Current: `tags(tag_id, name)`, `user_interests(user_id, tag_id)`, `event_tags(event_id, tag_id)`.

| Table | Change | Why |
|---|---|---|
| `profiles` | add `intent TEXT` | user's free-text "what I want to do offline" |
| `events` | add `why TEXT` | the host's stated purpose of the event |
| `events` | add `review_status TEXT DEFAULT 'approved'` (`approved` / `pending` / `rejected`) | guardrail outcome |
| `events` | add `review_summary TEXT` | AI one-line summary of the event, shown on the review card |
| `events` | add `review_reason TEXT` | AI's "why it was flagged" note (and any human note) |
| `tags` | add `status TEXT DEFAULT 'approved'` (`approved` / `pending`) | governance for emergent tags |
| `tags` | add `created_by_event_id INT NULL` | provenance of an emergent tag |
| `tags` | add `usage_count INT DEFAULT 0` | rank/merge/prune the taxonomy |

Migrations live alongside the existing ones (the repo uses raw SQL in `backend/sql/` plus
per-feature migration files — follow the pattern of the recent `announcements` migration).

---

## Backend

### New service: `services/moderation.py`
`review_event(title, description, why, tags) -> {status, summary, reason}`
- One Gemini call with a system prompt encoding BRANCH's mission (real, in-person, safe,
  community-building; reject ads/MLM/scams/purely-online/unsafe).
- Returns three fields in one JSON response — no extra AI call:
  - `status`: `approved` or `pending` (never hard-rejects at creation, per decision: flag for review)
  - `summary`: one neutral sentence describing what the event is (so a reviewer approves at a glance
    without reading the whole event)
  - `reason`: one sentence on *why* it was flagged (empty when `approved`)
- Graceful no-op → `{status: 'approved', summary: '', reason: ''}` if no API key (mirror
  `recommendations._get_client()` returning `None`).

### New service: `services/tagging.py`
`suggest_tags(title, description, why, existing_tags) -> [{name, is_new}]`
- Gemini call: "reuse an existing tag when it fits; only propose a new one when nothing
  fits." Feed it the current approved tag names so it prefers reuse (prevents taxonomy sprawl).
- New tags are inserted with `status='pending'` and wired to the event; existing tags reused directly.

### Modify `services/recommendations.py`
- Add **user `intent`** and each event's **`why`** to the prompt. The matchmaker's quality
  jumps because it now reasons over intent, not just 6 words. (Small prompt-template edit.)

### Modify `routers/events.py` → `create_event`
New flow: build event → `suggest_tags()` → attach tags (create pending ones) →
`review_event()` → set `review_status` / `review_summary` / `review_reason`. Also **validate
`tag_ids` exist** (current code relies on the FK and would throw IntegrityError — clean this up
while you're here).

### Admin gating (prerequisite for the review flow)
The app has **no role/admin concept today** — every user is equal. Flag-for-review needs one,
or any user could approve their own held event. Keep it minimal, per the client's "build around
ourselves":
- `ADMIN_EMAILS` in `.env` (comma-separated team emails) + a `require_admin` FastAPI dependency
  that 403s if the session user's email isn't in the list. No schema change, no role system.
- `GET /api/me/is-admin` → boolean, so the frontend can show/hide the review link.

> **Deploy note:** `ADMIN_EMAILS` is not committed (`.env` is gitignored). Production reads env
> vars from the **Render dashboard**, not the local file — so before Phase 2 ships, add
> `ADMIN_EMAILS` (the full team list, no quotes) to the backend service's Render env vars, or no
> one will be an admin in prod. Locally, each dev only needs their own login email.

### New review endpoints (admin-gated via `require_admin`)
- `GET /api/events?review_status=pending` — the moderation queue.
- `PATCH /api/events/{id}/review` — approve / reject (+ optional human note appended to `review_reason`).
- `GET /api/tags?status=pending` and `PATCH /api/tags/{id}` — approve/rename/merge emergent tags.

### Discover / listing
- Default event queries filter to `review_status='approved'` so held events don't surface
  publicly. Hosts still see their own pending events (with a "under review" note).

---

## Frontend

- **`pages/SignUp.jsx`** — add an intent textarea to the interests step ("What do you want
  to do more of, offline?"). Keep the checkboxes as a warm-up.
- **`pages/CreateEvent.jsx`** — add a **"Why this event?"** field; replace the 6 fixed
  checkboxes with **AI-suggested tag chips** (editable: add/remove) generated from the
  title/description/why. Show a gentle "held for review" banner if `review_status='pending'`.
- **`pages/Profile.jsx`** — let users view/edit their intent text.
- **New review page** (admin-only route, hidden unless `GET /api/me/is-admin` is true). Dead
  simple, one card per pending event:
  - **Summary** — the AI's one-line `review_summary` (what the event is)
  - **Why it was flagged** — the AI's `review_reason`
  - **Approve / Reject** buttons → `PATCH /api/events/{id}/review`
  No need to open the full event — the reviewer decides from the two AI lines. Same pattern for
  pending tags. Doesn't need to be pretty for the capstone.
- **`pages/Discover.jsx`** — unchanged UX; benefits automatically from richer matchmaking.

---

## Phased delivery

- **Phase 0 — Schema.** Migrations + backfill (`review_status='approved'` for existing rows,
  `status='approved'` for the 6 seed tags). Nothing user-visible; safe to ship first.
- **Phase 1 — Intent capture + matchmaker enrichment.** Add `intent` (onboarding/profile) and
  `why` (create event); feed both into the recommender prompt. *Immediate, visible quality win,
  low risk.* This alone demonstrates "capture the why."
- **Phase 2 — Mission guardrail.** `moderation.py` (returns summary + why-flagged in one call),
  `review_status`, `ADMIN_EMAILS` gating, review endpoints + the simple approve/reject review
  page. This is the safety story — "we let people make any event, and here's how we stay safe."
- **Phase 3 — Emergent vocabulary.** `tagging.py`, pending-tag governance, swap CreateEvent's
  checkboxes for suggested chips. Kills the 6-tag restriction for good.

Each phase is independently demoable — good for capstone checkpoints.

---

## "We define what success looks like"

Your client also said *they* define success. Build the measurement in, so you can prove the
new matching is better than the old 6 tags:

- **Primary metric: check-in conversion** — of events a user was recommended, what fraction
  did they RSVP *and physically check in to* (`community_standing.events_attended`,
  `checked_in_at`). That's "doors walked through," the mission's own success metric.
- Compare cohorts before/after Phase 1–3, or A/B the old vs. new matchmaker prompt.
- Secondary: tag diversity (how far past 6 the taxonomy grows), % events auto-approved vs. held.

If the intent-based matcher lifts check-in conversion, you've shown — in the client's own
terms — that building around the *why* beats building around fixed categories.

---

## Open risks / notes

- **Taxonomy sprawl** — without reuse pressure, emergent tags explode. Mitigated by feeding
  existing tags to the suggester + `usage_count`-based merge/prune in the review page.
- **LLM latency on create** — two extra Gemini calls (tag + moderation) on `POST /events`.
  Keep them fast (`gemini-3.1-flash-lite`, already used) or run moderation async and default to
  `pending` until it returns.
- **Cost** — every event now costs ~2 LLM calls. Fine at capstone scale; note it.
- **Guardrail false-holds** — "flag for review" makes these low-stakes (nothing is wrongly
  destroyed), which is exactly why we chose it over hard-reject.
