from pydantic import BaseModel

from app.schemas.tag import TagOut


class ProfileCreate(BaseModel):
    display_name: str
    bio: str
    home_zip_code: str
    profile_picture: str = "/images/default_avatar.svg"


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    bio: str | None = None
    profile_picture: str | None = None
    home_zip_code: str | None = None


class ProfileOut(BaseModel):
    profile_id: int
    display_name: str
    profile_picture: str
    bio: str
    home_zip_code: str
    user_id: int
    interests: list[TagOut] = []

    class Config:
        from_attributes = True
