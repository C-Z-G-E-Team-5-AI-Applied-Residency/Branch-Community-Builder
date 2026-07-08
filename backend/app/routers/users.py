from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import require_user
from app.database import get_db
from app.models.community_standing import CommunityStanding
from app.models.event import Event
from app.models.neighborhood import Neighborhood
from app.models.recommendation import Recommendation
from app.models.rsvp import Rsvp
from app.models.tag import EventTag, Tag, UserInterest
from app.models.user import User
from app.schemas.tag import InterestCreate
from app.schemas.user import UserOut
from app.services.recommendations import generate_recommendations

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Public user info. 200 / 404."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


@router.get("/{user_id}/rsvps")
def get_user_rsvps(user_id: int, db: Session = Depends(get_db)):
    """All RSVPs (and therefore events) for a user. 200."""
    rows = db.execute(
        select(Rsvp, Event)
        .join(Event, Event.event_id == Rsvp.event_id)
        .where(Rsvp.user_id == user_id)
        .order_by(Event.event_date)
    ).all()
    return [
        {
            "rsvp_id": rsvp.rsvp_id,
            "user_id": rsvp.user_id,
            "event_id": rsvp.event_id,
            "status": rsvp.status,
            "did_attend": rsvp.did_attend,
            "created_at": rsvp.created_at,
            "checked_in_at": rsvp.checked_in_at,
            "event": {
                "event_id": event.event_id,
                "title": event.title,
                "event_date": event.event_date,
                "location": event.location,
                "status": event.status,
                "event_image_url": event.event_image_url,
            },
        }
        for rsvp, event in rows
    ]


@router.get("/{user_id}/interests")
def get_user_interests(user_id: int, db: Session = Depends(get_db)):
    """Interest tags for a user. 200."""
    tags = db.execute(
        select(Tag)
        .join(UserInterest, UserInterest.tag_id == Tag.tag_id)
        .where(UserInterest.user_id == user_id)
    ).scalars().all()
    return tags


@router.post("/{user_id}/interests", status_code=201)
def add_user_interest(
    user_id: int,
    body: InterestCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Add an interest tag. 201 / 401 / 403 / 409."""
    if require_user(request) != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot edit another user's interests")

    existing = db.get(UserInterest, {"user_id": user_id, "tag_id": body.tag_id})
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Interest already added")

    db.add(UserInterest(user_id=user_id, tag_id=body.tag_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Interest already added")

    return {"user_id": user_id, "tag_id": body.tag_id}


@router.delete("/{user_id}/interests/{tag_id}")
def remove_user_interest(
    user_id: int,
    tag_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """Remove an interest tag. 200 / 401 / 403 / 404."""
    if require_user(request) != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot edit another user's interests")

    interest = db.get(UserInterest, {"user_id": user_id, "tag_id": tag_id})
    if interest is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Interest not found")

    db.delete(interest)
    db.commit()
    return {"message": "interest removed"}


@router.get("/{user_id}/standings")
def get_user_standings(user_id: int, db: Session = Depends(get_db)):
    """Community standing across all neighborhoods. 200."""
    rows = db.execute(
        select(CommunityStanding, Neighborhood.name, Neighborhood.city)
        .join(Neighborhood, Neighborhood.neighborhood_id == CommunityStanding.neighborhood_id)
        .where(CommunityStanding.user_id == user_id)
        .order_by(CommunityStanding.events_hosted.desc(), CommunityStanding.events_attended.desc())
    ).all()
    return [
        {
            "standing_id": s.standing_id,
            "user_id": s.user_id,
            "neighborhood_id": s.neighborhood_id,
            "neighborhood_name": name,
            "city": city,
            "events_hosted": s.events_hosted,
            "events_attended": s.events_attended,
            "is_leader": s.is_leader,
            "updated_at": s.updated_at,
        }
        for s, name, city in rows
    ]


def _serialize_recommendations(db: Session, user_id: int) -> list[dict]:
    rows = db.execute(
        select(Recommendation, Event)
        .join(Event, Event.event_id == Recommendation.event_id)
        .where(Recommendation.user_id == user_id)
        .order_by(Recommendation.recommendation_id)
    ).all()
    return [
        {
            "recommendation_id": rec.recommendation_id,
            "user_id": rec.user_id,
            "event_id": rec.event_id,
            "reason": rec.reason,
            "created_at": rec.created_at,
            "event": {
                "event_id": event.event_id,
                "title": event.title,
                "event_date": event.event_date,
                "location": event.location,
                "status": event.status,
                "event_image_url": event.event_image_url,
                "latitude": event.latitude,
                "longitude": event.longitude,
            },
        }
        for rec, event in rows
    ]


@router.get("/{user_id}/recommendations")
def get_user_recommendations(user_id: int, request: Request, db: Session = Depends(get_db)):
    """Cached AI recommendations. 200 / 401 / 403."""
    if require_user(request) != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot view another user's recommendations")
    return _serialize_recommendations(db, user_id)


@router.post("/{user_id}/recommendations/refresh")
def refresh_user_recommendations(user_id: int, request: Request, db: Session = Depends(get_db)):
    """Trigger a fresh Gemini recommendation pass and overwrite cache. 200 / 401 / 403."""
    if require_user(request) != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot refresh another user's recommendations")

    interests = db.execute(
        select(Tag.name)
        .join(UserInterest, UserInterest.tag_id == Tag.tag_id)
        .where(UserInterest.user_id == user_id)
    ).scalars().all()

    # Candidate pool: upcoming open events (not the user's own).
    # TODO(review): no geographic filter yet — consider radius around the
    # user's home zip once zip geocoding is available.
    events = db.execute(
        select(Event)
        .where(Event.event_date >= func.now(), Event.status == "open", Event.host_id != user_id)
        .order_by(Event.event_date)
        .limit(50)
    ).scalars().all()

    tag_rows = db.execute(
        select(EventTag.event_id, Tag.name)
        .join(Tag, Tag.tag_id == EventTag.tag_id)
        .where(EventTag.event_id.in_([e.event_id for e in events]))
    ).all() if events else []
    tags_by_event: dict[int, list[str]] = {}
    for event_id, name in tag_rows:
        tags_by_event.setdefault(event_id, []).append(name)

    candidates = [
        {
            "event_id": e.event_id,
            "title": e.title,
            "event_description": e.event_description,
            "tags": tags_by_event.get(e.event_id, []),
        }
        for e in events
    ]

    results = generate_recommendations(list(interests), candidates)

    # Overwrite cache: delete-then-insert, honoring UNIQUE(user_id, event_id).
    valid_ids = {e.event_id for e in events}
    db.execute(delete(Recommendation).where(Recommendation.user_id == user_id))
    seen: set[int] = set()
    for item in results:
        event_id = item["eventId"]
        if event_id not in valid_ids or event_id in seen:
            continue  # drop hallucinated or duplicate event ids
        seen.add(event_id)
        db.add(Recommendation(user_id=user_id, event_id=event_id, reason=item["reason"]))
    db.commit()

    return _serialize_recommendations(db, user_id)
