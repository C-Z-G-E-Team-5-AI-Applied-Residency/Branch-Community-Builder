from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.tag import Tag

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("")
def list_tags(db: Session = Depends(get_db)):
    """Global predefined tag list (used for interests and event tags). 200."""
    tags = db.execute(select(Tag)).scalars().all()
    return [{"tag_id": tag.tag_id, "name": tag.name} for tag in tags]
