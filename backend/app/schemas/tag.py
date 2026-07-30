from typing import Literal

from pydantic import BaseModel, Field


class TagOut(BaseModel):
    tag_id: int
    name: str

    class Config:
        from_attributes = True


class TagAdd(BaseModel):
    tag_id: int


class InterestCreate(BaseModel):
    tag_id: int


class TagSuggestRequest(BaseModel):
    title: str
    description: str = ""
    why: str | None = None


class TagUpdate(BaseModel):
    # Governance for emergent tags: approve (status) and/or clean up the name.
    name: str | None = Field(default=None, min_length=1, max_length=40)
    status: Literal["approved", "pending"] | None = None
