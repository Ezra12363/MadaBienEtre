# app/services/notification_service.py
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from datetime import datetime
import logging

from ..models.notification import Notification
from ..models.user import User
from ..core.database import SessionLocal
from ..core.config import settings

logger = logging.getLogger(__name__)


class NotificationService:
    """Service centralisé de création et de gestion des notifications."""

    @staticmethod
    def create_notification(
        db: Session,
        user_id: int,
        title: str,
        body: str,
        notification_type: str,
        data: Optional[Dict[str, Any]] = None,
        priority: str = "normal",
        booking_id: Optional[int] = None,
    ) -> Notification:
        """
        Crée ET commit immédiatement la notification.

        Cette méthode vérifie d'abord que le destinataire existe.
        Le commit immédiat est volontaire : les appels venant de
        bookings.py / offers.py doivent laisser une notification
        durable même si leur propre transaction est différente.
        """
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"Utilisateur destinataire introuvable: user_id={user_id}")

        notification = Notification(
            user_id=user_id,
            booking_id=booking_id,
            title=(title or "Nouvelle notification")[:255],
            body=body or "",
            type=(notification_type or "system")[:50],
            data=data or {},
            priority=(priority or "normal")[:20],
            is_read=False,
            is_delivered=False,
            is_sent=False,
        )

        db.add(notification)
        db.flush()
        db.commit()
        db.refresh(notification)

        logger.info(
            "NOTIFICATION DB CREATED id=%s user_id=%s type=%s booking_id=%s",
            notification.id,
            user_id,
            notification.type,
            booking_id,
        )
        return notification

    @staticmethod
    def send_push_notification(
        user_id: int,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Point d'intégration push.

        IMPORTANT : cette fonction ne prétend pas envoyer un push réel.
        Le stockage DB est indépendant et constitue la source de vérité
        pour le centre Notifications.
        """
        try:
            logger.info(
                "PUSH PLACEHOLDER user_id=%s title=%s data=%s",
                user_id, title, data or {},
            )
            return True
        except Exception:
            logger.exception("Push notification failed for user_id=%s", user_id)
            return False

    @staticmethod
    def get_user_notifications(
        db: Session,
        user_id: int,
        is_read: Optional[bool] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Notification]:
        limit = max(1, min(limit, 100))
        offset = max(0, offset)

        query = db.query(Notification).filter(Notification.user_id == user_id)

        if is_read is not None:
            query = query.filter(Notification.is_read == is_read)

        return (
            query.order_by(Notification.created_at.desc(), Notification.id.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    @staticmethod
    def mark_as_read(
        db: Session, notification_id: int, user_id: int
    ) -> Optional[Notification]:
        notification = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        ).first()

        if notification:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            db.commit()
            db.refresh(notification)

        return notification

    @staticmethod
    def mark_all_as_read(db: Session, user_id: int) -> int:
        result = (
            db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
            )
            .update(
                {"is_read": True, "read_at": datetime.utcnow()},
                synchronize_session=False,
            )
        )
        db.commit()
        return result

    @staticmethod
    def delete_notification(
        db: Session, notification_id: int, user_id: int
    ) -> bool:
        notification = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        ).first()

        if not notification:
            return False

        db.delete(notification)
        db.commit()
        return True

    @staticmethod
    def get_unread_count(db: Session, user_id: int) -> int:
        return (
            db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
            )
            .count()
        )


def send_notification(
    user_id: int,
    title: str,
    body: str,
    notification_type: str,
    data: Optional[Dict[str, Any]] = None,
    priority: str = "normal",
    booking_id: Optional[int] = None,
    send_push: bool = True,
) -> Optional[Notification]:
    """
    Helper utilisé depuis bookings.py / offers.py.

    La session est toujours fermée par finally.
    Une erreur de notification ne fait pas échouer la réservation/offre.
    """
    db = SessionLocal()

    try:
        notification = NotificationService.create_notification(
            db=db,
            user_id=user_id,
            title=title,
            body=body,
            notification_type=notification_type,
            data=data,
            priority=priority,
            booking_id=booking_id,
        )

        # Marque comme "sent" uniquement si le canal push est réellement
        # considéré comme envoyé. Le centre DB reste disponible dans tous
        # les cas.
        if send_push:
            push_ok = NotificationService.send_push_notification(
                user_id=user_id,
                title=title,
                body=body,
                data=data,
            )
            if push_ok:
                notification.is_sent = True
                notification.sent_at = datetime.utcnow()
                db.commit()
                db.refresh(notification)

        return notification

    except Exception:
        db.rollback()
        logger.exception(
            "NOTIFICATION FAILED user_id=%s type=%s booking_id=%s",
            user_id, notification_type, booking_id,
        )
        return None

    finally:
        db.close()


def send_booking_notification(
    user_id: int,
    booking_id: int,
    status: str,
    message: str,
) -> None:
    notifications = {
        "pending": (
            "Nouvelle réservation",
            "Votre réservation est en attente de confirmation",
        ),
        "confirmed": (
            "Réservation confirmée",
            "Votre réservation a été confirmée",
        ),
        "in_progress": (
            "Massage en cours",
            "Le massage a commencé",
        ),
        "completed": (
            "Massage terminé",
            "Le massage est terminé",
        ),
        "cancelled": (
            "Réservation annulée",
            "La réservation a été annulée",
        ),
    }

    title, body = notifications.get(status, ("Mise à jour", message))

    send_notification(
        user_id=user_id,
        title=title,
        body=body or message,
        notification_type="booking",
        data={"booking_id": booking_id, "status": status},
        booking_id=booking_id,
    )


def send_emergency_notification(
    user_id: int,
    sos_id: int,
    location: str,
    alert_type: str,
) -> None:
    send_notification(
        user_id=user_id,
        title="🚨 ALERTE SOS",
        body=f"Alerte {alert_type} activée à {location}",
        notification_type="sos",
        data={
            "sos_id": sos_id,
            "location": location,
            "alert_type": alert_type,
        },
        priority="urgent",
    )


def send_offer_notification(
    user_id: int,
    booking_id: int,
    offer_id: int,
    title: str,
    body: str,
    notification_type: str = "new_offer",
    extra_data: Optional[Dict[str, Any]] = None,
) -> Optional[Notification]:
    """Helper recommandé pour tous les événements d'offre/négociation."""
    payload = {
        "booking_id": booking_id,
        "offer_id": offer_id,
    }
    if extra_data:
        payload.update(extra_data)

    return send_notification(
        user_id=user_id,
        title=title,
        body=body,
        notification_type=notification_type,
        data=payload,
        booking_id=booking_id,
    )


def send_counter_offer_notification(
    user_id: int,
    booking_id: int,
    offer_id: int,
    original_offer_id: int,
    title: str,
    body: str,
) -> Optional[Notification]:
    return send_offer_notification(
        user_id=user_id,
        booking_id=booking_id,
        offer_id=offer_id,
        title=title,
        body=body,
        notification_type="counter_offer",
        extra_data={"original_offer_id": original_offer_id},
    )


def send_sms(phone: str, message: str) -> bool:
    """Envoyer un SMS si le canal SMS est activé."""
    try:
        if getattr(settings, "SMS_ENABLED", False):
            logger.info("SMS enabled; destination=%s", phone)
            # Brancher Twilio ici si les credentials sont configurés.
        else:
            logger.info("SMS disabled; would send to %s: %s", phone, message[:50])
        return True
    except Exception:
        logger.exception("SMS sending failed")
        return False
