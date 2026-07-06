from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.event import EventCreate, EventUpdate

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("")
def list_events(
    zip_code: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius: float = 10,
    status: str | None = None,
    after: str | None = None,
    tag_id: int | None = None,
    db: Session = Depends(get_db),
):
    """List events with optional filters. Uses ST_DWithin on geo for lat/lng/radius. 200."""
    raise NotImplementedError


@router.get("/{event_id}")
def get_event(event_id: int, db: Session = Depends(get_db)):
    """Single event with tags. 200 / 404."""
    raise NotImplementedError


@router.post("", status_code=201)
def create_event(body: EventCreate, request: Request, db: Session = Depends(get_db)):
    """Create an event hosted by the authenticated user. 201 / 400 / 401."""
    raise NotImplementedError


@router.patch("/{event_id}")
def update_event(event_id: int, body: EventUpdate, request: Request, db: Session = Depends(get_db)):
    """Update an event (host only). 200 / 401 / 403 / 404."""
    raise NotImplementedError


@router.delete("/{event_id}")
def delete_event(event_id: int, request: Request, db: Session = Depends(get_db)):
    """Delete an event (host only), cascading to rsvps/event_tags/recommendations. 200 / 401 / 403 / 404."""
    raise NotImplementedError


# --- event tags ---------------------------------------------------------------
@router.get("/{event_id}/tags")
def list_event_tags(event_id: int, db: Session = Depends(get_db)):
    """Tags on an event. 200."""
    raise NotImplementedError


@router.post("/{event_id}/tags", status_code=201)
def add_event_tag(event_id: int, request: Request, db: Session = Depends(get_db)):
    """Attach a tag (host only). 201 / 401 / 403 / 409."""
    raise NotImplementedError


@router.delete("/{event_id}/tags/{tag_id}")
def remove_event_tag(event_id: int, tag_id: int, request: Request, db: Session = Depends(get_db)):
    """Remove a tag (host only). 200 / 401 / 403 / 404."""
    raise NotImplementedError


# --- rsvps nested under events ------------------------------------------------
@router.get("/{event_id}/rsvps")
def list_event_rsvps(
    event_id: int,
    status: str | None = None,
    did_attend: bool | None = None,
    db: Session = Depends(get_db),
):
    """All RSVPs for an event (host view). 200 / 404."""
    raise NotImplementedError


@router.post("/{event_id}/rsvps", status_code=201)
def create_rsvp(event_id: int, request: Request, db: Session = Depends(get_db)):
    """RSVP the authenticated user to an event. 201 / 401 / 404 / 409."""
    raise NotImplementedError


@router.post("/{event_id}/check-in")
def check_in(event_id: int, request: Request, db: Session = Depends(get_db)):
    """Verify attendance via the host's QR code value. 200 / 400 / 401 / 403 / 404 / 409."""
    raise NotImplementedError
