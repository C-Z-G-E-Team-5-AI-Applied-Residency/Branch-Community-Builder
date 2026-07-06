from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("")
def list_tags(db: Session = Depends(get_db)):
    """Global predefined tag list (used for interests and event tags). 200."""
    raise NotImplementedError
