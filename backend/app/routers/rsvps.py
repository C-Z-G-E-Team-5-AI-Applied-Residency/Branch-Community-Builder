from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import require_user
from app.database import get_db
from app.models.event import Event
from app.models.rsvp import Rsvp
from app.schemas.rsvp import RsvpUpdate
from app.services import standings

router = APIRouter(prefix="/api/rsvps", tags=["rsvps"])


@router.patch("/{rsvp_id}")
def update_rsvp(rsvp_id: int, body: RsvpUpdate, request: Request, db: Session = Depends(get_db)):
    """Owner cancels/re-confirms (status); host verifies (did_attend). 200 / 401 / 403 / 404."""
    caller_id = require_user(request)
    rsvp = db.get(Rsvp, rsvp_id)
    if rsvp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "RSVP not found")
    event = db.get(Event, rsvp.event_id)

    is_owner = caller_id == rsvp.user_id
    is_host = event is not None and caller_id == event.host_id

    changes = body.model_dump(exclude_unset=True)
    if "status" in changes and not is_owner:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the RSVP owner may change status")
    if "did_attend" in changes and not is_host:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the event host may change did_attend")
    if not is_owner and not is_host:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your RSVP")

    if changes.get("status") == "going" and event is not None:
        event_end = event.event_end_date or event.event_date
        if datetime.now(timezone.utc) > event_end:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This event has already ended")

    newly_attended = changes.get("did_attend") is True and not rsvp.did_attend
    for field, value in changes.items():
        setattr(rsvp, field, value)

    if newly_attended:
        # Host verification counts as a check-in, same as scanning the QR code.
        rsvp.checked_in_at = datetime.now(timezone.utc)
        if event is not None:
            # Attendance counts toward the attendee's standing in the event's neighborhood.
            standings.record_attendance(db, rsvp.user_id, event.latitude, event.longitude)

    db.commit()
    db.refresh(rsvp)
    return {
        "rsvp_id": rsvp.rsvp_id,
        "user_id": rsvp.user_id,
        "event_id": rsvp.event_id,
        "status": rsvp.status,
        "did_attend": rsvp.did_attend,
        "created_at": rsvp.created_at,
        "checked_in_at": rsvp.checked_in_at,
    }


@router.delete("/{rsvp_id}")
def delete_rsvp(rsvp_id: int, request: Request, db: Session = Depends(get_db)):
    """Owner permanently removes an RSVP. 200 / 401 / 403 / 404."""
    caller_id = require_user(request)
    rsvp = db.get(Rsvp, rsvp_id)
    if rsvp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "RSVP not found")
    if rsvp.user_id != caller_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your RSVP")

    db.delete(rsvp)
    db.commit()
    return {"message": "rsvp deleted"}
