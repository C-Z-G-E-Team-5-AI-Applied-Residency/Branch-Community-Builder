from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_user
from app.database import get_db
from app.models.profile import Profile
from app.models.tag import Tag, UserInterest
from app.schemas.profile import ProfileCreate, ProfileOut, ProfileUpdate

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


def _get_interests(db: Session, user_id: int) -> list[Tag]:
    return (
        db.execute(
            select(Tag).join(UserInterest, UserInterest.tag_id == Tag.tag_id).where(UserInterest.user_id == user_id)
        )
        .scalars()
        .all()
    )


def _to_profile_out(db: Session, profile: Profile) -> ProfileOut:
    out = ProfileOut.model_validate(profile)
    out.interests = _get_interests(db, profile.user_id)
    return out


@router.get("/{user_id}")
def get_profile(user_id: int, db: Session = Depends(get_db)):
    """Profile + interest tags for a user. 200 / 404."""
    profile = db.execute(select(Profile).where(Profile.user_id == user_id)).scalar_one_or_none()
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    return _to_profile_out(db, profile)


@router.post("", status_code=201)
def create_profile(body: ProfileCreate, request: Request, db: Session = Depends(get_db)):
    """Create the authenticated user's profile. 201 / 401 / 409."""
    user_id = require_user(request)

    existing = db.execute(select(Profile).where(Profile.user_id == user_id)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Profile already exists for this user")

    profile = Profile(**body.model_dump(), user_id=user_id)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return _to_profile_out(db, profile)


@router.patch("/{user_id}")
def update_profile(user_id: int, body: ProfileUpdate, request: Request, db: Session = Depends(get_db)):
    """Update own profile. 200 / 401 / 403 / 404."""
    authed_user_id = require_user(request)
    if authed_user_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to update this profile")

    profile = db.execute(select(Profile).where(Profile.user_id == user_id)).scalar_one_or_none()
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return _to_profile_out(db, profile)
