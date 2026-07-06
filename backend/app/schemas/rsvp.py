from datetime import datetime

from pydantic import BaseModel


class RsvpCreate(BaseModel):
    status: str = "going"


class RsvpUpdate(BaseModel):
    status: str | None = None
    did_attend: bool | None = None


class CheckInRequest(BaseModel):
    code: str


class RsvpOut(BaseModel):
    rsvp_id: int
    user_id: int
    event_id: int
    status: str
    did_attend: bool
    created_at: datetime

    class Config:
        from_attributes = True
