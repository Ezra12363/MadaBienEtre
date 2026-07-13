from typing import Optional, Dict, Any, List
from enum import Enum
import logging
from .push_notifications import push_service
from .email_notifications import email_service
from .sms_notifications import sms_service
from ..core.config import settings

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
    PROMOTIONAL = "promotional"
    SYSTEM = "system"

class NotificationFactory:
    """Factory pour créer et envoyer des notifications"""
    
    @staticmethod
    async def send_notification(
        user_id: int,
        notification_type: NotificationType,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        channels: List[NotificationChannel] = None,
        **kwargs
    ) -> Dict[str, bool]:
        """Envoyer une notification via plusieurs canaux"""
        if channels is None:
            channels = [NotificationChannel.PUSH, NotificationChannel.EMAIL]
        
        results = {
            "push": False,
            "email": False,
            "sms": False
        }
        
        # Données utilisateur (à récupérer de la base de données)
        user_data = kwargs.get("user_data", {})
        user_email = user_data.get("email")
        user_phone = user_data.get("phone")
        
        # Envoyer via Push
        if NotificationChannel.PUSH in channels or NotificationChannel.ALL in channels:
            try:
                sent = await push_service.send_to_user(user_id, title, body, data)
                results["push"] = sent > 0
                if sent > 0:
                    logger.info(f"Push notification sent to user {user_id}")
            except Exception as e:
                logger.error(f"Push notification failed: {e}")
        
        # Envoyer via Email
        if (NotificationChannel.EMAIL in channels or NotificationChannel.ALL in channels) and user_email:
            try:
                success = await NotificationFactory._send_email_notification(
                    notification_type,
                    user_email,
                    user_data.get("fullname", "Utilisateur"),
                    **kwargs
                )
                results["email"] = success
                if success:
                    logger.info(f"Email notification sent to {user_email}")
            except Exception as e:
                logger.error(f"Email notification failed: {e}")
        
        # Envoyer via SMS
        if (NotificationChannel.SMS in channels or NotificationChannel.ALL in channels) and user_phone:
            try:
                success = await NotificationFactory._send_sms_notification(
                    notification_type,
                    user_phone,
                    **kwargs
                )
                results["sms"] = success
                if success:
                    logger.info(f"SMS notification sent to {user_phone}")
            except Exception as e:
                logger.error(f"SMS notification failed: {e}")
        
        return results
    
    @staticmethod
    async def _send_email_notification(
        notification_type: NotificationType,
        email: str,
        fullname: str,
        **kwargs
    ) -> bool:
        """Envoyer une notification par email selon le type"""
        
        if notification_type == NotificationType.BOOKING_CONFIRMATION:
            return await email_service.send_booking_confirmation(
                to_email=email,
                fullname=fullname,
                massage_type=kwargs.get("massage_type", ""),
                date=kwargs.get("date", ""),
                duration=kwargs.get("duration", 60),
                price=kwargs.get("price", 0),
                therapist_name=kwargs.get("therapist_name", "")
            )
        
        elif notification_type == NotificationType.BOOKING_CANCELLATION:
            return await email_service.send_booking_cancellation(
                to_email=email,
                fullname=fullname,
                massage_type=kwargs.get("massage_type", ""),
                date=kwargs.get("date", ""),
                reason=kwargs.get("reason", "")
            )
        
        elif notification_type == NotificationType.PAYMENT_CONFIRMATION:
            return await email_service.send_payment_confirmation(
                to_email=email,
                fullname=fullname,
                amount=kwargs.get("amount", 0),
                method=kwargs.get("method", ""),
                booking_id=kwargs.get("booking_id", 0)
            )
        
        elif notification_type == NotificationType.SOS_ALERT:
            return await email_service.send_sos_alert(
                to_email=email,
                fullname=fullname,
                phone=kwargs.get("phone", ""),
                location=kwargs.get("location", ""),
                alert_type=kwargs.get("alert_type", ""),
                timestamp=kwargs.get("timestamp", "")
            )
        
        elif notification_type == NotificationType.THERAPIST_APPROVED:
            return await email_service.send_therapist_approved(
                to_email=email,
                fullname=fullname
            )
        
        else:
            # Email générique
            return send_email(
                to_email=email,
                subject=kwargs.get("title", "Mada Bien-être"),
                html_content=f"<p>{kwargs.get('body', '')}</p>"
            )
    
    @staticmethod
    async def _send_sms_notification(
        notification_type: NotificationType,
        phone: str,
        **kwargs
    ) -> bool:
        """Envoyer une notification par SMS selon le type"""
        
        if notification_type == NotificationType.BOOKING_CONFIRMATION:
            return await sms_service.send_booking_confirmation(
                phone=phone,
                booking_id=kwargs.get("booking_id", 0),
                date=kwargs.get("date", "")
            )
        
        elif notification_type == NotificationType.BOOKING_REMINDER:
            return await sms_service.send_booking_reminder(
                phone=phone,
                booking_id=kwargs.get("booking_id", 0),
                date=kwargs.get("date", ""),
                time=kwargs.get("time", "")
            )
        
        elif notification_type == NotificationType.SOS_ALERT:
            return await sms_service.send_sos_alert(
                phone=phone,
                user_name=kwargs.get("fullname", ""),
                location=kwargs.get("location", "")
            )
        
        elif notification_type == NotificationType.OTP:
            return await sms_service.send_otp(
                phone=phone,
                otp_code=kwargs.get("otp_code", "")
            )
        
        else:
            # SMS générique
            return await sms_service.send_sms(
                phone=phone,
                message=kwargs.get("body", "")
            )

# Instance globale
notification_factory = NotificationFactory()