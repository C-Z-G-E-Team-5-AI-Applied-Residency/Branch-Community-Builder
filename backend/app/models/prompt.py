from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WeeklyPrompt(Base):
    __tablename__ = "weekly_prompts"

    prompt_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    question_text: Mapped[str] = mapped_column(String, nullable=False)
    week_start: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PromptResponse(Base):
    __tablename__ = "prompt_responses"
    __table_args__ = (UniqueConstraint("user_id", "prompt_id"),)

    response_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    prompt_id: Mapped[int] = mapped_column(ForeignKey("weekly_prompts.prompt_id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"))
    response_text: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
