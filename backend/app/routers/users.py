from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import require_user
from app.database import get_db
from app.models.tag import Tag, UserInterest
from app.schemas.tag import InterestCreate

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
    raise NotImplementedError


@router.get("/{user_id}/recommendations")
def get_user_recommendations(user_id: int, db: Session = Depends(get_db)):
    """Cached AI recommendations. 200 / 401 / 403."""
    raise NotImplementedError


@router.post("/{user_id}/recommendations/refresh")
def refresh_user_recommendations(user_id: int, db: Session = Depends(get_db)):
    """Trigger a fresh Gemini recommendation pass and overwrite cache. 200 / 401 / 403."""
    raise NotImplementedError
