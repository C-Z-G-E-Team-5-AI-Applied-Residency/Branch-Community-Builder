from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.auth import LoginRequest, SignupRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", status_code=201)
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    """Create a new user account. 201 / 400 validation / 409 conflict."""
    raise NotImplementedError


@router.post("/login")
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Authenticate and start a session. 200 / 401 invalid credentials."""
    raise NotImplementedError


@router.post("/logout")
def logout(request: Request):
    """End the current session. 200."""
    request.session.clear()
    return {"message": "logged out"}
