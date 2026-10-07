# app/api/websocket.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
import json
import asyncio
import time
import logging
import inspect
from datetime import datetime

from sqlalchemy import Enum as SAEnum, JSON as SAJSON

from ..core.database import get_db
from ..core.dependencies import get_current_user_ws, get_user_from_websocket
from ..models.booking import Booking
from ..models.user import User
from ..models.notification import Notification
from ..services.websocket_manager import manager

router = APIRouter(tags=["WebSocket"])
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# État du suivi en mémoire : booking_id -> {"active": bool, "last": dict|None}
# (suffisant pour 1 worker uvicorn ; avec plusieurs workers il faudra
#  Redis pub/sub à la place de ce dict + du manager en mémoire)
# ------------------------------------------------------------------
tracking_state: dict[int, dict] = {}


def _get_state(booking_id: int) -> dict:
    return tracking_state.setdefault(
        booking_id, {"active": False, "last": None, "notified": False}
    )

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
    try:
        cols = Notification.__table__.columns
        names = set(cols.keys())
        type_value = _resolve_type_value(cols["type"], EN_ROUTE_TYPE) if "type" in names else None

        # Déjà notifié pour cette réservation ? (évite les doublons après
        # un redémarrage du serveur : le dict en mémoire est alors vide)
        if type_value is not None and "booking_id" in names:
            exists = db.query(Notification).filter(
                Notification.user_id == booking.client_id,
                Notification.booking_id == booking.id,
                Notification.type == type_value,
            ).first()
            if exists:
                return False

        details = []
        if eta:
            details.append(f"arrivée estimée : {str(eta)[:40]}")
        if distance:
            details.append(f"à {str(distance)[:30]}")
        body = f"{therapist_name or 'Votre thérapeute'} a démarré le trajet vers vous"
        body += f" ({', '.join(details)})." if details else "."

        values = {"user_id": booking.client_id}
        if "title" in names:
            values["title"] = "Votre thérapeute est en route 🚗"
        if "body" in names:
            values["body"] = body
        if "message" in names:
            values["message"] = body
        if type_value is not None:
            values["type"] = type_value
        if "booking_id" in names:
            values["booking_id"] = booking.id
        if "is_read" in names:
            values["is_read"] = False

        payload = {
            "booking_id": booking.id,
            "therapist_id": booking.therapist_id,
            "screen": "Tracking",
            "eta": eta,
            "distance": distance,
        }
        for key in ("data", "payload"):
            if key in names:
                values[key] = payload if isinstance(cols[key].type, SAJSON) else json.dumps(payload)
                break

        db.add(Notification(**values))
        db.commit()
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


@router.websocket("/ws/tracking/{booking_id}")
async def websocket_tracking(
    websocket: WebSocket,
    booking_id: int,
    token: Optional[str] = Query(None)
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

        if user.id not in [booking.client_id, booking.therapist_id]:
            await websocket.send_json({"error": "Not authorized"})
            await websocket.close()
            return

        is_therapist = user.id == booking.therapist_id
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
    token: Optional[str] = Query(None)
):
    """WebSocket pour le chat en temps réel entre client et thérapeute"""
    await manager.connect(websocket)
    
    try:
        # Authentification
        user = None
        if token:
            try:
                user = await get_current_user_ws(token)
            except Exception:
                await websocket.send_json({"error": "Authentication failed"})
                await websocket.close()
                return
        
        # Récupérer la réservation
        db = next(get_db())
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            await websocket.send_json({"error": "Booking not found"})
            await websocket.close()
            return
        
        if user and user.id not in [booking.client_id, booking.therapist_id]:
            await websocket.send_json({"error": "Not authorized"})
            await websocket.close()
            return
        
        room_id = f"chat_{booking_id}"
        await manager.join_room(websocket, room_id)
        
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "message":
                await manager.broadcast_to_room(
                    room_id,
                    {
                        "type": "message",
                        "user_id": data.get("user_id"),
                        "username": data.get("username"),
                        "message": data.get("message"),
                        "timestamp": datetime.utcnow().isoformat()
                    }
                )
            
            elif data.get("type") == "typing":
                await manager.broadcast_to_room(
                    room_id,
                    {
                        "type": "typing",
                        "user_id": data.get("user_id"),
                        "is_typing": data.get("is_typing")
                    },
                    exclude=websocket
                )
            
            elif data.get("type") == "image":
                await manager.broadcast_to_room(
                    room_id,
                    {
                        "type": "image",
                        "user_id": data.get("user_id"),
                        "image_url": data.get("image_url"),
                        "timestamp": datetime.utcnow().isoformat()
                    }
                )
    
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        await websocket.send_json({"error": str(e)})
        await manager.disconnect(websocket)

@router.get("/ws/connections")
async def get_connections():
    """Obtenir les connexions WebSocket actives"""
    return {
        "active_connections": len(manager.active_connections),
        "rooms": list(manager.rooms.keys())
    }