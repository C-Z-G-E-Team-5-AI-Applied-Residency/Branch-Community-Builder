from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class EventCreate(BaseModel):
    title: str
    event_date: datetime
    event_end_date: datetime
    location: str
    event_zip_code: int
    event_description: str
    event_capacity: int
    event_image_url: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    status: str = "open"
    tag_ids: list[int] = []
    # host's stated purpose ("the why"); fed to the matchmaker and mission guardrail
    why: str | None = None


class FlyerTemplateSelect(BaseModel):
    template_id: str


class EventUpdate(BaseModel):
    title: str | None = None
    event_date: datetime | None = None
    event_end_date: datetime | None = None
    location: str | None = None
    event_zip_code: int | None = None
    event_description: str | None = None
    event_capacity: int | None = None
    status: str | None = None
    event_image_url: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    why: str | None = None


class AnnouncementCreate(BaseModel):
    message: str = Field(max_length=500)


class EventReview(BaseModel):
    decision: Literal["approve", "reject"]
    note: str | None = Field(default=None, max_length=500)
