from sqlalchemy import ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

DEFAULT_AVATAR = "/images/default_avatar.svg"


class Profile(Base):
    __tablename__ = "profiles"

    profile_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    # URL/path shown in <img>; points at the picture endpoint once bytes are uploaded
    profile_picture: Mapped[str] = mapped_column(String, default=DEFAULT_AVATAR)
    picture_data: Mapped[bytes | None] = mapped_column(LargeBinary)
    picture_mime: Mapped[str | None] = mapped_column(String)
    bio: Mapped[str] = mapped_column(String, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"))
    home_zip_code: Mapped[str] = mapped_column(String, nullable=False)

    user = relationship("User", back_populates="profile")
