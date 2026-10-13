# app/models/chat_message.py
# Messages de chat : une réservation = une conversation (client <-> thérapeute).
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from ..core.database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(
        Integer,
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    content = Column(Text, nullable=False, default="")
    message_type = Column(String(20), nullable=False, default="text")  # text | image
    image_url = Column(String(500), nullable=True)

    # Identifiant généré par l'application mobile (envoi optimiste) :
    # permet de fusionner le message local avec celui du serveur.
    client_id = Column(String(64), nullable=True)

    is_read = Column(Boolean, nullable=False, default=False)
    read_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    sender = relationship("User", foreign_keys=[sender_id], lazy="joined")

    __table_args__ = (
        Index("ix_chat_messages_booking_created", "booking_id", "created_at"),
        Index("ix_chat_messages_booking_unread", "booking_id", "is_read"),
    )
