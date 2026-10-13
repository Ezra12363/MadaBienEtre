# app/services/chat_notifications.py
# ============================================================================
# Cœur du chat client <-> thérapeute : persistance + notification.
#
# Utilisé par :
#   - app/api/websocket.py   (WebSocket /ws/chat/{booking_id})
#   - app/api/chat.py        (REST POST /chat/send/{booking_id})
#
# Flux d'un message : persist_message -> diffusion WebSocket -> notify_new_message
#   notify_new_message = notification en base + signal temps réel
#   (/ws/notifications) + push Expo (app fermée) vers le DESTINATAIRE.
# ============================================================================
import importlib
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Enum as SAEnum, JSON as SAJSON
from sqlalchemy.orm import Session

from ..models.notification import Notification
from .push_notifications import push_service
from .websocket_manager import manager

logger = logging.getLogger(__name__)

CHAT_NOTIFICATION_TYPE = "chat_message"
MAX_MESSAGE_LENGTH = 2000


def utc_iso(dt: Optional[datetime] = None) -> str:
    """ISO 8601 AVEC fuseau (+00:00)."""
    if dt is None:
        return datetime.now(timezone.utc).isoformat()
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Présence : qui a actuellement l'écran de chat ouvert ? (booking -> user -> n)
# ---------------------------------------------------------------------------
_presence: dict[int, dict[int, int]] = {}


def presence_join(booking_id: int, user_id: int) -> None:
    room = _presence.setdefault(booking_id, {})
    room[user_id] = room.get(user_id, 0) + 1


def presence_leave(booking_id: int, user_id: int) -> None:
    room = _presence.get(booking_id)
    if not room:
        return
    room[user_id] = room.get(user_id, 1) - 1
    if room[user_id] <= 0:
        room.pop(user_id, None)
    if not room:
        _presence.pop(booking_id, None)


def user_in_chat(booking_id: int, user_id: int) -> bool:
    return _presence.get(booking_id, {}).get(user_id, 0) > 0


# ---------------------------------------------------------------------------
# Modèle de message (adaptatif)
# ---------------------------------------------------------------------------
_MESSAGE_MODEL_CANDIDATES = (
    ("..models.message", ("Message", "ChatMessage")),
    ("..models.chat_message", ("ChatMessage", "Message")),
    ("..models.chat", ("ChatMessage", "Message")),
    ("..models.messages", ("Message", "ChatMessage")),
)
_message_model = None
_message_model_searched = False


def get_message_model():
    global _message_model, _message_model_searched
    if _message_model_searched:
        return _message_model
    _message_model_searched = True
    for module_name, class_names in _MESSAGE_MODEL_CANDIDATES:
        try:
            module = importlib.import_module(module_name, package=__package__)
        except Exception:  # noqa: BLE001
            continue
        for cls_name in class_names:
            cls = getattr(module, cls_name, None)
            if cls is not None and hasattr(cls, "__table__"):
                _message_model = cls
                logger.info("Chat : modèle de message = %s.%s", module_name, cls_name)
                return _message_model
    logger.warning(
        "Chat : aucun modèle de message trouvé (essayé : %s). Les messages "
        "seront diffusés en direct mais NON enregistrés.",
        [m for m, _ in _MESSAGE_MODEL_CANDIDATES],
    )
    return None


def _first(names: set, *candidates):
    for c in candidates:
        if c in names:
            return c
    return None


def persist_message(db: Session, booking, sender, text: str,
                    message_type: str = "text", image_url: Optional[str] = None) -> Optional[dict]:
    """Enregistre le message. Renvoie {"id", "created_at"} ou None."""
    model = get_message_model()
    if model is None:
        return None
    try:
        cols = model.__table__.columns
        names = set(cols.keys())
        receiver_id = booking.therapist_id if sender.id == booking.client_id else booking.client_id

        values = {}
        c = _first(names, "booking_id")
        if c:
            values[c] = booking.id
        c = _first(names, "sender_id", "user_id", "from_user_id")
        if c:
            values[c] = sender.id
        c = _first(names, "receiver_id", "recipient_id", "to_user_id")
        if c:
            values[c] = receiver_id
        c = _first(names, "content", "message", "text", "body")
        if c:
            values[c] = text
        c = _first(names, "message_type", "type")
        if c:
            col_type = cols[c].type
            if isinstance(col_type, SAEnum) and col_type.enums:
                match = next((e for e in col_type.enums if str(e).lower() == message_type), None)
                if match is not None:
                    values[c] = match
            else:
                values[c] = message_type
        if image_url:
            c = _first(names, "image_url", "attachment_url", "media_url")
            if c:
                values[c] = image_url
        c = _first(names, "is_read")
        if c:
            values[c] = False

        row = model(**values)
        db.add(row)
        db.commit()
        db.refresh(row)
        created = getattr(row, "created_at", None) or getattr(row, "timestamp", None)
        return {
            "id": getattr(row, "id", None),
            "created_at": utc_iso(created) if isinstance(created, datetime) else utc_iso(),
        }
    except Exception:  # noqa: BLE001
        db.rollback()
        logger.exception("Chat : impossible d'enregistrer le message")
        return None


def mark_messages_read(db: Session, booking, reader) -> int:
    """Marque comme lus les messages ENVOYÉS À `reader` dans cette réservation,
    ainsi que sa notification de chat non lue."""
    count = 0
    model = get_message_model()
    if model is not None:
        try:
            names = set(model.__table__.columns.keys())
            read_col = _first(names, "is_read")
            book_col = _first(names, "booking_id")
            if read_col and book_col:
                query = db.query(model).filter(getattr(model, book_col) == booking.id,
                                               getattr(model, read_col) == False)  # noqa: E712
                recv_col = _first(names, "receiver_id", "recipient_id", "to_user_id")
                send_col = _first(names, "sender_id", "user_id", "from_user_id")
                if recv_col:
                    query = query.filter(getattr(model, recv_col) == reader.id)
                elif send_col:
                    query = query.filter(getattr(model, send_col) != reader.id)
                count = query.update({read_col: True}, synchronize_session=False)
                db.commit()
        except Exception:  # noqa: BLE001
            db.rollback()
            logger.exception("Chat : impossible de marquer les messages comme lus")

    # La notification « nouveau message » de cette conversation est lue aussi
    try:
        db.query(Notification).filter(
            Notification.user_id == reader.id,
            Notification.booking_id == booking.id,
            Notification.is_read == False,  # noqa: E712
            Notification.type == CHAT_NOTIFICATION_TYPE,
        ).update({"is_read": True, "read_at": datetime.utcnow()}, synchronize_session=False)
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
    return count


# ---------------------------------------------------------------------------
# Notification en base (adaptative)
# ---------------------------------------------------------------------------
def _resolve_type_value(column, wanted: str):
    if isinstance(column.type, SAEnum) and column.type.enums:
        enums = list(column.type.enums)
        for e in enums:
            if str(e).lower() == wanted.lower():
                return e
        for e in enums:
            low = str(e).lower()
            if "message" in low or "chat" in low:
                return e
        for e in enums:
            if "booking" in str(e).lower():
                return e
        return enums[0]
    return wanted


def _create_chat_notification(db: Session, booking, sender, receiver_id: int,
                              preview: str, message_id) -> Optional[dict]:
    try:
        cols = Notification.__table__.columns
        names = set(cols.keys())
        type_value = _resolve_type_value(cols["type"], CHAT_NOTIFICATION_TYPE) if "type" in names else None

        # Une seule notification non lue par conversation : remplacée par la plus récente.
        unread_count = 1
        if "booking_id" in names and "is_read" in names:
            q = db.query(Notification).filter(
                Notification.user_id == receiver_id,
                Notification.booking_id == booking.id,
                Notification.is_read == False,  # noqa: E712
            )
            if type_value is not None:
                q = q.filter(Notification.type == type_value)
            for n in q.all():
                prev = getattr(n, "data", None) or getattr(n, "payload", None)
                if isinstance(prev, str):
                    try:
                        prev = json.loads(prev)
                    except Exception:  # noqa: BLE001
                        prev = None
                if isinstance(prev, dict) and prev.get("kind") == CHAT_NOTIFICATION_TYPE:
                    unread_count += int(prev.get("unread_messages", 1) or 1)
                    db.delete(n)
            db.flush()

        sender_name = getattr(sender, "fullname", None) or "Nouveau message"
        text = preview.strip().replace("\n", " ")
        text = (text[:117] + "…") if len(text) > 120 else text
        title = sender_name if unread_count == 1 else f"{sender_name} ({unread_count} messages)"

        values = {"user_id": receiver_id}
        if "title" in names:
            values["title"] = title
        if "body" in names:
            values["body"] = text
        if "message" in names:
            values["message"] = text
        if type_value is not None:
            values["type"] = type_value
        if "booking_id" in names:
            values["booking_id"] = booking.id
        if "is_read" in names:
            values["is_read"] = False

        payload = {
            "kind": CHAT_NOTIFICATION_TYPE,
            "screen": "Chat",
            "booking_id": booking.id,
            "sender_id": sender.id,
            "sender_name": sender_name,
            "message_id": message_id,
            "unread_messages": unread_count,
        }
        for key in ("data", "payload"):
            if key in names:
                values[key] = payload if isinstance(cols[key].type, SAJSON) else json.dumps(payload)
                break

        row = Notification(**values)
        db.add(row)
        db.commit()
        db.refresh(row)
        return {"id": getattr(row, "id", None), "title": title, "body": text, "data": payload}
    except Exception:  # noqa: BLE001
        db.rollback()
        logger.exception("Chat : impossible de créer la notification de message")
        return None


def _chat_preferences(db: Session, user_id: int) -> tuple[bool, bool]:
    """(notification autorisée, push autorisé) d'après NotificationPreference."""
    try:
        from ..models.notification import NotificationPreference

        pref = db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id
        ).first()
        if pref is None:
            return True, True
        return pref.chat_notifications is not False, pref.push_enabled is not False
    except Exception:  # noqa: BLE001
        return True, True


async def notify_new_message(db: Session, booking, sender, text: str,
                             message_id=None, message_type: str = "text") -> bool:
    """À appeler APRÈS chaque message envoyé (WebSocket ET REST).

    Le DESTINATAIRE reçoit :
      1. une notification en base (liste + badge),
      2. un signal instantané sur /ws/notifications,
      3. un push Expo (même app fermée) vers tous ses appareils.
    Pas de notification si le destinataire a déjà ce chat ouvert.
    Chaque étape est isolée : l'échec de l'une n'empêche pas les autres.
    """
    try:
        receiver_id = booking.therapist_id if sender.id == booking.client_id else booking.client_id
        if not receiver_id or receiver_id == sender.id:
            return False
        if user_in_chat(booking.id, receiver_id):
            return False

        notif_ok, push_ok = _chat_preferences(db, receiver_id)
        if not notif_ok:
            return False

        preview = text if message_type == "text" else "📷 Photo"
        notif = _create_chat_notification(db, booking, sender, receiver_id, preview, message_id)
        if notif is None:
            return False

        # 2. temps réel
        try:
            await manager.broadcast_to_room(
                f"user_{receiver_id}",
                {
                    "type": "notification",
                    "kind": CHAT_NOTIFICATION_TYPE,
                    "notification_id": notif["id"],
                    "booking_id": booking.id,
                    "title": notif["title"],
                    "body": notif["body"],
                    "timestamp": utc_iso(),
                },
            )
        except Exception:  # noqa: BLE001
            logger.exception("Chat : signal temps réel impossible")

        # 3. push Expo (app fermée / arrière-plan)
        if push_ok:
            try:
                data = dict(notif["data"])
                data["notification_id"] = notif["id"]
                sent = await push_service.send_to_user(
                    receiver_id, notif["title"], notif["body"], data, channel_id="messages"
                )
                if sent:
                    try:
                        db.query(Notification).filter(Notification.id == notif["id"]).update(
                            {"is_sent": True, "sent_at": datetime.utcnow()},
                            synchronize_session=False,
                        )
                        db.commit()
                    except Exception:  # noqa: BLE001
                        db.rollback()
            except Exception:  # noqa: BLE001
                logger.exception("Chat : push Expo impossible")
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Chat : notify_new_message a échoué")
        return False
