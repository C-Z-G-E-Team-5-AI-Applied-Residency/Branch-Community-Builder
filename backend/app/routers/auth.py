from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.database import get_db
from app.models.profile import Profile
from app.models.user import User
from app.schemas.auth import LoginRequest, SignupRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _has_profile(db: Session, user_id: int) -> bool:
    return (
        db.execute(select(Profile.user_id).where(Profile.user_id == user_id)).scalar_one_or_none()
        is not None
    )


@router.post("/signup", status_code=201)
def signup(body: SignupRequest, request: Request, db: Session = Depends(get_db)):
    """Create a new user account and start a session. 201 / 400 validation / 409 conflict."""
    existing = db.execute(
        select(User).where((User.email == body.email) | (User.username == body.username))
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email or username already taken")

    user = User(
        email=body.email,
        username=body.username,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email or username already taken")

    request.session["user_id"] = user.user_id
    return {
        "user_id": user.user_id,
        "email": user.email,
        "username": user.username,
        "created_at": user.created_at,
        "has_profile": False,
    }


@router.post("/login")
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Authenticate and start a session. 200 / 401 invalid credentials."""
    user = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    request.session["user_id"] = user.user_id
    return {
        "user_id": user.user_id,
        "email": user.email,
        "username": user.username,
        "has_profile": _has_profile(db, user.user_id),
    }


@router.post("/logout")
def logout(request: Request):
    """End the current session. 200."""
    request.session.clear()
    return {"message": "logged out"}
