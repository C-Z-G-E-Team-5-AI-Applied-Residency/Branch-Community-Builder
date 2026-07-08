from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import Computed, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Event(Base):
    __tablename__ = "events"

    event_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    event_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    location: Mapped[str] = mapped_column(String, nullable=False)
    event_zip_code: Mapped[int] = mapped_column(Integer, nullable=False)
    event_description: Mapped[str] = mapped_column(String, nullable=False)
    event_capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="open")
    host_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    event_image_url: Mapped[str] = mapped_column(String, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    # geo is a generated column in the DB; Computed(...) keeps the ORM from
    # ever writing it (Postgres rejects explicit values for GENERATED columns).
    geo = mapped_column(
        Geography(geometry_type="POINT", srid=4326),
        Computed("ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography", persisted=True),
        nullable=True,
    )
    check_in_code: Mapped[str | None] = mapped_column(String, nullable=True)
