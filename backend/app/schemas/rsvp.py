from typing import Literal

from pydantic import BaseModel


class RsvpUpdate(BaseModel):
    status: Literal["going", "cancelled"] | None = None
    did_attend: bool | None = None


class CheckInRequest(BaseModel):
    code: str
