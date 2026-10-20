# app/api/notifications.py
from datetime import datetime
from typing import Optional

from typing import Any, Dict

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.notification import Notification, NotificationPreference
from ..models.user import User
from ..schemas.notification import NotificationResponse, PushNotificationToken
from ..services.push_notifications import push_service, is_expo_token

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationResponse])
@router.get("/", response_model=list[NotificationResponse], include_in_schema=False)
def get_notifications(
    is_read: Optional[bool] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retourne UNIQUEMENT les notifications du compte connecté."""
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)
    return (
        query.order_by(Notification.created_at.desc(), Notification.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .count()
    )
    return {"unread_count": count}


# --- Enregistrement du token push du téléphone (Expo) -----------------------
# L'app mobile doit l'appeler après connexion :
#   POST /notifications/register-token {token, platform, device_id}
@router.post("/register-token")
def register_push_token(
    payload: PushNotificationToken,
    current_user: User = Depends(get_current_user),
):
    if not is_expo_token(payload.token):
        raise HTTPException(
            status_code=400,
            detail="Token Expo invalide (attendu : ExponentPushToken[...])",
        )
    ok = push_service.register_token(
        current_user.id, payload.token, payload.platform, payload.device_id
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Impossible d'enregistrer le token")
    return {"success": True}


@router.post("/unregister-token")
def unregister_push_token(
    payload: PushNotificationToken,
    current_user: User = Depends(get_current_user),
):
    """À appeler à la déconnexion : l'ancien compte ne reçoit plus les push."""
    push_service.unregister_token(current_user.id, payload.token)
    return {"success": True}


@router.put("/read/{notification_id}")
def mark_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    notification.is_read = True
    notification.read_at = datetime.utcnow()
    db.commit()
    return {"success": True, "message": "Notification marked as read"}


@router.put("/read-all")
def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .update({"is_read": True, "read_at": datetime.utcnow()}, synchronize_session=False)
    )
    db.commit()
    return {"success": True, "updated": updated}


# --- Préférences : « désactiver » les notifications ----------------------------
# Catégories gérées par l'application (clés « <cat>_enabled » utilisées par les
# écrans client / thérapeute / admin) -> colonne de préférence en base.
_CATEGORY_COLUMNS = {
    "booking": "booking_notifications",
    "offer": "offer_notifications",
    "payment": "payment_notifications",
    "review": "review_notifications",
    "sos": "sos_notifications",
    "promotion": "promotion_notifications",
    "promotional": "promotion_notifications",
    "chat": "chat_notifications",
    "message": "chat_notifications",
}
_DIRECT_COLUMNS = {
    "push_enabled",
    "email_enabled",
    "sms_enabled",
    "booking_notifications",
    "offer_notifications",
    "payment_notifications",
    "review_notifications",
    "sos_notifications",
    "promotion_notifications",
    "chat_notifications",
    "silent_mode_start",
    "silent_mode_end",
}


def _get_or_create_preferences(db: Session, user_id: int) -> NotificationPreference:
    pref = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == user_id
    ).first()
    if pref is None:
        pref = NotificationPreference(user_id=user_id)
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return pref


def _preferences_payload(pref: NotificationPreference) -> Dict[str, Any]:
    data = {
        "push_enabled": pref.push_enabled is not False,
        "email_enabled": pref.email_enabled is not False,
        "sms_enabled": bool(pref.sms_enabled),
        "booking_notifications": pref.booking_notifications is not False,
        "offer_notifications": pref.offer_notifications is not False,
        "payment_notifications": pref.payment_notifications is not False,
        "review_notifications": pref.review_notifications is not False,
        "sos_notifications": pref.sos_notifications is not False,
        "promotion_notifications": bool(pref.promotion_notifications),
        "chat_notifications": pref.chat_notifications is not False,
        "silent_mode_start": pref.silent_mode_start,
        "silent_mode_end": pref.silent_mode_end,
    }
    # Alias « <catégorie>_enabled » attendus par l'application mobile
    data.update(
        {
            "booking_enabled": data["booking_notifications"],
            "offer_enabled": data["offer_notifications"],
            "payment_enabled": data["payment_notifications"],
            "review_enabled": data["review_notifications"],
            "sos_enabled": data["sos_notifications"],
            "promotion_enabled": data["promotion_notifications"],
            "chat_enabled": data["chat_notifications"],
        }
    )
    return data


@router.get("/preferences")
def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _preferences_payload(_get_or_create_preferences(db, current_user.id))


@router.put("/preferences")
def update_preferences(
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Accepte :
      - les colonnes directes  : {"push_enabled": false, "chat_notifications": false}
      - les clés par catégorie : {"booking_enabled": false, "payment_enabled": true}
    Les catégories sans interrupteur dédié (ex. « system ») sont refusées.
    """
    updates: Dict[str, Any] = {}
    unsupported = []

    for key, value in (payload or {}).items():
        if key in _DIRECT_COLUMNS:
            updates[key] = value
        elif key.endswith("_enabled") and key[: -len("_enabled")] in _CATEGORY_COLUMNS:
            updates[_CATEGORY_COLUMNS[key[: -len("_enabled")]]] = value
        else:
            unsupported.append(key)

    if unsupported and not updates:
        raise HTTPException(
            status_code=400,
            detail="Cette catégorie ne peut pas être désactivée : "
            + ", ".join(unsupported),
        )

    for column in ("silent_mode_start", "silent_mode_end"):
        value = updates.get(column)
        if value is not None and not (
            isinstance(value, str)
            and len(value) == 5
            and value[2] == ":"
            and value[:2].isdigit()
            and value[3:].isdigit()
        ):
            raise HTTPException(status_code=400, detail=f"{column} doit être au format HH:MM")

    pref = _get_or_create_preferences(db, current_user.id)
    for column, value in updates.items():
        if column in ("silent_mode_start", "silent_mode_end"):
            setattr(pref, column, value)
        else:
            setattr(pref, column, bool(value))
    db.commit()
    db.refresh(pref)

    return {"success": True, **_preferences_payload(pref)}


# --- Suppression -----------------------------------------------------------------
# ⚠️ « /all » doit être déclarée AVANT « /{notification_id} » (sinon FastAPI
# essaie de lire « all » comme un entier -> erreur 422).
@router.delete("/all")
def delete_all_notifications(
    only_read: bool = Query(default=False, description="Ne supprimer que les notifications lues"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if only_read:
        query = query.filter(Notification.is_read.is_(True))
    deleted = query.delete(synchronize_session=False)
    db.commit()
    return {"success": True, "deleted": deleted, "message": "Notifications supprimées"}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    db.delete(notification)
    db.commit()
    return {"success": True, "message": "Notification deleted"}
