# app/services/messenger_permissions.py
# ============================================================================
# TOUTES les règles d'autorisation de la messagerie, côté SERVEUR.
# Cacher un bouton dans l'application ne suffit pas : chaque route REST et
# chaque évènement WebSocket passe par ces fonctions (anti-contournement API).
# ============================================================================
from datetime import datetime, timedelta
from typing import Optional, Tuple

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models.booking import Booking
from ..models.messenger import (
    MessengerBlock,
    MessengerConversation,
    MessengerMember,
    MessengerMessage,
)
from ..models.user import User

PAIR_TYPES = ("direct", "booking")   # conversations à deux personnes
EDIT_WINDOW_MINUTES = 30
CALL_AFTER_COMPLETION_HOURS = 48
BOOKING_OK_STATUSES = ("pending", "negotiating", "confirmed", "in_progress", "completed")
BOOKING_CALL_STATUSES = ("confirmed", "in_progress")


def role_of(user: User) -> str:
    role = getattr(user, "role", "") or ""
    role = getattr(role, "value", role)
    role = str(role).strip().upper().split(".")[-1]
    return "ADMIN" if role == "ADMIN" or role.endswith("_ADMIN") else role


def is_admin(user: User) -> bool:
    return role_of(user) == "ADMIN"


def direct_key(a: int, b: int) -> str:
    lo, hi = sorted((int(a), int(b)))
    return f"{lo}_{hi}"


# ------------------------------------------------------------------ blocages
def is_blocked_between(db: Session, a: int, b: int) -> bool:
    return (
        db.query(MessengerBlock.id)
        .filter(
            or_(
                (MessengerBlock.blocker_id == a) & (MessengerBlock.blocked_id == b),
                (MessengerBlock.blocker_id == b) & (MessengerBlock.blocked_id == a),
            )
        )
        .first()
        is not None
    )


def blocked_by_me(db: Session, me: int, other: int) -> bool:
    return (
        db.query(MessengerBlock.id)
        .filter(MessengerBlock.blocker_id == me, MessengerBlock.blocked_id == other)
        .first()
        is not None
    )


# --------------------------------------------------------------- réservations
def has_booking_between(db: Session, a: User, b: User, statuses=BOOKING_OK_STATUSES) -> bool:
    roles = {role_of(a): a, role_of(b): b}
    client, therapist = roles.get("CLIENT"), roles.get("THERAPIST")
    if not client or not therapist:
        return False
    return (
        db.query(Booking.id)
        .filter(
            Booking.client_id == client.id,
            Booking.therapist_id == therapist.id,
            Booking.status.in_(statuses),
        )
        .first()
        is not None
    )


def can_start_direct(db: Session, me: User, other: User) -> Tuple[bool, str]:
    if me.id == other.id:
        return False, "Vous ne pouvez pas vous écrire à vous-même."
    if not getattr(other, "is_active", False) or getattr(other, "deleted_at", None) is not None:
        return False, "Ce compte n'est pas disponible."
    if is_blocked_between(db, me.id, other.id):
        return False, "Vous ne pouvez pas écrire à cet utilisateur."

    ra, rb = role_of(me), role_of(other)
    if "ADMIN" in (ra, rb):
        return True, ""
    if {ra, rb} == {"CLIENT", "THERAPIST"}:
        if has_booking_between(db, me, other):
            return True, ""
        return False, "Vous pouvez écrire à un thérapeute après une réservation avec lui."
    return False, "Cette conversation n'est pas autorisée."


def can_call(db: Session, caller: User, callee: User) -> Tuple[bool, str]:
    """Appel vocal : Client ↔ Thérapeute uniquement, avec une réservation
    active (ou terminée depuis moins de 48 h). Jamais de numéro exposé."""
    if {role_of(caller), role_of(callee)} != {"CLIENT", "THERAPIST"}:
        return False, "Les appels vocaux sont réservés aux clients et aux thérapeutes."
    if not getattr(callee, "is_active", False):
        return False, "Ce compte n'est pas disponible."
    if is_blocked_between(db, caller.id, callee.id):
        return False, "Appel impossible avec cet utilisateur."

    if has_booking_between(db, caller, callee, BOOKING_CALL_STATUSES):
        return True, ""

    roles = {role_of(caller): caller, role_of(callee): callee}
    recent = (
        db.query(Booking)
        .filter(
            Booking.client_id == roles["CLIENT"].id,
            Booking.therapist_id == roles["THERAPIST"].id,
            Booking.status == "completed",
        )
        .order_by(Booking.updated_at.desc())
        .first()
    )
    if recent is not None and recent.updated_at is not None:
        if datetime.utcnow() - recent.updated_at <= timedelta(hours=CALL_AFTER_COMPLETION_HOURS):
            return True, ""
    return False, "L'appel est disponible pendant une réservation confirmée ou en cours."


# ------------------------------------------------------------ appartenance
def get_member(db: Session, conversation_id: int, user_id: int) -> Optional[MessengerMember]:
    return (
        db.query(MessengerMember)
        .filter(
            MessengerMember.conversation_id == conversation_id,
            MessengerMember.user_id == user_id,
            MessengerMember.left_at.is_(None),
        )
        .first()
    )


def peer_of(db: Session, conv: MessengerConversation, me_id: int) -> Optional[User]:
    if conv.type not in PAIR_TYPES:
        return None
    other = (
        db.query(MessengerMember)
        .filter(MessengerMember.conversation_id == conv.id, MessengerMember.user_id != me_id)
        .first()
    )
    return other.user if other else None


# ------------------------------------------------------------ écriture
def can_post(db: Session, conv: MessengerConversation, user: User) -> Tuple[bool, str]:
    member = get_member(db, conv.id, user.id)
    if member is None:
        return False, "Vous ne faites pas partie de cette conversation."

    if conv.type in PAIR_TYPES:
        peer = peer_of(db, conv, user.id)
        if peer is None or not getattr(peer, "is_active", False):
            return False, "Ce compte n'est plus disponible."
        if is_blocked_between(db, user.id, peer.id):
            return False, "Vous ne pouvez plus envoyer de message dans cette conversation."
        return True, ""

    if conv.type == "announcement":
        if not is_admin(user):
            return False, "Seuls les administrateurs peuvent publier dans ce canal d'annonces."
        return True, ""

    # groupe
    if not is_admin(user) and not conv.members_can_chat:
        return False, "Les membres ne peuvent pas écrire dans ce groupe."
    return True, ""


def can_reply_to(conv: MessengerConversation, user: User, target: MessengerMessage) -> Tuple[bool, str]:
    if target.conversation_id != conv.id or target.deleted_at is not None:
        return False, "Le message auquel vous répondez est introuvable."
    if target.message_type == "system":
        return False, "Vous ne pouvez pas répondre à un message système."
    if not target.allow_reply and not is_admin(user):
        return False, "Vous ne pouvez pas répondre à ce message de l'administration."
    return True, ""


def effective_allow_reply(conv: MessengerConversation, user: User, requested: Optional[bool]) -> bool:
    """`allow_reply` n'a de sens que pour un message d'ADMIN dans un groupe / canal d'annonces."""
    if conv.type in PAIR_TYPES or not is_admin(user):
        return True
    if conv.type == "announcement":
        return False
    return bool(requested) if requested is not None else False


def can_edit(user: User, msg: MessengerMessage) -> bool:
    if msg.deleted_at is not None or msg.sender_id != user.id or msg.message_type != "text":
        return False
    return datetime.utcnow() - msg.created_at <= timedelta(minutes=EDIT_WINDOW_MINUTES)


def can_delete_for_all(user: User, msg: MessengerMessage) -> bool:
    if msg.deleted_at is not None or msg.message_type in ("system",):
        return False
    return msg.sender_id == user.id or is_admin(user)


def can_pin(user: User, conv: MessengerConversation) -> bool:
    return True if conv.type in PAIR_TYPES else is_admin(user)


def can_manage_group(user: User, conv: MessengerConversation) -> bool:
    return conv.type in ("group", "announcement") and is_admin(user)


def audience_allows(audience: Optional[str], user: User) -> bool:
    role = role_of(user)
    if role == "ADMIN" or not audience or audience == "support":
        return True
    return {
        "clients": role == "CLIENT",
        "therapists": role == "THERAPIST",
        "clients_therapists": role in ("CLIENT", "THERAPIST"),
        "admins": False,
    }.get(audience, True)
