# app/api/notifications.py
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.notification import Notification
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
