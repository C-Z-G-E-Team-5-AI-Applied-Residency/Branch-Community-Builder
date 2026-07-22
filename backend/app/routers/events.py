import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, UploadFile, status
from sqlalchemy import cast, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from geoalchemy2 import Geography

from app.core.images import MAX_IMAGE_BYTES, is_valid_image
from app.core.security import current_user_id, require_user
from app.database import get_db
from app.models.announcement import Announcement
from app.models.event import Event
from app.models.rsvp import Rsvp
from app.models.tag import EventTag, Tag
from app.models.user import User
from app.schemas.event import AnnouncementCreate, EventCreate, EventUpdate, EventCreate, EventUpdate, FlyerTemplateSelect
from app.schemas.rsvp import CheckInRequest
from app.schemas.tag import TagAdd
from app.services import standings

router = APIRouter(prefix="/api/events", tags=["events"])

# Prebuilt flyer designs a host can pick instead of uploading their own.
# TODO: these paths don't correspond to real assets yet — add the actual
# template images under frontend/public/images/flyer-templates/ before
# wiring this up to a UI.
FLYER_TEMPLATES = {
    "classic": "/images/flyer-templates/classic.svg",
    "bold": "/images/flyer-templates/bold.svg",
    "minimal": "/images/flyer-templates/minimal.svg",
}
# Check-in opens this many hours before the event start (BR-37).
CHECK_IN_OPENS_BEFORE_HOURS = 1


def _tags_by_event(db: Session, event_ids: list[int]) -> dict[int, list[dict]]:
    """One query: {event_id: [{tag_id, name}, ...]} for a batch of events."""
    if not event_ids:
        return {}
    rows = db.execute(
        select(EventTag.event_id, Tag.tag_id, Tag.name)
        .join(Tag, Tag.tag_id == EventTag.tag_id)
        .where(EventTag.event_id.in_(event_ids))
    ).all()
    tags_by_event: dict[int, list[dict]] = {}
    for event_id, tag_id, name in rows:
        tags_by_event.setdefault(event_id, []).append({"tag_id": tag_id, "name": name})
    return tags_by_event


def _serialize_event(event: Event, tags: list[dict], *, include_check_in_code: bool = False) -> dict:
    out = {
        "event_id": event.event_id,
        "title": event.title,
        "event_date": event.event_date,
        "event_end_date": event.event_end_date,
        "location": event.location,
        "event_zip_code": event.event_zip_code,
        "event_description": event.event_description,
        "event_capacity": event.event_capacity,
        "status": event.status,
        "host_id": event.host_id,
        "event_image_url": event.event_image_url,
        "flyer_url": event.flyer_url,
        "latitude": event.latitude,
        "longitude": event.longitude,
        "tags": tags,
        "check_in_opens_before_hours": CHECK_IN_OPENS_BEFORE_HOURS,
    }
    if include_check_in_code:
        out["check_in_code"] = event.check_in_code
    return out


@router.get("")
def list_events(
    zip_code: int | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius: float = 10,
    status: str | None = None,
    after: datetime | None = None,
    tag_id: int | None = None,
    db: Session = Depends(get_db),
):
    """List events with optional filters. Uses ST_DWithin on geo for lat/lng/radius. 200."""
    stmt = select(Event)

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
    tags_by_event = _tags_by_event(db, [e.event_id for e in events])
    return [_serialize_event(e, tags_by_event.get(e.event_id, [])) for e in events]


@router.get("/{event_id}")
def get_event(event_id: int, request: Request, db: Session = Depends(get_db)):
    """Single event with tags. 200 / 404. check_in_code is host-only."""
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    tags_by_event = _tags_by_event(db, [event_id])
    is_host = current_user_id(request) == event.host_id
    return _serialize_event(event, tags_by_event.get(event_id, []), include_check_in_code=is_host)


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
        check_in_code=secrets.token_urlsafe(12),
    )
    db.add(event)
    db.flush()

    db.add_all(EventTag(event_id=event.event_id, tag_id=tag_id) for tag_id in body.tag_ids)

    # Best-effort: record_hosted no-ops when no neighborhood polygon
    # contains this point.
    standings.record_hosted(db, host_id, body.latitude, body.longitude)

    db.commit()
    db.refresh(event)

    tags_by_event = _tags_by_event(db, [event.event_id])
    return _serialize_event(event, tags_by_event.get(event.event_id, []), include_check_in_code=True)


@router.patch("/{event_id}")
def update_event(event_id: int, body: EventUpdate, request: Request, db: Session = Depends(get_db)):
    """Update an event (host only). 200 / 401 / 403 / 404."""
    user_id = require_user(request)
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    if event.host_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the host of this event")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)

    tags_by_event = _tags_by_event(db, [event.event_id])
    return _serialize_event(event, tags_by_event.get(event.event_id, []))


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


# --- event flyer ---------------------------------------------------------------
@router.put("/{event_id}/flyer")
async def upload_event_flyer(event_id: int, file: UploadFile, request: Request, db: Session = Depends(get_db)):
    """Upload a custom flyer (JPEG/PNG/WebP/GIF, ≤2 MB), host only. 200 / 401 / 403 / 404 / 413 / 415."""
    user_id = require_user(request)
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    if event.host_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the host of this event")

    data = await file.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Image must be 2 MB or smaller")
    if not is_valid_image(file.content_type, data):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Use a JPEG, PNG, WebP, or GIF image")

    event.flyer_data = data
    event.flyer_mime = file.content_type
    # content-hash version so browsers can cache the URL forever
    version = hashlib.sha1(data).hexdigest()[:8]
    event.flyer_url = f"/api/events/{event_id}/flyer?v={version}"
    db.commit()
    db.refresh(event)

    tags_by_event = _tags_by_event(db, [event_id])
    return _serialize_event(event, tags_by_event.get(event_id, []), include_check_in_code=True)


@router.get("/{event_id}/flyer")
def get_event_flyer(event_id: int, db: Session = Depends(get_db)):
    """Serve the stored flyer bytes. 200 / 404."""
    event = db.get(Event, event_id)
    if event is None or event.flyer_data is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No flyer uploaded")
    return Response(
        content=event.flyer_data,
        media_type=event.flyer_mime,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.put("/{event_id}/flyer/template")
def select_event_flyer_template(
    event_id: int, body: FlyerTemplateSelect, request: Request, db: Session = Depends(get_db)
):
    """Pick a prebuilt flyer template instead of uploading, host only. 200 / 401 / 403 / 404."""
    user_id = require_user(request)
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    if event.host_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the host of this event")

    template_path = FLYER_TEMPLATES.get(body.template_id)
    if template_path is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown flyer template")

    event.flyer_data = None
    event.flyer_mime = None
    event.flyer_url = template_path
    db.commit()
    db.refresh(event)

    tags_by_event = _tags_by_event(db, [event_id])
    return _serialize_event(event, tags_by_event.get(event_id, []), include_check_in_code=True)


@router.delete("/{event_id}/flyer", status_code=204)
def delete_event_flyer(event_id: int, request: Request, db: Session = Depends(get_db)):
    """Remove the event's flyer, back to event_image_url. 204 / 401 / 403 / 404."""
    user_id = require_user(request)
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    if event.host_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the host of this event")

    event.flyer_data = None
    event.flyer_mime = None
    event.flyer_url = event.event_image_url
    db.commit()


# --- event tags ---------------------------------------------------------------
@router.get("/{event_id}/tags")
def list_event_tags(event_id: int, db: Session = Depends(get_db)):
    """Tags on an event. 200 / 404."""
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    tags_by_event = _tags_by_event(db, [event_id])
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
