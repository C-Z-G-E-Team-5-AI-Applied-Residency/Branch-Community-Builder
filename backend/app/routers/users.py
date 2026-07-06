from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Public user info. 200 / 404."""
    raise NotImplementedError


@router.get("/{user_id}/rsvps")
def get_user_rsvps(user_id: int, db: Session = Depends(get_db)):
    """All RSVPs (and therefore events) for a user. 200."""
    raise NotImplementedError


@router.get("/{user_id}/interests")
def get_user_interests(user_id: int, db: Session = Depends(get_db)):
    """Interest tags for a user. 200."""
    raise NotImplementedError


@router.post("/{user_id}/interests", status_code=201)
def add_user_interest(user_id: int, db: Session = Depends(get_db)):
    """Add an interest tag. 201 / 401 / 403 / 409."""
    raise NotImplementedError


@router.delete("/{user_id}/interests/{tag_id}")
def remove_user_interest(user_id: int, tag_id: int, db: Session = Depends(get_db)):
    """Remove an interest tag. 200 / 401 / 403 / 404."""
    raise NotImplementedError


@router.get("/{user_id}/standings")
def get_user_standings(user_id: int, db: Session = Depends(get_db)):
    """Community standing across all neighborhoods. 200."""
    raise NotImplementedError


@router.get("/{user_id}/recommendations")
def get_user_recommendations(user_id: int, db: Session = Depends(get_db)):
    """Cached AI recommendations. 200 / 401 / 403."""
    raise NotImplementedError


@router.post("/{user_id}/recommendations/refresh")
def refresh_user_recommendations(user_id: int, db: Session = Depends(get_db)):
    """Trigger a fresh Gemini recommendation pass and overwrite cache. 200 / 401 / 403."""
    raise NotImplementedError
