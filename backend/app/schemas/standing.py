from datetime import datetime

from pydantic import BaseModel


class StandingOut(BaseModel):
    standing_id: int
    user_id: int
    neighborhood_id: int
    events_hosted: int
    events_attended: int
    is_leader: bool
    updated_at: datetime

    class Config:
        from_attributes = True
