import inspect
import logging
from enum import Enum
from typing import Optional, Dict, Any, List

from .push_notifications import push_service
from .email_notifications import email_service
from .sms_notifications import sms_service

logger = logging.getLogger(__name__)


class NotificationChannel(str, Enum):
    PUSH = "push"
    EMAIL = "email"
    SMS = "sms"
    ALL = "all"


class NotificationType(str, Enum):
    BOOKING_CONFIRMATION = "booking_confirmation"
    BOOKING_CANCELLATION = "booking_cancellation"
    BOOKING_REMINDER = "booking_reminder"
    PAYMENT_CONFIRMATION = "payment_confirmation"
    SOS_ALERT = "sos_alert"
    THERAPIST_APPROVED = "therapist_approved"
    NEW_OFFER = "new_offer"
    OFFER_ACCEPTED = "offer_accepted"
    REVIEW_RECEIVED = "review_received"
    CHAT_MESSAGE = "chat_message"
    OTP = "otp"                      # manquait : provoquait AttributeError
    PROMOTIONAL = "promotional"
    SYSTEM = "system"


def _load_user_data(user_id: int) -> Dict[str, Any]:
    """Récupère email/téléphone/nom si l'appelant ne les a pas fournis."""
    try:
        from ..core.database import SessionLocal
        from ..models.user import User

        db = SessionLocal()
        try:
            u = db.query(User).filter(User.id == user_id).first()
            if u:
                return {"email": u.email, "phone": u.phone, "fullname": u.fullname}
        finally:
            db.close()
    except Exception:  # noqa: BLE001
        logger.exception("Impossible de charger l'utilisateur %s", user_id)
    return {}


class NotificationFactory:
    """Factory pour créer et envoyer des notifications multi-canaux."""

    @staticmethod
    async def send_notification(
        user_id: int,
        notification_type: NotificationType,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        channels: Optional[List[NotificationChannel]] = None,
        **kwargs,
    ) -> Dict[str, bool]:
        if channels is None:
            channels = [NotificationChannel.PUSH, NotificationChannel.EMAIL]

        results = {"push": False, "email": False, "sms": False}
        wants = lambda c: c in channels or NotificationChannel.ALL in channels  # noqa: E731

        user_data = kwargs.pop("user_data", None) or {}
        if (wants(NotificationChannel.EMAIL) or wants(NotificationChannel.SMS)) and not user_data:
            user_data = _load_user_data(user_id)
        user_email = user_data.get("email")
        user_phone = user_data.get("phone")
        kwargs.setdefault("title", title)
        kwargs.setdefault("body", body)

        if wants(NotificationChannel.PUSH):
            try:
                sent = await push_service.send_to_user(user_id, title, body, data)
                results["push"] = sent > 0
            except Exception as e:  # noqa: BLE001
                logger.error("Push notification failed: %s", e)

        if wants(NotificationChannel.EMAIL) and user_email:
            try:
                results["email"] = bool(await NotificationFactory._send_email_notification(
                    notification_type, user_email, user_data.get("fullname", "Utilisateur"), **kwargs
                ))
            except Exception as e:  # noqa: BLE001
                logger.error("Email notification failed: %s", e)

        if wants(NotificationChannel.SMS) and user_phone:
            try:
                results["sms"] = bool(await NotificationFactory._send_sms_notification(
                    notification_type, user_phone, **kwargs
                ))
            except Exception as e:  # noqa: BLE001
                logger.error("SMS notification failed: %s", e)

        return results

    @staticmethod
    async def _send_email_notification(
        notification_type: NotificationType, email: str, fullname: str, **kwargs
    ) -> bool:
        t = notification_type

        if t == NotificationType.BOOKING_CONFIRMATION:
            return await email_service.send_booking_confirmation(
                to_email=email, fullname=fullname,
                massage_type=kwargs.get("massage_type", ""), date=kwargs.get("date", ""),
                duration=kwargs.get("duration", 60), price=kwargs.get("price", 0),
                therapist_name=kwargs.get("therapist_name", ""),
            )
        if t == NotificationType.BOOKING_CANCELLATION:
            return await email_service.send_booking_cancellation(
                to_email=email, fullname=fullname,
                massage_type=kwargs.get("massage_type", ""), date=kwargs.get("date", ""),
                reason=kwargs.get("reason", ""),
            )
        if t == NotificationType.PAYMENT_CONFIRMATION:
            return await email_service.send_payment_confirmation(
                to_email=email, fullname=fullname, amount=kwargs.get("amount", 0),
                method=kwargs.get("method", ""), booking_id=kwargs.get("booking_id", 0),
            )
        if t == NotificationType.SOS_ALERT:
            return await email_service.send_sos_alert(
                to_email=email, fullname=fullname, phone=kwargs.get("phone", ""),
                location=kwargs.get("location", ""), alert_type=kwargs.get("alert_type", ""),
                timestamp=kwargs.get("timestamp", ""),
            )
        if t == NotificationType.THERAPIST_APPROVED:
            return await email_service.send_therapist_approved(to_email=email, fullname=fullname)

        # Email générique : `send_email` n'existait pas -> on passe par email_service
        sender = getattr(email_service, "send_email", None)
        if sender is None:
            logger.warning("email_service.send_email introuvable : email générique ignoré")
            return False
        result = sender(
            to_email=email,
            subject=kwargs.get("title", "Mada Bien-être"),
            html_content=f"<p>{kwargs.get('body', '')}</p>",
        )
        if inspect.isawaitable(result):
            result = await result
        return bool(result)

    @staticmethod
    async def _send_sms_notification(
        notification_type: NotificationType, phone: str, **kwargs
    ) -> bool:
        t = notification_type

        if t == NotificationType.BOOKING_CONFIRMATION:
            return await sms_service.send_booking_confirmation(
                phone=phone, booking_id=kwargs.get("booking_id", 0), date=kwargs.get("date", ""))
        if t == NotificationType.BOOKING_REMINDER:
            return await sms_service.send_booking_reminder(
                phone=phone, booking_id=kwargs.get("booking_id", 0),
                date=kwargs.get("date", ""), time=kwargs.get("time", ""))
        if t == NotificationType.SOS_ALERT:
            return await sms_service.send_sos_alert(
                phone=phone, user_name=kwargs.get("fullname", ""), location=kwargs.get("location", ""))
        if t == NotificationType.OTP:
            return await sms_service.send_otp(phone=phone, otp_code=kwargs.get("otp_code", ""))

        return await sms_service.send_sms(phone=phone, message=kwargs.get("body", ""))


notification_factory = NotificationFactory()
