from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_admin, require_user
from app.database import get_db
from app.models.tag import Tag
from app.schemas.tag import TagSuggestRequest, TagUpdate
from app.services.tagging import suggest_tags

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("")
def list_tags(db: Session = Depends(get_db)):
    """The curated (approved) tag vocabulary — used for interests, filters, and
    the event-tag picker. Pending/emergent tags are excluded until a moderator
    approves them. 200."""
    tags = db.execute(
        select(Tag).where(Tag.status == "approved").order_by(Tag.name)
    ).scalars().all()
    return [{"tag_id": tag.tag_id, "name": tag.name} for tag in tags]


@router.post("/suggest")
def suggest_event_tags(body: TagSuggestRequest, user_id: int = Depends(require_user), db: Session = Depends(get_db)):
    """AI-suggested tags for an in-progress event (reuse-first). Signed-in users.
    Returns {"suggestions": [{"name", "is_new"}]} — empty when no AI key. 200 / 401."""
    existing = list(db.execute(select(Tag.name).where(Tag.status == "approved")).scalars().all())
    return {"suggestions": suggest_tags(body.title, body.description, body.why, existing)}


@router.get("/pending")
def list_pending_tags(admin_id: int = Depends(require_admin), db: Session = Depends(get_db)):
    """Emergent tags awaiting moderation, most-used first. Admin only. 200 / 403.
    Declared before /{tag_id} so the literal path wins over the dynamic one."""
    tags = db.execute(
        select(Tag).where(Tag.status == "pending").order_by(Tag.usage_count.desc(), Tag.name)
    ).scalars().all()
    return [
        {
            "tag_id": tag.tag_id,
            "name": tag.name,
            "usage_count": tag.usage_count,
            "created_by_event_id": tag.created_by_event_id,
        }
        for tag in tags
    ]


@router.patch("/{tag_id}")
def update_tag(tag_id: int, body: TagUpdate, admin_id: int = Depends(require_admin), db: Session = Depends(get_db)):
    """Approve and/or rename an emergent tag. Admin only. 200 / 403 / 404 / 409."""
    tag = db.get(Tag, tag_id)
    if tag is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tag not found")
    if body.name is not None:
        new_name = body.name.strip().lower()
        clash = db.execute(
            select(Tag).where(Tag.name == new_name, Tag.tag_id != tag_id)
        ).scalar_one_or_none()
        if clash is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, f"A tag named '{new_name}' already exists")
        tag.name = new_name
    if body.status is not None:
        tag.status = body.status
    db.commit()
    db.refresh(tag)
    return {"tag_id": tag.tag_id, "name": tag.name, "status": tag.status, "usage_count": tag.usage_count}


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: int, admin_id: int = Depends(require_admin), db: Session = Depends(get_db)):
    """Reject/remove a *pending* tag (cascades to event_tags). Admin only. 204 / 403 / 404 / 409.

    Only pending tags can be deleted, so an approved, in-use tag can't be nuked by a stray
    click. To remove an approved tag, un-approve it first (PATCH status='pending')."""
    tag = db.get(Tag, tag_id)
    if tag is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tag not found")
    if tag.status != "pending":
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only pending tags can be deleted; un-approve it first"
        )
    db.delete(tag)
    db.commit()
