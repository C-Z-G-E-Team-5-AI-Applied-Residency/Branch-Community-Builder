from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from geoalchemy2 import Geometry
from app.database import get_db
from app.models.community_standing import CommunityStanding
from app.models.neighborhood import Neighborhood
from app.models.user import User
from app.schemas.neighborhood import NeighborhoodOut

router = APIRouter(prefix="/api/neighborhoods", tags=["neighborhoods"])

@router.get("", response_model=list[NeighborhoodOut])
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
        query = query.where(func.ST_Contains(func.cast(Neighborhood.boundary, Geometry), point))
    neighborhoods = db.execute(query).scalars().all()
    return neighborhoods


@router.get("/{neighborhood_id}", response_model=NeighborhoodOut)
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
    if db.get(Neighborhood, neighborhood_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Neighborhood not found")

    stmt = (
        select(CommunityStanding, User.username)
        .join(User, User.user_id == CommunityStanding.user_id)
        .where(CommunityStanding.neighborhood_id == neighborhood_id)
        .order_by(CommunityStanding.events_hosted.desc(), CommunityStanding.events_attended.desc())
    )
    if is_leader is not None:
        stmt = stmt.where(CommunityStanding.is_leader == is_leader)

    rows = db.execute(stmt).all()
    return [
        {
            "standing_id": s.standing_id,
            "user_id": s.user_id,
            "username": username,
            "neighborhood_id": s.neighborhood_id,
            "events_hosted": s.events_hosted,
            "events_attended": s.events_attended,
            "is_leader": s.is_leader,
            "updated_at": s.updated_at,
        }
        for s, username in rows
    ]
