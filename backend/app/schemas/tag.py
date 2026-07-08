from pydantic import BaseModel


class TagOut(BaseModel):
    tag_id: int
    name: str

    class Config:
        from_attributes = True


class TagAdd(BaseModel):
    tag_id: int
