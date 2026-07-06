from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.rsvp import RsvpUpdate

router = APIRouter(prefix="/api/rsvps", tags=["rsvps"])


@router.patch("/{rsvp_id}")
def update_rsvp(rsvp_id: int, body: RsvpUpdate, request: Request, db: Session = Depends(get_db)):
    """Owner cancels/re-confirms (status); host verifies (did_attend). 200 / 401 / 403 / 404."""
    raise NotImplementedError


@router.delete("/{rsvp_id}")
def delete_rsvp(rsvp_id: int, request: Request, db: Session = Depends(get_db)):
    """Owner permanently removes an RSVP. 200 / 401 / 403 / 404."""
    raise NotImplementedError
