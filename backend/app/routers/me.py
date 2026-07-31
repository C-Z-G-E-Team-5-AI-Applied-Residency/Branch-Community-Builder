from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.security import current_user_id, is_admin_email
from app.database import get_db
from app.models.user import User

router = APIRouter(prefix="/api/me", tags=["me"])


@router.get("/is-admin")
def get_is_admin(request: Request, db: Session = Depends(get_db)):
    """Whether the signed-in user may moderate (drives the review link in the UI).
    Returns {is_admin: false} for signed-out users rather than 401 — it's a UI hint."""
    user_id = current_user_id(request)
    if user_id is None:
        return {"is_admin": False}
    user = db.get(User, user_id)
    return {"is_admin": is_admin_email(user.email) if user else False}
