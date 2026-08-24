from typing import Optional, Dict, Any, List
from jinja2 import Template
import logging
from ..services.email_service import send_email
from ..core.config import settings

logger = logging.getLogger(__name__)

class EmailNotificationService:
    """Service de notifications par email"""
    
    def __init__(self):
        self.templates = self._load_templates()
    
    def _load_templates(self) -> Dict[str, str]:
        """Charger les templates d'emails"""
        return {
            "booking_confirmation": """
                <h2>Confirmation de réservation</h2>
                <p>Bonjour {{ fullname }},</p>
                <p>Votre réservation a été confirmée avec succès !</p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                    <p><strong>Type:</strong> {{ massage_type }}</p>
                    <p><strong>Date:</strong> {{ date }}</p>
                    <p><strong>Durée:</strong> {{ duration }} minutes</p>
                    <p><strong>Prix:</strong> {{ price }} Ar</p>
                    <p><strong>Thérapeute:</strong> {{ therapist_name }}</p>
                </div>
                <p>Vous pouvez suivre votre réservation dans l'application.</p>
            """,
            "booking_cancellation": """
                <h2>Réservation annulée</h2>
                <p>Bonjour {{ fullname }},</p>
                <p>Votre réservation a été annulée.</p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                    <p><strong>Type:</strong> {{ massage_type }}</p>
                    <p><strong>Date:</strong> {{ date }}</p>
                    <p><strong>Raison:</strong> {{ reason }}</p>
                </div>
            """,
            "payment_confirmation": """
                <h2>Confirmation de paiement</h2>
                <p>Bonjour {{ fullname }},</p>
                <p>Votre paiement a été effectué avec succès.</p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                    <p><strong>Montant:</strong> {{ amount }} Ar</p>
                    <p><strong>Méthode:</strong> {{ method }}</p>
                    <p><strong>Réservation:</strong> #{{ booking_id }}</p>
                </div>
            """,
            "sos_alert": """
                <h2 style="color: red;">🚨 ALERTE SOS</h2>
                <p>Une alerte SOS a été déclenchée.</p>
                <div style="background: #fff5f5; padding: 15px; border-radius: 5px; border: 1px solid red;">
                    <p><strong>Utilisateur:</strong> {{ fullname }}</p>
                    <p><strong>Téléphone:</strong> {{ phone }}</p>
                    <p><strong>Localisation:</strong> {{ location }}</p>
                    <p><strong>Type:</strong> {{ alert_type }}</p>
                    <p><strong>Heure:</strong> {{ timestamp }}</p>
                </div>
            """,
            "therapist_approved": """
                <h2>Compte thérapeute approuvé</h2>
                <p>Bonjour {{ fullname }},</p>
                <p>Votre compte thérapeute a été approuvé avec succès !</p>
                <p>Vous pouvez maintenant commencer à recevoir des demandes de massage.</p>
                <p>Connectez-vous à l'application pour activer votre statut "En ligne".</p>
            """
        }
    
    def render_template(self, template_name: str, context: Dict[str, Any]) -> str:
        """Rendre un template avec Jinja2"""
        template_str = self.templates.get(template_name, "")
        if not template_str:
            return ""
        
        template = Template(template_str)
        return template.render(**context)
    
    async def send_booking_confirmation(
        self,
        to_email: str,
        fullname: str,
        massage_type: str,
        date: str,
        duration: int,
        price: float,
        therapist_name: str
    ) -> bool:
        """Envoyer un email de confirmation de réservation"""
        context = {
            "fullname": fullname,
            "massage_type": massage_type,
            "date": date,
            "duration": duration,
            "price": price,
            "therapist_name": therapist_name
        }
        
        html_content = self.render_template("booking_confirmation", context)
        subject = "Mada Bien-être - Confirmation de réservation"
        
        return send_email(to_email, subject, html_content)
    
    async def send_booking_cancellation(
        self,
        to_email: str,
        fullname: str,
        massage_type: str,
        date: str,
        reason: str
    ) -> bool:
        """Envoyer un email d'annulation de réservation"""
        context = {
            "fullname": fullname,
            "massage_type": massage_type,
            "date": date,
            "reason": reason
        }
        
        html_content = self.render_template("booking_cancellation", context)
        subject = "Mada Bien-être - Réservation annulée"
        
        return send_email(to_email, subject, html_content)
    
    async def send_payment_confirmation(
        self,
        to_email: str,
        fullname: str,
        amount: float,
        method: str,
        booking_id: int
    ) -> bool:
        """Envoyer un email de confirmation de paiement"""
        context = {
            "fullname": fullname,
            "amount": amount,
            "method": method,
            "booking_id": booking_id
        }
        
        html_content = self.render_template("payment_confirmation", context)
        subject = "Mada Bien-être - Confirmation de paiement"
        
        return send_email(to_email, subject, html_content)
    
    async def send_sos_alert(
        self,
        to_email: str,
        fullname: str,
        phone: str,
        location: str,
        alert_type: str,
        timestamp: str
    ) -> bool:
        """Envoyer un email d'alerte SOS"""
        context = {
            "fullname": fullname,
            "phone": phone,
            "location": location,
            "alert_type": alert_type,
            "timestamp": timestamp
        }
        
        html_content = self.render_template("sos_alert", context)
        subject = "🚨 ALERTE SOS - Mada Bien-être"
        
        return send_email(to_email, subject, html_content)
    
    async def send_therapist_approved(
        self,
        to_email: str,
        fullname: str
    ) -> bool:
        """Envoyer un email d'approbation de compte thérapeute"""
        context = {
            "fullname": fullname
        }
        
        html_content = self.render_template("therapist_approved", context)
        subject = "Mada Bien-être - Compte thérapeute approuvé"
        
        return send_email(to_email, subject, html_content)

# Instance globale
email_service = EmailNotificationService()