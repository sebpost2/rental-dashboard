from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str]
    address: Mapped[str]
    property_type: Mapped[str] = mapped_column(default="apartment")
    currency: Mapped[str] = mapped_column(default="USD")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
