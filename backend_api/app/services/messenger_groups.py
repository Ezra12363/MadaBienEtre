# app/services/messenger_groups.py
# Groupes et canaux d'annonces : géré UNIQUEMENT par les administrateurs
# (créer, renommer, ajouter / retirer des membres, réglages). Les membres
# peuvent quitter un groupe.
import shutil
import uuid
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models.messenger import MessengerConversation, MessengerMember
from ..models.user import User
from . import messenger_permissions as perm
from . import messenger_service as svc
from .messenger_hub import hub

AUDIENCES = {"clients", "therapists", "clients_therapists", "admins", "support"}
GROUP_TYPES = {"group", "announcement"}
MAX_GROUP_MEMBERS = 5000


def _require_admin(user: User) -> None:
    if not perm.is_admin(user):
        raise HTTPException(403, "Action réservée aux administrateurs.")


def _managed_group(db: Session, user: User, conv_id: int) -> MessengerConversation:
    conv = svc.get_conversation_or_404(db, conv_id)
    if not perm.can_manage_group(user, conv):
        raise HTTPException(403, "Action réservée aux administrateurs.")
    return conv


async def _system_message(db: Session, conv: MessengerConversation, actor: User, text: str) -> None:
    msg = svc._create_message(  # noqa: SLF001 - même package
        db, conv, actor, message_type="system", content=text[:500], allow_reply=False
    )
    await svc.publish_new_message(db, conv, msg)


def _resolve_users(
    db: Session, conv: MessengerConversation, user_ids: Iterable[int], roles: Iterable[str]
) -> List[User]:
    wanted = set(int(i) for i in (user_ids or []))
    q = db.query(User).filter(User.is_active.is_(True), User.deleted_at.is_(None))
    users: Dict[int, User] = {}
    if wanted:
        for u in q.filter(User.id.in_(wanted)).all():
            users[u.id] = u
    role_list = [r.upper() for r in (roles or []) if r.upper() in svc.ROLE_FILTERS]
    if role_list:
        for u in q.filter(User.role.in_(role_list)).limit(MAX_GROUP_MEMBERS).all():
            users[u.id] = u
    return [u for u in users.values() if perm.audience_allows(conv.audience, u)]


def _add_members(db: Session, conv: MessengerConversation, users: List[User]) -> List[User]:
    added: List[User] = []
    existing = {m.user_id: m for m in conv.members}
    active_count = sum(1 for m in conv.members if m.left_at is None)
    for u in users:
        member = existing.get(u.id)
        if member is not None and member.left_at is None:
            continue
        if active_count >= MAX_GROUP_MEMBERS:
            break
        if member is not None:
            member.left_at = None
            member.joined_at = datetime.utcnow()
            member.hidden_before_id = conv.last_message_id or 0
        else:
            db.add(MessengerMember(
                conversation_id=conv.id, user_id=u.id,
                role="admin" if perm.is_admin(u) else "member",
                hidden_before_id=0,
            ))
        active_count += 1
        added.append(u)
    db.commit()
    return added


async def create_group(
    db: Session, admin: User, title: str, type_: str = "group", audience: Optional[str] = None,
    member_ids: Optional[List[int]] = None, add_roles: Optional[List[str]] = None,
    members_can_chat: bool = True, description: Optional[str] = None,
) -> Dict[str, Any]:
    _require_admin(admin)
    title = (title or "").strip()
    if len(title) < 2:
        raise HTTPException(422, "Le nom du groupe doit contenir au moins 2 caractères.")
    if type_ not in GROUP_TYPES:
        raise HTTPException(422, "Type de groupe invalide.")
    if audience is not None and audience not in AUDIENCES:
        raise HTTPException(422, "Audience invalide.")

    conv = MessengerConversation(
        type=type_, title=title[:150], description=(description or "").strip()[:500] or None,
        audience=audience, created_by_id=admin.id,
        members_can_chat=False if type_ == "announcement" else bool(members_can_chat),
    )
    db.add(conv)
    db.flush()
    db.add(MessengerMember(conversation_id=conv.id, user_id=admin.id, role="owner"))
    db.commit()
    db.refresh(conv)

    users = _resolve_users(db, conv, member_ids or [], add_roles or [])
    added = _add_members(db, conv, [u for u in users if u.id != admin.id])
    db.refresh(conv)

    label = "Canal d'annonces" if type_ == "announcement" else "Groupe"
    await _system_message(db, conv, admin, f"{label} « {conv.title} » créé.")
    await hub.send_to_users(
        svc.active_member_ids(conv), {"type": "conversation_updated", "conversation_id": conv.id}
    )
    return {"id": conv.id, "added": len(added)}


async def update_group(
    db: Session, admin: User, conv_id: int, title: Optional[str] = None,
    description: Optional[str] = None, members_can_chat: Optional[bool] = None,
    audience: Optional[str] = None, type_: Optional[str] = None,
) -> Dict[str, Any]:
    conv = _managed_group(db, admin, conv_id)
    changes: List[str] = []
    if title is not None:
        title = title.strip()
        if len(title) < 2:
            raise HTTPException(422, "Le nom du groupe doit contenir au moins 2 caractères.")
        if title != conv.title:
            conv.title = title[:150]
            changes.append(f"Le groupe a été renommé « {conv.title} ».")
    if description is not None:
        conv.description = description.strip()[:500] or None
    if audience is not None:
        if audience not in AUDIENCES:
            raise HTTPException(422, "Audience invalide.")
        conv.audience = audience
    if type_ is not None:
        if type_ not in GROUP_TYPES:
            raise HTTPException(422, "Type de groupe invalide.")
        if type_ != conv.type:
            conv.type = type_
            changes.append(
                "Ce groupe est maintenant un canal d'annonces." if type_ == "announcement"
                else "Ce canal est maintenant un groupe de discussion."
            )
    if members_can_chat is not None:
        if members_can_chat != conv.members_can_chat and conv.type == "group":
            changes.append(
                "Les membres peuvent maintenant écrire." if members_can_chat
                else "Seuls les administrateurs peuvent écrire."
            )
        conv.members_can_chat = bool(members_can_chat)
    if conv.type == "announcement":
        conv.members_can_chat = False
    db.commit()
    for text in changes:
        await _system_message(db, conv, admin, text)
    await hub.send_to_users(
        svc.active_member_ids(conv), {"type": "conversation_updated", "conversation_id": conv.id}
    )
    return {"success": True}


async def set_photo(db: Session, admin: User, conv_id: int, data: bytes) -> Dict[str, Any]:
    conv = _managed_group(db, admin, conv_id)
    kind, ext, _mime = svc.inspect_upload(data, "photo", None)
    if kind != "image" or ext == "gif":
        raise HTTPException(415, "La photo doit être une image JPEG, PNG ou WebP.")
    if len(data) > svc.MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image trop lourde.")
    folder = svc.conv_dir(conv.id)
    folder.mkdir(parents=True, exist_ok=True)
    key = f"{uuid.uuid4().hex}.{ext}"
    (folder / key).write_bytes(data)
    svc.remove_file(conv.id, conv.photo_file)
    conv.photo_file = key
    db.commit()
    await hub.send_to_users(
        svc.active_member_ids(conv), {"type": "conversation_updated", "conversation_id": conv.id}
    )
    return {"photo": f"/messenger/files/{conv.id}/{key}"}


async def add_members(
    db: Session, admin: User, conv_id: int, user_ids: List[int], roles: List[str]
) -> Dict[str, Any]:
    conv = _managed_group(db, admin, conv_id)
    users = _resolve_users(db, conv, user_ids, roles)
    added = _add_members(db, conv, users)
    db.refresh(conv)
    if added:
        names = ", ".join(u.fullname for u in added[:3]) + (f" et {len(added) - 3} autres" if len(added) > 3 else "")
        await _system_message(db, conv, admin, f"{names} {'a été ajouté(e)' if len(added) == 1 else 'ont été ajoutés'}.")
        for u in added:
            await hub.send_to_user(u.id, {"type": "conversation_updated", "conversation_id": conv.id})
    return {"added": len(added)}


async def remove_member(db: Session, admin: User, conv_id: int, user_id: int) -> Dict[str, Any]:
    conv = _managed_group(db, admin, conv_id)
    member = perm.get_member(db, conv.id, user_id)
    if member is None:
        raise HTTPException(404, "Membre introuvable.")
    if member.role == "owner":
        raise HTTPException(403, "Le propriétaire du groupe ne peut pas être retiré.")
    name = member.user.fullname if member.user else "Un membre"
    member.left_at = datetime.utcnow()
    db.commit()
    await hub.send_to_user(user_id, {"type": "conversation_removed", "conversation_id": conv.id})
    await _system_message(db, conv, admin, f"{name} a été retiré(e) du groupe.")
    return {"success": True}


async def set_member_role(db: Session, admin: User, conv_id: int, user_id: int, role: str) -> Dict[str, Any]:
    conv = _managed_group(db, admin, conv_id)
    if role not in ("admin", "member"):
        raise HTTPException(422, "Rôle invalide.")
    member = perm.get_member(db, conv.id, user_id)
    if member is None:
        raise HTTPException(404, "Membre introuvable.")
    if member.role == "owner":
        raise HTTPException(403, "Le rôle du propriétaire ne peut pas être modifié.")
    if role == "admin" and not perm.is_admin(member.user):
        raise HTTPException(422, "Seul un administrateur de la plateforme peut être administrateur du groupe.")
    member.role = role
    db.commit()
    await hub.send_to_users(svc.active_member_ids(conv), {"type": "conversation_updated", "conversation_id": conv.id})
    return {"success": True}


async def leave_group(db: Session, user: User, conv_id: int) -> Dict[str, Any]:
    conv, member = svc.require_member(db, conv_id, user)
    if conv.type in perm.PAIR_TYPES:
        raise HTTPException(422, "Utilisez « Supprimer la conversation ».")
    member.left_at = datetime.utcnow()
    db.commit()
    await hub.send_to_user(user.id, {"type": "conversation_removed", "conversation_id": conv.id})
    await _system_message(db, conv, user, f"{user.fullname} a quitté le groupe.")
    return {"success": True}


async def delete_group(db: Session, admin: User, conv_id: int) -> Dict[str, Any]:
    conv = _managed_group(db, admin, conv_id)
    members = svc.active_member_ids(conv)
    folder = svc.conv_dir(conv.id)
    db.delete(conv)
    db.commit()
    shutil.rmtree(folder, ignore_errors=True)
    await hub.send_to_users(members, {"type": "conversation_removed", "conversation_id": conv_id})
    return {"success": True}
