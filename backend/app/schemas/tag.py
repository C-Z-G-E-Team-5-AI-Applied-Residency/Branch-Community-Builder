from pydantic import BaseModel


class TagOut(BaseModel):
    tag_id: int
    name: str

    class Config:
        from_attributes = True


class InterestCreate(BaseModel):
    tag_id: int
