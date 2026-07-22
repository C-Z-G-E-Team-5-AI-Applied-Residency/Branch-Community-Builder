import hashlib

from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.images import MAX_IMAGE_BYTES, is_valid_image
from app.core.security import require_user
from app.database import get_db
from app.models.profile import DEFAULT_AVATAR, Profile
from app.models.tag import Tag, UserInterest
from app.schemas.profile import ProfileCreate, ProfileOut, ProfileUpdate

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


def _get_own_profile(db: Session, request: Request, user_id: int) -> Profile:
    authed_user_id = require_user(request)
    if authed_user_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to update this profile")
    profile = db.execute(select(Profile).where(Profile.user_id == user_id)).scalar_one_or_none()
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    return profile


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
    profile = _get_own_profile(db, request, user_id)

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return _to_profile_out(db, profile)


@router.put("/{user_id}/picture")
async def upload_profile_picture(
    user_id: int, file: UploadFile, request: Request, db: Session = Depends(get_db)
):
    """Upload own avatar (JPEG/PNG/WebP/GIF, ≤2 MB). 200 / 401 / 403 / 404 / 413 / 415."""
    profile = _get_own_profile(db, request, user_id)

    data = await file.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Image must be 2 MB or smaller")
    if not is_valid_image(file.content_type, data):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Use a JPEG, PNG, WebP, or GIF image")

    profile.picture_data = data
    profile.picture_mime = file.content_type
    # content-hash version so browsers can cache the URL forever
    version = hashlib.sha1(data).hexdigest()[:8]
    profile.profile_picture = f"/api/profiles/{user_id}/picture?v={version}"
    db.commit()
    db.refresh(profile)
    return _to_profile_out(db, profile)


@router.get("/{user_id}/picture")
def get_profile_picture(user_id: int, db: Session = Depends(get_db)):
    """Serve the stored avatar bytes. 200 / 404."""
    profile = db.execute(select(Profile).where(Profile.user_id == user_id)).scalar_one_or_none()
    if profile is None or profile.picture_data is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No profile picture")
    return Response(
        content=profile.picture_data,
        media_type=profile.picture_mime,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.delete("/{user_id}/picture", status_code=204)
def delete_profile_picture(user_id: int, request: Request, db: Session = Depends(get_db)):
    """Remove own avatar, back to the default. 204 / 401 / 403 / 404."""
    profile = _get_own_profile(db, request, user_id)
    profile.picture_data = None
    profile.picture_mime = None
    profile.profile_picture = DEFAULT_AVATAR
    db.commit()
