from pydantic import BaseModel


class NeighborhoodOut(BaseModel):
    neighborhood_id: int
    name: str
    city: str

    class Config:
        from_attributes = True
