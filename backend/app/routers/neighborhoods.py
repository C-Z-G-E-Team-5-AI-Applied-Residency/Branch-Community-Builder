from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.database import get_db
from app.models.neighborhood import Neighborhood

router = APIRouter(prefix="/api/neighborhoods", tags=["neighborhoods"])

@router.get("")
def list_neighborhoods(
    lat: float | None = None,
    lng: float | None = None,
    city: str | None = None,
    db: Session = Depends(get_db),
):
    """All neighborhoods; ?lat&lng does a point-in-boundary lookup via ST_Contains. 200."""
    query = select(Neighborhood)
    if city is not None:
        query = query.where(Neighborhood.city == city)
    if lat is not None and lng is not None:
        point = func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326)
        query = query.where(func.ST_Contains(Neighborhood.boundary, point))
    neighborhoods = db.execute(query).scalars().all()
    return neighborhoods


@router.get("/{neighborhood_id}")
def get_neighborhood(neighborhood_id: int, db: Session = Depends(get_db)):
    """Single neighborhood. 200 / 404."""
    neighborhood = db.get(Neighborhood, neighborhood_id)
    if neighborhood is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Neighborhood not found")
    return neighborhood


@router.get("/{neighborhood_id}/standings")
def get_neighborhood_standings(
    neighborhood_id: int, is_leader: bool | None = None, db: Session = Depends(get_db)
):
    """Leaderboard ordered by events_hosted, events_attended. 200 / 404."""
    raise NotImplementedError
