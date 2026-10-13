# app/api/chat.py
# ============================================================================
# API REST du chat client <-> thérapeute (une réservation = une conversation).
#
#   GET    /chat/history/{booking_id}      historique
#   POST   /chat/send/{booking_id}         envoi texte (secours si WebSocket coupé)
#   POST   /chat/send-image/{booking_id}   envoi d'une image (multipart)
#   PUT    /chat/read/{booking_id}         marquer comme lu
#   GET    /chat/unread                    badge : total + par réservation
#   GET    /chat/conversations             liste des conversations
#   GET    /chat/peer/{booking_id}         interlocuteur (nom, photo, en ligne ?)
#   DELETE /chat/message/{message_id}      suppression (expéditeur uniquement)
#   GET    /chat/files/{booking_id}/{name} image (participants uniquement)
#
# Les images sont enregistrées dans CHAT_UPLOAD_DIR (défaut : private_uploads/chat).
# NE PAS monter ce dossier avec StaticFiles : il doit rester privé.
#
# Sécurité : toutes les routes vérifient que l'utilisateur est le client OU le
# thérapeute de la réservation. Les images sont stockées hors dossier public et
# servies uniquement après authentification.
# ============================================================================
import inspect
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import (
    APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile, status,
)
from fastapi.responses import FileResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.booking import Booking
from ..models.chat_message import ChatMessage
from ..models.user import User
from ..schemas.chat import ChatSendRequest
from ..services.chat_notifications import (
    mark_messages_read,
    notify_new_message,
    utc_iso,
)
from ..services.websocket_manager import manager

try:  # authentification par token en query (pour <img src="...?token=...">)
    from ..core.dependencies import get_current_user_ws
except Exception:  # noqa: BLE001
    get_current_user_ws = None

router = APIRouter(prefix="/chat", tags=["Chat"])
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration des fichiers
# ---------------------------------------------------------------------------
CHAT_UPLOAD_DIR = Path(os.getenv("CHAT_UPLOAD_DIR", "private_uploads/chat")).resolve()
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 Mo
SAFE_NAME = re.compile(r"^[a-f0-9]{32}\.(jpg|png|webp)$")


def _detect_image_ext(data: bytes) -> Optional[str]:
    """Détermine le type RÉEL du fichier par ses premiers octets
    (on ne fait pas confiance au Content-Type ni au nom envoyés)."""
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


MIME_BY_EXT = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_booking_or_403(db: Session, booking_id: int, user: User) -> Booking:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Réservation introuvable")
    if user.id not in (booking.client_id, booking.therapist_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé à cette conversation")
    return booking


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return utc_iso(dt) if isinstance(dt, datetime) else None


def _serialize(msg: ChatMessage, me_id: Optional[int] = None) -> Dict[str, Any]:
    deleted = msg.deleted_at is not None
    sender = msg.sender
    return {
        "id": msg.id,
        "booking_id": msg.booking_id,
        "sender_id": msg.sender_id,
        "sender_name": getattr(sender, "fullname", None) or "",
        "content": "" if deleted else (msg.content or ""),
        "message_type": msg.message_type or "text",
        "image_url": None if deleted else msg.image_url,
        "client_id": msg.client_id,
        "is_read": bool(msg.is_read),
        "status": "read" if msg.is_read else "delivered",
        "deleted": deleted,
        "created_at": _iso(msg.created_at),
        "read_at": _iso(msg.read_at),
    }


async def _broadcast(booking_id: int, payload: Dict[str, Any]) -> None:
    try:
        await manager.broadcast_to_room(f"chat_{booking_id}", payload)
    except Exception:  # noqa: BLE001
        logger.exception("Chat : diffusion WebSocket impossible")


def _save_message(
    db: Session,
    booking: Booking,
    sender: User,
    content: str,
    message_type: str = "text",
    image_url: Optional[str] = None,
    client_id: Optional[str] = None,
) -> ChatMessage:
    row = ChatMessage(
        booking_id=booking.id,
        sender_id=sender.id,
        content=content,
        message_type=message_type,
        image_url=image_url,
        client_id=client_id,
        is_read=False,
        created_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _ws_payload(row: ChatMessage, sender: User) -> Dict[str, Any]:
    """Même format que le message diffusé par /ws/chat/{booking_id}."""
    return {
        "type": "message",
        "id": row.id,
        "client_id": row.client_id,
        "booking_id": row.booking_id,
        "user_id": sender.id,
        "username": getattr(sender, "fullname", None) or "Utilisateur",
        "message": row.content or "",
        "message_type": row.message_type,
        "image_url": row.image_url,
        "timestamp": _iso(row.created_at),
    }


# ---------------------------------------------------------------------------
# Historique
# ---------------------------------------------------------------------------
@router.get("/history/{booking_id}")
def get_history(
    booking_id: int,
    limit: int = Query(200, ge=1, le=500),
    before_id: Optional[int] = Query(None, ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_booking_or_403(db, booking_id, current_user)

    query = db.query(ChatMessage).filter(ChatMessage.booking_id == booking_id)
    if before_id:
        query = query.filter(ChatMessage.id < before_id)
    rows = query.order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc()).limit(limit).all()
    rows.reverse()
    return [_serialize(r, current_user.id) for r in rows]


# ---------------------------------------------------------------------------
# Envoi texte (REST de secours)
# ---------------------------------------------------------------------------
@router.post("/send/{booking_id}")
async def send_message(
    booking_id: int,
    payload: ChatSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = _get_booking_or_403(db, booking_id, current_user)

    # Idempotence : un renvoi avec le même client_id ne crée pas de doublon
    if payload.client_id:
        existing = (
            db.query(ChatMessage)
            .filter(
                ChatMessage.booking_id == booking_id,
                ChatMessage.sender_id == current_user.id,
                ChatMessage.client_id == payload.client_id,
            )
            .first()
        )
        if existing:
            return _serialize(existing, current_user.id)

    row = _save_message(db, booking, current_user, payload.message, client_id=payload.client_id)
    await _broadcast(booking_id, _ws_payload(row, current_user))
    await notify_new_message(db, booking, current_user, payload.message, message_id=row.id)
    return _serialize(row, current_user.id)


# ---------------------------------------------------------------------------
# Envoi d'image
# ---------------------------------------------------------------------------
@router.post("/send-image/{booking_id}")
async def send_image(
    booking_id: int,
    image: UploadFile = File(...),
    client_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = _get_booking_or_403(db, booking_id, current_user)

    if client_id and len(client_id) > 64:
        raise HTTPException(422, "client_id trop long")

    # Lecture bornée : on ne charge jamais plus de MAX_IMAGE_BYTES + 1 octets
    data = await image.read(MAX_IMAGE_BYTES + 1)
    if not data:
        raise HTTPException(422, "Fichier vide")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image trop lourde (maximum 5 Mo)")

    ext = _detect_image_ext(data)
    if ext is None:
        raise HTTPException(415, "Format non supporté (JPEG, PNG ou WebP uniquement)")

    folder = CHAT_UPLOAD_DIR / str(booking_id)
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.{ext}"
    (folder / name).write_bytes(data)

    image_url = f"/chat/files/{booking_id}/{name}"
    try:
        row = _save_message(
            db, booking, current_user, "", "image", image_url, client_id=client_id
        )
    except Exception:
        db.rollback()
        (folder / name).unlink(missing_ok=True)
        logger.exception("Chat : enregistrement de l'image impossible")
        raise HTTPException(500, "Impossible d'enregistrer l'image")

    await _broadcast(booking_id, _ws_payload(row, current_user))
    await notify_new_message(
        db, booking, current_user, "", message_id=row.id, message_type="image"
    )
    return _serialize(row, current_user.id)


# ---------------------------------------------------------------------------
# Lecture des images (authentifiée)
#   - app mobile : en-tête Authorization
#   - web (<img>) : ?token=...  (un <img> ne peut pas envoyer d'en-tête)
# ---------------------------------------------------------------------------
def _clean_token(token: Optional[str]) -> str:
    if not token:
        return ""
    t = str(token).strip().strip('"')
    return t[7:].strip() if t.lower().startswith("bearer ") else t


async def _user_from_token(token: str, db: Session) -> Optional[User]:
    if not token or get_current_user_ws is None:
        return None
    try:
        kwargs = {}
        for name in inspect.signature(get_current_user_ws).parameters:
            lname = name.lower()
            if lname in ("token", "access_token", "jwt"):
                kwargs[name] = token
            elif lname in ("db", "session"):
                kwargs[name] = db
        user = get_current_user_ws(**kwargs)
        if inspect.isawaitable(user):
            user = await user
        return user if getattr(user, "id", None) is not None else None
    except Exception:  # noqa: BLE001
        logger.warning("Chat : token de fichier invalide", exc_info=True)
        return None


@router.get("/files/{booking_id}/{filename}")
async def get_chat_file(
    booking_id: int,
    filename: str,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    # Nom strictement contrôlé : aucune traversée de dossier possible
    if not SAFE_NAME.match(filename):
        raise HTTPException(404, "Fichier introuvable")

    user = await _user_from_token(_clean_token(token or authorization), db)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentification requise")

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking or user.id not in (booking.client_id, booking.therapist_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

    path = (CHAT_UPLOAD_DIR / str(booking_id) / filename).resolve()
    if CHAT_UPLOAD_DIR not in path.parents or not path.is_file():
        raise HTTPException(404, "Fichier introuvable")

    return FileResponse(
        path,
        media_type=MIME_BY_EXT[filename.rsplit(".", 1)[1]],
        headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"},
    )


# ---------------------------------------------------------------------------
# Lu / non lu
# ---------------------------------------------------------------------------
@router.put("/read/{booking_id}")
async def mark_read(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = _get_booking_or_403(db, booking_id, current_user)
    count = mark_messages_read(db, booking, current_user)
    if count:
        await _broadcast(
            booking_id,
            {"type": "read", "reader_id": current_user.id, "timestamp": utc_iso()},
        )
    return {"success": True, "updated": count}


def _my_booking_ids(db: Session, user_id: int) -> list:
    rows = db.query(Booking.id).filter(
        or_(Booking.client_id == user_id, Booking.therapist_id == user_id)
    ).all()
    return [row[0] for row in rows]


@router.get("/unread")
def get_unread(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(ChatMessage.booking_id, func.count(ChatMessage.id))
        .filter(
            ChatMessage.booking_id.in_(_my_booking_ids(db, current_user.id) or [0]),
            ChatMessage.sender_id != current_user.id,
            ChatMessage.is_read.is_(False),
            ChatMessage.deleted_at.is_(None),
        )
        .group_by(ChatMessage.booking_id)
        .all()
    )
    by_booking = {str(bid): int(n) for bid, n in rows}
    total = sum(by_booking.values())
    return {"unread_count": total, "count": total, "by_booking": by_booking}


# ---------------------------------------------------------------------------
# Liste des conversations
# ---------------------------------------------------------------------------
@router.get("/conversations")
def get_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = current_user.id
    bookings = {
        b.id: b
        for b in db.query(Booking)
        .filter(or_(Booking.client_id == uid, Booking.therapist_id == uid))
        .all()
    }
    if not bookings:
        return []

    ids = list(bookings.keys())

    # Dernier message de chaque réservation
    last_ids = (
        db.query(func.max(ChatMessage.id))
        .filter(ChatMessage.booking_id.in_(ids))
        .group_by(ChatMessage.booking_id)
        .all()
    )
    last_messages = {
        m.booking_id: m
        for m in db.query(ChatMessage)
        .filter(ChatMessage.id.in_([i for (i,) in last_ids]))
        .all()
    } if last_ids else {}

    unread_rows = (
        db.query(ChatMessage.booking_id, func.count(ChatMessage.id))
        .filter(
            ChatMessage.booking_id.in_(ids),
            ChatMessage.sender_id != uid,
            ChatMessage.is_read.is_(False),
            ChatMessage.deleted_at.is_(None),
        )
        .group_by(ChatMessage.booking_id)
        .all()
    )
    unread = {bid: int(n) for bid, n in unread_rows}

    other_ids = {
        (b.therapist_id if b.client_id == uid else b.client_id) for b in bookings.values()
    }
    others = {u.id: u for u in db.query(User).filter(User.id.in_(other_ids)).all()} if other_ids else {}

    result = []
    for booking_id, last in last_messages.items():
        b = bookings[booking_id]
        other = others.get(b.therapist_id if b.client_id == uid else b.client_id)
        if last.deleted_at:
            preview = "Message supprimé"
        elif last.message_type == "image":
            preview = "📷 Photo"
        else:
            preview = (last.content or "").replace("\n", " ")[:120]
        result.append({
            "booking_id": booking_id,
            "booking_status": getattr(b, "status", None),
            "other_user": {
                "id": getattr(other, "id", None),
                "fullname": getattr(other, "fullname", None) or "Utilisateur",
                "profile_image": getattr(other, "profile_image", None),
                "role": getattr(other, "role", None),
                "is_online": bool(getattr(other, "is_online", False)),
            },
            "last_message": {
                "id": last.id,
                "preview": preview,
                "sender_id": last.sender_id,
                "message_type": last.message_type,
                "created_at": _iso(last.created_at),
            },
            "unread_count": unread.get(booking_id, 0),
        })

    result.sort(key=lambda c: c["last_message"]["created_at"] or "", reverse=True)
    return result


# ---------------------------------------------------------------------------
# Interlocuteur de la conversation (en-tête du chat : nom, photo, « Actif
# maintenant »). Réservé aux deux participants : GET /users/{id} est refusé
# (403) pour un utilisateur qui consulte le profil d'un autre.
# ---------------------------------------------------------------------------
@router.get("/peer/{booking_id}")
def get_peer(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = _get_booking_or_403(db, booking_id, current_user)
    other_id = booking.therapist_id if booking.client_id == current_user.id else booking.client_id
    other = db.query(User).filter(User.id == other_id).first() if other_id else None
    if other is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Interlocuteur introuvable")

    role = getattr(other, "role", None)
    return {
        "id": other.id,
        "fullname": other.fullname or "Utilisateur",
        "profile_image": other.profile_image,
        "role": getattr(role, "value", role),
        "is_online": bool(other.is_online),
    }


# ---------------------------------------------------------------------------
# Suppression (soft delete, expéditeur uniquement)
# ---------------------------------------------------------------------------
@router.delete("/message/{message_id}")
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not msg:
        raise HTTPException(404, "Message introuvable")

    # Doit appartenir à la conversation ET être l'auteur du message
    _get_booking_or_403(db, msg.booking_id, current_user)
    if msg.sender_id != current_user.id:
        raise HTTPException(403, "Vous ne pouvez supprimer que vos propres messages")
    if msg.deleted_at is not None:
        return {"success": True, "id": msg.id}

    image_url = msg.image_url
    msg.deleted_at = datetime.utcnow()
    msg.content = ""
    msg.image_url = None
    db.commit()

    # Suppression physique du fichier image
    if image_url:
        match = re.match(r"^/chat/files/(\d+)/([a-f0-9]{32}\.(?:jpg|png|webp))$", image_url)
        if match:
            try:
                (CHAT_UPLOAD_DIR / match.group(1) / match.group(2)).unlink(missing_ok=True)
            except OSError:
                logger.warning("Chat : fichier image non supprimé", exc_info=True)

    await _broadcast(
        msg.booking_id,
        {"type": "message_deleted", "id": msg.id, "booking_id": msg.booking_id,
         "timestamp": utc_iso()},
    )
    return {"success": True, "id": msg.id}
