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
from geoalchemy2 import Geography, Geometry
from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session

from app.models.community_standing import CommunityStanding
from app.models.neighborhood import Neighborhood

LEADER_HOSTED_THRESHOLD = 3
LEADER_ATTENDED_THRESHOLD = 10

# Zillow's neighborhood polygons have gaps and don't line up with real
# addresses, so a point that's squarely "in" a neighborhood in the everyday
# sense often still misses an exact ST_Contains — e.g. 11226 (Flatbush,
# Brooklyn) geocodes ~1.3km outside the Flatbush polygon. Cap the nearest
# fallback so a point nowhere near any seeded neighborhood (e.g. a ZIP outside
# NY) still comes back empty instead of matching whatever's technically
# closest. Shared with GET /api/neighborhoods, which does the same lookup for
# display — standings must resolve a hosted/attended event to the same
# neighborhood that lookup would show for it.
NEARBY_METERS = 3200  # ~2 miles


def _resolve_neighborhood_id(db: Session, latitude: float, longitude: float) -> int | None:
    point = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
    # boundary is GEOGRAPHY; ST_Contains only exists for geometry, so cast.
    neighborhood_id = db.execute(
        select(Neighborhood.neighborhood_id)
        .where(func.ST_Contains(cast(Neighborhood.boundary, Geometry), point))
        .limit(1)
    ).scalar_one_or_none()
    if neighborhood_id is not None:
        return neighborhood_id

    # ST_DWithin (not ST_Distance <= NEARBY_METERS) so this can use the GiST
    # index on boundary instead of computing exact polygon distance for every
    # row; ST_Distance still does the final ordering, same as list_events.
    point_geog = cast(point, Geography)
    distance = func.ST_Distance(Neighborhood.boundary, point_geog)
    return db.execute(
        select(Neighborhood.neighborhood_id)
        .where(func.ST_DWithin(Neighborhood.boundary, point_geog, NEARBY_METERS))
        .order_by(distance)
        .limit(1)
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
    # Points outside every neighborhood polygon are a silent no-op: the event
    # still exists, it just doesn't count toward any neighborhood standing.
    neighborhood_id = _resolve_neighborhood_id(db, latitude, longitude)
    if neighborhood_id is None:
        return

    standing = _get_or_create_standing(db, user_id, neighborhood_id)
    standing.events_hosted += 1
    db.flush()

    recompute_leader(db, user_id, neighborhood_id)
    # No db.commit() here — caller's endpoint owns the transaction boundary.


def record_attendance(db: Session, user_id: int, latitude: float, longitude: float) -> None:
    # Callers (check_in, update_rsvp) pass the EVENT's latitude/longitude,
    # not the attendee's current location.
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
