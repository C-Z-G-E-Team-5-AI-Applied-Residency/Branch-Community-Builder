from datetime import datetime

from pydantic import BaseModel


class RecommendationOut(BaseModel):
    recommendation_id: int
    event_id: int
    reason: str
    created_at: datetime

    class Config:
        from_attributes = True
