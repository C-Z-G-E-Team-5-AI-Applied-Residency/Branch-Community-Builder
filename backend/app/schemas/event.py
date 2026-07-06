from datetime import datetime

from pydantic import BaseModel

from app.schemas.tag import TagOut


class EventCreate(BaseModel):
    title: str
    event_date: datetime
    location: str
    event_zip_code: int
    event_description: str
    event_capacity: int
    event_image_url: str
    latitude: float
    longitude: float
    status: str = "open"
    tag_ids: list[int] = []


class EventUpdate(BaseModel):
    title: str | None = None
    event_date: datetime | None = None
    location: str | None = None
    event_zip_code: int | None = None
    event_description: str | None = None
    event_capacity: int | None = None
    status: str | None = None
    event_image_url: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class EventOut(BaseModel):
    event_id: int
    title: str
    event_date: datetime
    location: str
    event_zip_code: int
    event_description: str
    event_capacity: int
    status: str
    host_id: int
    event_image_url: str
    latitude: float
    longitude: float
    tags: list[TagOut] = []

    class Config:
        from_attributes = True
