# Technical Specifications

Companion to the main [README](README.md): full database schema, API contract, and technology rationale for BRANCH.

## Schema Design

**users table**

| Field         | Constraints                        |
| ------------- | ----------------------------------- |
| user_id       | SERIAL PRIMARY KEY                 |
| email         | TEXT UNIQUE NOT NULL               |
| password_hash | TEXT NOT NULL                      |
| username      | TEXT UNIQUE NOT NULL               |
| created_at    | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

**profiles table**

| Field           | Constraints                                                                   |
| --------------- | ----------------------------------------------------------------------------- |
| profile_id      | SERIAL PRIMARY KEY                                                            |
| display_name    | TEXT NOT NULL                                                                 |
| profile_picture | TEXT DEFAULT /images/default_avatar.svg                                       |
| picture_data    | BYTEA — uploaded avatar bytes (nullable; unset when using the default avatar) |
| picture_mime    | TEXT — MIME type of `picture_data` (nullable)                                 |
| bio             | TEXT NOT NULL                                                                 |
| user_id         | INTEGER REFERENCES users(user_id) ON DELETE CASCADE                           |
| home_zip_code   | TEXT NOT NULL                                                                 |
| intent          | TEXT — free-text "what I want to do offline"; fed to the AI matchmaker alongside interest tags (nullable) |

**events table**

| Field             | Constraints                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| event_id          | SERIAL PRIMARY KEY                                                                                                                            |
| title             | TEXT NOT NULL                                                                                                                                 |
| event_date        | TIMESTAMPTZ NOT NULL                                                                                                                          |
| event_end_date    | TIMESTAMPTZ — nullable for events created before this column existed; required going forward (enforced by `EventCreate`, not a DB constraint) |
| location          | TEXT NOT NULL                                                                                                                                 |
| event_zip_code    | INT NOT NULL                                                                                                                                  |
| event_description | TEXT NOT NULL                                                                                                                                 |
| event_capacity    | INTEGER NOT NULL CHECK (event_capacity > 0)                                                                                                   |
| status            | TEXT NOT NULL DEFAULT 'open'                                                                                                                  |
| host_id           | INTEGER REFERENCES users(user_id) ON DELETE CASCADE                                                                                           |
| created_at        | TIMESTAMPTZ DEFAULT NOW()                                                                                                                     |
| event_image_url   | TEXT NOT NULL                                                                                                                                 |
| geo               | GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED                            |
| longitude         | DOUBLE PRECISION NOT NULL                                                                                                                     |
| latitude          | DOUBLE PRECISION NOT NULL                                                                                                                     |
| check_in_code     | TEXT                                                                                                                                          |
| flyer_url         | TEXT — template asset path, or `/api/events/{id}/flyer` once bytes are uploaded (nullable)                                                    |
| flyer_data        | BYTEA — uploaded flyer bytes, served at `GET /api/events/{id}/flyer` (nullable)                                                                |
| flyer_mime        | TEXT — MIME type of `flyer_data` (nullable)                                                                                                   |
| why               | TEXT — host's stated purpose for the event; fed to the AI matchmaker and the mission guardrail (nullable)                                     |
| review_status     | TEXT NOT NULL DEFAULT 'approved' — mission guardrail outcome, one of `'approved'` \| `'pending'` \| `'rejected'`                               |
| review_summary    | TEXT — AI one-line summary of the event, shown on the moderation review card (nullable)                                                       |
| review_reason     | TEXT — AI "why it was flagged" note, plus any human moderator note appended (nullable)                                                        |

**rsvps table**

| Field                     | Constraints                                                           |
| ------------------------- | --------------------------------------------------------------------- |
| rsvp_id                   | SERIAL PRIMARY KEY                                                    |
| user_id                   | INTEGER REFERENCES users(user_id) ON DELETE CASCADE                   |
| event_id                  | INTEGER REFERENCES events(event_id) ON DELETE CASCADE                 |
| did_attend                | BOOLEAN DEFAULT FALSE                                                 |
| status                    | TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going','cancelled')) |
| created_at                | TIMESTAMPTZ DEFAULT NOW()                                             |
| checked_in_at             | TIMESTAMPTZ                                                           |
| UNIQUE(user_id, event_id) | Prevents duplicate RSVPs to the same event                            |

**neighborhoods table**

| Field           | Constraints                            |
| --------------- | ---------------------------------------- |
| neighborhood_id | SERIAL PRIMARY KEY                     |
| name            | TEXT NOT NULL                          |
| city            | TEXT NOT NULL                          |
| boundary        | GEOGRAPHY(MULTIPOLYGON, 4326) NOT NULL |

**community_standing table**

| Field                             | Constraints                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------ |
| standing_id                       | SERIAL PRIMARY KEY                                                           |
| user_id                           | INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE                 |
| neighborhood_id                   | INTEGER NOT NULL REFERENCES neighborhoods(neighborhood_id) ON DELETE CASCADE |
| events_hosted                     | INTEGER NOT NULL DEFAULT 0                                                   |
| events_attended                   | INTEGER NOT NULL DEFAULT 0                                                   |
| is_leader                         | BOOLEAN NOT NULL DEFAULT FALSE                                               |
| updated_at                        | TIMESTAMPTZ NOT NULL DEFAULT NOW()                                           |
| UNIQUE (user_id, neighborhood_id) | One standing row per user per neighborhood                                   |

**tags table**

| Field               | Constraints                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| tag_id              | SERIAL PRIMARY KEY                                                                              |
| name                | TEXT UNIQUE NOT NULL                                                                            |
| status              | TEXT NOT NULL DEFAULT 'approved' — `'approved'` \| `'pending'`; emergent (AI/host-suggested) tags start `'pending'` until a moderator approves them |
| created_by_event_id | INTEGER REFERENCES events(event_id) ON DELETE SET NULL — provenance: the event whose creation first proposed this tag, if any (nullable) |
| usage_count         | INTEGER NOT NULL DEFAULT 0 — how many events use this tag; drives rank/merge/prune of the taxonomy |

Seeded with six starter tags (`basketball`, `volunteering`, `photography`, `coding`, `music`, `outdoors`), all `'approved'`.

**user_interests table**

| Field                         | Constraints                                                  |
| ----------------------------- | -------------------------------------------------------------- |
| tag_id                        | INTEGER NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE   |
| user_id                       | INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE |
| PRIMARY KEY (user_id, tag_id) | Composite key                                                |

**event_tags table**

| Field                          | Constraints                                                    |
| -------------------------------- | ------------------------------------------------------------- |
| event_id                       | INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE |
| tag_id                         | INTEGER NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE     |
| PRIMARY KEY (event_id, tag_id) | Composite key                                                  |

**recommendations table**

| Field                      | Constraints                                                    |
| ---------------------------- | --------------------------------------------------------------- |
| recommendation_id          | SERIAL PRIMARY KEY                                             |
| user_id                    | INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE   |
| event_id                   | INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE |
| reason                     | TEXT NOT NULL                                                  |
| created_at                 | TIMESTAMPTZ NOT NULL DEFAULT NOW()                             |
| UNIQUE (user_id, event_id) | One cached recommendation per user/event                       |

This table is a cache, overwritten every time `POST /api/users/:user_id/recommendations/refresh` runs.

**recommendation_log table**

Append-only history of every recommendation ever made (unlike `recommendations`, rows here are never overwritten), used to measure recommendation → RSVP → check-in conversion over time.

| Field          | Constraints                                                    |
| -------------- | --------------------------------------------------------------- |
| id             | SERIAL PRIMARY KEY                                             |
| user_id        | INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE   |
| event_id       | INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE |
| recommended_at | TIMESTAMPTZ NOT NULL DEFAULT NOW()                             |
| UNIQUE (user_id, event_id) | One row per (user, event) ever recommended         |

**announcements table**

| Field           | Constraints                                                    |
| --------------- | ----------------------------------------------------------------- |
| announcement_id | SERIAL PRIMARY KEY                                             |
| event_id        | INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE |
| host_id         | INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE   |
| message         | TEXT NOT NULL                                                  |
| created_at      | TIMESTAMPTZ NOT NULL DEFAULT NOW()                             |

**weekly_prompts table**

| Field         | Constraints                             |
| ------------- | ----------------------------------------- |
| prompt_id     | SERIAL PRIMARY KEY                      |
| question_text | TEXT NOT NULL                           |
| week_start    | DATE NOT NULL UNIQUE — Monday of the prompt week |
| created_at    | TIMESTAMPTZ DEFAULT NOW()               |

**prompt_responses table**

| Field                     | Constraints                                                             |
| ------------------------- | -------------------------------------------------------------------------- |
| response_id               | SERIAL PRIMARY KEY                                                      |
| prompt_id                 | INTEGER REFERENCES weekly_prompts(prompt_id) ON DELETE CASCADE          |
| user_id                   | INTEGER REFERENCES users(user_id) ON DELETE CASCADE                     |
| response_text             | TEXT NOT NULL                                                           |
| created_at                | TIMESTAMPTZ DEFAULT NOW()                                               |
| updated_at                | TIMESTAMPTZ NOT NULL DEFAULT NOW() — auto-bumped on UPDATE by the `set_updated_at()` trigger |
| UNIQUE(user_id, prompt_id) | One response per user per prompt                                        |

## API Contract

### Auth

**POST /api/auth/signup**

Creates a new user account and starts a session immediately.

- **Request Body:** `{ email, password, username }`
  - `email`, `password`, and `username` are required. `email` must be a valid email address.
- **Response:**
  - Success: `{ user_id, email, username, created_at, has_profile }` 201
  - Error, Validation (missing/invalid field, e.g. malformed email): `{ detail }` 422
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

### Me

**GET /api/me/is-admin**

UI hint for whether the signed-in user may moderate (drives the review link/queue in the frontend). Returns `{ is_admin: false }` for a signed-out visitor instead of 401.

- **Request Body:** None
- **Response:**
  - Success: `{ is_admin }` 200

### Users

**GET /api/users/:user_id**

Returns a single user's public info.

- **Request Body:** None
- **Response:**
  - Success: `{ user_id, username, created_at }` 200
  - Error, Not Found: `{ message }` 404

**DELETE /api/users/:user_id**

Permanently deletes the authenticated user's own account. DB-level `ON DELETE CASCADE` removes their profile, events, RSVPs, interests, standings, and recommendations. Clears the session.

- **Request Body:** None
- **Response:**
  - Success: 204 (no body)
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized (deleting another user's account): `{ message }` 403
  - Error, Not Found: `{ message }` 404

### Profiles

**GET /api/profiles/:user_id**

Returns the profile associated with a given user, including their interest tags.

- **Request Body:** None
- **Response:**
  - Success: `{ profile_id, display_name, profile_picture, bio, home_zip_code, user_id, intent, interests: [{ tag_id, name }, ...] }` 200
  - Error, Not Found: `{ message }` 404

**POST /api/profiles**

Creates a profile for the authenticated user. `profile_picture` is not accepted here — it is server-set (default avatar, or via the picture upload endpoint below).

- **Request Body:** `{ display_name, bio, home_zip_code, intent }`
  - `display_name`, `bio`, and `home_zip_code` are required. `intent` is optional free text ("what I want to do offline"), fed to the AI matchmaker.
- **Response:**
  - Success: `{ profile_id, display_name, profile_picture, bio, home_zip_code, user_id, intent, interests: [{ tag_id, name }, ...] }` 201
  - Error, Not Authenticated: `{ message }` 401
  - Error, Conflict (profile already exists): `{ message }` 409

**PATCH /api/profiles/:user_id**

Updates an existing profile. Only the owner may update it.

- **Request Body:** `{ display_name, bio, home_zip_code, intent }` (all optional — only included fields are updated)
- **Response:**
  - Success: `{ profile_id, display_name, profile_picture, bio, home_zip_code, user_id, intent, interests: [{ tag_id, name }, ...] }` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found: `{ message }` 404

**PUT /api/profiles/:user_id/picture**

Uploads (or replaces) the authenticated user's avatar. Multipart form upload (`file`), owner only.

- **Request Body:** `multipart/form-data` with a `file` field — JPEG/PNG/WebP/GIF, ≤2 MB (validated by magic bytes, not just the declared content type).
- **Response:**
  - Success: `{ profile_id, display_name, profile_picture, bio, home_zip_code, user_id, intent, interests: [...] }` 200 — `profile_picture` becomes a content-hash-versioned URL, `/api/profiles/:user_id/picture?v=<hash>`
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found (no profile yet): `{ message }` 404
  - Error, Too Large (>2 MB): `{ message }` 413
  - Error, Unsupported Type (fails magic-byte check): `{ message }` 415

**GET /api/profiles/:user_id/picture**

Serves the raw avatar image bytes (long-lived cache headers), for use as an `<img src>`.

- **Request Body:** None
- **Response:**
  - Success: raw image bytes with the stored MIME type 200
  - Error, Not Found (no profile, or no uploaded picture): `{ message }` 404

**DELETE /api/profiles/:user_id/picture**

Removes the authenticated user's uploaded avatar, reverting `profile_picture` to the default avatar. Owner only.

- **Request Body:** None
- **Response:**
  - Success: 204 (no body)
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found: `{ message }` 404

### Events

**GET /api/events**

Returns events, with optional filtering by zip code, proximity, date, status, or tag. Events held or rejected by the mission guardrail are hidden from everyone except their host (or an admin, via `/pending-review`).

- **Request Body:** None
- **Optional Query Strings:**
  - `?zip_code=` filter by `event_zip_code`
  - `?lat=&lng=&radius=` filter by distance using the `geo` column (radius in miles, default 10)
  - `?status=` filter by event `status`
  - `?after=` filter for events on/after a given ISO date
  - `?tag_id=` filter to events tagged with a given tag
- **Response:**
  - Success: `[{ event_id, title, event_date, event_end_date, location, event_zip_code, event_description, event_capacity, why, status, review_status, host_id, event_image_url, flyer_url, latitude, longitude, tags: [{ tag_id, name }, ...], check_in_opens_before_hours }, ...]` 200

**GET /api/events/pending-review**

Moderation queue: events currently held (`review_status = 'pending'`), oldest first. Admin only.

- **Request Body:** None
- **Response:**
  - Success: `[{ event_id, ..., review_summary, review_reason }, ...]` (same event shape as above, plus the AI's `review_summary`/`review_reason`) 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized (not an admin): `{ message }` 403

**GET /api/events/:event_id**

Returns a single event's details. `check_in_code` is included only when the requester is the event's host. `review_summary`/`review_reason` are included for the host or an admin. A held/rejected event 404s for anyone but its host or an admin (existence isn't revealed to others).

- **Request Body:** None
- **Response:**
  - Success: `{ event_id, title, event_date, event_end_date, location, event_zip_code, event_description, event_capacity, why, status, review_status, host_id, event_image_url, flyer_url, latitude, longitude, tags: [...], check_in_opens_before_hours, check_in_code?, review_summary?, review_reason? }` 200
  - Error, Not Found: `{ message }` 404

**PATCH /api/events/:event_id/review**

Approves or rejects an event (moves it in/out of `review_status`). Admin only. Accepts any current status, so a moderator can also take down a previously-approved event or restore a rejected one.

- **Request Body:** `{ decision, note }`
  - `decision` is required, one of `"approve"` \| `"reject"`. `note` is optional free text (≤500 chars), appended to `review_reason` as `[moderator] <note>`.
- **Response:**
  - Success: event object (as `GET /api/events/:event_id` with `review_summary`/`review_reason` included) 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized (not an admin): `{ message }` 403
  - Error, Not Found: `{ message }` 404

**POST /api/events**

Creates a new event hosted by the authenticated user. The server generates a random `check_in_code`. Every new event is run through the Gemini mission guardrail, which sets `review_status` (`'approved'` unless flagged, in which case `'pending'`; falls back to `'approved'` if no Gemini key is configured).

- **Request Body:** `{ title, event_date, event_end_date, location, event_zip_code, event_description, event_capacity, event_image_url, latitude, longitude, status="open", tag_ids=[], tag_names=[], why }`
  - `title`, `event_date`, `event_end_date`, `location`, `event_zip_code`, `event_description`, `event_capacity`, `event_image_url`, `latitude`, and `longitude` are required. `event_capacity` must be greater than 0; `latitude`/`longitude` must be in valid ranges. `status` defaults to `"open"`. `tag_ids` (existing tag ids) and `tag_names` (free-text; reused if an existing tag matches case-insensitively, else minted as a new `'pending'` tag) both default to empty. `why` is optional free text fed to the matchmaker and the guardrail.
- **Response:**
  - Success: `{ event_id, ..., check_in_code, review_status, review_summary, review_reason, tags: [...] }` 201 (full event shape, always including `check_in_code` and the review fields for the creating host)
  - Error, Not Authenticated: `{ message }` 401
  - Error, Validation (missing/invalid field): `{ detail }` 422
  - Error, Unknown Tag (a `tag_ids` entry doesn't exist): `{ message }` 400

**PATCH /api/events/:event_id**

Updates an event. Only the host may update it. If `title`, `event_description`, or `why` changes, the mission guardrail re-runs against the new content and `review_status`/`review_summary`/`review_reason` are reset from that fresh verdict.

- **Request Body:** `{ title, event_date, event_end_date, location, event_zip_code, event_description, event_capacity, status, event_image_url, latitude, longitude, why }` (all optional — only included fields are updated)
- **Response:**
  - Success: event object (as `GET /api/events/:event_id`, with review fields included) 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found: `{ message }` 404

**DELETE /api/events/:event_id**

Deletes an event. Only the host may delete it. Cascades to associated RSVPs, event_tags, announcements, and recommendations.

- **Request Body:** None
- **Response:**
  - Success: `{ message }` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found: `{ message }` 404

### Event Flyers

**PUT /api/events/:event_id/flyer**

Uploads a custom flyer image for an event. Multipart form upload (`file`), host only.

- **Request Body:** `multipart/form-data` with a `file` field — JPEG/PNG/WebP/GIF, ≤2 MB (magic-byte validated).
- **Response:**
  - Success: event object (with `check_in_code` included) 200 — `flyer_url` becomes a content-hash-versioned URL, `/api/events/:event_id/flyer?v=<hash>`
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found: `{ message }` 404
  - Error, Too Large (>2 MB): `{ message }` 413
  - Error, Unsupported Type: `{ message }` 415

**GET /api/events/:event_id/flyer**

Serves the stored flyer image bytes (long-lived cache headers), for use as an `<img src>`.

- **Request Body:** None
- **Response:**
  - Success: raw image bytes with the stored MIME type 200
  - Error, Not Found (no event, or no uploaded flyer): `{ message }` 404

**PUT /api/events/:event_id/flyer/template**

Selects a prebuilt flyer template instead of uploading a custom image. Host only.

- **Request Body:** `{ template_id }` — one of `"classic"` \| `"bold"` \| `"minimal"`
- **Response:**
  - Success: event object (with `check_in_code` included) 200 — `flyer_url` is set to the template's static asset path; any previously uploaded flyer bytes are cleared
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found (event, or unknown `template_id`): `{ message }` 404

**DELETE /api/events/:event_id/flyer**

Removes the event's flyer (uploaded or template), reverting `flyer_url` to `event_image_url`. Host only.

- **Request Body:** None
- **Response:**
  - Success: 204 (no body)
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found: `{ message }` 404

### Event Tags

**GET /api/events/:event_id/tags**

Returns the tags attached to a given event. A pending (unapproved) tag is included only for the event's host or an admin — everyone else sees just the approved tags.

- **Request Body:** None
- **Response:**
  - Success: `[{ tag_id, name }, ...]` 200
  - Error, Not Found: `{ message }` 404

**POST /api/events/:event_id/tags**

Attaches an existing tag to an event. Only the host may add tags.

- **Request Body:** `{ tag_id }`
  - `tag_id` is required.
- **Response:**
  - Success: `{ tag_id, name }` 201
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found (event, or tag_id doesn't exist): `{ message }` 404
  - Error, Conflict (tag already attached): `{ message }` 409

**DELETE /api/events/:event_id/tags/:tag_id**

Removes a tag from an event. Only the host may remove tags.

- **Request Body:** None
- **Response:**
  - Success: `{ message }` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found: `{ message }` 404

### Event Announcements

**GET /api/events/:event_id/announcements**

Returns an event's announcements, newest first.

- **Request Body:** None
- **Optional Query Strings:**
  - `?limit=` page size, 1–100 (default 50)
  - `?offset=` pagination offset (default 0)
- **Response:**
  - Success: `[{ announcement_id, event_id, host_id, message, created_at }, ...]` 200
  - Error, Not Found: `{ message }` 404

**POST /api/events/:event_id/announcements**

Posts an announcement to an event. Host only.

- **Request Body:** `{ message }`
  - `message` is required, ≤500 characters.
- **Response:**
  - Success: `{ announcement_id, event_id, host_id, message, created_at }` 201
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found: `{ message }` 404

**DELETE /api/events/:event_id/announcements/:announcement_id**

Deletes an announcement. Host only.

- **Request Body:** None
- **Response:**
  - Success: `{ message }` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found (event, or announcement not on this event): `{ message }` 404

### RSVPs

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

Updates an RSVP. Used by the RSVP owner to cancel/re-confirm (`status`), or by the event host to verify attendance (`did_attend`). Setting `did_attend` to true stamps `checked_in_at` and counts toward the attendee's community standing, same as a QR check-in. Re-confirming `status` back to `"going"` is rejected if the event has already ended.

- **Request Body:** `{ status, did_attend }` (both optional — only included fields are updated)
- **Response:**
  - Success: `{ rsvp_id, user_id, event_id, status, did_attend, created_at, checked_in_at }` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized (not the host or the RSVP owner, or attempting a field you don't have permission to change): `{ message }` 403
  - Error, Event Ended (re-confirming `status` to `"going"` on an ended event): `{ message }` 400
  - Error, Not Found: `{ message }` 404

**DELETE /api/rsvps/:rsvp_id**

Permanently removes an RSVP record. Only the RSVP owner may delete it.

- **Request Body:** None
- **Response:**
  - Success: `{ message }` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found: `{ message }` 404

### Neighborhoods

**GET /api/neighborhoods**

Returns all neighborhoods, optionally filtered by point-in-boundary lookup.

- **Request Body:** None
- **Optional Query Strings:**
  - `?lat=&lng=` returns the neighborhood whose `boundary` contains the given point, falling back to the nearest neighborhood within ~2 miles if none contain it exactly
  - `?city=` filter by city
- **Response:**
  - Success: `[{ neighborhood_id, name, city }, ...]` 200

**GET /api/neighborhoods/:neighborhood_id**

Returns a single neighborhood's details.

- **Request Body:** None
- **Response:**
  - Success: `{ neighborhood_id, name, city }` 200
  - Error, Not Found: `{ message }` 404

### Community Standing

**GET /api/neighborhoods/:neighborhood_id/standings**

Returns the community standing leaderboard for a given neighborhood, ordered by `events_hosted` and `events_attended`.

- **Request Body:** None
- **Optional Query Strings:**
  - `?is_leader=true` filter to leaders only
- **Response:**
  - Success: `[{ standing_id, user_id, username, neighborhood_id, events_hosted, events_attended, is_leader, updated_at }, ...]` 200
  - Error, Not Found: `{ message }` 404

**GET /api/users/:user_id/standings**

Returns a given user's community standing across all neighborhoods they're active in, including a per-neighborhood breakdown of the events they've hosted there.

- **Request Body:** None
- **Response:**
  - Success: `[{ standing_id, user_id, neighborhood_id, neighborhood_name, city, events_hosted, events_attended, is_leader, updated_at, hosted_events: [{ event_id, title, event_date, confirmed_count }, ...] }, ...]` 200

Note: `community_standing` rows are created and updated server-side (incrementing `events_hosted` on event creation and `events_attended` when `did_attend` is set to true on an RSVP — via check-in or host verification — then recalculating `is_leader` against a hosted ≥ 3 or attended ≥ 10 threshold), so there is no public POST/PATCH endpoint for this resource.

### Tags

**GET /api/tags**

Returns the curated (approved) tag vocabulary — used for interests, filters, and the event-tag picker. Pending/emergent tags are excluded until a moderator approves them.

- **Request Body:** None
- **Response:**
  - Success: `[{ tag_id, name }, ...]` 200

**POST /api/tags/suggest**

Returns AI-suggested tags for an in-progress event, reusing an existing tag whenever one reasonably fits. Signed-in users.

- **Request Body:** `{ title, description="", why }`
  - `title` is required; `description` and `why` are optional.
- **Response:**
  - Success: `{ suggestions: [{ name, is_new }, ...] }` — empty list when no Gemini key is configured or the call fails 200
  - Error, Not Authenticated: `{ message }` 401

**GET /api/tags/pending**

Emergent tags awaiting moderation, most-used first. Admin only.

- **Request Body:** None
- **Response:**
  - Success: `[{ tag_id, name, usage_count, created_by_event_id }, ...]` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403

**PATCH /api/tags/:tag_id**

Approves and/or renames an emergent tag. Admin only.

- **Request Body:** `{ name, status }` (both optional)
  - `name` (1–40 chars, normalized to lowercase) renames the tag; `status` is one of `"approved"` \| `"pending"`.
- **Response:**
  - Success: `{ tag_id, name, status, usage_count }` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found: `{ message }` 404
  - Error, Conflict (renaming to a name already in use): `{ message }` 409

**DELETE /api/tags/:tag_id**

Rejects/removes a *pending* tag (cascades to `event_tags`). Admin only. An approved, in-use tag can't be deleted directly — un-approve it first via `PATCH`.

- **Request Body:** None
- **Response:**
  - Success: 204 (no body)
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403
  - Error, Not Found: `{ message }` 404
  - Error, Conflict (tag is not pending): `{ message }` 409

### User Interests

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

### Recommendations

**GET /api/users/:user_id/recommendations**

Returns cached AI-generated event recommendations for a given user. Each recommendation embeds a summary of its event.

- **Request Body:** None
- **Response:**
  - Success: `[{ recommendation_id, user_id, event_id, reason, created_at, event: { event_id, title, event_date, location, status, event_image_url, latitude, longitude } }, ...]` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403

**POST /api/users/:user_id/recommendations/refresh**

Triggers a fresh AI recommendation pass for the user — weighing their interest tags, their free-text profile `intent`, and up to 50 upcoming open events they're not hosting — and overwrites the cached results. Also appends any newly-recommended (user, event) pairs to the permanent `recommendation_log`, for conversion tracking.

- **Request Body:** None
- **Response:**
  - Success: `[{ recommendation_id, user_id, event_id, reason, created_at, event: { event_id, title, event_date, location, status, event_image_url, latitude, longitude } }, ...]` 200 — empty list if no Gemini key is configured or the call fails
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized: `{ message }` 403

### Weekly Prompts

**GET /api/prompts/current**

Returns this week's community prompt, generating one via Gemini (with a deterministic fallback question if no key is configured or the call fails) if this week doesn't have one yet. Every user sees the same question for the week.

- **Request Body:** None
- **Response:**
  - Success: `{ prompt_id, question_text, week_start, has_responded, my_response_id }` 200
  - Error, Not Authenticated: `{ message }` 401

**GET /api/prompts/current/responses**

Other users' answers to the current prompt. Gated on having answered it yourself.

- **Request Body:** None
- **Response:**
  - Success: `[{ username, response_text, updated_at }, ...]` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized (haven't answered yet): `{ message }` 403

**POST /api/prompts/current/responses**

Answers the current week's prompt.

- **Request Body:** `{ response_text }`
  - `response_text` is required, 1–500 chars after trimming whitespace (whitespace-only text is rejected).
- **Response:**
  - Success: `{ response_id, prompt_id, user_id, response_text, created_at, updated_at }` 201
  - Error, Not Authenticated: `{ message }` 401
  - Error, Validation: `{ detail }` 422
  - Error, Conflict (already responded — use `PATCH /api/prompt-responses/:response_id`): `{ message }` 409

**GET /api/prompts**

Past prompts (before the current week), newest first.

- **Request Body:** None
- **Response:**
  - Success: `[{ prompt_id, question_text, week_start }, ...]` 200
  - Error, Not Authenticated: `{ message }` 401

**GET /api/prompts/:prompt_id**

Looks up a single (typically past) prompt, e.g. from tapping it in the list.

- **Request Body:** None
- **Response:**
  - Success: `{ prompt_id, question_text, week_start, has_responded, my_response_id }` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Not Found: `{ message }` 404

**GET /api/prompts/:prompt_id/responses**

Other users' answers to a given prompt. Gated on having answered it yourself.

- **Request Body:** None
- **Response:**
  - Success: `[{ username, response_text, updated_at }, ...]` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized (haven't answered yet): `{ message }` 403
  - Error, Not Found: `{ message }` 404

**PATCH /api/prompt-responses/:response_id**

Edits your own response. Author only. (Mounted at `/api/prompt-responses`, not nested under `/api/prompts`.)

- **Request Body:** `{ response_text }`
  - `response_text` is required, 1–500 chars after trimming whitespace.
- **Response:**
  - Success: `{ response_id, prompt_id, user_id, response_text, created_at, updated_at }` 200
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized (not your response): `{ message }` 403
  - Error, Not Found: `{ message }` 404

### Metrics

**GET /api/metrics/recommendation-conversion**

Admin-only dashboard metric: measures whether the AI matchmaker moves BRANCH's "doors walked through" number. Reports the recommendation → RSVP → check-in funnel, and compares the check-in rate of recommended vs. non-recommended RSVPs.

- **Request Body:** None
- **Response:**
  - Success: `{ funnel: { recommended, rsvped, checked_in, rsvp_rate, checkin_rate }, comparison: { recommended_rsvps, recommended_checkin_rate, other_rsvps, other_checkin_rate } }` 200 (rate fields are `null` when their denominator is 0)
  - Error, Not Authenticated: `{ message }` 401
  - Error, Unauthorized (not an admin): `{ message }` 403

## Core Technologies, 3rd-Party APIs and New Libraries

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
- **Google Gemini API** — powers four AI features: the event matchmaker, the mission guardrail (event moderation), emergent tag suggestion, and weekly icebreaker prompt generation.
  - Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent`
  - Model: `gemini-3.1-flash-lite` (see `backend/app/services/moderation.py`, `recommendations.py`, `tagging.py`, and `prompts.py` — each sets `MODEL = "gemini-3.1-flash-lite"`) — chosen over `2.5-flash` for two reasons: (1) on Google's free tier the Flash-Lite line carries a higher daily request allowance than standard Flash (per AI Studio's published free-tier limits at time of writing; these change periodically, so verify current numbers there), which matters because we're free-tier only; (2) it's a lower-latency model, and none of these four tasks need Flash's extra reasoning depth.
  - Matchmaker: sends the user's interest tags, free-text `intent`, and a list of nearby/upcoming events; the request sets `generationConfig.responseMimeType: "application/json"` so the model returns a structured array of `{ "eventId", "reason" }`. Called from `POST /api/users/:user_id/recommendations/refresh`, with results written to the `recommendations` table (and appended to `recommendation_log`).
  - Mission guardrail: sends an event's title, description, "why", and tags, wrapped as explicitly untrusted data; returns `{ "status", "summary", "reason" }` used to set `events.review_status`/`review_summary`/`review_reason`. Called from `POST /api/events` and, when relevant fields change, `PATCH /api/events/:event_id`. Fails safe: no API key → auto-approved; a key present but a failed/unparseable call → held `'pending'` for a human.
  - Tag suggestion: given an event's text and the existing approved tag vocabulary, returns `[{ "name", "is_new" }]`, preferring reuse of an existing tag. Called from `POST /api/tags/suggest`.
  - Weekly prompt: generates one icebreaker question per calendar week (keyed by `week_start`), with a deterministic fallback question bank used when no key is configured or the call fails. Called from `GET /api/prompts/current`.
  - All four fail closed/safe rather than raising: no key configured is treated the same as "AI unavailable" (moderation approves by default; recommendations/tag-suggestions return empty; prompts use a fallback question).

**Libraries**

- **google-genai (Python SDK)** — wraps all four Gemini call sites on the FastAPI backend via `client.models.generate_content(...)`. (This is Google's current unified SDK; you install it with `pip install google-genai`.)
- **Leaflet / react-leaflet** — renders the interactive event map. Uses `<MapContainer>`, a `<TileLayer>` pointed at OpenStreetMap tiles (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`), and a `<Marker>` per event returned by `GET /api/events?lat=&lng=&radius=`.
- **SQLAlchemy + psycopg** — ORM and driver connecting FastAPI to Postgres; **GeoAlchemy2** lets SQLAlchemy understand the PostGIS `GEOGRAPHY` types (or you can drop to raw SQL for the spatial queries — either is fine).
- **passlib[bcrypt]** — hashes passwords into `users.password_hash` at signup and verifies them at login. Pinned alongside `bcrypt==4.0.1` in `requirements.txt`, since passlib 1.7.4 is incompatible with `bcrypt>=4.1`.
- **itsdangerous** — signs the session cookie for Starlette's `SessionMiddleware`, which backs `request.session["user_id"]` (login/signup/logout, and every `require_user`/`require_admin`-gated route).
- **pydantic-settings** — loads `backend/.env` into the typed `Settings` object (`app/config.py`): `DATABASE_URL`, `SESSION_SECRET`, `GEMINI_API_KEY`, `FRONTEND_ORIGIN`, `SESSION_COOKIE_SECURE`, `ADMIN_EMAILS`.
- **python-multipart** — required by FastAPI to parse the `multipart/form-data` bodies used by the profile picture and event flyer upload endpoints (`UploadFile`).
- **pytest** — the backend test runner (`backend/tests/`); unit tests cover the Gemini-calling services with the API stubbed out, and endpoint tests run inside a rolled-back transaction so they never commit rows.
- **qrcode.react** — renders the host's check-in QR code on-screen from the event's `check_in_code`. Runs entirely client-side; no API or key.
- **html5-qrcode** — lets an attendee scan the host's QR through their device camera; the decoded code is posted to `POST /api/events/:event_id/check-in` to verify attendance. Also fully client-side.
- **react-easy-crop** — lets a user crop their profile picture (and event flyer) client-side before it's uploaded, so the server always receives a pre-cropped image.

**Data Source**

- **Zillow Neighborhood Boundaries** — free neighborhood polygons (CC BY-SA), loaded once into the `neighborhoods.boundary` column. The current deployment seeds the New York state shapefile only (266 neighborhoods, shipped as `backend/sql/neighborhoods_seed.dump`); events outside NY still work but don't map to a neighborhood, so community standing is only tracked for NY events. The shapefile's `Name` and `City` fields populate `neighborhoods.name` and `neighborhoods.city`, imported via `backend/scripts/load_neighborhoods.py`. Attribution ("provided by Zillow") is included per the license. This is a one-time data-loading task, not an API called at runtime.
