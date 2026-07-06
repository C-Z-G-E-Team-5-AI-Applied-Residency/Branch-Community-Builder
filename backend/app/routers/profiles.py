from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.profile import ProfileCreate, ProfileUpdate

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


@router.get("/{user_id}")
def get_profile(user_id: int, db: Session = Depends(get_db)):
    """Profile + interest tags for a user. 200 / 404."""
    raise NotImplementedError


@router.post("", status_code=201)
def create_profile(body: ProfileCreate, request: Request, db: Session = Depends(get_db)):
    """Create the authenticated user's profile. 201 / 401 / 409."""
    raise NotImplementedError


@router.patch("/{user_id}")
def update_profile(user_id: int, body: ProfileUpdate, request: Request, db: Session = Depends(get_db)):
    """Update own profile. 200 / 401 / 403 / 404."""
    raise NotImplementedError
