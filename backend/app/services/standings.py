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


def record_hosted(db: Session, user_id: int, latitude: float, longitude: float) -> None:
    raise NotImplementedError


def record_attendance(db: Session, user_id: int, latitude: float, longitude: float) -> None:
    raise NotImplementedError


def recompute_leader(db: Session, user_id: int, neighborhood_id: int) -> None:
    raise NotImplementedError
