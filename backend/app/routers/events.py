import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import cast, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from geoalchemy2 import Geography

from app.core.security import current_user_id, is_admin_email, require_admin, require_user
from app.database import get_db
from app.models.announcement import Announcement
from app.models.event import Event
from app.models.rsvp import Rsvp
from app.models.tag import EventTag, Tag
from app.models.user import User
from app.schemas.event import AnnouncementCreate, EventCreate, EventReview, EventUpdate
from app.schemas.rsvp import CheckInRequest
from app.schemas.tag import TagAdd
from app.services import standings
from app.services.moderation import review_event

router = APIRouter(prefix="/api/events", tags=["events"])

# Check-in opens this many hours before the event start (BR-37).
CHECK_IN_OPENS_BEFORE_HOURS = 1


def _viewer_is_admin(db: Session, viewer_id: int | None) -> bool:
    if viewer_id is None:
        return False
    user = db.get(User, viewer_id)
    return bool(user and is_admin_email(user.email))


def _tags_by_event(
    db: Session, event_ids: list[int], *, viewer_id: int | None = None, viewer_is_admin: bool = False
) -> dict[int, list[dict]]:
    """One query: {event_id: [{tag_id, name}, ...]} for a batch of events.

    Emergent tags start 'pending' and must not enter the public vocabulary until a
    moderator approves them — so a pending tag is only included for the event's own
    host or an admin. Everyone else sees the approved tags on the event."""
    if not event_ids:
        return {}
    rows = db.execute(
        select(EventTag.event_id, Tag.tag_id, Tag.name, Tag.status, Event.host_id)
        .join(Tag, Tag.tag_id == EventTag.tag_id)
        .join(Event, Event.event_id == EventTag.event_id)
        .where(EventTag.event_id.in_(event_ids))
    ).all()
    tags_by_event: dict[int, list[dict]] = {}
    for event_id, tag_id, name, tag_status, host_id in rows:
        if tag_status == "approved" or viewer_is_admin or (viewer_id is not None and viewer_id == host_id):
            tags_by_event.setdefault(event_id, []).append({"tag_id": tag_id, "name": name})
    return tags_by_event


def _serialize_event(
    event: Event, tags: list[dict], *, include_check_in_code: bool = False, include_review: bool = False
) -> dict:
    out = {
        "event_id": event.event_id,
        "title": event.title,
        "event_date": event.event_date,
        "event_end_date": event.event_end_date,
        "location": event.location,
        "event_zip_code": event.event_zip_code,
        "event_description": event.event_description,
        "event_capacity": event.event_capacity,
        "why": event.why,
        "status": event.status,
        # review_status is a harmless state flag; the AI summary/reason are moderator-
        # facing (and may echo user text), so only expose them to the host/admin.
        "review_status": event.review_status,
        "host_id": event.host_id,
        "event_image_url": event.event_image_url,
        "latitude": event.latitude,
        "longitude": event.longitude,
        "tags": tags,
        "check_in_opens_before_hours": CHECK_IN_OPENS_BEFORE_HOURS,
    }
    if include_review:
        out["review_summary"] = event.review_summary
        out["review_reason"] = event.review_reason
    if include_check_in_code:
        out["check_in_code"] = event.check_in_code
    return out


@router.get("")
def list_events(
    request: Request,
    zip_code: int | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius: float = 10,
    status: str | None = None,
    after: datetime | None = None,
    tag_id: int | None = None,
    db: Session = Depends(get_db),
):
    """List events with optional filters. Uses ST_DWithin on geo for lat/lng/radius. 200.
    Events held/rejected by the mission guardrail are hidden from everyone but their host."""
    stmt = select(Event)

    # Guardrail visibility: only approved events are public; a host still sees their own
    # held/rejected events (so the "under review" state is visible to them).
    viewer_id = current_user_id(request)
    if viewer_id is not None:
        stmt = stmt.where((Event.review_status == "approved") | (Event.host_id == viewer_id))
    else:
        stmt = stmt.where(Event.review_status == "approved")

    if zip_code is not None:
        stmt = stmt.where(Event.event_zip_code == zip_code)
    if status is not None:
        stmt = stmt.where(Event.status == status)
    if after is not None:
        stmt = stmt.where(Event.event_date >= after)
    if tag_id is not None:
        stmt = stmt.join(EventTag, EventTag.event_id == Event.event_id).where(EventTag.tag_id == tag_id)
    if lat is not None and lng is not None:
        point = cast(func.ST_MakePoint(lng, lat), Geography)
        stmt = stmt.where(func.ST_DWithin(Event.geo, point, radius * 1609.34))

    events = db.execute(stmt).scalars().all()
    # Pending tags on an event show only to that event's host; the wider public
    # listing sees approved tags only.
    tags_by_event = _tags_by_event(db, [e.event_id for e in events], viewer_id=viewer_id)
    return [_serialize_event(e, tags_by_event.get(e.event_id, [])) for e in events]


@router.get("/pending-review")
def list_pending_review(admin_id: int = Depends(require_admin), db: Session = Depends(get_db)):
    """Moderation queue: events held by the guardrail, awaiting an approve/reject. Admin only.
    Declared before /{event_id} so the literal path wins over the dynamic one."""
    events = db.execute(
        select(Event).where(Event.review_status == "pending").order_by(Event.created_at)
    ).scalars().all()
    tags_by_event = _tags_by_event(db, [e.event_id for e in events], viewer_is_admin=True)
    return [_serialize_event(e, tags_by_event.get(e.event_id, []), include_review=True) for e in events]


@router.get("/{event_id}")
def get_event(event_id: int, request: Request, db: Session = Depends(get_db)):
    """Single event with tags. 200 / 404. check_in_code is host-only.
    Non-approved events are visible only to their host or an admin (else 404)."""
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    viewer_id = current_user_id(request)
    is_host = viewer_id == event.host_id
    # Admin status is needed both to reveal a held event and to show its pending tags,
    # so resolve it for any signed-in non-host viewer (anon + host skip the lookup;
    # this is a single-event detail view, not the batch listing).
    is_admin = _viewer_is_admin(db, viewer_id) if (viewer_id is not None and not is_host) else False
    if event.review_status != "approved" and not (is_host or is_admin):
        # Don't reveal existence of held/rejected events to other users.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    tags_by_event = _tags_by_event(db, [event_id], viewer_id=viewer_id, viewer_is_admin=is_admin)
    return _serialize_event(
        event, tags_by_event.get(event_id, []), include_check_in_code=is_host, include_review=is_host or is_admin
    )


@router.patch("/{event_id}/review")
def review_event_decision(
    event_id: int,
    body: EventReview,
    admin_id: int = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Approve or reject an event. Admin only. 200 / 403 / 404.

    Deliberately accepts any current status (not just 'pending'): a moderator can also
    take down a previously-approved event or restore a rejected one — an explicit admin
    override. Content edits re-run the guardrail separately (see update_event)."""
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    event.review_status = "approved" if body.decision == "approve" else "rejected"
    if body.note:
        # Keep the AI's original reason, append the human note.
        prefix = f"{event.review_reason}\n" if event.review_reason else ""
        event.review_reason = f"{prefix}[moderator] {body.note}"
    db.commit()
    db.refresh(event)
    tags_by_event = _tags_by_event(db, [event_id], viewer_is_admin=True)
    return _serialize_event(event, tags_by_event.get(event_id, []), include_review=True)


@router.post("", status_code=201)
def create_event(body: EventCreate, request: Request, db: Session = Depends(get_db)):
    """Create an event hosted by the authenticated user. 201 / 400 / 401."""
    host_id = require_user(request)

    event = Event(
        title=body.title,
        event_date=body.event_date,
        event_end_date=body.event_end_date,
        location=body.location,
        event_zip_code=body.event_zip_code,
        event_description=body.event_description,
        event_capacity=body.event_capacity,
        status=body.status,
        host_id=host_id,
        event_image_url=body.event_image_url,
        latitude=body.latitude,
        longitude=body.longitude,
        why=body.why,
        check_in_code=secrets.token_urlsafe(12),
    )

    # Resolve tags (emergent vocabulary). Existing tags are reused; free-text names
    # that don't exist yet are minted as 'pending' for a moderator to approve later.
    tags_to_attach: dict[int, Tag] = {}
    if body.tag_ids:
        rows = db.execute(select(Tag).where(Tag.tag_id.in_(set(body.tag_ids)))).scalars().all()
        missing = set(body.tag_ids) - {t.tag_id for t in rows}
        if missing:
            # Previously this relied on the FK and raised a 500 IntegrityError.
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown tag_ids: {sorted(missing)}")
        tags_to_attach.update({t.tag_id: t for t in rows})

    new_names: list[str] = []
    for name in dict.fromkeys(n.strip().lower() for n in body.tag_names if n.strip()):
        existing = db.execute(select(Tag).where(func.lower(Tag.name) == name)).scalar_one_or_none()
        if existing is not None:
            tags_to_attach[existing.tag_id] = existing
        else:
            new_names.append(name)

    # Mission guardrail: off-mission events are held ('pending') for a human to
    # review rather than rejected outright. Runs one Gemini call; no key -> approved.
    guardrail_tags = [t.name for t in tags_to_attach.values()] + new_names
    verdict = review_event(body.title, body.event_description, body.why, guardrail_tags)
    event.review_status = verdict["status"]
    event.review_summary = verdict["summary"]
    event.review_reason = verdict["reason"]

    db.add(event)
    db.flush()

    # Mint new pending tags now that the event has an id (for provenance). The
    # savepoint handles the mint-race: if a concurrent request created the same
    # name between our earlier lookup and this insert, reuse theirs instead of 500ing.
    for name in new_names:
        try:
            with db.begin_nested():
                tag = Tag(name=name, status="pending", created_by_event_id=event.event_id)
                db.add(tag)
                db.flush()
        except IntegrityError:
            tag = db.execute(select(Tag).where(func.lower(Tag.name) == name)).scalar_one()
        tags_to_attach[tag.tag_id] = tag

    for tag in tags_to_attach.values():
        db.add(EventTag(event_id=event.event_id, tag_id=tag.tag_id))
        tag.usage_count = (tag.usage_count or 0) + 1

    # Best-effort: record_hosted no-ops when no neighborhood polygon
    # contains this point.
    standings.record_hosted(db, host_id, body.latitude, body.longitude)

    db.commit()
    db.refresh(event)

    tags_by_event = _tags_by_event(db, [event.event_id], viewer_id=event.host_id)
    return _serialize_event(
        event, tags_by_event.get(event.event_id, []), include_check_in_code=True, include_review=True
    )


@router.patch("/{event_id}")
def update_event(event_id: int, body: EventUpdate, request: Request, db: Session = Depends(get_db)):
    """Update an event (host only). 200 / 401 / 403 / 404."""
    user_id = require_user(request)
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    if event.host_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the host of this event")

    changed = body.model_dump(exclude_unset=True)
    for field, value in changed.items():
        setattr(event, field, value)

    # Edit-time guardrail: a host could get an innocuous event approved and then
    # edit it into off-mission content. So if any field the guardrail judges
    # changed, re-run it and reset the review state on the *new* content.
    if {"title", "event_description", "why"} & changed.keys():
        tag_names = list(
            db.execute(
                select(Tag.name).join(EventTag, EventTag.tag_id == Tag.tag_id).where(EventTag.event_id == event.event_id)
            ).scalars().all()
        )
        verdict = review_event(event.title, event.event_description, event.why, tag_names)
        event.review_status = verdict["status"]
        event.review_summary = verdict["summary"]
        event.review_reason = verdict["reason"]

    db.commit()
    db.refresh(event)

    tags_by_event = _tags_by_event(db, [event.event_id], viewer_id=event.host_id)
    return _serialize_event(event, tags_by_event.get(event.event_id, []), include_review=True)


@router.delete("/{event_id}")
def delete_event(event_id: int, request: Request, db: Session = Depends(get_db)):
    """Delete an event (host only), cascading to rsvps/event_tags/recommendations. 200 / 401 / 403 / 404."""
    user_id = require_user(request)
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    if event.host_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the host of this event")

    db.delete(event)
    db.commit()
    return {"message": "event deleted"}


# --- event tags ---------------------------------------------------------------
@router.get("/{event_id}/tags")
def list_event_tags(event_id: int, request: Request, db: Session = Depends(get_db)):
    """Tags on an event. 200 / 404. Pending tags show only to the host/an admin."""
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    viewer_id = current_user_id(request)
    is_admin = viewer_id != event.host_id and _viewer_is_admin(db, viewer_id)
    tags_by_event = _tags_by_event(db, [event_id], viewer_id=viewer_id, viewer_is_admin=is_admin)
    return tags_by_event.get(event_id, [])


@router.post("/{event_id}/tags", status_code=201)
def add_event_tag(event_id: int, body: TagAdd, request: Request, db: Session = Depends(get_db)):
    """Attach a tag (host only). 201 / 401 / 403 / 404 / 409."""
    user_id = require_user(request)
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    if event.host_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the host of this event")

    tag = db.get(Tag, body.tag_id)
    if tag is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tag not found")

    existing = db.execute(
        select(EventTag).where(EventTag.event_id == event_id, EventTag.tag_id == body.tag_id)
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Tag already attached to this event")

    db.add(EventTag(event_id=event_id, tag_id=body.tag_id))
    db.commit()
    return {"tag_id": tag.tag_id, "name": tag.name}


@router.delete("/{event_id}/tags/{tag_id}")
def remove_event_tag(event_id: int, tag_id: int, request: Request, db: Session = Depends(get_db)):
    """Remove a tag (host only). 200 / 401 / 403 / 404."""
    user_id = require_user(request)
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    if event.host_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the host of this event")

    event_tag = db.execute(
        select(EventTag).where(EventTag.event_id == event_id, EventTag.tag_id == tag_id)
    ).scalar_one_or_none()
    if event_tag is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tag not attached to this event")

    db.delete(event_tag)
    db.commit()
    return {"message": "tag removed"}


# --- rsvps nested under events ------------------------------------------------
def _serialize_rsvp(rsvp: Rsvp, username: str | None = None) -> dict:
    out = {
        "rsvp_id": rsvp.rsvp_id,
        "user_id": rsvp.user_id,
        "event_id": rsvp.event_id,
        "status": rsvp.status,
        "did_attend": rsvp.did_attend,
        "created_at": rsvp.created_at,
        "checked_in_at": rsvp.checked_in_at,
    }
    if username is not None:
        out["username"] = username
    return out


@router.get("/{event_id}/rsvps")
def list_event_rsvps(
    event_id: int,
    status_filter: str | None = Query(default=None, alias="status"),
    did_attend: bool | None = None,
    db: Session = Depends(get_db),
):
    """All RSVPs for an event (host view). 200 / 404."""
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    stmt = (
        select(Rsvp, User.username)
        .join(User, User.user_id == Rsvp.user_id)
        .where(Rsvp.event_id == event_id)
    )
    if status_filter is not None:
        stmt = stmt.where(Rsvp.status == status_filter)
    if did_attend is not None:
        stmt = stmt.where(Rsvp.did_attend == did_attend)

    rows = db.execute(stmt).all()
    return [_serialize_rsvp(rsvp, username) for rsvp, username in rows]


@router.post("/{event_id}/rsvps", status_code=201)
def create_rsvp(event_id: int, request: Request, db: Session = Depends(get_db)):
    """RSVP the authenticated user to an event. 201 / 401 / 404 / 409."""
    user_id = require_user(request)
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    event_end = event.event_end_date or event.event_date
    if datetime.now(timezone.utc) > event_end:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This event has already ended")

    existing = db.execute(
        select(Rsvp).where(Rsvp.user_id == user_id, Rsvp.event_id == event_id)
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already RSVP'd to this event")

    rsvp = Rsvp(user_id=user_id, event_id=event_id, status="going")
    db.add(rsvp)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Already RSVP'd to this event")
    db.refresh(rsvp)
    return _serialize_rsvp(rsvp)


@router.post("/{event_id}/check-in")
def check_in(event_id: int, body: CheckInRequest, request: Request, db: Session = Depends(get_db)):
    """Verify attendance via the host's QR code value. 200 / 400 / 401 / 403 / 404 / 409."""
    user_id = require_user(request)
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    if not event.check_in_code or not secrets.compare_digest(body.code, event.check_in_code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid check-in code")

    now = datetime.now(timezone.utc)
    if now < event.event_date - timedelta(hours=CHECK_IN_OPENS_BEFORE_HOURS):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Check-in is not open yet")

    rsvp = db.execute(
        select(Rsvp).where(Rsvp.user_id == user_id, Rsvp.event_id == event_id)
    ).scalar_one_or_none()
    if rsvp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No RSVP for this event")
    if rsvp.did_attend:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already checked in")

    rsvp.did_attend = True
    rsvp.checked_in_at = now
    standings.record_attendance(db, user_id, event.latitude, event.longitude)
    db.commit()
    db.refresh(rsvp)
    return _serialize_rsvp(rsvp)


# --- announcements ------------------------------------------------
def _serialize_announcement(announcement: Announcement) -> dict:
    return {
        "announcement_id": announcement.announcement_id,
        "event_id": announcement.event_id,
        "host_id": announcement.host_id,
        "message": announcement.message,
        "created_at": announcement.created_at,
    }

@router.get("/{event_id}/announcements")
def list_event_announcements(
    event_id: int,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """All announcements for an event, newest-first. 200 / 404."""
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    announcements = db.execute(
        select(Announcement)
        .where(Announcement.event_id == event_id)
        .order_by(Announcement.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()
    return [_serialize_announcement(a) for a in announcements]


@router.post("/{event_id}/announcements", status_code=201)
def create_event_announcement(
    event_id: int, body: AnnouncementCreate, request: Request, db: Session = Depends(get_db)
):
    """Post an announcement to an event (host only). 201 / 401 / 403 / 404."""
    user_id = require_user(request)
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    if event.host_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the host of this event")

    announcement = Announcement(event_id=event_id, host_id=user_id, message=body.message)
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return _serialize_announcement(announcement)


@router.delete("/{event_id}/announcements/{announcement_id}")
def delete_event_announcement(
    event_id: int, announcement_id: int, request: Request, db: Session = Depends(get_db)
):
    """Delete an announcement (host only). 200 / 401 / 403 / 404."""
    user_id = require_user(request)
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    if event.host_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the host of this event")

    announcement = db.execute(
        select(Announcement).where(
            Announcement.announcement_id == announcement_id, Announcement.event_id == event_id
        )
    ).scalar_one_or_none()
    if announcement is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Announcement not found on this event")

    db.delete(announcement)
    db.commit()
    return {"message": "announcement deleted"}
