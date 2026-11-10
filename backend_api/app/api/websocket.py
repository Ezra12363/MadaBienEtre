# app/api/websocket.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
import json
import re
import asyncio
import time
import logging
import inspect
import threading
from datetime import datetime

from sqlalchemy import Enum as SAEnum, JSON as SAJSON

from ..core.database import get_db
from ..core.dependencies import get_current_user, get_current_user_ws, get_user_from_websocket
from ..models.booking import Booking
from ..models.user import User
from ..models.notification import Notification
from ..services.websocket_manager import manager
from ..services.push_notifications import push_service
from ..services.chat_notifications import (
    MAX_MESSAGE_LENGTH,
    mark_messages_read,
    notify_new_message,
    persist_message,
    presence_join,
    presence_leave,
    utc_iso,
)

router = APIRouter(tags=["WebSocket"])
logger = logging.getLogger(__name__)


def _safe_client_id(data: dict):
    """client_id venant du mobile : borné à 64 caractères (colonne String(64))."""
    value = data.get("client_id")
    return str(value)[:64] if value else None

# ------------------------------------------------------------------
# État du suivi en mémoire : booking_id -> {"active": bool, "last": dict|None}
# (suffisant pour 1 worker uvicorn ; avec plusieurs workers il faudra
#  Redis pub/sub à la place de ce dict + du manager en mémoire)
# ------------------------------------------------------------------
tracking_state: dict[int, dict] = {}


def _get_state(booking_id: int) -> dict:
    return tracking_state.setdefault(
        booking_id,
        {
            "active": False,
            "last": None,
            "notified": False,
            # horodatage (time.time()) du dernier signe de vie du thérapeute
            "last_ts": 0.0,
            # "stopped" (arrêt volontaire) | "disconnected" (réseau coupé) | None
            "stopped_reason": None,
            "stopped_at": 0.0,
        },
    )


# Un partage est considéré « en direct » tant que le thérapeute a donné signe de
# vie il y a moins de LIVE_STALE_S secondes (le mobile renvoie sa position toutes
# les ~4 s au pire), et on garde le signal DISCONNECT_GRACE_S secondes après une
# coupure réseau pour éviter qu'il clignote pendant la reconnexion automatique.
LIVE_STALE_S = 90
DISCONNECT_GRACE_S = 40
_TERMINAL_STATUSES = {"completed", "cancelled", "cancelled_by_client", "cancelled_by_therapist", "expired"}


def _is_live(state: dict) -> bool:
    now = time.time()
    if state.get("active"):
        return now - float(state.get("last_ts") or 0) < LIVE_STALE_S
    if state.get("stopped_reason") == "disconnected":
        return now - float(state.get("stopped_at") or 0) < DISCONNECT_GRACE_S
    return False

# On n'écrit en base qu'au plus toutes les N secondes par réservation
# (le WebSocket, lui, diffuse chaque position immédiatement).
DB_WRITE_INTERVAL_S = 5
_last_db_write: dict[int, float] = {}


def _valid_coords(lat, lng) -> bool:
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return False
    return -90 <= lat <= 90 and -180 <= lng <= 180 and not (lat == 0 and lng == 0)


def _persist_position(db: Session, booking_id: int, therapist_id: int, lat: float, lng: float):
    """Garde la dernière position en base (utile pour le polling de secours
    du client et pour la 1re position à la reconnexion)."""
    now = time.monotonic()
    if now - _last_db_write.get(booking_id, 0) < DB_WRITE_INTERVAL_S:
        return
    _last_db_write[booking_id] = now

    therapist = db.query(User).filter(User.id == therapist_id).first()
    if therapist:
        therapist.latitude = lat
        therapist.longitude = lng
        therapist.last_location = f"POINT({lng} {lat})"
        db.commit()


# ------------------------------------------------------------------
# ✅ AUTHENTIFICATION WebSocket ROBUSTE
#
# Avant : `except Exception` masquait TOUT en "Authentication failed"
# (token vide, token expiré, mauvaise signature de get_current_user_ws,
# fonction non-async awaitée…). Maintenant :
#   - on nettoie le token ("Bearer ", guillemets),
#   - on appelle get_current_user_ws / get_user_from_websocket en
#     adaptant les arguments à leur signature (token, db, websocket),
#     qu'elles soient async ou non,
#   - la VRAIE exception est écrite dans les logs du serveur.
# ------------------------------------------------------------------
def _clean_token(token):
    if not token:
        return ""
    t = str(token).strip().strip('"')
    if t.lower().startswith("bearer "):
        t = t[7:].strip()
    return t


async def _authenticate_ws(token: str, db: Session, websocket: WebSocket):
    last_error = None
    for fn in (get_current_user_ws, get_user_from_websocket):
        if fn is None:
            continue
        try:
            kwargs = {}
            usable = True
            for name, param in inspect.signature(fn).parameters.items():
                lname = name.lower()
                if lname in ("token", "access_token", "jwt"):
                    kwargs[name] = token
                elif lname in ("db", "session"):
                    kwargs[name] = db
                elif lname in ("websocket", "ws"):
                    kwargs[name] = websocket
                elif param.default is inspect.Parameter.empty and param.kind not in (
                    inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD
                ):
                    usable = False
                    break
            if not usable:
                continue

            user = fn(**kwargs)
            if inspect.isawaitable(user):
                user = await user
            if user is not None and getattr(user, "id", None) is not None:
                return user
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            logger.warning("WS auth via %s a échoué: %r", getattr(fn, "__name__", fn), exc)

    if last_error:
        logger.error("WS authentification impossible: %r", last_error)
    return None


# ------------------------------------------------------------------
# ✅ NOTIFICATION "Votre thérapeute est en route" (envoyée au CLIENT)
#
# Elle est enregistrée en base (table notifications). Le client la reçoit
# via le polling GET /notifications (toutes les 5 s, NotificationContext) :
# notificationService.presentBackendNotification() l'affiche alors en
# notification native (mobile) / navigateur (web).
#
# Le helper s'adapte aux colonnes réellement présentes dans le modèle
# Notification (body OU message, data, booking_id, type Enum ou texte…).
# ------------------------------------------------------------------
EN_ROUTE_TYPE = "booking_en_route"  # contient "booking" -> catégorie Réservations


def _resolve_type_value(column, wanted: str):
    if isinstance(column.type, SAEnum) and column.type.enums:
        enums = list(column.type.enums)
        for e in enums:
            if str(e).lower() == wanted.lower():
                return e
        for e in enums:
            if "booking" in str(e).lower():
                return e
        return enums[0]
    return wanted


def _notify_client_en_route(db: Session, booking, therapist_name: str, eta, distance) -> bool:
    """« Votre thérapeute est en route » -> CLIENT (liste + signal temps réel + push)."""
    try:
        # Déjà notifié pour cette réservation ? (évite les doublons après
        # un redémarrage du serveur : le dict en mémoire est alors vide)
        exists = db.query(Notification).filter(
            Notification.user_id == booking.client_id,
            Notification.booking_id == booking.id,
            Notification.type == EN_ROUTE_TYPE,
        ).first()
        if exists:
            return False

        from ..services import booking_notifications as bnotif

        bnotif.notify_en_route(booking, therapist_name, eta, distance)
        return True
    except Exception:
        db.rollback()
        logger.exception("Impossible de créer la notification 'thérapeute en route'")
        return False


def _notify_once(db: Session, booking, user, state: dict, eta=None, distance=None):
    if state.get("notified"):
        return
    state["notified"] = True
    _notify_client_en_route(db, booking, getattr(user, "fullname", None), eta, distance)


@router.get("/tracking/active")
async def tracking_active(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Partages de position EN DIRECT concernant l'utilisateur connecté.

    Le client l'interroge depuis n'importe quelle page de l'app pour afficher le
    signal « Thérapeute en direct » dans l'en-tête ; le thérapeute peut s'en
    servir pour retrouver ses partages en cours. Le signal disparaît quand le
    thérapeute arrête le partage (ou quand la réservation est terminée/annulée).
    """
    live_ids = [bid for bid, st in tracking_state.items() if _is_live(st)]
    if not live_ids:
        return []

    bookings = db.query(Booking).filter(Booking.id.in_(live_ids)).all()
    out = []
    for b in bookings:
        if current_user.id not in (b.client_id, b.therapist_id):
            continue
        status = str(getattr(b.status, "value", b.status) or "").lower()
        if status in _TERMINAL_STATUSES:
            continue
        st = tracking_state.get(b.id) or {}
        therapist = db.query(User).filter(User.id == b.therapist_id).first()
        client = db.query(User).filter(User.id == b.client_id).first()
        last = st.get("last") or {}
        out.append({
            "booking_id": b.id,
            "therapist_id": b.therapist_id,
            "client_id": b.client_id,
            "therapist_name": getattr(therapist, "fullname", None),
            "client_name": getattr(client, "fullname", None),
            "reconnecting": not st.get("active", False),
            "latitude": last.get("latitude"),
            "longitude": last.get("longitude"),
            "last_update": last.get("timestamp"),
        })
    return out


# ------------------------------------------------------------------
# ✅ DROIT D'ACCÈS AU SUIVI (FIX « Not authorized » sur le bouton
#    « Envoyer ma position au client »)
#
# Avant : seul booking.therapist_id / booking.client_id étaient acceptés.
# Or tant que le client n'a pas accepté l'offre, booking.therapist_id est
# NULL (le thérapeute n'a fait que négocier) -> « Not authorized ».
#
# Maintenant, est autorisé :
#   - le client propriétaire de la réservation ;
#   - le thérapeute assigné ;
#   - un thérapeute (role THERAPIST) qui a participé à la négociation d'une
#     réservation encore NON assignée et non terminée (pending/negotiating…).
# Retourne "client" | "therapist" | None.
# ------------------------------------------------------------------
_TRACKING_CLOSED_STATUSES = {
    "completed", "cancelled", "cancelled_by_client",
    "cancelled_by_therapist", "expired", "rejected",
}


def _tracking_role(db: Session, user, booking) -> Optional[str]:
    uid = getattr(user, "id", None)
    if uid is None:
        return None
    if uid == booking.client_id:
        return "client"
    if booking.therapist_id is not None:
        return "therapist" if uid == booking.therapist_id else None

    # Réservation non assignée : thérapeute ayant déjà fait une offre
    role = str(getattr(getattr(user, "role", None), "value", getattr(user, "role", "")) or "").upper()
    status = str(getattr(booking.status, "value", booking.status) or "").lower()
    if role != "THERAPIST" or status in _TRACKING_CLOSED_STATUSES:
        return None
    try:
        from ..models.negotiation import Negotiation  # import local : évite un import circulaire
        offer = (
            db.query(Negotiation)
            .filter(
                Negotiation.booking_id == booking.id,
                Negotiation.user_id == uid,
                Negotiation.user_type == "therapist",
            )
            .first()
        )
        return "therapist" if offer is not None else None
    except Exception as exc:  # noqa: BLE001
        logger.warning("tracking: vérification de la négociation impossible: %r", exc)
        return None


@router.websocket("/ws/tracking/{booking_id}")
async def websocket_tracking(
    websocket: WebSocket,
    booking_id: int,
    token: Optional[str] = Query(None),
    viewer: int = Query(0),
):
    """WebSocket pour le suivi en temps réel : le thérapeute ENVOIE sa
    position, le client la REÇOIT."""
    await manager.connect(websocket)
    db = next(get_db())
    is_therapist = False
    room_id = f"booking_{booking_id}"

    try:
        # ✅ Authentification OBLIGATOIRE (une position GPS est une donnée
        # sensible : avant, un client sans token pouvait rejoindre la room).
        token = _clean_token(token)
        if not token:
            await websocket.send_json({"error": "Authentication failed", "reason": "missing_token"})
            await websocket.close()
            return

        user = await _authenticate_ws(token, db, websocket)
        if user is None:
            await websocket.send_json({"error": "Authentication failed", "reason": "invalid_token"})
            await websocket.close()
            return

        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            await websocket.send_json({"error": "Booking not found"})
            await websocket.close()
            return

        tracking_role = _tracking_role(db, user, booking)
        if tracking_role is None:
            logger.warning(
                "WS tracking refusé: user_id=%s role=%s booking_id=%s client_id=%s therapist_id=%s status=%s",
                user.id, getattr(user, "role", None), booking_id,
                booking.client_id, booking.therapist_id, booking.status,
            )
            await websocket.send_json({
                "error": "Not authorized",
                "reason": "not_assigned",
                "booking_id": booking_id,
            })
            await websocket.close()
            return

        # viewer=1 : connexion en lecture seule (écran web du thérapeute qui reçoit
        # la position de son téléphone) -> n'envoie rien, et sa fermeture n'arrête pas le suivi.
        is_therapist = tracking_role == "therapist" and not viewer
        await manager.join_room(websocket, room_id)

        # ✅ Envoie l'état courant au nouvel arrivant : le client sait tout de
        # suite si le thérapeute est en train de partager sa position.
        state = _get_state(booking_id)
        last = state.get("last") or {}
        await websocket.send_json({
            "type": "tracking_state",
            "active": state["active"],
            "latitude": last.get("latitude"),
            "longitude": last.get("longitude"),
            "heading": last.get("heading"),
            "status": booking.status,
            "timestamp": datetime.utcnow().isoformat()
        })

        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            # ---------- Le thérapeute démarre / arrête le partage ----------
            elif msg_type == "tracking_started" and is_therapist:
                state = _get_state(booking_id)
                state["active"] = True
                state["stopped_reason"] = None
                state["last_ts"] = time.time()
                eta, distance = data.get("eta"), data.get("distance")

                # ✅ Notifie le client (une seule fois par réservation)
                _notify_once(db, booking, user, state, eta, distance)

                await manager.broadcast_to_room(
                    room_id,
                    {"type": "tracking_started", "therapist_id": user.id,
                     "eta": eta, "distance": distance,
                     "timestamp": datetime.utcnow().isoformat()},
                    exclude=websocket
                )

            elif msg_type == "tracking_stopped" and is_therapist:
                state = _get_state(booking_id)
                state["active"] = False
                state["stopped_reason"] = "stopped"
                state["stopped_at"] = time.time()
                await manager.broadcast_to_room(
                    room_id,
                    {"type": "tracking_stopped", "reason": "stopped",
                     "timestamp": datetime.utcnow().isoformat()},
                    exclude=websocket
                )

            # ---------- Position du thérapeute (à chaque déplacement) ----------
            elif msg_type == "location_update" and is_therapist:
                lat, lng = data.get("latitude"), data.get("longitude")
                if not _valid_coords(lat, lng):
                    continue
                lat, lng = float(lat), float(lng)

                payload = {
                    "type": "location_update",
                    "therapist_id": user.id,
                    "latitude": lat,
                    "longitude": lng,
                    "heading": data.get("heading"),
                    "speed": data.get("speed"),
                    "accuracy": data.get("accuracy"),
                    "timestamp": datetime.utcnow().isoformat()
                }
                state = _get_state(booking_id)
                state["active"] = True
                state["stopped_reason"] = None
                state["last_ts"] = time.time()
                state["last"] = payload
                # Au cas où "tracking_started" aurait été manqué
                _notify_once(db, booking, user, state)

                await manager.broadcast_to_room(room_id, payload, exclude=websocket)
                _persist_position(db, booking_id, user.id, lat, lng)

            elif msg_type == "status_update":
                if user.id in [booking.client_id, booking.therapist_id]:
                    booking.status = data.get("status")
                    db.commit()

                    await manager.broadcast_to_room(
                        room_id,
                        {
                            "type": "status_update",
                            "status": booking.status,
                            "timestamp": datetime.utcnow().isoformat()
                        }
                    )

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass
    finally:
        # Si c'est le thérapeute qui se déconnecte (réseau coupé, app fermée),
        # on prévient le client : "partage interrompu".
        if is_therapist:
            state = tracking_state.get(booking_id)
            if state and state["active"]:
                state["active"] = False
                state["stopped_reason"] = "disconnected"
                state["stopped_at"] = time.time()
                try:
                    await manager.broadcast_to_room(
                        room_id,
                        {"type": "tracking_stopped", "reason": "disconnected",
                         "timestamp": datetime.utcnow().isoformat()},
                        exclude=websocket
                    )
                except Exception:
                    pass
        try:
            await manager.disconnect(websocket)
        finally:
            db.close()

@router.websocket("/ws/chat/{booking_id}")
async def websocket_chat(
    websocket: WebSocket,
    booking_id: int,
    token: Optional[str] = Query(None),
):
    """Chat temps réel client <-> thérapeute.

    ✅ Authentification OBLIGATOIRE (avant, un token vide était accepté).
    ✅ L'identité de l'expéditeur vient du TOKEN, jamais du JSON reçu
       (avant, n'importe qui pouvait écrire "user_id": 12).
    ✅ Chaque message est ENREGISTRÉ en base puis diffusé à tous (expéditeur
       compris, avec `client_id` pour confirmer l'envoi : coches ✓ / ✓✓).
    ✅ Le destinataire reçoit une NOTIFICATION (base + signal instantané +
       push Expo) s'il n'a pas le chat ouvert.
    ✅ Accusés de lecture ("read") et indicateur de saisie ("typing").
    ✅ Session base fermée proprement (avant : fuite de connexions).
    """
    await manager.connect(websocket)
    db = next(get_db())
    room_id = f"chat_{booking_id}"
    user = None
    joined = False

    try:
        token = _clean_token(token)
        if not token:
            await websocket.send_json({"error": "Authentication failed", "reason": "missing_token"})
            await websocket.close()
            return

        user = await _authenticate_ws(token, db, websocket)
        if user is None:
            await websocket.send_json({"error": "Authentication failed", "reason": "invalid_token"})
            await websocket.close()
            return

        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            await websocket.send_json({"error": "Booking not found"})
            await websocket.close()
            return

        if user.id not in [booking.client_id, booking.therapist_id]:
            await websocket.send_json({"error": "Not authorized"})
            await websocket.close()
            return

        await manager.join_room(websocket, room_id)
        presence_join(booking_id, user.id)
        joined = True

        sender_name = getattr(user, "fullname", None) or "Utilisateur"

        await websocket.send_json({"type": "chat_ready", "user_id": user.id,
                                   "booking_id": booking_id, "timestamp": utc_iso()})

        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif msg_type == "message":
                text = str(data.get("message") or "").strip()
                if not text:
                    continue
                text = text[:MAX_MESSAGE_LENGTH]

                saved = persist_message(db, booking, user, text)
                payload = {
                    "type": "message",
                    "id": saved["id"] if saved else None,
                    "client_id": _safe_client_id(data),
                    "booking_id": booking_id,
                    "user_id": user.id,
                    "username": sender_name,
                    "message": text,
                    "message_type": "text",
                    "timestamp": saved["created_at"] if saved else utc_iso(),
                }
                # À TOUT LE MONDE, expéditeur inclus (confirmation d'envoi)
                await manager.broadcast_to_room(room_id, payload)

                await notify_new_message(
                    db, booking, user, text,
                    message_id=saved["id"] if saved else None,
                )

            elif msg_type == "image":
                image_url = str(data.get("image_url") or "")
                # Sécurité : seules les images déjà enregistrées par le serveur
                # (POST /chat/send-image/{booking_id}) de CETTE réservation sont
                # acceptées — jamais une URL arbitraire fournie par le client.
                if not re.fullmatch(
                    rf"/chat/files/{booking_id}/[a-f0-9]{{32}}\.(?:jpg|png|webp)", image_url
                ):
                    continue
                saved = persist_message(db, booking, user, "", "image", str(image_url))
                await manager.broadcast_to_room(room_id, {
                    "type": "message",
                    "id": saved["id"] if saved else None,
                    "client_id": _safe_client_id(data),
                    "booking_id": booking_id,
                    "user_id": user.id,
                    "username": sender_name,
                    "message": "",
                    "message_type": "image",
                    "image_url": image_url,
                    "timestamp": saved["created_at"] if saved else utc_iso(),
                })
                await notify_new_message(
                    db, booking, user, "",
                    message_id=saved["id"] if saved else None,
                    message_type="image",
                )

            elif msg_type == "typing":
                await manager.broadcast_to_room(
                    room_id,
                    {"type": "typing", "user_id": user.id,
                     "is_typing": bool(data.get("is_typing"))},
                    exclude=websocket,
                )

            elif msg_type == "read":
                # L'utilisateur a ouvert/lu la conversation
                mark_messages_read(db, booking, user)
                await manager.broadcast_to_room(
                    room_id,
                    {"type": "read", "reader_id": user.id, "timestamp": utc_iso()},
                    exclude=websocket,
                )

    except WebSocketDisconnect:
        pass
    except Exception as e:  # noqa: BLE001
        logger.exception("Erreur WebSocket chat")
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:  # noqa: BLE001
            pass
    finally:
        if joined and user is not None:
            presence_leave(booking_id, user.id)
        try:
            await manager.disconnect(websocket)
        finally:
            db.close()


@router.websocket("/ws/notifications")
async def websocket_notifications(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """Canal personnel de l'utilisateur : reçoit un signal INSTANTANÉ dès
    qu'une notification est créée pour lui (nouveau message, offre...).
    Le téléphone relit alors GET /notifications sans attendre le polling."""
    await manager.connect(websocket)
    db = next(get_db())
    try:
        token = _clean_token(token)
        user = await _authenticate_ws(token, db, websocket) if token else None
        if user is None:
            await websocket.send_json({"error": "Authentication failed"})
            await websocket.close()
            return

        user_id = user.id
        db.close()  # plus besoin de la base pour ce canal

        await manager.join_room(websocket, f"user_{user_id}")
        await websocket.send_json({"type": "notifications_ready", "user_id": user_id})

        while True:
            data = await websocket.receive_json()
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        logger.exception("Erreur WebSocket notifications")
    finally:
        try:
            await manager.disconnect(websocket)
        finally:
            try:
                db.close()
            except Exception:  # noqa: BLE001
                pass


@router.get("/ws/connections")
async def get_connections():
    """Obtenir les connexions WebSocket actives"""
    return {
        "active_connections": len(manager.active_connections),
        "rooms": list(manager.rooms.keys())
    }