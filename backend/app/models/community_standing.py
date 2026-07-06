from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CommunityStanding(Base):
    __tablename__ = "community_standing"
    __table_args__ = (UniqueConstraint("user_id", "neighborhood_id"),)

    standing_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    neighborhood_id: Mapped[int] = mapped_column(ForeignKey("neighborhoods.neighborhood_id", ondelete="CASCADE"), nullable=False)
    events_hosted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    events_attended: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_leader: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
