# app/api/messenger.py
# ============================================================================
# API REST de la messagerie « Messenger » (préfixe /messenger).
# Le temps réel (messages, reçus, saisie, présence, appels) passe par le
# WebSocket /ws/messenger (voir messenger_ws.py). Chaque route revérifie les
# permissions côté serveur — l'interface n'est jamais la seule protection.
# ============================================================================
import logging
import re
from typing import List, Optional

from fastapi import (
    APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile, status,
)
import os

from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.messenger_schema import ensure_messenger_schema
from ..core.dependencies import get_current_admin, get_current_user, get_user_from_websocket
from ..models.messenger import MessengerConversation, MessengerMember, MessengerMessage, MessengerReport
from ..models.user import User
from ..services import messenger_calls as calls
from ..services import messenger_groups as groups
from ..services import messenger_permissions as perm
from ..services import messenger_service as svc
from ..services.messenger_hub import hub
from ..services.messenger_stickers import catalog

def _ensure_schema() -> None:
    """Filet de sécurité : met le schéma à niveau à la 1re requête (une seule fois par processus)."""
    if not ensure_messenger_schema():
        raise HTTPException(503, "Mise à jour de la base de données de la messagerie impossible : "
                                 "lancez « python fix_messenger_schema.py » dans backend_api.")


router = APIRouter(prefix="/messenger", tags=["Messenger"], dependencies=[Depends(_ensure_schema)])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Schémas
# ---------------------------------------------------------------------------
class DirectRequest(BaseModel):
    user_id: int


class SendRequest(BaseModel):
    type: str = Field("text", pattern="^(text|sticker|location)$")
    text: Optional[str] = Field(None, max_length=svc.MAX_TEXT_LENGTH)
    sticker_id: Optional[str] = Field(None, max_length=40)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = Field(None, max_length=500)
    client_id: Optional[str] = Field(None, max_length=64)
    reply_to_id: Optional[int] = None
    allow_reply: Optional[bool] = None
    location_type: Optional[str] = Field(None, pattern="^(booking|live)$")


class ReadRequest(BaseModel):
    up_to_id: Optional[int] = None


class SettingsRequest(BaseModel):
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None
    is_muted: Optional[bool] = None


class EditRequest(BaseModel):
    text: str = Field(..., max_length=svc.MAX_TEXT_LENGTH)


class ReactRequest(BaseModel):
    emoji: Optional[str] = Field(None, max_length=16)


class PinRequest(BaseModel):
    pinned: bool = True


class ForwardRequest(BaseModel):
    conversation_ids: List[int] = Field(..., min_length=1, max_length=10)


class ReportRequest(BaseModel):
    reason: str
    details: Optional[str] = Field(None, max_length=500)


class FavoriteRequest(BaseModel):
    favorite: bool = True


class GroupCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=150)
    type: str = Field("group", pattern="^(group|announcement)$")
    audience: Optional[str] = None
    member_ids: List[int] = []
    add_roles: List[str] = []
    members_can_chat: bool = True
    description: Optional[str] = Field(None, max_length=500)


class GroupUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=150)
    description: Optional[str] = Field(None, max_length=500)
    members_can_chat: Optional[bool] = None
    audience: Optional[str] = None
    type: Optional[str] = Field(None, pattern="^(group|announcement)$")


class MembersAdd(BaseModel):
    user_ids: List[int] = []
    roles: List[str] = []


class RoleRequest(BaseModel):
    role: str


class ReportReview(BaseModel):
    status: str = Field(..., pattern="^(reviewed|dismissed|open)$")


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------
@router.get("/conversations")
def list_conversations(
    archived: bool = Query(False),
    me: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.list_conversations(db, me, archived)


@router.post("/conversations/direct")
def open_direct(body: DirectRequest, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = svc.get_or_create_direct(db, me, body.user_id)
    return {"id": conv.id}


@router.post("/conversations/booking/{booking_id}")
def open_booking_conversation(booking_id: int, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Ouvre (ou crée) la conversation d'une réservation — le chat existant."""
    conv = svc.get_or_create_booking_conversation(db, me, booking_id)
    return {"id": conv.id}


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: int, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv, member = svc.require_member(db, conversation_id, me)
    return svc.conversation_detail(db, me, conv, member)


@router.get("/conversations/{conversation_id}/messages")
def get_messages(
    conversation_id: int,
    before_id: Optional[int] = Query(None, ge=1),
    after_id: Optional[int] = Query(None, ge=1),
    limit: int = Query(40, ge=1, le=100),
    me: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.load_messages(db, me, conversation_id, before_id, after_id, limit)


@router.get("/conversations/{conversation_id}/pinned")
def get_pinned(conversation_id: int, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.pinned_messages(db, me, conversation_id)


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: int, body: SendRequest,
    me: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    if body.type == "text":
        return await svc.send_text(db, me, conversation_id, body.text or "", body.client_id,
                                   body.reply_to_id, body.allow_reply)
    if body.type == "sticker":
        return await svc.send_sticker(db, me, conversation_id, body.sticker_id or "", body.client_id,
                                      body.reply_to_id, body.allow_reply)
    if body.latitude is None or body.longitude is None:
        raise HTTPException(422, "Position manquante.")
    return await svc.send_location(db, me, conversation_id, body.latitude, body.longitude,
                                   body.address, body.client_id, body.reply_to_id,
                                   body.location_type or "live")


@router.post("/conversations/{conversation_id}/attachments")
async def send_attachment(
    conversation_id: int,
    file: UploadFile = File(...),
    kind: Optional[str] = Form(None),
    caption: Optional[str] = Form(None),
    client_id: Optional[str] = Form(None),
    reply_to_id: Optional[int] = Form(None),
    duration_seconds: Optional[int] = Form(None),
    allow_reply: Optional[bool] = Form(None),
    me: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if client_id and len(client_id) > 64:
        raise HTTPException(422, "client_id trop long")
    # Lecture bornée : jamais plus de MAX + 1 octets en mémoire
    data = await file.read(svc.MAX_FILE_BYTES + 1)
    return await svc.send_attachment(
        db, me, conversation_id, data, file.filename or "fichier", kind, caption, client_id,
        reply_to_id, duration_seconds, allow_reply,
    )


@router.post("/conversations/{conversation_id}/read")
async def mark_read(
    conversation_id: int, body: Optional[ReadRequest] = None,
    me: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    changed = await svc.mark_read(db, me, conversation_id, body.up_to_id if body else None)
    return {"success": True, "changed": changed}


@router.put("/conversations/{conversation_id}/settings")
async def update_settings(
    conversation_id: int, body: SettingsRequest,
    me: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    return await svc.update_my_settings(db, me, conversation_id, body.is_pinned, body.is_archived, body.is_muted)


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: int, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await svc.delete_conversation_for_me(db, me, conversation_id)


@router.get("/unread")
def unread(me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.unread_summary(db, me.id)


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------
@router.put("/messages/{message_id}")
async def edit_message(message_id: int, body: EditRequest, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await svc.edit_message(db, me, message_id, body.text)


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int, scope: str = Query("all", pattern="^(all|me)$"),
    me: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    return await svc.delete_message(db, me, message_id, scope)


@router.post("/messages/{message_id}/reactions")
async def react(message_id: int, body: ReactRequest, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await svc.react(db, me, message_id, body.emoji)


@router.put("/messages/{message_id}/pin")
async def pin(message_id: int, body: PinRequest, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await svc.set_pinned(db, me, message_id, body.pinned)


@router.post("/messages/{message_id}/forward")
async def forward(message_id: int, body: ForwardRequest, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await svc.forward_message(db, me, message_id, body.conversation_ids)


@router.post("/messages/{message_id}/report")
def report(message_id: int, body: ReportRequest, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"success": True, "report_id": svc.report_message(db, me, message_id, body.reason, body.details)}


# ---------------------------------------------------------------------------
# Fichiers (authentifiés : en-tête Authorization OU ?token= pour <img>/<audio>)
# ---------------------------------------------------------------------------
def _clean_token(token: Optional[str]) -> str:
    if not token:
        return ""
    t = str(token).strip().strip('"')
    return t[7:].strip() if t.lower().startswith("bearer ") else t


_INLINE_MIME = ("image/", "audio/", "application/pdf")


def _range_response(path, mime: str, range_header: str, display_name: str):
    """Réponse 206 (HTTP Range) : indispensable au lecteur audio Android (ExoPlayer),
    qui lit les .m4a en sautant à la fin du fichier (atome « moov »)."""
    size = os.path.getsize(path)
    m = re.match(r"bytes=(\d*)-(\d*)", range_header or "")
    if not m or (m.group(1) == "" and m.group(2) == ""):
        return None
    if m.group(1) == "":                      # bytes=-N : les N derniers octets
        start = max(0, size - int(m.group(2)))
        end = size - 1
    else:
        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else size - 1
    end = min(end, size - 1)
    if start >= size or start > end:
        return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
    with open(path, "rb") as fh:
        fh.seek(start)
        data = fh.read(end - start + 1)
    return Response(
        content=data, status_code=206, media_type=mime,
        headers={
            "Content-Range": f"bytes {start}-{end}/{size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(len(data)),
            "Content-Disposition": "inline",
            "Cache-Control": "private, max-age=86400",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/files/{conversation_id}/{filename}")
def get_file(
    conversation_id: int, filename: str,
    range: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
    download: bool = Query(False),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user = get_user_from_websocket(_clean_token(token or authorization), db)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentification requise")
    if perm.get_member(db, conversation_id, user.id) is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")

    path = svc.file_path_for(conversation_id, filename)
    if path is None:
        raise HTTPException(404, "Fichier introuvable")

    msg = db.query(MessengerMessage).filter(
        MessengerMessage.conversation_id == conversation_id, MessengerMessage.file_key == filename
    ).first()
    conv = db.query(MessengerConversation).filter_by(id=conversation_id, photo_file=filename).first()
    if msg is None and conv is None:
        raise HTTPException(404, "Fichier introuvable")  # supprimé ou orphelin

    mime = (msg.file_mime if msg else None) or "image/jpeg"
    display_name = (msg.file_name if msg else None) or filename
    inline = (not download) and mime.startswith(_INLINE_MIME)
    if range and mime.startswith("audio/"):
        partial = _range_response(path, mime, range, display_name)
        if partial is not None:
            return partial
    return FileResponse(
        path, media_type=mime,
        filename=display_name,
        content_disposition_type="inline" if inline else "attachment",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, max-age=86400",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )


# ---------------------------------------------------------------------------
# Contacts, recherche, présence, stickers
# ---------------------------------------------------------------------------
@router.get("/contacts")
def contacts(q: Optional[str] = Query(None, max_length=100), me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.list_contacts(db, me, q)


@router.get("/search")
def search(
    q: str = Query(..., min_length=2, max_length=100),
    conversation_id: Optional[int] = Query(None),
    me: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    if conversation_id:
        svc.require_member(db, conversation_id, me)
    return svc.search(db, me, q, conversation_id)


@router.get("/presence")
def presence(user_ids: str = Query(..., max_length=2000), me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        ids = [int(i) for i in user_ids.split(",") if i.strip()][:200]
    except ValueError:
        raise HTTPException(422, "user_ids invalide")
    allowed = set(svc.co_member_ids(db, me.id, ids))
    seen = svc.last_seen_map(db, allowed)
    return {
        str(i): {"is_online": hub.is_online(i), "last_seen_at": svc._iso(seen.get(i))}  # noqa: SLF001
        for i in allowed
    }


@router.get("/stickers")
def stickers(me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"packs": catalog(), **svc.user_stickers(db, me.id)}


@router.put("/stickers/{sticker_id}/favorite")
def favorite_sticker(sticker_id: str, body: FavoriteRequest, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    svc.set_favorite_sticker(db, me.id, sticker_id, body.favorite)
    return {"success": True}


# ---------------------------------------------------------------------------
# Blocage
# ---------------------------------------------------------------------------
@router.get("/blocks")
def blocks(me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.list_blocks(db, me)


@router.post("/blocks/{user_id}")
def block(user_id: int, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    svc.block_user(db, me, user_id)
    return {"success": True}


@router.delete("/blocks/{user_id}")
def unblock(user_id: int, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    svc.unblock_user(db, me, user_id)
    return {"success": True}


# ---------------------------------------------------------------------------
# Groupes / annonces (administrateurs)
# ---------------------------------------------------------------------------
@router.post("/groups")
async def create_group(body: GroupCreate, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await groups.create_group(
        db, me, body.title, body.type, body.audience, body.member_ids, body.add_roles,
        body.members_can_chat, body.description,
    )


@router.put("/groups/{conversation_id}")
async def update_group(conversation_id: int, body: GroupUpdate, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await groups.update_group(
        db, me, conversation_id, body.title, body.description, body.members_can_chat, body.audience, body.type
    )


@router.post("/groups/{conversation_id}/photo")
async def group_photo(conversation_id: int, file: UploadFile = File(...), me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = await file.read(svc.MAX_IMAGE_BYTES + 1)
    return await groups.set_photo(db, me, conversation_id, data)


@router.post("/groups/{conversation_id}/members")
async def add_members(conversation_id: int, body: MembersAdd, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await groups.add_members(db, me, conversation_id, body.user_ids, body.roles)


@router.delete("/groups/{conversation_id}/members/{user_id}")
async def remove_member(conversation_id: int, user_id: int, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await groups.remove_member(db, me, conversation_id, user_id)


@router.put("/groups/{conversation_id}/members/{user_id}/role")
async def member_role(conversation_id: int, user_id: int, body: RoleRequest, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await groups.set_member_role(db, me, conversation_id, user_id, body.role)


@router.post("/groups/{conversation_id}/leave")
async def leave_group(conversation_id: int, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await groups.leave_group(db, me, conversation_id)


@router.delete("/groups/{conversation_id}")
async def delete_group(conversation_id: int, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await groups.delete_group(db, me, conversation_id)


# ---------------------------------------------------------------------------
# Appels : historique + configuration ICE (la signalisation passe par le WebSocket)
# ---------------------------------------------------------------------------
@router.get("/calls")
def call_history(limit: int = Query(50, ge=1, le=200), me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return calls.list_calls(db, me, limit)


@router.get("/calls/ice-config")
def ice_config(me: User = Depends(get_current_user)):
    return {"ice_servers": calls.ice_servers()}


# ---------------------------------------------------------------------------
# Modération (administrateurs)
# ---------------------------------------------------------------------------
@router.get("/admin/reports")
def admin_reports(
    report_status: str = Query("open", alias="status", pattern="^(open|reviewed|dismissed|all)$"),
    limit: int = Query(100, ge=1, le=300),
    admin: User = Depends(get_current_admin), db: Session = Depends(get_db),
):
    q = db.query(MessengerReport)
    if report_status != "all":
        q = q.filter(MessengerReport.status == report_status)
    rows = q.order_by(MessengerReport.id.desc()).limit(limit).all()
    titles = {}
    for r in rows:
        if r.conversation_id and r.conversation_id not in titles:
            c = db.query(MessengerConversation).filter_by(id=r.conversation_id).first()
            titles[r.conversation_id] = (c.title if c and c.title else "Conversation privée") if c else "Supprimée"
    return [{
        "id": r.id, "reason": r.reason, "details": r.details, "status": r.status,
        "message_id": r.message_id, "message_snapshot": r.message_snapshot,
        "conversation_id": r.conversation_id, "conversation_title": titles.get(r.conversation_id),
        "reporter": svc.user_brief(r.reporter), "reported_user": svc.user_brief(r.reported_user),
        "created_at": svc._iso(r.created_at),  # noqa: SLF001
    } for r in rows]


@router.put("/admin/reports/{report_id}")
def admin_review_report(report_id: int, body: ReportReview, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    from datetime import datetime
    rep = db.query(MessengerReport).filter_by(id=report_id).first()
    if rep is None:
        raise HTTPException(404, "Signalement introuvable")
    rep.status = body.status
    rep.reviewed_by_id = admin.id
    rep.reviewed_at = datetime.utcnow()
    db.commit()
    return {"success": True}


@router.get("/admin/groups")
def admin_groups(q: Optional[str] = Query(None, max_length=100), admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    query = db.query(MessengerConversation).filter(MessengerConversation.type.in_(["group", "announcement"]))
    if q and q.strip():
        query = query.filter(MessengerConversation.title.ilike(svc._like(q.strip()), escape="\\"))  # noqa: SLF001
    rows = query.order_by(MessengerConversation.last_message_at.desc()).limit(100).all()
    mine = {m.conversation_id for m in db.query(MessengerMember).filter(
        MessengerMember.user_id == admin.id, MessengerMember.left_at.is_(None))}
    return [{
        "id": c.id, "type": c.type, "title": c.title, "audience": c.audience,
        "member_count": sum(1 for m in c.members if m.left_at is None), "joined": c.id in mine,
    } for c in rows]


@router.post("/admin/groups/{conversation_id}/join")
async def admin_join_group(conversation_id: int, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    conv = svc.get_conversation_or_404(db, conversation_id)
    if conv.type in perm.PAIR_TYPES:
        raise HTTPException(403, "Les conversations privées ne sont pas accessibles.")
    member = db.query(MessengerMember).filter_by(conversation_id=conv.id, user_id=admin.id).first()
    if member is None:
        db.add(MessengerMember(conversation_id=conv.id, user_id=admin.id, role="admin"))
    else:
        member.left_at = None
    db.commit()
    await hub.send_to_user(admin.id, {"type": "conversation_updated", "conversation_id": conv.id})
    return {"success": True}
