from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Tag(Base):
    __tablename__ = "tags"

    tag_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    # 'approved' | 'pending' — emergent (LLM-suggested) tags start pending
    status: Mapped[str] = mapped_column(String, nullable=False, default="approved")
    # provenance: the event whose creation first proposed this tag (if any)
    created_by_event_id: Mapped[int | None] = mapped_column(
        ForeignKey("events.event_id", ondelete="SET NULL"), nullable=True
    )
    # how many events use this tag; drives rank/merge/prune of the taxonomy
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class UserInterest(Base):
    __tablename__ = "user_interests"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.tag_id", ondelete="CASCADE"), primary_key=True)


class EventTag(Base):
    __tablename__ = "event_tags"

    event_id: Mapped[int] = mapped_column(ForeignKey("events.event_id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.tag_id", ondelete="CASCADE"), primary_key=True)
