from typing import Optional, Dict, Any, List
import asyncio
import re
import requests
import logging
from ..core.config import settings

logger = logging.getLogger(__name__)


def normalize_phone(phone: str) -> str:
    """0341234567 / 034 12 345 67 / 261341234567 -> +261341234567 (E.164)."""
    p = re.sub(r"[\s().-]", "", phone or "")
    if p.startswith("+"):
        return p
    if p.startswith("00"):
        return "+" + p[2:]
    cc = settings.SMS_DEFAULT_COUNTRY_CODE or "+261"
    if p.startswith(cc.lstrip("+")) and len(p) > 10:
        return "+" + p
    if p.startswith("0"):
        p = p[1:]
    return f"{cc}{p}"

class SMSNotificationService:
    """Service de notifications par SMS"""
    
    def __init__(self):
        self.twilio_enabled = settings.SMS_ENABLED
        self.twilio_account_sid = settings.SMS_ACCOUNT_SID
        self.twilio_auth_token = settings.SMS_AUTH_TOKEN
        self.twilio_from_number = settings.SMS_FROM_NUMBER
    
    async def send_sms(self, phone: str, message: str) -> bool:
        """Envoyer un SMS via Twilio"""
        phone = normalize_phone(phone)
        if not self.twilio_enabled:
            # Mode développement : le SMS n'est pas envoyé, on l'affiche dans la console
            logger.info(f"[SMS désactivé] Vers {phone}: {message}")
            return False

        if not (self.twilio_account_sid and self.twilio_auth_token and self.twilio_from_number):
            logger.error("SMS_ENABLED=True mais SMS_ACCOUNT_SID / SMS_AUTH_TOKEN / SMS_FROM_NUMBER manquent")
            return False

        try:
            from twilio.rest import Client

            def _send():
                client = Client(self.twilio_account_sid, self.twilio_auth_token)
                return client.messages.create(
                    body=message,
                    from_=self.twilio_from_number,
                    to=phone,
                )

            # Le client Twilio est bloquant : on l'exécute hors de la boucle asyncio
            result = await asyncio.to_thread(_send)
            logger.info(f"SMS sent to {phone}: {result.sid}")
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