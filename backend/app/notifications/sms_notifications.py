from typing import Optional, Dict, Any, List
import requests
import logging
from ..core.config import settings

logger = logging.getLogger(__name__)

class SMSNotificationService:
    """Service de notifications par SMS"""
    
    def __init__(self):
        self.twilio_enabled = settings.SMS_ENABLED
        self.twilio_account_sid = settings.SMS_ACCOUNT_SID
        self.twilio_auth_token = settings.SMS_AUTH_TOKEN
        self.twilio_from_number = settings.SMS_FROM_NUMBER
    
    async def send_sms(self, phone: str, message: str) -> bool:
        """Envoyer un SMS via Twilio"""
        if not self.twilio_enabled:
            logger.info(f"SMS would be sent to {phone}: {message[:50]}...")
            return True
        
        try:
            # Implémentation Twilio
            from twilio.rest import Client
            
            client = Client(self.twilio_account_sid, self.twilio_auth_token)
            message = client.messages.create(
                body=message,
                from_=self.twilio_from_number,
                to=phone
            )
            
            logger.info(f"SMS sent to {phone}: {message.sid}")
            return True
            
        except ImportError:
            logger.warning("Twilio not installed, SMS not sent")
            return False
        except Exception as e:
            logger.error(f"SMS sending failed: {e}")
            return False
    
    async def send_otp(self, phone: str, otp_code: str) -> bool:
        """Envoyer un code OTP par SMS"""
        message = f"Mada Bien-être: Votre code de vérification est {otp_code}. Valable 10 minutes."
        return await self.send_sms(phone, message)
    
    async def send_booking_confirmation(self, phone: str, booking_id: int, date: str) -> bool:
        """Envoyer une confirmation de réservation par SMS"""
        message = f"Mada Bien-être: Réservation #{booking_id} confirmée pour le {date}. Merci de votre confiance !"
        return await self.send_sms(phone, message)
    
    async def send_booking_reminder(self, phone: str, booking_id: int, date: str, time: str) -> bool:
        """Envoyer un rappel de réservation par SMS"""
        message = f"Mada Bien-être: Rappel de votre massage #{booking_id} aujourd'hui à {time}. Bonne séance !"
        return await self.send_sms(phone, message)
    
    async def send_sos_alert(self, phone: str, user_name: str, location: str) -> bool:
        """Envoyer une alerte SOS par SMS"""
        message = f"🚨 ALERTE: {user_name} a activé SOS. Position: {location}. Agissez immédiatement !"
        return await self.send_sms(phone, message)
    
    async def send_therapist_notification(self, phone: str, message: str) -> bool:
        """Envoyer une notification à un thérapeute"""
        return await self.send_sms(phone, message)

# Instance globale
sms_service = SMSNotificationService()