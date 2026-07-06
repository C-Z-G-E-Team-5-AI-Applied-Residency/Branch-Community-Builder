"""Password hashing (passlib/bcrypt) and session-based auth helpers.

Sessions are cookie-based via Starlette's SessionMiddleware. On login we store
`request.session["user_id"]`; `require_user` reads it back.
"""
from fastapi import Depends, HTTPException, Request, status
from passlib.context import CryptContext

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
