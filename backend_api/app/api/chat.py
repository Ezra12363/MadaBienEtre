# app/api/chat.py
# ============================================================================
# API REST du chat client <-> thérapeute (une réservation = une conversation).
#
#   GET    /chat/history/{booking_id}      historique
#   POST   /chat/send/{booking_id}         envoi texte (secours si WebSocket coupé)
#   POST   /chat/send-image/{booking_id}   envoi d'une image (multipart)
#   POST   /chat/send-location/{booking_id}  partage de position (booking | live)
#   GET    /chat/booking-location/{booking_id}  lieu de la réservation (adresse + GPS)
#   POST   /chat/share-booking/{booking_id}   partage adresse + infos de la réservation
#   PUT    /chat/read/{booking_id}         marquer comme lu
#   GET    /chat/unread                    badge : total + par réservation
#   GET    /chat/conversations             liste des conversations
#   GET    /chat/peer/{booking_id}         interlocuteur (nom, photo, en ligne ?)
#   DELETE /chat/message/{message_id}      suppression (expéditeur uniquement)
#   DELETE /chat/messages/{booking_id}/mine  supprimer TOUS mes messages de la conversation
#   DELETE /chat/mine/{booking_id}         supprime TOUS mes messages de la conversation
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
import json
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import (
    APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile, status,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
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


# ---------------------------------------------------------------------------
# Position partagée — AUCUNE nouvelle table ni colonne.
# Le message est enregistré comme un message texte normal dans chat_messages ;
# le champ `content` contient  [[loc]]{"lat":..,"lng":..,"address":..,"type":..}
# et l'API le « décode » : le mobile reçoit message_type="location" avec
# latitude, longitude, address, location_type.
# ---------------------------------------------------------------------------
LOC_PREFIX = "[[loc]]"
LOCATION_TYPES = ("booking", "live")


def _encode_location(
    lat: Optional[float],
    lng: Optional[float],
    address: Optional[str],
    loc_type: str,
    info: Optional[Dict[str, Any]] = None,
) -> str:
    data: Dict[str, Any] = {"lat": lat, "lng": lng, "address": address, "type": loc_type}
    if info:
        data["info"] = info
    return LOC_PREFIX + json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def _decode_location(content: Optional[str]) -> Optional[Dict[str, Any]]:
    """Retourne {latitude, longitude, address, location_type, booking_info} ou None."""
    if not content or not content.startswith(LOC_PREFIX):
        return None
    try:
        data = json.loads(content[len(LOC_PREFIX):])
        if not isinstance(data, dict):
            return None
    except ValueError:
        return None

    lat = lng = None
    if data.get("lat") is not None and data.get("lng") is not None:
        try:
            lat, lng = float(data["lat"]), float(data["lng"])
        except (TypeError, ValueError):
            return None
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            return None

    address = str(data["address"])[:500] if data.get("address") else None
    if lat is None and not address:
        return None  # ni coordonnées ni adresse : rien à afficher

    info = data.get("info")
    booking_info = (
        {str(k)[:30]: str(v)[:200] for k, v in info.items() if v not in (None, "")}
        if isinstance(info, dict)
        else None
    ) or None

    loc_type = data.get("type") if data.get("type") in LOCATION_TYPES else "live"
    return {
        "latitude": lat,
        "longitude": lng,
        "address": address,
        "location_type": loc_type,
        "booking_info": booking_info,
    }


def _location_label(loc: Dict[str, Any]) -> str:
    """Texte lisible (notification, anciens clients) — jamais le JSON brut."""
    info = loc.get("booking_info")
    if info:
        parts = [f"📋 Réservation {info.get('ref', '')}".strip()]
        if info.get("service"):
            parts.append(info["service"])
        if info.get("date"):
            parts.append(info["date"])
        label = " · ".join(parts)
    else:
        label = "📍 Lieu du rendez-vous" if loc["location_type"] == "booking" else "📍 Position actuelle"
    return f"{label} — {loc['address']}" if loc.get("address") else label


def _location_view(content: Optional[str], deleted: bool = False) -> Dict[str, Any]:
    """Champs à fusionner dans la réponse JSON (message_type, content, position)."""
    loc = None if deleted else _decode_location(content)
    if loc is None:
        return {}
    return {"message_type": "location", "content": _location_label(loc), **loc}


def _serialize(msg: ChatMessage, me_id: Optional[int] = None) -> Dict[str, Any]:
    deleted = msg.deleted_at is not None
    sender = msg.sender
    data = {
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
    data.update(_location_view(msg.content, deleted))
    return data


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
    payload = {
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
    view = _location_view(row.content)
    if view:
        payload["message_type"] = view["message_type"]
        payload["message"] = view["content"]
        for key in ("latitude", "longitude", "address", "location_type", "booking_info"):
            payload[key] = view[key]
    return payload


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
# Partage de position
#   location_type = "booking" : lieu de la réservation (client)
#   location_type = "live"    : position GPS actuelle (thérapeute en route)
# ---------------------------------------------------------------------------
class LocationSendRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: Optional[str] = Field(None, max_length=500)
    location_type: str = Field("live")
    client_id: Optional[str] = Field(None, max_length=64)


@router.post("/send-location/{booking_id}")
async def send_location(
    booking_id: int,
    payload: LocationSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = _get_booking_or_403(db, booking_id, current_user)

    if payload.location_type not in LOCATION_TYPES:
        raise HTTPException(422, "location_type doit être « booking » ou « live »")

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

    address = (payload.address or "").strip() or None
    encoded = _encode_location(payload.latitude, payload.longitude, address, payload.location_type)
    row = _save_message(db, booking, current_user, encoded, client_id=payload.client_id)

    await _broadcast(booking_id, _ws_payload(row, current_user))
    try:
        # texte lisible pour la notification (jamais le JSON brut)
        await notify_new_message(
            db,
            booking,
            current_user,
            _location_label(_decode_location(encoded)),
            message_id=row.id,
        )
    except Exception:  # noqa: BLE001 - la notification ne doit jamais bloquer l'envoi
        logger.exception("Chat : notification de position impossible")
    return _serialize(row, current_user.id)


_STATUS_FR = {
    "pending": "En attente",
    "negotiation": "En négociation",
    "negotiating": "En négociation",
    "accepted": "Acceptée",
    "confirmed": "Confirmée",
    "on_the_way": "Thérapeute en route",
    "in_progress": "En cours",
    "completed": "Terminée",
    "cancelled": "Annulée",
    "canceled": "Annulée",
}


def _fmt_booking_date(value: Any) -> Optional[str]:
    """Date de la réservation en heure de Madagascar (UTC+3)."""
    if not value:
        return None
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone(timedelta(hours=3))).strftime("%d/%m/%Y à %H:%M")
    return str(value)


def _fmt_price(value: Any) -> Optional[str]:
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return None
    return f"{int(round(amount)):,}".replace(",", " ") + " Ar"


def _booking_info(db: Session, booking: Booking) -> Dict[str, Any]:
    """Résumé lisible de la réservation (tout est lu côté serveur : les trois
    écrans — historique client, suivi client, navigation thérapeute — partagent
    exactement les mêmes informations)."""
    client = db.query(User).filter(User.id == booking.client_id).first()
    mtype = getattr(booking, "massage_type", None)
    status_raw = getattr(booking, "status", None)
    status_raw = str(getattr(status_raw, "value", status_raw) or "").lower()
    duration = getattr(booking, "scheduled_duration_minutes", None) or getattr(
        booking, "duration_minutes", None
    )
    price = getattr(booking, "final_price", None) or getattr(booking, "client_price_proposed", None)
    notes = getattr(booking, "special_instructions", None)

    info = {
        "ref": f"#{booking.id}",
        "service": getattr(mtype, "name", None) if mtype is not None and not isinstance(mtype, str) else mtype,
        "date": _fmt_booking_date(getattr(booking, "scheduled_date", None)),
        "duration": f"{int(duration)} min" if duration else None,
        "price": _fmt_price(price),
        "status": _STATUS_FR.get(status_raw, status_raw or None),
        "client": getattr(client, "fullname", None),
        "notes": (notes or "").strip()[:200] or None,
    }
    return {k: str(v)[:200] for k, v in info.items() if v not in (None, "")}


class ShareBookingRequest(BaseModel):
    client_id: Optional[str] = Field(None, max_length=64)


@router.post("/share-booking/{booking_id}")
async def share_booking(
    booking_id: int,
    payload: Optional[ShareBookingRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Envoie dans la conversation l'adresse + les informations de la réservation
    (client OU thérapeute). Le destinataire peut toucher l'adresse pour ouvrir
    Google Maps."""
    booking = _get_booking_or_403(db, booking_id, current_user)
    if not booking.therapist_id:
        raise HTTPException(409, "Aucun thérapeute n'est encore assigné à cette réservation")

    lat = getattr(booking, "client_latitude", None)
    lng = getattr(booking, "client_longitude", None)
    address = (getattr(booking, "address", None) or "").strip() or None
    if lat is None and lng is None and not address:
        raise HTTPException(422, "Cette réservation n'a ni adresse ni position GPS")

    client_id = payload.client_id if payload else None
    encoded = _encode_location(
        float(lat) if lat is not None and lng is not None else None,
        float(lng) if lat is not None and lng is not None else None,
        address,
        "booking",
        _booking_info(db, booking),
    )
    row = _save_message(db, booking, current_user, encoded, client_id=client_id)

    await _broadcast(booking_id, _ws_payload(row, current_user))
    try:
        await notify_new_message(
            db, booking, current_user, _location_label(_decode_location(encoded)), message_id=row.id
        )
    except Exception:  # noqa: BLE001
        logger.exception("Chat : notification de réservation impossible")
    return _serialize(row, current_user.id)


@router.get("/booking-location/{booking_id}")
def get_booking_location(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lieu de la réservation (adresse + GPS du client)."""
    booking = _get_booking_or_403(db, booking_id, current_user)
    lat = getattr(booking, "client_latitude", None)
    lng = getattr(booking, "client_longitude", None)
    return {
        "booking_id": booking.id,
        "address": getattr(booking, "address", None),
        "latitude": float(lat) if lat is not None else None,
        "longitude": float(lng) if lng is not None else None,
    }


# ---------------------------------------------------------------------------
# Suppression de TOUS mes messages d'une conversation (soft delete).
# Les messages de l'autre personne ne sont pas touchés. Si plus aucun message
# visible n'existe, la conversation disparaît de GET /chat/conversations.
# ---------------------------------------------------------------------------
@router.delete("/mine/{booking_id}")
async def delete_my_messages(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_booking_or_403(db, booking_id, current_user)

    rows = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.booking_id == booking_id,
            ChatMessage.sender_id == current_user.id,
            ChatMessage.deleted_at.is_(None),
        )
        .all()
    )
    if not rows:
        return {"success": True, "deleted": 0, "ids": []}

    now = datetime.utcnow()
    ids = []
    image_urls = []
    for row in rows:
        ids.append(row.id)
        if row.image_url:
            image_urls.append(row.image_url)
        row.deleted_at = now
        row.content = ""
        row.image_url = None
    db.commit()

    # Suppression physique des images après validation de la transaction
    for image_url in image_urls:
        match = re.match(r"^/chat/files/(\d+)/([a-f0-9]{32}\.(?:jpg|png|webp))$", image_url)
        if match:
            try:
                (CHAT_UPLOAD_DIR / match.group(1) / match.group(2)).unlink(missing_ok=True)
            except OSError:
                logger.warning("Chat : fichier image non supprimé", exc_info=True)

    await _broadcast(
        booking_id,
        {
            "type": "messages_deleted",
            "booking_id": booking_id,
            "sender_id": current_user.id,
            "ids": ids,
            "timestamp": utc_iso(),
        },
    )
    return {"success": True, "deleted": len(ids), "ids": ids}


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

    # Dernier message VISIBLE (non supprimé) de chaque réservation : une
    # conversation dont tous les messages sont supprimés disparaît de la liste.
    last_ids = (
        db.query(func.max(ChatMessage.id))
        .filter(ChatMessage.booking_id.in_(ids), ChatMessage.deleted_at.is_(None))
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

    # Nombre de MES messages encore visibles (pour proposer « Supprimer mes messages »)
    mine_rows = (
        db.query(ChatMessage.booking_id, func.count(ChatMessage.id))
        .filter(
            ChatMessage.booking_id.in_(ids),
            ChatMessage.sender_id == uid,
            ChatMessage.deleted_at.is_(None),
        )
        .group_by(ChatMessage.booking_id)
        .all()
    )
    mine = {bid: int(n) for bid, n in mine_rows}

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
        elif _decode_location(last.content):
            preview = (
                "📋 Réservation partagée"
                if _decode_location(last.content).get("booking_info")
                else "📍 Position partagée"
            )
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
                "message_type": "location" if _decode_location(last.content) else last.message_type,
                "deleted": last.deleted_at is not None,
                "is_read": bool(last.is_read),
                "status": "read" if last.is_read else "delivered",
                "created_at": _iso(last.created_at),
            },
            "unread_count": unread.get(booking_id, 0),
            "my_count": mine.get(booking_id, 0),
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


# ---------------------------------------------------------------------------
# Suppression de TOUS mes messages d'une conversation (soft delete).
# Les messages de l'autre personne ne sont jamais touchés. Les photos
# sont supprimées du disque. Les deux participants voient « Message supprimé ».
# ---------------------------------------------------------------------------
_IMAGE_URL_RE = re.compile(r"^/chat/files/(\d+)/([a-f0-9]{32}\.(?:jpg|png|webp))$")


@router.delete("/messages/{booking_id}/mine")
async def delete_my_messages(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = _get_booking_or_403(db, booking_id, current_user)

    rows = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.booking_id == booking.id,
            ChatMessage.sender_id == current_user.id,
            ChatMessage.deleted_at.is_(None),
        )
        .all()
    )
    if not rows:
        return {"success": True, "deleted": 0, "ids": []}

    now = datetime.utcnow()
    ids = []
    image_urls = []
    for msg in rows:
        if msg.image_url:
            image_urls.append(msg.image_url)
        msg.deleted_at = now
        msg.content = ""
        msg.image_url = None
        ids.append(msg.id)
    db.commit()

    # Suppression physique des photos (après validation de la transaction)
    for url in image_urls:
        match = _IMAGE_URL_RE.match(url)
        if match:
            try:
                (CHAT_UPLOAD_DIR / match.group(1) / match.group(2)).unlink(missing_ok=True)
            except OSError:
                logger.warning("Chat : fichier image non supprimé", exc_info=True)

    await _broadcast(
        booking.id,
        {
            "type": "messages_deleted",
            "ids": ids,
            "booking_id": booking.id,
            "sender_id": current_user.id,
            "timestamp": utc_iso(),
        },
    )
    return {"success": True, "deleted": len(ids), "ids": ids}
