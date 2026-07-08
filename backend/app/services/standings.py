"""Community standing logic — the leader system.

community_standing has no public write endpoints; these functions are the ONLY
place standings change. Call them from:

  - POST /api/events            -> record_hosted(db, host_id, latitude, longitude)
  - check-in / RSVP verification -> record_attendance(db, user_id, latitude, longitude)

Each function should:
  1. Resolve the event's neighborhood via ST_Contains(boundary, point)
  2. Upsert the (user, neighborhood) standing row and increment the counter
  3. Recompute is_leader (threshold TBD as a team — e.g. hosted >= 3 or attended >= 10)
"""
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.neighborhood import Neighborhood
from app.models.community_standing import CommunityStanding
from geoalchemy2 import Geometry


def record_hosted(db: Session, user_id: int, latitude: float, longitude: float) -> None:
  point = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
  neighborhood = (
      db.query(Neighborhood)
      .filter(func.ST_Contains(func.cast(Neighborhood.boundary, Geometry), point))
      .first()
  )
  if neighborhood is None:
    return
  standing = (
    db.query(CommunityStanding)
    .filter_by(user_id=user_id, neighborhood_id=neighborhood.neighborhood_id)
    .first()
  )
  if standing is None:
    standing = CommunityStanding(
      user_id=user_id,
      neighborhood_id=neighborhood.neighborhood_id,
      events_hosted=1,
      )
    db.add(standing)
  else:
    standing.events_hosted += 1
  db.flush()
  recompute_leader(db, user_id, neighborhood.neighborhood_id)

def record_attendance(db: Session, user_id: int, latitude: float, longitude: float) -> None:
  point = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)

  neighborhood = (
    db.query(Neighborhood)
    .filter(func.ST_Contains(func.cast(Neighborhood.boundary, Geometry), point))
    .first()
  )
  if neighborhood is None:
    return
  
  standing = (
    db.query(CommunityStanding)
    .filter_by(user_id=user_id, neighborhood_id=neighborhood.neighborhood_id)
    .first()
  )

  if standing is None:
    standing = CommunityStanding(
      user_id=user_id,
      neighborhood_id=neighborhood.neighborhood_id,
      events_attended=1,
    )
    db.add(standing)
  else:
    standing.events_attended += 1
  db.flush()
  recompute_leader(db, user_id, neighborhood.neighborhood_id)


def recompute_leader(db: Session, user_id: int, neighborhood_id: int) -> None:
  standing = (
    db.query(CommunityStanding)
    .filter_by(user_id=user_id, neighborhood_id=neighborhood_id)
    .first()
  )

  if standing is None:
    return

  standing.is_leader = standing.events_hosted >= 3 or standing.events_attended >= 10 # Placeholder numbers, fix with team

  db.flush()