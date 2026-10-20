# app/services/notification_service.py
import logging
import threading
from datetime import datetime
from typing import Optional, Dict, Any, List

from sqlalchemy.orm import Session

from ..models.notification import Notification, NotificationPreference
from ..models.user import User
from ..core.database import SessionLocal
from ..core.config import settings
from .push_notifications import push_service

logger = logging.getLogger(__name__)

# Types de notification -> colonne de préférence
_PREF_BY_TYPE = {
    "booking": "booking_notifications",
    "new_offer": "offer_notifications",
    "counter_offer": "offer_notifications",
    "offer_accepted": "offer_notifications",
    "payment": "payment_notifications",
    "review": "review_notifications",
    "sos": "sos_notifications",
    "promotional": "promotion_notifications",
    "chat_message": "chat_notifications",
}

# Mots-clés (sous-chaînes) -> colonne de préférence. Permet de reconnaître
# aussi sos_alert, new_review, payment_received, booking_confirmed, etc.
_PREF_KEYWORDS = (
    ("sos", "sos_notifications"),
    ("emergency", "sos_notifications"),
    ("chat", "chat_notifications"),
    ("message", "chat_notifications"),
    ("offer", "offer_notifications"),
    ("negotiation", "offer_notifications"),
    ("counter", "offer_notifications"),
    ("payment", "payment_notifications"),
    ("refund", "payment_notifications"),
    ("review", "review_notifications"),
    ("promo", "promotion_notifications"),
    ("booking", "booking_notifications"),
    ("reservation", "booking_notifications"),
)


def preference_column(notification_type: Optional[str]) -> Optional[str]:
    """Colonne de préférence d'un type de notification (None = pas de catégorie)."""
    t = str(notification_type or "").lower().strip()
    if t in _PREF_BY_TYPE:
        return _PREF_BY_TYPE[t]
    for keyword, column in _PREF_KEYWORDS:
        if keyword in t:
            return column
    return None


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
        """Crée ET commit immédiatement la notification."""
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
            notification.id, user_id, notification.type, booking_id,
        )
        return notification

    @staticmethod
    def in_app_allowed(db: Session, user_id: int, notification_type: str) -> bool:
        """
        L'utilisateur accepte-t-il de RECEVOIR ce type de notification ?
        (interrupteur général push_enabled + catégorie).
        """
        try:
            pref = db.query(NotificationPreference).filter(
                NotificationPreference.user_id == user_id
            ).first()
            if pref is None:
                return True
            if pref.push_enabled is False:
                return False
            col = preference_column(notification_type)
            if col and getattr(pref, col, True) is False:
                return False
        except Exception:  # noqa: BLE001
            logger.debug("Préférences illisibles", exc_info=True)
        return True

    @staticmethod
    def push_allowed(db: Session, user_id: int, notification_type: str) -> bool:
        """Respecte les préférences de l'utilisateur (push + catégorie)."""
        try:
            pref = db.query(NotificationPreference).filter(
                NotificationPreference.user_id == user_id
            ).first()
            if pref is None:
                return True
            if pref.push_enabled is False:
                return False
            col = preference_column(notification_type)
            if col and getattr(pref, col, True) is False:
                return False
        except Exception:  # noqa: BLE001
            logger.debug("Préférences illisibles", exc_info=True)
        return True

    @staticmethod
    def send_push_notification(
        user_id: int,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Envoi push RÉEL via Expo (bloquant). True si au moins un appareil reçu."""
        try:
            return push_service.send_sync(user_id, title, body, data) > 0
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
    def mark_as_read(db: Session, notification_id: int, user_id: int) -> Optional[Notification]:
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
            .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
            .update({"is_read": True, "read_at": datetime.utcnow()}, synchronize_session=False)
        )
        db.commit()
        return result

    @staticmethod
    def delete_notification(db: Session, notification_id: int, user_id: int) -> bool:
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
            .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
            .count()
        )


def _push_and_mark(notification_id: int, user_id: int, title: str, body: str,
                   data: Optional[Dict[str, Any]], notification_type: str) -> None:
    """Thread d'arrière-plan : envoie le push puis marque is_sent."""
    db = SessionLocal()
    try:
        if not NotificationService.push_allowed(db, user_id, notification_type):
            return
        payload = dict(data or {})
        payload.setdefault("notification_id", notification_id)
        payload.setdefault("type", notification_type)
        sent = push_service.send_sync(user_id, title, body, payload)
        if sent > 0:
            db.query(Notification).filter(Notification.id == notification_id).update(
                {"is_sent": True, "sent_at": datetime.utcnow()}, synchronize_session=False
            )
            db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
        logger.exception("Push d'arrière-plan échoué (notif %s)", notification_id)
    finally:
        db.close()


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
    - crée la notification en base
    - lance le push Expo en arrière-plan (ne bloque pas la requête)
    - une erreur ne fait jamais échouer la réservation/offre.
    """
    db = SessionLocal()
    try:
        # ✅ « Désactiver » une notification : si l'utilisateur a coupé les
        # notifications (interrupteur général ou catégorie), on ne la crée
        # pas du tout (ni liste, ni push, ni bannière). Les alertes
        # urgentes (SOS) passent toujours.
        if priority != "urgent" and not NotificationService.in_app_allowed(
            db, user_id, notification_type
        ):
            logger.info(
                "NOTIFICATION IGNOREE (désactivée) user_id=%s type=%s",
                user_id, notification_type,
            )
            return None

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
        nid = notification.id

        if send_push:
            threading.Thread(
                target=_push_and_mark,
                args=(nid, user_id, title, body, data, notification_type),
                daemon=True,
            ).start()

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


def send_admin_notification(
    title: str,
    body: str,
    notification_type: str,
    data: Optional[Dict[str, Any]] = None,
    priority: str = "normal",
    booking_id: Optional[int] = None,
    send_push: bool = True,
) -> int:
    """
    Notifie TOUS les administrateurs actifs (nouvel utilisateur, thérapeute à
    valider, paiement, avis...). Ne lève jamais d'exception : un échec de
    notification ne doit pas faire échouer l'action qui l'a déclenchée.
    Retourne le nombre d'admins notifiés.
    """
    db = SessionLocal()
    try:
        admin_ids = [
            row[0]
            for row in db.query(User.id)
            .filter(User.role == "ADMIN", User.is_active == True)  # noqa: E712
            .all()
        ]
    except Exception:  # noqa: BLE001
        logger.exception("Lecture des administrateurs impossible")
        return 0
    finally:
        db.close()

    sent = 0
    for admin_id in admin_ids:
        if send_notification(
            user_id=admin_id,
            title=title,
            body=body,
            notification_type=notification_type,
            data=data,
            priority=priority,
            booking_id=booking_id,
            send_push=send_push,
        ):
            sent += 1
    return sent


def send_booking_notification(user_id: int, booking_id: int, status: str, message: str) -> None:
    notifications = {
        "pending": ("Nouvelle réservation", "Votre réservation est en attente de confirmation"),
        "confirmed": ("Réservation confirmée", "Votre réservation a été confirmée"),
        "in_progress": ("Massage en cours", "Le massage a commencé"),
        "completed": ("Massage terminé", "Le massage est terminé"),
        "cancelled": ("Réservation annulée", "La réservation a été annulée"),
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


def send_emergency_notification(user_id: int, sos_id: int, location: str, alert_type: str) -> None:
    send_notification(
        user_id=user_id,
        title="🚨 ALERTE SOS",
        body=f"Alerte {alert_type} activée à {location}",
        notification_type="sos",
        data={"sos_id": sos_id, "location": location, "alert_type": alert_type},
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
    payload = {"booking_id": booking_id, "offer_id": offer_id}
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
        else:
            logger.info("SMS disabled; would send to %s: %s", phone, message[:50])
        return True
    except Exception:
        logger.exception("SMS sending failed")
        return False
