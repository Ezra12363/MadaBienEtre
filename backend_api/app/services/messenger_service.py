# app/services/messenger_service.py
# ============================================================================
# Logique métier de la messagerie (utilisée par l'API REST ET le WebSocket).
# Chaque fonction qui écrit vérifie les permissions via messenger_permissions.
# ============================================================================
import asyncio
import io
import logging
import os
import re
import shutil
import time
import uuid
import zipfile
from collections import defaultdict, deque
from datetime import datetime
from pathlib import Path
from typing import Any, Deque, Dict, Iterable, List, Optional, Tuple

from fastapi import HTTPException
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from ..models.booking import Booking
from ..models.chat_message import ChatMessage
from ..models.messenger import (
    MessengerBlock,
    MessengerConversation,
    MessengerHidden,
    MessengerMember,
    MessengerMessage,
    MessengerPresence,
    MessengerReaction,
    MessengerReport,
    MessengerUserSticker,
)
from ..models.user import User
from . import messenger_permissions as perm
from .messenger_hub import hub
from .messenger_stickers import get_sticker

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
UPLOAD_DIR = Path(os.getenv("MESSENGER_UPLOAD_DIR", "private_uploads/messenger")).resolve()
MAX_TEXT_LENGTH = 4000
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_FILE_BYTES = 15 * 1024 * 1024
MAX_AUDIO_BYTES = 10 * 1024 * 1024
MAX_AUDIO_SECONDS = 600
RATE_LIMIT_COUNT = 60          # messages
RATE_LIMIT_WINDOW = 60         # secondes
SAFE_KEY = re.compile(r"^[a-f0-9]{32}\.(jpg|png|webp|gif|pdf|docx|xlsx|pptx|txt|csv|m4a|mp3|ogg|webm|wav|aac)$")
REACTION_EMOJIS = {"❤️", "😂", "👍", "😮", "😢", "🙏", "🔥", "👎"}
REPORT_REASONS = {"spam", "harcelement", "contenu_inapproprie", "arnaque", "autre"}
ROLE_FILTERS = {"CLIENT", "THERAPIST", "ADMIN"}


def utc_iso(dt: Optional[datetime] = None) -> str:
    dt = dt or datetime.utcnow()
    return dt.replace(microsecond=0).isoformat() + "Z"


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return utc_iso(dt) if isinstance(dt, datetime) else None


# ---------------------------------------------------------------------------
# Anti-spam : limite de débit en mémoire
# ---------------------------------------------------------------------------
_rate: Dict[int, Deque[float]] = defaultdict(deque)


def check_rate_limit(user_id: int) -> None:
    now = time.monotonic()
    q = _rate[user_id]
    while q and now - q[0] > RATE_LIMIT_WINDOW:
        q.popleft()
    if len(q) >= RATE_LIMIT_COUNT:
        raise HTTPException(429, "Trop de messages envoyés. Réessayez dans un instant.")
    q.append(now)


# ---------------------------------------------------------------------------
# Accès
# ---------------------------------------------------------------------------
def get_conversation_or_404(db: Session, conversation_id: int) -> MessengerConversation:
    conv = db.query(MessengerConversation).filter(MessengerConversation.id == conversation_id).first()
    if conv is None:
        raise HTTPException(404, "Conversation introuvable")
    return conv


def require_member(db: Session, conversation_id: int, user: User) -> Tuple[MessengerConversation, MessengerMember]:
    conv = get_conversation_or_404(db, conversation_id)
    member = perm.get_member(db, conversation_id, user.id)
    if member is None:
        raise HTTPException(403, "Accès refusé à cette conversation")
    return conv, member


def active_member_ids(conv: MessengerConversation) -> List[int]:
    return [m.user_id for m in conv.members if m.left_at is None]


# ---------------------------------------------------------------------------
# Sérialisation
# ---------------------------------------------------------------------------
def user_brief(user: Optional[User]) -> Dict[str, Any]:
    if user is None:
        return {"id": None, "fullname": "Utilisateur supprimé", "profile_image": None, "role": None}
    return {
        "id": user.id,
        "fullname": user.fullname or "Utilisateur",
        "profile_image": user.profile_image,
        "role": perm.role_of(user),
    }


# ---------------------------------------------------------------------------
# Compatibilité avec le chat existant : position encodée dans `content`
# ([[loc]]{json}) et image stockée dans `image_url` — on les LIT tels quels.
# ---------------------------------------------------------------------------
LOC_PREFIX = "[[loc]]"


def decode_location(content: Optional[str]) -> Optional[Dict[str, Any]]:
    from ..api.chat import _decode_location  # import tardif : évite un cycle
    return _decode_location(content)


def location_label(loc: Dict[str, Any]) -> str:
    from ..api.chat import _location_label
    return _location_label(loc)


def encode_location(lat, lng, address, loc_type="live") -> str:
    from ..api.chat import _encode_location
    return _encode_location(lat, lng, address, loc_type)


def preview_of(msg: MessengerMessage) -> str:
    if msg.deleted_at is not None:
        return "Message supprimé"
    t = msg.message_type
    if (msg.content or "").startswith(LOC_PREFIX):
        loc = decode_location(msg.content)
        return location_label(loc) if loc else "📍 Position partagée"
    if t == "image" or (msg.image_url and not msg.file_key):
        return "📷 Photo"
    if t == "file":
        return f"📎 {msg.file_name or 'Document'}"
    if t == "audio":
        d = msg.duration_seconds or 0
        return f"🎤 Message vocal{f' ({d // 60}:{d % 60:02d})' if d else ''}"
    if t == "sticker":
        s = get_sticker(msg.sticker_id or "")
        return f"{s['emoji'] if s else '🙂'} Sticker"
    if t == "location":
        return "📍 Position partagée"
    return (msg.content or "").replace("\n", " ")[:120]


def serialize_message(msg: MessengerMessage, reply_map: Optional[Dict[int, MessengerMessage]] = None) -> Dict[str, Any]:
    """Format identique pour REST et WebSocket. Indépendant du lecteur : le client
    déduit « mes » réactions / droits à partir des ids (le serveur revérifie tout)."""
    deleted = msg.deleted_at is not None
    sticker = get_sticker(msg.sticker_id or "") if msg.message_type == "sticker" and not deleted else None

    reply = None
    if msg.reply_to_id and reply_map is not None:
        target = reply_map.get(msg.reply_to_id)
        if target is not None:
            reply = {
                "id": target.id,
                "sender_id": target.sender_id,
                "sender_name": getattr(target.sender, "fullname", None) or "Utilisateur",
                "message_type": target.message_type,
                "preview": preview_of(target),
                "deleted": target.deleted_at is not None,
            }

    attachment = None
    message_type = msg.message_type
    content = "" if deleted else (msg.content or "")
    location = None
    if not deleted and content.startswith(LOC_PREFIX):
        loc = decode_location(content)
        if loc is not None:
            message_type = "location"
            location = loc
            content = location_label(loc)
    if message_type == "image" and msg.image_url and not msg.file_key and not deleted:
        # ancienne image du chat : servie par /chat/files/... (déjà authentifié)
        attachment = {"url": msg.image_url, "name": "photo", "mime": "image/jpeg",
                      "size": None, "duration": None}
    if msg.file_key and not deleted:
        attachment = {
            "url": f"/messenger/files/{msg.conversation_id}/{msg.file_key}",
            "name": msg.file_name,
            "mime": msg.file_mime,
            "size": msg.file_size,
            "duration": msg.duration_seconds,
        }

    by_emoji: Dict[str, List[int]] = defaultdict(list)
    for r in msg.reactions or []:
        by_emoji[r.emoji].append(r.user_id)

    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender": user_brief(msg.sender),
        "message_type": message_type,
        "content": content,
        "client_id": msg.client_id,
        "reply_to": reply,
        "is_forwarded": bool(msg.is_forwarded),
        "forwarded_from_name": msg.forwarded_from_name,
        "allow_reply": bool(msg.allow_reply),
        "attachment": attachment,
        "sticker": sticker,
        "location": location,
        "call_id": msg.call_id,
        "reactions": [{"emoji": e, "count": len(u), "user_ids": u[:100]} for e, u in by_emoji.items()],
        "booking_id": msg.booking_id,
        "is_pinned": bool(msg.is_pinned) and not deleted,
        "edited_at": _iso(msg.edited_at),
        "deleted": deleted,
        "created_at": _iso(msg.created_at),
    }


def reply_map_for(db: Session, messages: Iterable[MessengerMessage]) -> Dict[int, MessengerMessage]:
    ids = {m.reply_to_id for m in messages if m.reply_to_id}
    if not ids:
        return {}
    return {m.id: m for m in db.query(MessengerMessage).filter(MessengerMessage.id.in_(ids)).all()}


def serialize_one(db: Session, msg: MessengerMessage) -> Dict[str, Any]:
    return serialize_message(msg, reply_map_for(db, [msg]))


# ---------------------------------------------------------------------------
# Présence
# ---------------------------------------------------------------------------
def last_seen_map(db: Session, user_ids: Iterable[int]) -> Dict[int, datetime]:
    ids = list(set(user_ids))
    if not ids:
        return {}
    return {
        p.user_id: p.last_seen_at
        for p in db.query(MessengerPresence).filter(MessengerPresence.user_id.in_(ids)).all()
    }


def touch_last_seen(db: Session, user_id: int) -> None:
    row = db.query(MessengerPresence).filter(MessengerPresence.user_id == user_id).first()
    if row is None:
        db.add(MessengerPresence(user_id=user_id, last_seen_at=datetime.utcnow()))
    else:
        row.last_seen_at = datetime.utcnow()
    db.commit()


def peer_brief(user: Optional[User], seen: Dict[int, datetime]) -> Dict[str, Any]:
    data = user_brief(user)
    uid = data["id"]
    data["is_online"] = bool(uid and hub.is_online(uid))
    data["last_seen_at"] = _iso(seen.get(uid)) if uid else None
    return data


def co_member_ids(db: Session, user_id: int, among: Iterable[int]) -> List[int]:
    """Parmi `among`, ceux qui partagent au moins une conversation avec user_id."""
    among = [i for i in set(among) if i != user_id]
    if not among:
        return []
    m2 = MessengerMember.__table__.alias("m2")
    rows = (
        db.query(m2.c.user_id)
        .join(MessengerMember, MessengerMember.conversation_id == m2.c.conversation_id)
        .filter(
            MessengerMember.user_id == user_id,
            MessengerMember.left_at.is_(None),
            m2.c.left_at.is_(None),
            m2.c.user_id.in_(among),
        )
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------
def _blocked_ids(db: Session, me_id: int) -> set:
    rows = db.query(MessengerBlock).filter(
        or_(MessengerBlock.blocker_id == me_id, MessengerBlock.blocked_id == me_id)
    ).all()
    return {r.blocked_id if r.blocker_id == me_id else r.blocker_id for r in rows}


def unread_by_conversation(db: Session, user_id: int) -> Dict[int, int]:
    rows = (
        db.query(MessengerMessage.conversation_id, func.count(MessengerMessage.id))
        .join(
            MessengerMember,
            and_(
                MessengerMember.conversation_id == MessengerMessage.conversation_id,
                MessengerMember.user_id == user_id,
                MessengerMember.left_at.is_(None),
            ),
        )
        .filter(
            MessengerMessage.id > MessengerMember.last_read_message_id,
            MessengerMessage.id > MessengerMember.hidden_before_id,
            MessengerMessage.sender_id != user_id,
            MessengerMessage.deleted_at.is_(None),
            MessengerMessage.message_type != "system",
        )
        .group_by(MessengerMessage.conversation_id)
        .all()
    )
    return {cid: int(n) for cid, n in rows}


def unread_summary(db: Session, user_id: int) -> Dict[str, Any]:
    by_conv = unread_by_conversation(db, user_id)
    muted = {
        m.conversation_id
        for m in db.query(MessengerMember.conversation_id, MessengerMember.is_muted)
        .filter(MessengerMember.user_id == user_id, MessengerMember.is_muted.is_(True))
        .all()
    }
    total = sum(n for cid, n in by_conv.items() if cid not in muted)
    return {"total": total, "by_conversation": {str(k): v for k, v in by_conv.items()}}


def _post_state(conv: MessengerConversation, me: User, peer: Optional[User], blocked: set) -> Tuple[bool, str]:
    if conv.type in perm.PAIR_TYPES:
        if peer is None or not getattr(peer, "is_active", False):
            return False, "Ce compte n'est plus disponible."
        if peer.id in blocked:
            return False, "Vous ne pouvez plus envoyer de message dans cette conversation."
        return True, ""
    if conv.type == "announcement":
        return (True, "") if perm.is_admin(me) else (False, "Canal d'annonces : seuls les administrateurs publient.")
    if not perm.is_admin(me) and not conv.members_can_chat:
        return False, "Les membres ne peuvent pas écrire dans ce groupe."
    return True, ""


def list_conversations(db: Session, me: User, archived: bool = False) -> List[Dict[str, Any]]:
    sync_booking_conversations(db, me)
    members = (
        db.query(MessengerMember)
        .filter(
            MessengerMember.user_id == me.id,
            MessengerMember.left_at.is_(None),
            MessengerMember.is_archived.is_(archived),
        )
        .all()
    )
    if not members:
        return []
    conv_ids = [m.conversation_id for m in members]
    convs = {
        c.id: c
        for c in db.query(MessengerConversation).filter(MessengerConversation.id.in_(conv_ids)).all()
    }

    last_ids = [c.last_message_id for c in convs.values() if c.last_message_id]
    last_msgs = (
        {m.id: m for m in db.query(MessengerMessage).filter(MessengerMessage.id.in_(last_ids)).all()}
        if last_ids
        else {}
    )
    unread = unread_by_conversation(db, me.id)
    blocked = _blocked_ids(db, me.id)

    direct_ids = [c.id for c in convs.values() if c.type in perm.PAIR_TYPES]
    peers: Dict[int, User] = {}
    if direct_ids:
        for pm in db.query(MessengerMember).filter(
            MessengerMember.conversation_id.in_(direct_ids), MessengerMember.user_id != me.id
        ):
            peers[pm.conversation_id] = pm.user
    seen = last_seen_map(db, [p.id for p in peers.values()])

    counts = dict(
        db.query(MessengerMember.conversation_id, func.count(MessengerMember.id))
        .filter(MessengerMember.conversation_id.in_(conv_ids), MessengerMember.left_at.is_(None))
        .group_by(MessengerMember.conversation_id)
        .all()
    )

    result = []
    for m in members:
        conv = convs.get(m.conversation_id)
        if conv is None:
            continue
        last = last_msgs.get(conv.last_message_id) if conv.last_message_id else None
        visible_last = last is not None and last.id > m.hidden_before_id
        if conv.type in perm.PAIR_TYPES and not visible_last:
            continue  # conversation vide / supprimée pour moi : n'apparaît pas

        peer = peers.get(conv.id)
        can_post, why = _post_state(conv, me, peer, blocked)
        if conv.type in perm.PAIR_TYPES:
            title = peer.fullname if peer else "Utilisateur"
            photo = peer.profile_image if peer else None
        else:
            title = conv.title or "Groupe"
            photo = f"/messenger/files/{conv.id}/{conv.photo_file}" if conv.photo_file else None

        result.append({
            "booking_id": conv.booking_id,
            "id": conv.id,
            "type": conv.type,
            "title": title,
            "photo": photo,
            "audience": conv.audience,
            "peer": peer_brief(peer, seen) if peer else None,
            "member_count": int(counts.get(conv.id, 0)),
            "members_can_chat": bool(conv.members_can_chat),
            "can_post": can_post,
            "cannot_post_reason": None if can_post else why,
            "my_role": m.role,
            "is_pinned": bool(m.is_pinned),
            "is_archived": bool(m.is_archived),
            "is_muted": bool(m.is_muted),
            "unread_count": unread.get(conv.id, 0),
            "last_message": (
                {
                    "id": last.id,
                    "preview": preview_of(last),
                    "sender_id": last.sender_id,
                    "sender_name": getattr(last.sender, "fullname", None),
                    "message_type": last.message_type,
                    "deleted": last.deleted_at is not None,
                    "created_at": _iso(last.created_at),
                }
                if visible_last
                else None
            ),
            "last_message_at": _iso(conv.last_message_at),
        })

    result.sort(key=lambda c: (c["is_pinned"], c["last_message_at"] or ""), reverse=True)
    return result


def conversation_detail(db: Session, me: User, conv: MessengerConversation, member: MessengerMember) -> Dict[str, Any]:
    blocked = _blocked_ids(db, me.id)
    peer = perm.peer_of(db, conv, me.id)
    can_post, why = _post_state(conv, me, peer, blocked)
    members = [m for m in conv.members if m.left_at is None]
    seen = last_seen_map(db, [m.user_id for m in members][:200])

    if conv.type in perm.PAIR_TYPES:
        title = peer.fullname if peer else "Utilisateur"
        photo = peer.profile_image if peer else None
    else:
        title = conv.title or "Groupe"
        photo = f"/messenger/files/{conv.id}/{conv.photo_file}" if conv.photo_file else None

    can_call, _ = (
        perm.can_call(db, me, peer) if (peer is not None and conv.type in perm.PAIR_TYPES) else (False, "")
    )

    return {
        "id": conv.id,
        "type": conv.type,
        "booking_id": conv.booking_id,
        "title": title,
        "description": conv.description,
        "photo": photo,
        "audience": conv.audience,
        "members_can_chat": bool(conv.members_can_chat),
        "can_post": can_post,
        "cannot_post_reason": None if can_post else why,
        "can_call": bool(can_call),
        "can_manage": perm.can_manage_group(me, conv),
        "can_pin": perm.can_pin(me, conv),
        "blocked_by_me": bool(peer and perm.blocked_by_me(db, me.id, peer.id)),
        "my_role": member.role,
        "is_pinned": bool(member.is_pinned),
        "is_archived": bool(member.is_archived),
        "is_muted": bool(member.is_muted),
        "member_count": len(members),
        "members": [
            {
                **peer_brief(m.user, seen),
                "member_role": m.role,
                "last_delivered_message_id": m.last_delivered_message_id,
                "last_read_message_id": m.last_read_message_id,
            }
            for m in sorted(members, key=lambda x: (x.role != "owner", x.role != "admin", x.joined_at))[:200]
        ],
        "created_at": _iso(conv.created_at),
    }


# ---------------------------------------------------------------------------
# Conversations de RÉSERVATION : le chat existant (booking_id) devient une
# conversation « booking » ; ses messages restent dans chat_messages.
# ---------------------------------------------------------------------------
def ensure_booking_conversation(db: Session, booking: Booking) -> Optional[MessengerConversation]:
    if booking is None or not booking.client_id or not booking.therapist_id:
        return None
    conv = db.query(MessengerConversation).filter(MessengerConversation.booking_id == booking.id).first()
    if conv is None:
        conv = MessengerConversation(type="booking", booking_id=booking.id, created_by_id=booking.client_id,
                                     members_can_chat=True)
        db.add(conv)
        db.flush()
        for uid in (booking.client_id, booking.therapist_id):
            db.add(MessengerMember(conversation_id=conv.id, user_id=uid, role="member"))
        db.flush()

    # rattache les anciens messages (et ceux envoyés par d'anciennes versions de l'app)
    pending = db.query(ChatMessage.id).filter(
        ChatMessage.booking_id == booking.id, ChatMessage.conversation_id.is_(None)
    ).count()
    if pending:
        db.query(ChatMessage).filter(
            ChatMessage.booking_id == booking.id, ChatMessage.conversation_id.is_(None)
        ).update({ChatMessage.conversation_id: conv.id}, synchronize_session=False)
        last = db.query(ChatMessage).filter(ChatMessage.conversation_id == conv.id).order_by(ChatMessage.id.desc()).first()
        if last is not None:
            conv.last_message_id = last.id
            conv.last_message_at = last.created_at
        for member in db.query(MessengerMember).filter(MessengerMember.conversation_id == conv.id):
            seen = db.query(func.max(ChatMessage.id)).filter(
                ChatMessage.conversation_id == conv.id,
                or_(ChatMessage.sender_id == member.user_id, ChatMessage.is_read.is_(True)),
            ).scalar() or 0
            member.last_read_message_id = max(member.last_read_message_id, seen)
            member.last_delivered_message_id = max(member.last_delivered_message_id, seen)
    db.commit()
    db.refresh(conv)
    return conv


def sync_booking_conversations(db: Session, me: User) -> None:
    """Crée les conversations des réservations qui ont déjà des messages."""
    if perm.is_admin(me):
        return
    booking_ids = [r[0] for r in db.query(ChatMessage.booking_id).join(
        Booking, Booking.id == ChatMessage.booking_id
    ).filter(
        ChatMessage.conversation_id.is_(None),
        or_(Booking.client_id == me.id, Booking.therapist_id == me.id),
    ).distinct().limit(200).all()]
    for bid in booking_ids:
        ensure_booking_conversation(db, db.query(Booking).filter(Booking.id == bid).first())


def get_or_create_booking_conversation(db: Session, me: User, booking_id: int) -> MessengerConversation:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(404, "Réservation introuvable")
    if me.id not in (booking.client_id, booking.therapist_id):
        raise HTTPException(403, "Accès refusé à cette conversation")
    conv = ensure_booking_conversation(db, booking)
    if conv is None:
        raise HTTPException(409, "Le chat sera disponible dès qu'un thérapeute est assigné.")
    member = db.query(MessengerMember).filter_by(conversation_id=conv.id, user_id=me.id).first()
    if member is None:
        db.add(MessengerMember(conversation_id=conv.id, user_id=me.id, role="member"))
        db.commit()
    elif member.left_at is not None:
        member.left_at = None
        db.commit()
    return conv


def get_or_create_direct(db: Session, me: User, other_id: int) -> MessengerConversation:
    other = db.query(User).filter(User.id == other_id, User.deleted_at.is_(None)).first()
    if other is None:
        raise HTTPException(404, "Utilisateur introuvable")
    # Client <-> thérapeute : la conversation EST celle de la réservation (chat existant).
    if {perm.role_of(me), perm.role_of(other)} == {"CLIENT", "THERAPIST"}:
        client_id = me.id if perm.role_of(me) == "CLIENT" else other.id
        therapist_id = me.id if perm.role_of(me) == "THERAPIST" else other.id
        booking = (
            db.query(Booking)
            .filter(Booking.client_id == client_id, Booking.therapist_id == therapist_id,
                    Booking.status.in_(perm.BOOKING_OK_STATUSES))
            .order_by(Booking.id.desc())
            .first()
        )
        if booking is None:
            raise HTTPException(403, "Vous pouvez écrire à un thérapeute après une réservation avec lui.")
        return get_or_create_booking_conversation(db, me, booking.id)

    key = perm.direct_key(me.id, other.id)
    conv = db.query(MessengerConversation).filter(MessengerConversation.direct_key == key).first()
    if conv is not None:
        # on (ré)active la participation de l'utilisateur courant si besoin
        member = (
            db.query(MessengerMember)
            .filter(MessengerMember.conversation_id == conv.id, MessengerMember.user_id == me.id)
            .first()
        )
        if member is not None and member.left_at is not None:
            member.left_at = None
            db.commit()
        return conv

    ok, why = perm.can_start_direct(db, me, other)
    if not ok:
        raise HTTPException(403, why)

    conv = MessengerConversation(type="direct", direct_key=key, created_by_id=me.id, members_can_chat=True)
    db.add(conv)
    db.flush()
    db.add(MessengerMember(conversation_id=conv.id, user_id=me.id, role="member"))
    db.add(MessengerMember(conversation_id=conv.id, user_id=other.id, role="member"))
    db.commit()
    db.refresh(conv)
    return conv


# ---------------------------------------------------------------------------
# Création / diffusion des messages
# ---------------------------------------------------------------------------
def _create_message(db: Session, conv: MessengerConversation, sender: Optional[User], **fields) -> MessengerMessage:
    msg = MessengerMessage(
        conversation_id=conv.id,
        sender_id=sender.id if sender else None,
        created_at=datetime.utcnow(),
        **fields,
    )
    db.add(msg)
    db.flush()
    conv.last_message_id = msg.id
    conv.last_message_at = msg.created_at
    if sender is not None:
        member = perm.get_member(db, conv.id, sender.id)
        if member is not None:
            member.last_read_message_id = max(member.last_read_message_id, msg.id)
            member.last_delivered_message_id = max(member.last_delivered_message_id, msg.id)
            if member.is_archived:
                member.is_archived = False
    db.commit()
    db.refresh(msg)
    return msg


def _find_by_client_id(db: Session, conv_id: int, sender_id: int, client_id: Optional[str]) -> Optional[MessengerMessage]:
    if not client_id:
        return None
    return (
        db.query(MessengerMessage)
        .filter(
            MessengerMessage.conversation_id == conv_id,
            MessengerMessage.sender_id == sender_id,
            MessengerMessage.client_id == client_id,
        )
        .first()
    )


def _clean_text(text: Optional[str]) -> str:
    return (text or "").replace("\x00", "").strip()[:MAX_TEXT_LENGTH]


def _check_reply(db: Session, conv: MessengerConversation, user: User, reply_to_id: Optional[int]) -> None:
    if not reply_to_id:
        return
    target = db.query(MessengerMessage).filter(MessengerMessage.id == reply_to_id).first()
    if target is None:
        raise HTTPException(404, "Le message auquel vous répondez est introuvable.")
    ok, why = perm.can_reply_to(conv, user, target)
    if not ok:
        raise HTTPException(403, why)


async def publish_new_message(db: Session, conv: MessengerConversation, msg: MessengerMessage) -> Dict[str, Any]:
    data = serialize_one(db, msg)
    recipients = active_member_ids(conv)
    await hub.send_to_users(
        recipients,
        {"type": "message_new", "conversation_id": conv.id, "message": data},
    )
    if msg.message_type != "system":
        _push_offline(db, conv, msg, recipients)
    return data


def _push_offline(db: Session, conv: MessengerConversation, msg: MessengerMessage, recipients: List[int]) -> None:
    """Push Expo (client, thérapeute, admin : même chemin) pour chaque destinataire qui n'a
    PAS l'appli ouverte au premier plan : hors ligne OU en arrière-plan. Les membres en
    sourdine / partis et l'expéditeur sont exclus. Jamais bloquant, jamais d'exception."""
    try:
        from .push_notifications import push_service
        sender_name = getattr(msg.sender, "fullname", None) or "Mada Bien-être"
        if conv.type in perm.PAIR_TYPES:
            title, prefix = sender_name, ""
        else:
            title, prefix = (conv.title or "Groupe"), f"{sender_name} : "
        body = (prefix + preview_of(msg))[:160]
        skip = {m.user_id for m in conv.members if m.is_muted or m.left_at is not None}
        targets = [
            uid for uid in dict.fromkeys(recipients)
            if uid != msg.sender_id and uid not in skip and not hub.is_foreground(uid)
        ][:200]
        if not targets:
            return
        data = {
            "kind": "chat_message", "type": "messenger_message",
            "conversation_id": conv.id, "message_id": msg.id,
            "conversation_type": conv.type, "booking_id": getattr(conv, "booking_id", None),
        }
        loop = asyncio.get_running_loop()
        for uid in targets:
            loop.create_task(push_service.send_to_user(uid, title, body, data, channel_id="messages"))
    except Exception:  # noqa: BLE001
        logger.warning("Messenger : push impossible", exc_info=True)


async def send_text(
    db: Session, user: User, conv_id: int, text: str, client_id: Optional[str] = None,
    reply_to_id: Optional[int] = None, allow_reply: Optional[bool] = None,
) -> Dict[str, Any]:
    conv, _ = require_member(db, conv_id, user)
    ok, why = perm.can_post(db, conv, user)
    if not ok:
        raise HTTPException(403, why)
    text = _clean_text(text)
    if not text:
        raise HTTPException(422, "Le message ne peut pas être vide.")

    existing = _find_by_client_id(db, conv.id, user.id, client_id)
    if existing is not None:
        return serialize_one(db, existing)

    _check_reply(db, conv, user, reply_to_id)
    check_rate_limit(user.id)
    msg = _create_message(
        db, conv, user, message_type="text", content=text, client_id=client_id,
        reply_to_id=reply_to_id, allow_reply=perm.effective_allow_reply(conv, user, allow_reply),
    )
    return await publish_new_message(db, conv, msg)


async def send_sticker(
    db: Session, user: User, conv_id: int, sticker_id: str, client_id: Optional[str] = None,
    reply_to_id: Optional[int] = None, allow_reply: Optional[bool] = None,
) -> Dict[str, Any]:
    conv, _ = require_member(db, conv_id, user)
    ok, why = perm.can_post(db, conv, user)
    if not ok:
        raise HTTPException(403, why)
    if get_sticker(sticker_id) is None:
        raise HTTPException(422, "Sticker inconnu.")
    existing = _find_by_client_id(db, conv.id, user.id, client_id)
    if existing is not None:
        return serialize_one(db, existing)
    _check_reply(db, conv, user, reply_to_id)
    check_rate_limit(user.id)
    msg = _create_message(
        db, conv, user, message_type="sticker", content="", sticker_id=sticker_id, client_id=client_id,
        reply_to_id=reply_to_id, allow_reply=perm.effective_allow_reply(conv, user, allow_reply),
    )
    _remember_sticker(db, user.id, sticker_id)
    return await publish_new_message(db, conv, msg)


async def send_location(
    db: Session, user: User, conv_id: int, latitude: float, longitude: float,
    address: Optional[str] = None, client_id: Optional[str] = None,
    reply_to_id: Optional[int] = None, location_type: str = "live",
) -> Dict[str, Any]:
    conv, _ = require_member(db, conv_id, user)
    ok, why = perm.can_post(db, conv, user)
    if not ok:
        raise HTTPException(403, why)
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise HTTPException(422, "Coordonnées invalides.")
    existing = _find_by_client_id(db, conv.id, user.id, client_id)
    if existing is not None:
        return serialize_one(db, existing)
    _check_reply(db, conv, user, reply_to_id)
    check_rate_limit(user.id)
    if location_type not in ("booking", "live"):
        raise HTTPException(422, "location_type doit être « booking » ou « live ».")
    # Même encodage que le chat par réservation : la carte « en route » / « lieu du
    # rendez-vous » et le suivi continuent de fonctionner.
    encoded = encode_location(latitude, longitude, (address or "").strip()[:500] or None, location_type)
    msg = _create_message(
        db, conv, user, message_type="text", content=encoded, client_id=client_id,
        reply_to_id=reply_to_id, allow_reply=perm.effective_allow_reply(conv, user, None),
    )
    return await publish_new_message(db, conv, msg)


# ---------------------------------------------------------------------------
# Pièces jointes (contrôle de sécurité : type RÉEL détecté par les octets)
# ---------------------------------------------------------------------------
_OFFICE_EXT = {"docx", "xlsx", "pptx"}
_TEXT_EXT = {"txt", "csv"}


def _sanitize_name(name: Optional[str], fallback: str) -> str:
    name = os.path.basename((name or "").replace("\\", "/")).strip()
    name = re.sub(r"[^\w\s.\-()\[\]àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]", "_", name)
    name = re.sub(r"\s+", " ", name).strip(" .")
    return (name or fallback)[:200]


def _check_office_zip(data: bytes, ext: str) -> bool:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            names = zf.namelist()
            if len(names) > 5000 or "[Content_Types].xml" not in names:
                return False
            if any(n.lower().endswith("vbaproject.bin") for n in names):
                return False  # pas de macros
            if sum(i.file_size for i in zf.infolist()) > 300 * 1024 * 1024:
                return False  # zip bomb
            folder = {"docx": "word/", "xlsx": "xl/", "pptx": "ppt/"}[ext]
            return any(n.startswith(folder) for n in names)
    except Exception:  # noqa: BLE001
        return False


def inspect_upload(data: bytes, filename: str, declared_kind: Optional[str]) -> Tuple[str, str, str]:
    """Retourne (message_type, extension, mime) ou lève HTTPException."""
    ext_in = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if data[:3] == b"\xff\xd8\xff":
        return "image", "jpg", "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image", "png", "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image", "webp", "image/webp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image", "gif", "image/gif"

    if data[:5] == b"%PDF-":
        return "file", "pdf", "application/pdf"

    # Audio
    if data[4:8] == b"ftyp":
        return "audio", "m4a", "audio/mp4"
    if data[:3] == b"ID3" or (len(data) > 2 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0 and (data[1] & 0x06) != 0):
        if len(data) > 2 and data[0] == 0xFF and data[1] in (0xF1, 0xF9):
            return "audio", "aac", "audio/aac"
        return "audio", "mp3", "audio/mpeg"
    if data[:4] == b"OggS":
        return "audio", "ogg", "audio/ogg"
    if data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return "audio", "wav", "audio/wav"
    if data[:4] == b"\x1aE\xdf\xa3":
        if declared_kind == "audio":
            return "audio", "webm", "audio/webm"
        raise HTTPException(415, "Format non autorisé.")

    # Office moderne (zip)
    if data[:4] == b"PK\x03\x04" and ext_in in _OFFICE_EXT:
        if not _check_office_zip(data, ext_in):
            raise HTTPException(415, "Document Office invalide ou contenant des macros.")
        mime = {
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        }[ext_in]
        return "file", ext_in, mime

    # Texte brut
    if ext_in in _TEXT_EXT and b"\x00" not in data[:4096]:
        try:
            data[:200000].decode("utf-8")
            return "file", ext_in, "text/plain" if ext_in == "txt" else "text/csv"
        except UnicodeDecodeError:
            pass

    raise HTTPException(
        415,
        "Fichier non autorisé. Formats acceptés : images (JPEG, PNG, WebP, GIF), PDF, "
        "Word/Excel/PowerPoint (sans macros), TXT, CSV et messages audio.",
    )


def _max_bytes_for(kind: str) -> int:
    return {"image": MAX_IMAGE_BYTES, "audio": MAX_AUDIO_BYTES}.get(kind, MAX_FILE_BYTES)


def conv_dir(conv_id: int) -> Path:
    return UPLOAD_DIR / str(conv_id)


def file_path_for(conv_id: int, key: str) -> Optional[Path]:
    if not SAFE_KEY.match(key or ""):
        return None
    path = (conv_dir(conv_id) / key).resolve()
    if UPLOAD_DIR not in path.parents or not path.is_file():
        return None
    return path


def remove_file(conv_id: int, key: Optional[str]) -> None:
    if not key:
        return
    path = file_path_for(conv_id, key)
    if path is not None:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            logger.warning("Messenger : fichier non supprimé", exc_info=True)


async def send_attachment(
    db: Session, user: User, conv_id: int, data: bytes, filename: str, declared_kind: Optional[str] = None,
    caption: Optional[str] = None, client_id: Optional[str] = None, reply_to_id: Optional[int] = None,
    duration_seconds: Optional[int] = None, allow_reply: Optional[bool] = None,
) -> Dict[str, Any]:
    conv, _ = require_member(db, conv_id, user)
    ok, why = perm.can_post(db, conv, user)
    if not ok:
        raise HTTPException(403, why)
    if not data:
        raise HTTPException(422, "Fichier vide.")

    existing = _find_by_client_id(db, conv.id, user.id, client_id)
    if existing is not None:
        return serialize_one(db, existing)

    kind, ext, mime = inspect_upload(data, filename or "", declared_kind)
    if len(data) > _max_bytes_for(kind):
        mb = _max_bytes_for(kind) // (1024 * 1024)
        raise HTTPException(413, f"Fichier trop lourd (maximum {mb} Mo).")
    if declared_kind == "audio" and kind != "audio":
        raise HTTPException(415, "Le fichier n'est pas un message audio valide.")

    _check_reply(db, conv, user, reply_to_id)
    check_rate_limit(user.id)

    folder = conv_dir(conv.id)
    folder.mkdir(parents=True, exist_ok=True)
    key = f"{uuid.uuid4().hex}.{ext}"
    (folder / key).write_bytes(data)

    duration = None
    if kind == "audio" and duration_seconds is not None:
        duration = max(0, min(int(duration_seconds), MAX_AUDIO_SECONDS))

    try:
        msg = _create_message(
            db, conv, user,
            message_type=kind, content=_clean_text(caption), client_id=client_id,
            reply_to_id=reply_to_id, allow_reply=perm.effective_allow_reply(conv, user, allow_reply),
            file_key=key, file_name=_sanitize_name(filename, f"fichier.{ext}"), file_mime=mime,
            file_size=len(data), duration_seconds=duration,
        )
    except Exception:
        db.rollback()
        (folder / key).unlink(missing_ok=True)
        logger.exception("Messenger : enregistrement de la pièce jointe impossible")
        raise HTTPException(500, "Impossible d'enregistrer le fichier.")
    return await publish_new_message(db, conv, msg)


# ---------------------------------------------------------------------------
# Historique
# ---------------------------------------------------------------------------
def load_messages(
    db: Session, user: User, conv_id: int, before_id: Optional[int] = None,
    after_id: Optional[int] = None, limit: int = 50,
) -> Dict[str, Any]:
    conv, member = require_member(db, conv_id, user)
    q = db.query(MessengerMessage).filter(
        MessengerMessage.conversation_id == conv.id,
        MessengerMessage.id > member.hidden_before_id,
        ~MessengerMessage.id.in_(
            db.query(MessengerHidden.message_id).filter(MessengerHidden.user_id == user.id)
        ),
    )
    if after_id:
        rows = q.filter(MessengerMessage.id > after_id).order_by(MessengerMessage.id.asc()).limit(limit).all()
        has_more = False
    else:
        if before_id:
            q = q.filter(MessengerMessage.id < before_id)
        rows = q.order_by(MessengerMessage.id.desc()).limit(limit + 1).all()
        has_more = len(rows) > limit
        rows = list(reversed(rows[:limit]))
    rmap = reply_map_for(db, rows)
    return {"messages": [serialize_message(m, rmap) for m in rows], "has_more": has_more}


def pinned_messages(db: Session, user: User, conv_id: int) -> List[Dict[str, Any]]:
    conv, member = require_member(db, conv_id, user)
    rows = (
        db.query(MessengerMessage)
        .filter(
            MessengerMessage.conversation_id == conv.id,
            MessengerMessage.is_pinned.is_(True),
            MessengerMessage.deleted_at.is_(None),
            MessengerMessage.id > member.hidden_before_id,
        )
        .order_by(MessengerMessage.pinned_at.desc())
        .all()
    )
    rmap = reply_map_for(db, rows)
    return [serialize_message(m, rmap) for m in rows]


# ---------------------------------------------------------------------------
# Reçus : envoyé ✓ / reçu ✓✓ / vu
# ---------------------------------------------------------------------------
async def mark_delivered(db: Session, user: User, conv_id: int, up_to_id: Optional[int] = None) -> bool:
    conv, member = require_member(db, conv_id, user)
    target = min(up_to_id, conv.last_message_id or 0) if up_to_id else (conv.last_message_id or 0)
    if target <= member.last_delivered_message_id:
        return False
    member.last_delivered_message_id = target
    db.commit()
    await hub.send_to_users(
        active_member_ids(conv),
        {"type": "receipt", "kind": "delivered", "conversation_id": conv.id, "user_id": user.id, "up_to_id": target},
        exclude_user_id=user.id,
    )
    return True


async def mark_read(db: Session, user: User, conv_id: int, up_to_id: Optional[int] = None) -> bool:
    conv, member = require_member(db, conv_id, user)
    target = min(up_to_id, conv.last_message_id or 0) if up_to_id else (conv.last_message_id or 0)
    if target <= member.last_read_message_id:
        return False
    member.last_read_message_id = target
    member.last_delivered_message_id = max(member.last_delivered_message_id, target)
    if conv.booking_id:
        # le badge « non lus » de l'ancien chat repose sur is_read
        db.query(ChatMessage).filter(
            ChatMessage.booking_id == conv.booking_id, ChatMessage.sender_id != user.id,
            ChatMessage.id <= target, ChatMessage.is_read.is_(False),
        ).update({ChatMessage.is_read: True, ChatMessage.read_at: datetime.utcnow()}, synchronize_session=False)
    db.commit()
    await hub.send_to_users(
        active_member_ids(conv),
        {"type": "receipt", "kind": "read", "conversation_id": conv.id, "user_id": user.id, "up_to_id": target},
        exclude_user_id=user.id,
    )
    return True


async def deliver_pending(db: Session, user: User) -> None:
    """À la connexion : tout ce qui est arrivé hors ligne passe en « reçu »."""
    rows = (
        db.query(MessengerMember, MessengerConversation)
        .join(MessengerConversation, MessengerConversation.id == MessengerMember.conversation_id)
        .filter(MessengerMember.user_id == user.id, MessengerMember.left_at.is_(None))
        .all()
    )
    for member, conv in rows:
        last = conv.last_message_id or 0
        if last > member.last_delivered_message_id:
            member.last_delivered_message_id = last
            db.commit()
            await hub.send_to_users(
                active_member_ids(conv),
                {"type": "receipt", "kind": "delivered", "conversation_id": conv.id,
                 "user_id": user.id, "up_to_id": last},
                exclude_user_id=user.id,
            )


async def send_typing(db: Session, user: User, conv_id: int, is_typing: bool) -> None:
    conv = get_conversation_or_404(db, conv_id)
    if perm.get_member(db, conv_id, user.id) is None:
        return
    await hub.send_to_users(
        active_member_ids(conv),
        {"type": "typing", "conversation_id": conv.id, "user_id": user.id,
         "name": user.fullname, "is_typing": bool(is_typing)},
        exclude_user_id=user.id,
    )


# ---------------------------------------------------------------------------
# Modifier / supprimer / réagir / épingler / transférer
# ---------------------------------------------------------------------------
def _get_message_for_member(db: Session, user: User, message_id: int):
    msg = db.query(MessengerMessage).filter(MessengerMessage.id == message_id).first()
    if msg is None:
        raise HTTPException(404, "Message introuvable")
    conv, member = require_member(db, msg.conversation_id, user)
    return msg, conv, member


async def _publish_update(db: Session, conv: MessengerConversation, msg: MessengerMessage) -> Dict[str, Any]:
    data = serialize_one(db, msg)
    await hub.send_to_users(
        active_member_ids(conv), {"type": "message_updated", "conversation_id": conv.id, "message": data}
    )
    return data


async def edit_message(db: Session, user: User, message_id: int, text: str) -> Dict[str, Any]:
    msg, conv, _ = _get_message_for_member(db, user, message_id)
    if not perm.can_edit(user, msg):
        raise HTTPException(403, "Ce message ne peut plus être modifié.")
    ok, why = perm.can_post(db, conv, user)
    if not ok:
        raise HTTPException(403, why)
    text = _clean_text(text)
    if not text:
        raise HTTPException(422, "Le message ne peut pas être vide.")
    msg.content = text
    msg.edited_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)
    return await _publish_update(db, conv, msg)


async def delete_message(db: Session, user: User, message_id: int, scope: str = "all") -> Dict[str, Any]:
    msg, conv, _ = _get_message_for_member(db, user, message_id)
    if scope == "me":
        if not db.query(MessengerHidden).filter_by(message_id=msg.id, user_id=user.id).first():
            db.add(MessengerHidden(message_id=msg.id, user_id=user.id))
            db.commit()
        return {"success": True, "scope": "me", "id": msg.id, "conversation_id": conv.id}

    if not perm.can_delete_for_all(user, msg):
        raise HTTPException(403, "Vous ne pouvez supprimer que vos propres messages.")
    file_key = msg.file_key
    msg.deleted_at = datetime.utcnow()
    msg.deleted_by_id = user.id
    msg.content = ""
    msg.file_key = None
    msg.is_pinned = False
    db.commit()
    remove_file(conv.id, file_key)
    await hub.send_to_users(
        active_member_ids(conv),
        {"type": "message_deleted", "conversation_id": conv.id, "message_id": msg.id},
    )
    return {"success": True, "scope": "all", "id": msg.id, "conversation_id": conv.id}


async def react(db: Session, user: User, message_id: int, emoji: Optional[str]) -> Dict[str, Any]:
    msg, conv, _ = _get_message_for_member(db, user, message_id)
    if msg.deleted_at is not None or msg.message_type == "system":
        raise HTTPException(422, "Impossible de réagir à ce message.")
    existing = db.query(MessengerReaction).filter_by(message_id=msg.id, user_id=user.id).first()
    if not emoji or (existing is not None and existing.emoji == emoji):
        if existing is not None:
            db.delete(existing)  # même réaction = on la retire
    else:
        if emoji not in REACTION_EMOJIS:
            raise HTTPException(422, "Réaction non autorisée.")
        if existing is not None:
            existing.emoji = emoji
            existing.created_at = datetime.utcnow()
        else:
            db.add(MessengerReaction(message_id=msg.id, user_id=user.id, emoji=emoji))
    db.commit()
    db.refresh(msg)
    data = serialize_one(db, msg)
    await hub.send_to_users(
        active_member_ids(conv),
        {"type": "reaction", "conversation_id": conv.id, "message_id": msg.id, "reactions": data["reactions"]},
    )
    return data


async def set_pinned(db: Session, user: User, message_id: int, pinned: bool) -> Dict[str, Any]:
    msg, conv, _ = _get_message_for_member(db, user, message_id)
    if not perm.can_pin(user, conv):
        raise HTTPException(403, "Seuls les administrateurs peuvent épingler dans ce groupe.")
    if msg.deleted_at is not None or msg.message_type == "system":
        raise HTTPException(422, "Impossible d'épingler ce message.")
    msg.is_pinned = bool(pinned)
    msg.pinned_at = datetime.utcnow() if pinned else None
    msg.pinned_by_id = user.id if pinned else None
    db.commit()
    db.refresh(msg)
    return await _publish_update(db, conv, msg)


_FORWARDABLE = {"text", "image", "file", "audio", "sticker", "location"}


async def forward_message(
    db: Session, user: User, message_id: int, target_ids: List[int]
) -> Dict[str, Any]:
    src, src_conv, _ = _get_message_for_member(db, user, message_id)
    if src.deleted_at is not None or src.message_type not in _FORWARDABLE:
        raise HTTPException(422, "Ce message ne peut pas être transféré.")
    sender_name = getattr(src.sender, "fullname", None) or "Utilisateur"
    done, failed = [], []

    for target_id in list(dict.fromkeys(target_ids))[:10]:
        try:
            conv, _m = require_member(db, target_id, user)
            ok, why = perm.can_post(db, conv, user)
            if not ok:
                raise HTTPException(403, why)
            check_rate_limit(user.id)
            fields: Dict[str, Any] = dict(
                message_type=src.message_type, content=src.content or "", is_forwarded=True,
                forwarded_from_name=sender_name, sticker_id=src.sticker_id,
                image_url=src.image_url,
                allow_reply=perm.effective_allow_reply(conv, user, None),
            )
            new_key = None
            if src.file_key:
                source_path = file_path_for(src_conv.id, src.file_key)
                if source_path is None:
                    raise HTTPException(410, "Le fichier n'est plus disponible.")
                conv_dir(conv.id).mkdir(parents=True, exist_ok=True)
                new_key = f"{uuid.uuid4().hex}.{src.file_key.rsplit('.', 1)[-1]}"
                shutil.copyfile(source_path, conv_dir(conv.id) / new_key)
                fields.update(file_key=new_key, file_name=src.file_name, file_mime=src.file_mime,
                              file_size=src.file_size, duration_seconds=src.duration_seconds)
            msg = _create_message(db, conv, user, **fields)
            await publish_new_message(db, conv, msg)
            done.append(conv.id)
        except HTTPException as exc:
            db.rollback()
            failed.append({"conversation_id": target_id, "detail": exc.detail})
    return {"forwarded_to": done, "failed": failed}


# ---------------------------------------------------------------------------
# Réglages personnels d'une conversation
# ---------------------------------------------------------------------------
async def update_my_settings(
    db: Session, user: User, conv_id: int, is_pinned: Optional[bool], is_archived: Optional[bool],
    is_muted: Optional[bool],
) -> Dict[str, Any]:
    conv, member = require_member(db, conv_id, user)
    if is_pinned is not None:
        member.is_pinned = is_pinned
    if is_archived is not None:
        member.is_archived = is_archived
        if is_archived:
            member.is_pinned = False
    if is_muted is not None:
        member.is_muted = is_muted
    db.commit()
    await hub.send_to_user(user.id, {"type": "conversation_updated", "conversation_id": conv.id})
    return {"success": True, "is_pinned": member.is_pinned, "is_archived": member.is_archived,
            "is_muted": member.is_muted}


async def delete_conversation_for_me(db: Session, user: User, conv_id: int) -> Dict[str, Any]:
    conv, member = require_member(db, conv_id, user)
    if conv.type not in perm.PAIR_TYPES:
        raise HTTPException(422, "Pour un groupe, utilisez « Quitter le groupe ».")
    member.hidden_before_id = conv.last_message_id or 0
    member.is_archived = False
    member.is_pinned = False
    db.commit()
    await hub.send_to_user(user.id, {"type": "conversation_updated", "conversation_id": conv.id})
    return {"success": True}


# ---------------------------------------------------------------------------
# Stickers : favoris et récents
# ---------------------------------------------------------------------------
def _remember_sticker(db: Session, user_id: int, sticker_id: str) -> None:
    try:
        row = db.query(MessengerUserSticker).filter_by(user_id=user_id, sticker_id=sticker_id, kind="recent").first()
        if row is None:
            db.add(MessengerUserSticker(user_id=user_id, sticker_id=sticker_id, kind="recent"))
        else:
            row.used_at = datetime.utcnow()
        db.commit()
        old = (
            db.query(MessengerUserSticker)
            .filter_by(user_id=user_id, kind="recent")
            .order_by(MessengerUserSticker.used_at.desc())
            .offset(24)
            .all()
        )
        for r in old:
            db.delete(r)
        if old:
            db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()


def user_stickers(db: Session, user_id: int) -> Dict[str, List[str]]:
    rows = (
        db.query(MessengerUserSticker)
        .filter(MessengerUserSticker.user_id == user_id)
        .order_by(MessengerUserSticker.used_at.desc())
        .all()
    )
    return {
        "favorites": [r.sticker_id for r in rows if r.kind == "favorite"],
        "recents": [r.sticker_id for r in rows if r.kind == "recent"][:24],
    }


def set_favorite_sticker(db: Session, user_id: int, sticker_id: str, favorite: bool) -> None:
    if get_sticker(sticker_id) is None:
        raise HTTPException(422, "Sticker inconnu.")
    row = db.query(MessengerUserSticker).filter_by(user_id=user_id, sticker_id=sticker_id, kind="favorite").first()
    if favorite and row is None:
        db.add(MessengerUserSticker(user_id=user_id, sticker_id=sticker_id, kind="favorite"))
    elif not favorite and row is not None:
        db.delete(row)
    db.commit()


# ---------------------------------------------------------------------------
# Blocage / signalement
# ---------------------------------------------------------------------------
def block_user(db: Session, me: User, other_id: int) -> None:
    other = db.query(User).filter(User.id == other_id).first()
    if other is None or other.id == me.id:
        raise HTTPException(404, "Utilisateur introuvable")
    if perm.is_admin(other):
        raise HTTPException(403, "Un administrateur ne peut pas être bloqué.")
    if not db.query(MessengerBlock).filter_by(blocker_id=me.id, blocked_id=other.id).first():
        db.add(MessengerBlock(blocker_id=me.id, blocked_id=other.id))
        db.commit()


def unblock_user(db: Session, me: User, other_id: int) -> None:
    db.query(MessengerBlock).filter_by(blocker_id=me.id, blocked_id=other_id).delete()
    db.commit()


def list_blocks(db: Session, me: User) -> List[Dict[str, Any]]:
    return [user_brief(b.blocked) for b in db.query(MessengerBlock).filter_by(blocker_id=me.id).all()]


def report_message(db: Session, me: User, message_id: int, reason: str, details: Optional[str]) -> int:
    msg, conv, _ = _get_message_for_member(db, me, message_id)
    if reason not in REPORT_REASONS:
        raise HTTPException(422, "Motif de signalement invalide.")
    if msg.sender_id == me.id:
        raise HTTPException(422, "Vous ne pouvez pas signaler votre propre message.")
    rep = MessengerReport(
        reporter_id=me.id, reported_user_id=msg.sender_id, conversation_id=conv.id, message_id=msg.id,
        message_snapshot=preview_of(msg) if msg.message_type != "text" else (msg.content or "")[:1000],
        reason=reason, details=(details or "").strip()[:500] or None,
    )
    db.add(rep)
    db.commit()
    return rep.id


# ---------------------------------------------------------------------------
# Contacts & recherche
# ---------------------------------------------------------------------------
def _like(q: str) -> str:
    return "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def list_contacts(db: Session, me: User, q: Optional[str], limit: int = 40) -> List[Dict[str, Any]]:
    base = db.query(User).filter(User.is_active.is_(True), User.deleted_at.is_(None), User.id != me.id)
    role = perm.role_of(me)
    if role == "CLIENT":
        t_ids = [r[0] for r in db.query(Booking.therapist_id).filter(
            Booking.client_id == me.id, Booking.therapist_id.isnot(None),
            Booking.status.in_(perm.BOOKING_OK_STATUSES)).distinct().all()]
        base = base.filter(or_(User.id.in_(t_ids or [0]), User.role == "ADMIN"))
    elif role == "THERAPIST":
        c_ids = [r[0] for r in db.query(Booking.client_id).filter(
            Booking.therapist_id == me.id, Booking.status.in_(perm.BOOKING_OK_STATUSES)).distinct().all()]
        base = base.filter(or_(User.id.in_(c_ids or [0]), User.role == "ADMIN"))
    if q and q.strip():
        base = base.filter(User.fullname.ilike(_like(q.strip()), escape="\\"))
    users = base.order_by(User.fullname.asc()).limit(limit).all()

    seen = last_seen_map(db, [u.id for u in users])
    keys = {perm.direct_key(me.id, u.id): u.id for u in users}
    existing = {
        c.direct_key: c.id
        for c in db.query(MessengerConversation).filter(MessengerConversation.direct_key.in_(list(keys)))
    } if keys else {}
    return [
        {**peer_brief(u, seen), "conversation_id": existing.get(perm.direct_key(me.id, u.id))}
        for u in users
    ]


def search(db: Session, me: User, q: str, conversation_id: Optional[int] = None, limit: int = 30) -> Dict[str, Any]:
    q = (q or "").strip()
    if len(q) < 2:
        return {"messages": [], "conversations": []}
    pattern = _like(q)

    mq = (
        db.query(MessengerMessage)
        .join(
            MessengerMember,
            and_(
                MessengerMember.conversation_id == MessengerMessage.conversation_id,
                MessengerMember.user_id == me.id,
                MessengerMember.left_at.is_(None),
            ),
        )
        .filter(
            MessengerMessage.id > MessengerMember.hidden_before_id,
            MessengerMessage.deleted_at.is_(None),
            MessengerMessage.message_type.in_(["text", "file", "image", "audio"]),
            ~MessengerMessage.content.startswith(LOC_PREFIX),
            or_(
                MessengerMessage.content.ilike(pattern, escape="\\"),
                MessengerMessage.file_name.ilike(pattern, escape="\\"),
            ),
        )
    )
    if conversation_id:
        mq = mq.filter(MessengerMessage.conversation_id == conversation_id)
    rows = mq.order_by(MessengerMessage.id.desc()).limit(limit).all()
    rmap = reply_map_for(db, rows)

    titles: Dict[int, str] = {}
    for conv_id in {m.conversation_id for m in rows}:
        conv = db.query(MessengerConversation).filter_by(id=conv_id).first()
        if conv is None:
            continue
        if conv.type in perm.PAIR_TYPES:
            peer = perm.peer_of(db, conv, me.id)
            titles[conv_id] = peer.fullname if peer else "Conversation"
        else:
            titles[conv_id] = conv.title or "Groupe"

    messages = []
    for m in rows:
        item = serialize_message(m, rmap)
        item["conversation_title"] = titles.get(m.conversation_id, "")
        messages.append(item)

    conversations = []
    if not conversation_id:
        for c in list_conversations(db, me, archived=False) + list_conversations(db, me, archived=True):
            if q.lower() in (c["title"] or "").lower():
                conversations.append(c)
    return {"messages": messages, "conversations": conversations[:15]}
