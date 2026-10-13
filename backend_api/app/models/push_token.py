# app/models/push_token.py
from sqlalchemy import Column, Integer, String, Boolean, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func

from ..core.database import Base


class PushToken(Base):
    """Token de notification push (Expo) d'un appareil, persisté en base."""

    __tablename__ = "push_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String(255), nullable=False, unique=True, index=True)
    platform = Column(String(20), nullable=True)
    device_id = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
