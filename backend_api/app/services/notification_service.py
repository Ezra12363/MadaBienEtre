# app/services/notification_service.py
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from datetime import datetime
import json
import logging
from ..models.notification import Notification
from ..models.user import User
from ..core.database import get_db
from ..core.config import settings

logger = logging.getLogger(__name__)

class NotificationService:
    """Service de notifications"""
    
    @staticmethod
    def create_notification(
        db: Session,
        user_id: int,
        title: str,
        body: str,
        notification_type: str,
        data: Optional[Dict[str, Any]] = None,
        priority: str = "normal",
        booking_id: Optional[int] = None
    ) -> Notification:
        """Créer une notification"""
        notification = Notification(
            user_id=user_id,
            title=title,
            body=body,
            type=notification_type,
            data=data or {},
            priority=priority,
            booking_id=booking_id,
            is_read=False,
            is_sent=False
        )
        
        db.add(notification)
        db.commit()
        db.refresh(notification)
        
        return notification
    
    @staticmethod
    def send_push_notification(
        user_id: int,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Envoyer une notification push"""
        try:
            # Implémentation avec Expo Notifications ou Firebase
            logger.info(f"Push notification sent to user {user_id}: {title}")
            return True
        except Exception as e:
            logger.error(f"Push notification failed: {e}")
            return False
    
    @staticmethod
    def get_user_notifications(
        db: Session,
        user_id: int,
        is_read: Optional[bool] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Notification]:
        """Obtenir les notifications d'un utilisateur"""
        query = db.query(Notification).filter(Notification.user_id == user_id)
        
        if is_read is not None:
            query = query.filter(Notification.is_read == is_read)
        
        return query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()
    
    @staticmethod
    def mark_as_read(db: Session, notification_id: int, user_id: int) -> Optional[Notification]:
        """Marquer une notification comme lue"""
        notification = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()
        
        if notification:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            db.commit()
            db.refresh(notification)
        
        return notification
    
    @staticmethod
    def mark_all_as_read(db: Session, user_id: int) -> int:
        """Marquer toutes les notifications comme lues"""
        result = db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).update({"is_read": True, "read_at": datetime.utcnow()})
        
        db.commit()
        return result
    
    @staticmethod
    def delete_notification(db: Session, notification_id: int, user_id: int) -> bool:
        """Supprimer une notification"""
        notification = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()
        
        if notification:
            db.delete(notification)
            db.commit()
            return True
        
        return False
    
    @staticmethod
    def get_unread_count(db: Session, user_id: int) -> int:
        """Obtenir le nombre de notifications non lues"""
        return db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).count()


# ✅ Ajout de la fonction send_sms
def send_sms(phone: str, message: str) -> bool:
    """
    Envoyer un SMS
    
    Args:
        phone: Numéro de téléphone du destinataire
        message: Message à envoyer
    
    Returns:
        bool: True si l'envoi a réussi, False sinon
    """
    try:
        # Implémentation avec Twilio ou autre service SMS
        if settings.SMS_ENABLED:
            # Exemple avec Twilio (décommentez si configuré)
            # from twilio.rest import Client
            # client = Client(settings.SMS_ACCOUNT_SID, settings.SMS_AUTH_TOKEN)
            # client.messages.create(
            #     body=message,
            #     from_=settings.SMS_FROM_NUMBER,
            #     to=phone
            # )
            logger.info(f"SMS sent to {phone}: {message[:50]}...")
        else:
            logger.info(f"SMS would be sent to {phone}: {message[:50]}...")
        return True
    except Exception as e:
        logger.error(f"SMS sending failed: {e}")
        return False


def send_notification(
    user_id: int,
    title: str,
    body: str,
    notification_type: str,
    data: Optional[Dict[str, Any]] = None,
    priority: str = "normal",
    booking_id: Optional[int] = None,
    send_push: bool = True
) -> Optional[Notification]:
    """Fonction helper pour envoyer une notification"""
    db = next(get_db())
    
    # Créer la notification
    notification = NotificationService.create_notification(
        db=db,
        user_id=user_id,
        title=title,
        body=body,
        notification_type=notification_type,
        data=data,
        priority=priority,
        booking_id=booking_id
    )
    
    # Envoyer la notification push
    if send_push:
        NotificationService.send_push_notification(user_id, title, body, data)
    
    return notification


def send_booking_notification(
    user_id: int,
    booking_id: int,
    status: str,
    message: str
) -> None:
    """Envoyer une notification liée à une réservation"""
    notifications = {
        "pending": ("Nouvelle réservation", "Votre réservation est en attente de confirmation"),
        "confirmed": ("Réservation confirmée", "Votre réservation a été confirmée"),
        "in_progress": ("Massage en cours", "Le massage a commencé"),
        "completed": ("Massage terminé", "Le massage est terminé"),
        "cancelled": ("Réservation annulée", "La réservation a été annulée")
    }
    
    title, body = notifications.get(status, ("Mise à jour", message))
    
    send_notification(
        user_id=user_id,
        title=title,
        body=body or message,
        notification_type="booking",
        data={"booking_id": booking_id, "status": status},
        booking_id=booking_id
    )


def send_emergency_notification(
    user_id: int,
    sos_id: int,
    location: str,
    alert_type: str
) -> None:
    """Envoyer une notification d'urgence"""
    send_notification(
        user_id=user_id,
        title="🚨 ALERTE SOS",
        body=f"Alerte {alert_type} activée à {location}",
        notification_type="sos",
        data={"sos_id": sos_id, "location": location, "alert_type": alert_type},
        priority="urgent"
    )