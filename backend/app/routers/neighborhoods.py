from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter(prefix="/api/neighborhoods", tags=["neighborhoods"])


@router.get("")
def list_neighborhoods(
    lat: float | None = None,
    lng: float | None = None,
    city: str | None = None,
    db: Session = Depends(get_db),
):
    """All neighborhoods; ?lat&lng does a point-in-boundary lookup via ST_Contains. 200."""
    raise NotImplementedError


@router.get("/{neighborhood_id}")
def get_neighborhood(neighborhood_id: int, db: Session = Depends(get_db)):
    """Single neighborhood. 200 / 404."""
    raise NotImplementedError


@router.get("/{neighborhood_id}/standings")
def get_neighborhood_standings(
    neighborhood_id: int, is_leader: bool | None = None, db: Session = Depends(get_db)
):
    """Leaderboard ordered by events_hosted, events_attended. 200 / 404."""
    raise NotImplementedError
