# app/services/messenger_calls.py
# ============================================================================
# Appels vocaux Client ↔ Thérapeute : SIGNALISATION uniquement (l'audio passe
# en WebRTC pair-à-pair, jamais par ce serveur).
#
#   caller  ── call_invite ──►  serveur ── call_incoming (+ push) ──► callee
#   callee  ── call_accept ──►  serveur ── call_state=accepted ──► les deux
#   caller  ── call_signal(offer) ──► callee ── call_signal(answer) ──► caller
#   (candidats ICE échangés des deux côtés)  puis  call_end
#
# Variables d'environnement (optionnelles, pour traverser les NAT stricts) :
#   MESSENGER_STUN_URLS   défaut "stun:stun.l.google.com:19302"
#   MESSENGER_TURN_URLS / MESSENGER_TURN_USERNAME / MESSENGER_TURN_CREDENTIAL
# (un serveur TURN — ex. coturn — est recommandé en production ; ce n'est pas
#  gratuit sans limite : bande passante du serveur à prévoir.)
# ============================================================================
import asyncio
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..core.database import SessionLocal
from ..models.messenger import MessengerCall, MessengerConversation
from ..models.user import User
from . import messenger_permissions as perm
from . import messenger_service as svc
from .messenger_hub import hub

logger = logging.getLogger(__name__)

RING_TIMEOUT_SECONDS = 45
DISCONNECT_GRACE_SECONDS = 10

_active: Dict[int, Dict[str, Any]] = {}   # call_id -> état
_busy: Dict[int, int] = {}                # user_id -> call_id


def ice_servers() -> List[Dict[str, Any]]:
    stun = [u.strip() for u in os.getenv("MESSENGER_STUN_URLS", "stun:stun.l.google.com:19302").split(",") if u.strip()]
    servers: List[Dict[str, Any]] = [{"urls": stun}] if stun else []
    turn = [u.strip() for u in os.getenv("MESSENGER_TURN_URLS", "").split(",") if u.strip()]
    if turn:
        servers.append({
            "urls": turn,
            "username": os.getenv("MESSENGER_TURN_USERNAME", ""),
            "credential": os.getenv("MESSENGER_TURN_CREDENTIAL", ""),
        })
    return servers


def _other(call_state: Dict[str, Any], uid: int) -> int:
    return call_state["callee_id"] if uid == call_state["caller_id"] else call_state["caller_id"]


def _fmt_duration(seconds: int) -> str:
    return f"{seconds // 60}:{seconds % 60:02d}"


async def invite(db: Session, caller: User, conversation_id: int) -> Dict[str, Any]:
    conv, _member = svc.require_member(db, conversation_id, caller)
    if conv.type not in perm.PAIR_TYPES:
        raise HTTPException(422, "Les appels ne sont possibles que dans une conversation privée.")
    callee = perm.peer_of(db, conv, caller.id)
    if callee is None:
        raise HTTPException(404, "Interlocuteur introuvable")
    ok, why = perm.can_call(db, caller, callee)
    if not ok:
        raise HTTPException(403, why)
    if caller.id in _busy:
        raise HTTPException(409, "Vous êtes déjà en communication.")

    call = MessengerCall(conversation_id=conv.id, caller_id=caller.id, callee_id=callee.id, status="ringing")
    db.add(call)
    db.commit()
    db.refresh(call)

    if callee.id in _busy:
        call.status = "busy"
        call.ended_at = datetime.utcnow()
        call.end_reason = "busy"
        db.commit()
        await _post_call_message(db, conv, call, caller, "Appel manqué (occupé)")
        await hub.send_to_user(caller.id, {"type": "call_state", "call_id": call.id, "status": "busy",
                                           "conversation_id": conv.id})
        return {"call_id": call.id, "status": "busy"}

    state = {"id": call.id, "conversation_id": conv.id, "caller_id": caller.id, "callee_id": callee.id,
             "status": "ringing", "task": None}
    _active[call.id] = state
    _busy[caller.id] = call.id
    _busy[callee.id] = call.id
    state["task"] = asyncio.create_task(_ring_timeout(call.id))

    incoming = {
        "type": "call_incoming", "call_id": call.id, "conversation_id": conv.id,
        "caller": svc.user_brief(caller), "ice_servers": ice_servers(),
    }
    delivered = await hub.send_to_user(callee.id, incoming)
    if not delivered:
        try:
            from .push_notifications import push_service
            asyncio.create_task(push_service.send_to_user(
                callee.id, "Appel vocal", f"{caller.fullname} vous appelle",
                {"type": "messenger_call", "call_id": call.id, "conversation_id": conv.id},
                channel_id="calls",
            ))
        except Exception:  # noqa: BLE001
            logger.warning("Push d'appel impossible", exc_info=True)

    await hub.send_to_user(caller.id, {"type": "call_state", "call_id": call.id, "status": "ringing",
                                       "conversation_id": conv.id, "ice_servers": ice_servers()})
    return {"call_id": call.id, "status": "ringing"}


async def accept(db: Session, user: User, call_id: int) -> None:
    state = _active.get(call_id)
    if state is None or state["callee_id"] != user.id or state["status"] != "ringing":
        raise HTTPException(409, "Cet appel n'est plus disponible.")
    state["status"] = "accepted"
    if state.get("task"):
        state["task"].cancel()
    call = db.query(MessengerCall).filter_by(id=call_id).first()
    if call is not None:
        call.status = "accepted"
        call.answered_at = datetime.utcnow()
        db.commit()
    payload = {"type": "call_state", "call_id": call_id, "status": "accepted",
               "conversation_id": state["conversation_id"], "ice_servers": ice_servers()}
    await hub.send_to_users([state["caller_id"], state["callee_id"]], payload)


async def decline(db: Session, user: User, call_id: int) -> None:
    state = _active.get(call_id)
    if state is None or state["callee_id"] != user.id or state["status"] != "ringing":
        return
    await finish(call_id, "declined", "declined")


async def hangup(db: Session, user: User, call_id: int) -> None:
    """Raccrocher : annule l'appel (si ça sonne encore) ou le termine."""
    state = _active.get(call_id)
    if state is None or user.id not in (state["caller_id"], state["callee_id"]):
        return
    if state["status"] == "ringing":
        if user.id == state["caller_id"]:
            await finish(call_id, "cancelled", "cancelled")
        else:
            await finish(call_id, "declined", "declined")
    else:
        await finish(call_id, "ended", "hangup")


async def relay_signal(user: User, call_id: int, signal: str, data: Any) -> None:
    state = _active.get(call_id)
    if state is None or state["status"] != "accepted" or user.id not in (state["caller_id"], state["callee_id"]):
        return
    if signal not in ("offer", "answer", "candidate"):
        return
    await hub.send_to_user(_other(state, user.id), {
        "type": "call_signal", "call_id": call_id, "signal": signal, "data": data, "from": user.id,
    })


async def _ring_timeout(call_id: int) -> None:
    try:
        await asyncio.sleep(RING_TIMEOUT_SECONDS)
    except asyncio.CancelledError:
        return
    state = _active.get(call_id)
    if state is not None and state["status"] == "ringing":
        await finish(call_id, "missed", "no_answer")


async def on_user_disconnected(user_id: int) -> None:
    """Dernière connexion fermée : si un appel est en cours, on laisse 10 s pour se reconnecter."""
    call_id = _busy.get(user_id)
    if call_id is None:
        return
    await asyncio.sleep(DISCONNECT_GRACE_SECONDS)
    state = _active.get(call_id)
    if state is not None and state["status"] == "accepted" and not hub.is_online(user_id):
        await finish(call_id, "ended", "disconnected")


def pending_incoming(user_id: int) -> Optional[Dict[str, Any]]:
    call_id = _busy.get(user_id)
    state = _active.get(call_id) if call_id else None
    if state and state["status"] == "ringing" and state["callee_id"] == user_id:
        return state
    return None


async def finish(call_id: int, status: str, reason: str) -> None:
    state = _active.pop(call_id, None)
    if state is None:
        return
    if state.get("task"):
        state["task"].cancel()
    for uid in (state["caller_id"], state["callee_id"]):
        if _busy.get(uid) == call_id:
            _busy.pop(uid, None)

    db = SessionLocal()
    try:
        call = db.query(MessengerCall).filter_by(id=call_id).first()
        if call is None:
            return
        call.status = status
        call.ended_at = datetime.utcnow()
        call.end_reason = reason
        if call.answered_at is not None:
            call.duration_seconds = max(0, int((call.ended_at - call.answered_at).total_seconds()))
        db.commit()
        db.refresh(call)

        conv = db.query(MessengerConversation).filter_by(id=call.conversation_id).first()
        caller = db.query(User).filter_by(id=call.caller_id).first()
        if conv is not None and caller is not None:
            if status == "ended" and call.duration_seconds >= 0 and call.answered_at is not None:
                text = f"Appel vocal · {_fmt_duration(call.duration_seconds)}"
            elif status == "declined":
                text = "Appel refusé"
            elif status == "cancelled":
                text = "Appel manqué"
            else:
                text = "Appel manqué"
            await _post_call_message(db, conv, call, caller, text)

        await hub.send_to_users(
            [state["caller_id"], state["callee_id"]],
            {"type": "call_state", "call_id": call_id, "status": status, "reason": reason,
             "duration_seconds": call.duration_seconds, "conversation_id": state["conversation_id"]},
        )
    except Exception:  # noqa: BLE001
        db.rollback()
        logger.exception("Appel : clôture impossible")
    finally:
        db.close()


async def _post_call_message(db: Session, conv: MessengerConversation, call: MessengerCall, caller: User, text: str) -> None:
    msg = svc._create_message(  # noqa: SLF001
        db, conv, caller, message_type="call", content=text, call_id=call.id, allow_reply=False
    )
    await svc.publish_new_message(db, conv, msg)


def list_calls(db: Session, user: User, limit: int = 50) -> List[Dict[str, Any]]:
    rows = (
        db.query(MessengerCall)
        .filter((MessengerCall.caller_id == user.id) | (MessengerCall.callee_id == user.id))
        .order_by(MessengerCall.id.desc())
        .limit(limit)
        .all()
    )
    seen = svc.last_seen_map(db, [r.caller_id for r in rows] + [r.callee_id for r in rows])
    items = []
    for r in rows:
        outgoing = r.caller_id == user.id
        peer = r.callee if outgoing else r.caller
        items.append({
            "id": r.id,
            "conversation_id": r.conversation_id,
            "direction": "outgoing" if outgoing else "incoming",
            "status": r.status,
            "missed": (not outgoing) and r.status in ("missed", "cancelled", "busy"),
            "duration_seconds": r.duration_seconds or 0,
            "peer": svc.peer_brief(peer, seen),
            "created_at": svc._iso(r.created_at),  # noqa: SLF001
        })
    return items
