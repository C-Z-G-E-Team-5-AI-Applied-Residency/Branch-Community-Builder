from geoalchemy2 import Geography
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Neighborhood(Base):
    __tablename__ = "neighborhoods"

    neighborhood_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    city: Mapped[str] = mapped_column(String, nullable=False)
    boundary = mapped_column(Geography(geometry_type="MULTIPOLYGON", srid=4326), nullable=False)
