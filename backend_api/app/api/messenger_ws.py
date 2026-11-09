# app/api/messenger_ws.py
# ============================================================================
# WebSocket unique de la messagerie : /ws/messenger?token=<JWT>
#
# Client -> serveur
#   {type:"ping"}
#   {type:"app_state", active}                        (appli au 1er plan / en arrière-plan : pilote les push)
#   {type:"typing",   conversation_id, is_typing}
#   {type:"delivered", conversation_id, up_to_id?}      (reçu ✓✓)
#   {type:"read",      conversation_id, up_to_id?}      (vu)
#   {type:"send", conversation_id, kind:"text|sticker|location", text?, sticker_id?,
#                 latitude?, longitude?, address?, client_id?, reply_to_id?, allow_reply?}
#   {type:"call_invite", conversation_id}
#   {type:"call_accept"|"call_decline"|"call_hangup", call_id}
#   {type:"call_signal", call_id, kind:"offer|answer|candidate", data}
#
# Serveur -> client
#   ready, pong, ack, error, message_new, message_updated, message_deleted, reaction,
#   receipt, typing, presence, conversation_updated, conversation_removed,
#   call_incoming, call_state, call_signal
#
# ⚠️ L'identité vient TOUJOURS du token, jamais du JSON reçu.
# ============================================================================
import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from fastapi import HTTPException

from ..core.database import SessionLocal
from ..core.dependencies import get_user_from_websocket
from ..core.messenger_schema import ensure_messenger_schema
from ..models.user import User
from ..services import messenger_calls as calls
from ..services import messenger_service as svc
from ..services.messenger_hub import hub

router = APIRouter(tags=["Messenger WebSocket"])
logger = logging.getLogger(__name__)


def _clean_token(token: Optional[str]) -> str:
    if not token:
        return ""
    t = str(token).strip().strip('"')
    return t[7:].strip() if t.lower().startswith("bearer ") else t


async def _broadcast_presence(user_id: int, online: bool) -> None:
    db = SessionLocal()
    try:
        svc.touch_last_seen(db, user_id)
        seen = svc.last_seen_map(db, [user_id]).get(user_id)
        targets = svc.co_member_ids(db, user_id, hub.online_user_ids())
        await hub.send_to_users(
            targets,
            {"type": "presence", "user_id": user_id, "is_online": online, "last_seen_at": svc._iso(seen)},  # noqa: SLF001
        )
    except Exception:  # noqa: BLE001
        logger.exception("Messenger : présence")
    finally:
        db.close()


async def _handle(user_id: int, ws: WebSocket, data: dict) -> None:
    kind = data.get("type")
    if kind == "ping":
        await ws.send_json({"type": "pong"})
        return

    if kind == "app_state":
        hub.set_active(ws, bool(data.get("active", True)))
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
        if user is None or not user.is_active:
            await ws.close(code=4403)
            return

        conv_id = int(data.get("conversation_id") or 0)

        if kind == "typing":
            await svc.send_typing(db, user, conv_id, bool(data.get("is_typing")))

        elif kind == "delivered":
            await svc.mark_delivered(db, user, conv_id, data.get("up_to_id"))

        elif kind == "read":
            await svc.mark_read(db, user, conv_id, data.get("up_to_id"))

        elif kind == "send":
            client_id = str(data["client_id"])[:64] if data.get("client_id") else None
            reply_to = data.get("reply_to_id")
            allow_reply = data.get("allow_reply")
            what = data.get("kind", "text")
            if what == "text":
                msg = await svc.send_text(db, user, conv_id, str(data.get("text") or ""), client_id, reply_to, allow_reply)
            elif what == "sticker":
                msg = await svc.send_sticker(db, user, conv_id, str(data.get("sticker_id") or ""), client_id, reply_to, allow_reply)
            elif what == "location":
                msg = await svc.send_location(
                    db, user, conv_id, float(data.get("latitude")), float(data.get("longitude")),
                    data.get("address"), client_id, reply_to,
                )
            else:
                raise HTTPException(422, "Type de message invalide.")
            await ws.send_json({"type": "ack", "client_id": client_id, "message": msg})

        elif kind == "call_invite":
            await calls.invite(db, user, conv_id)

        elif kind == "call_accept":
            await calls.accept(db, user, int(data.get("call_id") or 0))

        elif kind == "call_decline":
            await calls.decline(db, user, int(data.get("call_id") or 0))

        elif kind == "call_hangup":
            await calls.hangup(db, user, int(data.get("call_id") or 0))

        elif kind == "call_signal":
            await calls.relay_signal(user, int(data.get("call_id") or 0), str(data.get("signal") or ""), data.get("data"))
    except HTTPException as exc:
        await ws.send_json({"type": "error", "ref": kind, "code": exc.status_code, "detail": exc.detail,
                            "client_id": data.get("client_id"), "conversation_id": data.get("conversation_id")})
    except (TypeError, ValueError):
        await ws.send_json({"type": "error", "ref": kind, "code": 422, "detail": "Données invalides.",
                            "client_id": data.get("client_id")})
    finally:
        db.close()


@router.websocket("/ws/messenger")
async def websocket_messenger(websocket: WebSocket, token: Optional[str] = Query(None)):
    await websocket.accept()
    ensure_messenger_schema()
    db = SessionLocal()
    user_id: Optional[int] = None
    try:
        user = get_user_from_websocket(_clean_token(token), db) if token else None
        if user is None:
            await websocket.send_json({"type": "error", "code": 401, "detail": "Authentification requise"})
            await websocket.close(code=4401)
            return
        user_id = user.id
        summary = svc.unread_summary(db, user_id)
    finally:
        db.close()

    first = await hub.connect(user_id, websocket)
    try:
        await websocket.send_json({"type": "ready", "user_id": user_id, "unread": summary})

        # Appel entrant resté en attente (app ouverte via la notification push)
        pending = calls.pending_incoming(user_id)
        if pending is not None:
            db2 = SessionLocal()
            try:
                caller = db2.query(User).filter_by(id=pending["caller_id"]).first()
                await websocket.send_json({
                    "type": "call_incoming", "call_id": pending["id"],
                    "conversation_id": pending["conversation_id"],
                    "caller": svc.user_brief(caller), "ice_servers": calls.ice_servers(),
                })
            finally:
                db2.close()

        if first:
            db3 = SessionLocal()
            try:
                u = db3.query(User).filter_by(id=user_id).first()
                if u is not None:
                    await svc.deliver_pending(db3, u)
            finally:
                db3.close()
            await _broadcast_presence(user_id, True)

        while True:
            data = await websocket.receive_json()
            if isinstance(data, dict):
                await _handle(user_id, websocket, data)
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        logger.exception("Erreur WebSocket messenger")
    finally:
        if user_id is not None:
            last = await hub.disconnect(user_id, websocket)
            if last:
                await _broadcast_presence(user_id, False)
                asyncio.create_task(calls.on_user_disconnected(user_id))
