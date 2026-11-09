# app/models/messenger.py
# ============================================================================
# Messagerie de Mada Bien-être : on CONTINUE le chat existant (`chat_messages`),
# on ne crée aucune table de messages parallèle. Les conversations par
# réservation (type « booking ») et les nouvelles conversations (privé admin,
# groupes, annonces) partagent la même table de messages.
#
#   messenger_conversations  : direct | group | announcement
#   messenger_members        : participants + reçus (livré / lu) + réglages perso
#   chat_messages            : (TABLE EXISTANTE, étendue) texte, image, fichier,
#                              audio, sticker, position, appel, message système
#   messenger_reactions      : une réaction par utilisateur et par message
#   messenger_hidden         : « supprimer pour moi »
#   messenger_calls          : historique des appels vocaux
#   messenger_blocks         : blocages
#   messenger_reports        : signalements (modération admin)
#   messenger_user_stickers  : stickers favoris / récents
#   messenger_presence       : dernière connexion
# ============================================================================
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
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from ..core.database import Base
from .chat_message import ChatMessage


class MessengerConversation(Base):
    __tablename__ = "messenger_conversations"

    id = Column(Integer, primary_key=True, index=True)
    # booking | direct | group | announcement
    type = Column(String(20), nullable=False, default="direct", index=True)
    title = Column(String(150), nullable=True)
    description = Column(String(500), nullable=True)
    photo_file = Column(String(80), nullable=True)

    # clients | therapists | clients_therapists | admins | support (informatif + filtre d'ajout)
    audience = Column(String(30), nullable=True)

    # group : les membres peuvent-ils s'écrire entre eux ? (annonce : toujours False)
    members_can_chat = Column(Boolean, nullable=False, default=True)

    # direct : "<petit_id>_<grand_id>" -> une seule conversation par paire
    direct_key = Column(String(40), nullable=True, unique=True)

    # type « booking » : la conversation est celle d'une réservation (client <-> thérapeute)
    booking_id = Column(
        Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=True, unique=True
    )

    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    last_message_id = Column(Integer, nullable=True)
    last_message_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    members = relationship(
        "MessengerMember", back_populates="conversation", cascade="all, delete-orphan"
    )


class MessengerMember(Base):
    __tablename__ = "messenger_members"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(
        Integer, ForeignKey("messenger_conversations.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # owner | admin | member   (rôle DANS la conversation)
    role = Column(String(10), nullable=False, default="member")
    joined_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    left_at = Column(DateTime, nullable=True)  # NULL = membre actif

    # Accusés (valables pour 1-1 comme pour les groupes)
    last_delivered_message_id = Column(Integer, nullable=False, default=0)
    last_read_message_id = Column(Integer, nullable=False, default=0)

    # Réglages personnels
    is_pinned = Column(Boolean, nullable=False, default=False)
    is_archived = Column(Boolean, nullable=False, default=False)
    is_muted = Column(Boolean, nullable=False, default=False)
    # « supprimer la conversation pour moi » : on ne voit plus les messages <= cet id
    hidden_before_id = Column(Integer, nullable=False, default=0)

    conversation = relationship("MessengerConversation", back_populates="members")
    user = relationship("User", foreign_keys=[user_id], lazy="joined")

    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_messenger_member"),
        Index("ix_messenger_members_user_active", "user_id", "left_at"),
    )


class MessengerReaction(Base):
    __tablename__ = "messenger_reactions"

    id = Column(Integer, primary_key=True)
    message_id = Column(
        Integer, ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    emoji = Column(String(16), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    message = relationship("ChatMessage", back_populates="reactions")

    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_messenger_reaction"),)


class MessengerHidden(Base):
    """« Supprimer pour moi » : le message disparaît seulement pour cet utilisateur."""

    __tablename__ = "messenger_hidden"

    id = Column(Integer, primary_key=True)
    message_id = Column(
        Integer, ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_messenger_hidden"),)


class MessengerCall(Base):
    __tablename__ = "messenger_calls"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(
        Integer, ForeignKey("messenger_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    caller_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    callee_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # ringing | accepted | declined | missed | cancelled | busy | ended | failed
    status = Column(String(12), nullable=False, default="ringing")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    answered_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=False, default=0)
    end_reason = Column(String(30), nullable=True)

    caller = relationship("User", foreign_keys=[caller_id], lazy="joined")
    callee = relationship("User", foreign_keys=[callee_id], lazy="joined")


class MessengerBlock(Base):
    __tablename__ = "messenger_blocks"

    id = Column(Integer, primary_key=True)
    blocker_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    blocked_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    blocked = relationship("User", foreign_keys=[blocked_id], lazy="joined")

    __table_args__ = (UniqueConstraint("blocker_id", "blocked_id", name="uq_messenger_block"),)


class MessengerReport(Base):
    __tablename__ = "messenger_reports"

    id = Column(Integer, primary_key=True)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reported_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    conversation_id = Column(
        Integer, ForeignKey("messenger_conversations.id", ondelete="SET NULL"), nullable=True
    )
    message_id = Column(Integer, nullable=True)
    message_snapshot = Column(Text, nullable=True)   # copie du texte au moment du signalement
    reason = Column(String(40), nullable=False)       # spam | harcelement | contenu_inapproprie | arnaque | autre
    details = Column(String(500), nullable=True)
    # open | reviewed | dismissed
    status = Column(String(12), nullable=False, default="open", index=True)
    reviewed_by_id = Column(Integer, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    reporter = relationship("User", foreign_keys=[reporter_id], lazy="joined")
    reported_user = relationship("User", foreign_keys=[reported_user_id], lazy="joined")


class MessengerUserSticker(Base):
    __tablename__ = "messenger_user_stickers"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    sticker_id = Column(String(40), nullable=False)
    kind = Column(String(10), nullable=False)  # favorite | recent
    used_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("user_id", "sticker_id", "kind", name="uq_messenger_user_sticker"),)


class MessengerPresence(Base):
    __tablename__ = "messenger_presence"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    last_seen_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# Le « message de messagerie » EST le message de chat existant.
MessengerMessage = ChatMessage
ChatMessage.reactions = relationship(
    "MessengerReaction", back_populates="message", cascade="all, delete-orphan", lazy="selectin"
)


MESSENGER_TABLES = [
    MessengerConversation.__table__,
    MessengerMember.__table__,
    MessengerReaction.__table__,
    MessengerHidden.__table__,
    MessengerCall.__table__,
    MessengerBlock.__table__,
    MessengerReport.__table__,
    MessengerUserSticker.__table__,
    MessengerPresence.__table__,
]
