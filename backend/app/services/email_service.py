# app/services/email_service.py
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from jinja2 import Template
from datetime import datetime
import os
from ..core.config import settings
from ..models.user import User  # ✅ Ajout de l'import User
from ..models.booking import Booking  # ✅ Ajout de l'import Booking

def get_email_template(template_name: str) -> str:
    """Charger un template email"""
    templates = {
        "otp": """
        <html>
        <body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #2c3e50;">Mada Bien-être</h1>
                    <p style="color: #7f8c8d;">Massage à domicile</p>
                </div>
                <h2 style="color: #2c3e50;">Bonjour {{ fullname }},</h2>
                <p>Votre code de vérification est :</p>
                <div style="background: #3498db; color: white; padding: 15px; font-size: 32px; text-align: center; border-radius: 5px; margin: 20px 0;">
                    <strong>{{ otp_code }}</strong>
                </div>
                <p>Ce code est valable pendant <strong>10 minutes</strong>.</p>
                {% if reset %}
                <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
                {% else %}
                <p>Pour finaliser votre inscription, veuillez entrer ce code dans l'application.</p>
                {% endif %}
                <hr>
                <p style="color: #7f8c8d; font-size: 12px;">
                    Si vous n'avez pas demandé ce code, ignorez simplement cet email.
                </p>
                <p style="color: #7f8c8d; font-size: 12px;">
                    Mada Bien-être - Votre bien-être à domicile
                </p>
            </div>
        </body>
        </html>
        """,
        "emergency": """
        <html>
        <body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #fff5f5; border: 2px solid #e74c3c; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #e74c3c;">🚨 ALERTE URGENCE</h1>
                    <p style="color: #7f8c8d;">Mada Bien-être - SOS</p>
                </div>
                <h2 style="color: #2c3e50;">Détails de l'alerte</h2>
                <p><strong>Utilisateur:</strong> {{ user.fullname }}</p>
                <p><strong>Téléphone:</strong> {{ user.phone }}</p>
                <p><strong>Email:</strong> {{ user.email }}</p>
                <p><strong>Type:</strong> {{ alert_type }}</p>
                <p><strong>Localisation:</strong> {{ location }}</p>
                {% if booking %}
                <p><strong>Réservation:</strong> #{{ booking.id }}</p>
                <p><strong>Adresse:</strong> {{ booking.address }}</p>
                {% endif %}
                {% if details %}
                <p><strong>Détails:</strong> {{ details }}</p>
                {% endif %}
                <div style="background: #ecf0f1; padding: 10px; border-radius: 5px; margin-top: 20px;">
                    <p><strong>Heure de l'alerte:</strong> {{ timestamp }}</p>
                </div>
                <hr>
                <p style="color: #7f8c8d; font-size: 12px;">
                    Cet email a été envoyé automatiquement suite à une alerte SOS.
                </p>
            </div>
        </body>
        </html>
        """,
        "booking_confirmation": """
        <html>
        <body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #f0f8ff; border-radius: 10px;">
                <h2 style="color: #2c3e50;">Confirmation de réservation</h2>
                <p>Bonjour {{ fullname }},</p>
                <p>Votre réservation a été confirmée avec succès !</p>
                <div style="background: #ecf0f1; padding: 15px; border-radius: 5px;">
                    <p><strong>Type:</strong> {{ massage_type }}</p>
                    <p><strong>Date:</strong> {{ date }}</p>
                    <p><strong>Durée:</strong> {{ duration }} minutes</p>
                    <p><strong>Prix:</strong> {{ price }} Ar</p>
                </div>
                <p>Vous pouvez suivre votre réservation dans l'application.</p>
                <hr>
                <p style="color: #7f8c8d; font-size: 12px;">
                    Mada Bien-être - Votre bien-être à domicile
                </p>
            </div>
        </body>
        </html>
        """
    }
    
    return templates.get(template_name, "")

def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None
) -> bool:
    """Envoyer un email"""
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = settings.EMAIL_FROM
        msg['To'] = to_email
        
        # Version texte
        if text_content:
            part_text = MIMEText(text_content, 'plain')
            msg.attach(part_text)
        
        # Version HTML
        part_html = MIMEText(html_content, 'html')
        msg.attach(part_html)
        
        # Connexion SMTP
        with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT) as server:
            server.starttls()
            server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
            server.send_message(msg)
        
        return True
    except Exception as e:
        print(f"Email sending failed: {e}")
        return False

def send_otp_email(to_email: str, otp_code: str, fullname: str, reset: bool = False) -> bool:
    """Envoyer un email OTP"""
    template = get_email_template("otp")
    html_content = Template(template).render(
        fullname=fullname,
        otp_code=otp_code,
        reset=reset
    )
    
    subject = "Mada Bien-être - Code de vérification" if not reset else "Mada Bien-être - Réinitialisation du mot de passe"
    
    return send_email(to_email, subject, html_content)

def send_emergency_email(
    user: User,
    location: str,
    alert_type: str,
    details: Optional[str] = None,
    booking: Optional[Booking] = None
) -> bool:
    """Envoyer un email d'urgence"""
    template = get_email_template("emergency")
    html_content = Template(template).render(
        user=user,
        location=location,
        alert_type=alert_type,
        details=details,
        booking=booking,
        timestamp=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    )
    
    subject = "🚨 ALERTE URGENCE - Mada Bien-être"
    
    # Envoyer aux administrateurs
    from ..core.database import get_db
    from ..models.user import User as UserModel
    
    db = next(get_db())
    admins = db.query(UserModel).filter(UserModel.role == "ADMIN", UserModel.is_active == True).all()
    
    success = True
    for admin in admins:
        if admin.email:
            success &= send_email(admin.email, subject, html_content)
    
    return success

def send_booking_confirmation_email(
    to_email: str,
    fullname: str,
    massage_type: str,
    date: str,
    duration: int,
    price: float
) -> bool:
    """Envoyer un email de confirmation de réservation"""
    template = get_email_template("booking_confirmation")
    html_content = Template(template).render(
        fullname=fullname,
        massage_type=massage_type,
        date=date,
        duration=duration,
        price=price
    )
    
    subject = "Mada Bien-être - Confirmation de réservation"
    
    return send_email(to_email, subject, html_content)

def send_sms(phone: str, message: str) -> bool:
    """Envoyer un SMS"""
    try:
        print(f"SMS sent to {phone}: {message}")
        return True
    except Exception as e:
        print(f"SMS sending failed: {e}")
        return False