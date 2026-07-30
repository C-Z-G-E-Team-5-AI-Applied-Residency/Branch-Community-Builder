"""Password hashing (passlib/bcrypt) and session-based auth helpers.

Sessions are cookie-based via Starlette's SessionMiddleware. On login we store
`request.session["user_id"]`; `require_user` reads it back.
"""
from fastapi import Depends, HTTPException, Request, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def current_user_id(request: Request) -> int | None:
    return request.session.get("user_id")


def require_user(request: Request) -> int:
    user_id = current_user_id(request)
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user_id


def is_admin_email(email: str | None) -> bool:
    """Whether an email is on the moderator allowlist (ADMIN_EMAILS). Case-insensitive."""
    return bool(email) and email.lower() in settings.admin_email_set()


def require_admin(request: Request, db: Session = Depends(get_db)) -> int:
    """Gate a route to team moderators. 401 if not signed in, 403 if not an admin.
    No role table — membership is the ADMIN_EMAILS allowlist ("build around ourselves")."""
    user_id = require_user(request)
    user = db.get(User, user_id)
    if user is None or not is_admin_email(user.email):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins only")
    return user_id
