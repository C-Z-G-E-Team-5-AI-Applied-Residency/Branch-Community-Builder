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
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.community_standing import CommunityStanding
from app.models.neighborhood import Neighborhood

# TODO(team): confirm these thresholds before merging — placeholder from the ticket
LEADER_HOSTED_THRESHOLD = 3
LEADER_ATTENDED_THRESHOLD = 10


def _resolve_neighborhood_id(db: Session, latitude: float, longitude: float) -> int | None:
    point = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
    return db.execute(
        select(Neighborhood.neighborhood_id).where(
            func.ST_Contains(Neighborhood.boundary, point)
        )
    ).scalar_one_or_none()


def _get_or_create_standing(
    db: Session, user_id: int, neighborhood_id: int
) -> CommunityStanding:
    standing = db.execute(
        select(CommunityStanding).where(
            CommunityStanding.user_id == user_id,
            CommunityStanding.neighborhood_id == neighborhood_id,
        )
    ).scalar_one_or_none()

    if standing is None:
        standing = CommunityStanding(user_id=user_id, neighborhood_id=neighborhood_id)
        db.add(standing)
        db.flush()

    return standing


def record_hosted(db: Session, user_id: int, latitude: float, longitude: float) -> None:
    # TODO(Gabriel, BR-3): decide what create_event should do if this point falls
    # outside every neighborhood — reject earlier in validation, or is a silent
    # no-operation here fine?
    neighborhood_id = _resolve_neighborhood_id(db, latitude, longitude)
    if neighborhood_id is None:
        return

    standing = _get_or_create_standing(db, user_id, neighborhood_id)
    standing.events_hosted += 1
    db.flush()

    recompute_leader(db, user_id, neighborhood_id)
    # No db.commit() here — caller's endpoint owns the transaction boundary.

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
    # TODO(Emily, BR-8/BR-9): check_in/update_rsvp need to pass the event's own
    # latitude/longitude here (not the user's current location) — confirm signature.
    neighborhood_id = _resolve_neighborhood_id(db, latitude, longitude)
    if neighborhood_id is None:
        return

    standing = _get_or_create_standing(db, user_id, neighborhood_id)
    standing.events_attended += 1
    db.flush()

    recompute_leader(db, user_id, neighborhood_id)
    # No db.commit() here — caller's endpoint owns the transaction boundary.


def recompute_leader(db: Session, user_id: int, neighborhood_id: int) -> None:
    standing = db.execute(
        select(CommunityStanding).where(
            CommunityStanding.user_id == user_id,
            CommunityStanding.neighborhood_id == neighborhood_id,
        )
    ).scalar_one()

    standing.is_leader = (
        standing.events_hosted >= LEADER_HOSTED_THRESHOLD
        or standing.events_attended >= LEADER_ATTENDED_THRESHOLD
    )
