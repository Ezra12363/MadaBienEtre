# app/models/chat_message.py
# Messages de chat : une réservation = une conversation (client <-> thérapeute).
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
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
    # NULL pour les conversations hors réservation (admin, groupes, annonces).
    booking_id = Column(
        Integer,
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=True,
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

    # ------------------------------------------------------------------
    # Messagerie complète (même table : on ÉTEND chat_messages, rien de parallèle).
    # message_type : text | image | file | audio | sticker | location | call | system
    # ------------------------------------------------------------------
    conversation_id = Column(
        Integer,
        ForeignKey("messenger_conversations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    reply_to_id = Column(
        Integer, ForeignKey("chat_messages.id", ondelete="SET NULL"), nullable=True
    )
    is_forwarded = Column(Boolean, nullable=False, default=False, server_default="false")
    forwarded_from_name = Column(String(100), nullable=True)
    # False : client / thérapeute ne peuvent PAS répondre à ce message d'admin
    allow_reply = Column(Boolean, nullable=False, default=True, server_default="true")

    file_name = Column(String(255), nullable=True)
    file_key = Column(String(80), nullable=True)
    file_mime = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    sticker_id = Column(String(40), nullable=True)
    call_id = Column(Integer, nullable=True)

    is_pinned = Column(Boolean, nullable=False, default=False, server_default="false")
    pinned_at = Column(DateTime, nullable=True)
    pinned_by_id = Column(Integer, nullable=True)
    edited_at = Column(DateTime, nullable=True)
    deleted_by_id = Column(Integer, nullable=True)

    sender = relationship("User", foreign_keys=[sender_id], lazy="joined")

    __table_args__ = (
        Index("ix_chat_messages_booking_created", "booking_id", "created_at"),
        Index("ix_chat_messages_booking_unread", "booking_id", "is_read"),
        Index("ix_chat_messages_conv_id", "conversation_id", "id"),
    )
