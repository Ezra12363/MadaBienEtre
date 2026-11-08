# app/services/email_service.py
import html as _html
import logging
import re
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.mime.image import MIMEImage
from functools import lru_cache
from pathlib import Path
from email.utils import formataddr, formatdate, make_msgid, parseaddr
from typing import Any, Dict, List, Optional, Tuple
from jinja2 import Template
from datetime import datetime
import os
from ..core.config import settings
from ..models.user import User  # ✅ Ajout de l'import User
from ..models.booking import Booking  # ✅ Ajout de l'import Booking

logger = logging.getLogger(__name__)


def _html_to_text(html: str) -> str:
    """Version texte simple d'un email HTML (meilleure délivrabilité, anti-spam)."""
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", "", html or "")
    text = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</h[1-6]>|</tr>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


# ============================================================
# THÈME EMAIL — Mada Bien-être (vert)
# ============================================================
THEME_MARKER = "<!--mbe-themed-->"
GREEN_DARK = "#1B5E20"
GREEN = "#2E7D32"
GREEN_LIGHT = "#E8F5E9"
GREEN_SOFT = "#C8E6C9"


# ------------------------------------------------------------
# LOGO ZEBUTECH (image intégrée à l'email via Content-ID)
# ------------------------------------------------------------
LOGO_CID = "zebutech_logo"
_APP_DIR = Path(__file__).resolve().parent.parent
_LOGO_CANDIDATES = (
    _APP_DIR / "assets" / "zebutech_logo.png",
    _APP_DIR.parent / "uploads" / "certificate_assets" / "default_logo.png",
)


@lru_cache(maxsize=1)
def _logo_bytes() -> Optional[bytes]:
    """Octets du logo Zebutech (None si aucun fichier n'est trouvé)."""
    for path in _LOGO_CANDIDATES:
        try:
            if path.is_file():
                return path.read_bytes()
        except OSError:
            continue
    logger.warning("Logo Zebutech introuvable pour les emails (app/assets/zebutech_logo.png)")
    return None


def esc(value: Any) -> str:
    """Échappe une valeur pour l'HTML ('—' si vide)."""
    return _html.escape(str(value if value not in (None, "") else "—"))


def _shell(content_html: str) -> str:
    """Enveloppe commune à tous les emails : bandeau vert, carte blanche, pied de page."""
    logo_row = ""
    if _logo_bytes():
        logo_row = (
            '<tr><td align="center" style="background:#ffffff;padding:24px 20px 16px">'
            f'<img src="cid:{LOGO_CID}" alt="Zebutech" width="150" '
            'style="display:block;border:0;outline:none;max-width:150px;height:auto">'
            "</td></tr>"
        )
    return f"""{THEME_MARKER}
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EEF5EF;font-family:Arial,Helvetica,sans-serif;color:#1f2d1f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF5EF;padding:24px 12px">
 <tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid {GREEN_SOFT}">
   {logo_row}
   <tr><td align="center" style="background:{GREEN};background-image:linear-gradient(135deg,{GREEN_DARK},#43A047);padding:14px 20px">
     <div style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:.5px">Mada Bien-&ecirc;tre</div>
     <div style="font-size:12px;color:{GREEN_SOFT};margin-top:3px;letter-spacing:1px">Massage &agrave; domicile</div>
   </td></tr>
   <tr><td style="padding:28px 28px 12px;font-size:15px;line-height:1.55">
     {content_html}
   </td></tr>
   <tr><td style="background:{GREEN_LIGHT};padding:16px 28px;text-align:center;font-size:12px;color:#4a6b4c;border-top:1px solid {GREEN_SOFT}">
     Mada Bien-&ecirc;tre &mdash; Votre bien-&ecirc;tre &agrave; domicile<br>
     Cet email a &eacute;t&eacute; envoy&eacute; automatiquement, merci de ne pas y r&eacute;pondre.
   </td></tr>
  </table>
 </td></tr>
</table></body></html>"""


def render_email(
    title: str,
    intro_html: str = "",
    rows: Optional[Dict[str, Any]] = None,
    footer_html: str = "",
    code: Optional[str] = None,
    alert: bool = False,
    button: Optional[Tuple[str, str]] = None,
) -> str:
    """Construit un email au thème vert : titre, intro, code (OTP), tableau d'infos, pied."""
    title_color = "#C62828" if alert else GREEN_DARK
    parts = [f'<h2 style="margin:0 0 14px;color:{title_color};font-size:21px">{esc(title)}</h2>', intro_html]
    if code:
        parts.append(
            f'<div style="background:{GREEN};color:#ffffff;font-size:34px;font-weight:bold;'
            f'letter-spacing:8px;text-align:center;padding:16px;border-radius:10px;margin:20px 0">{esc(code)}</div>'
        )
    if rows:
        lines = "".join(
            f'<tr><td style="padding:7px 14px 7px 0;color:#5b7a5d;white-space:nowrap;vertical-align:top">{esc(k)}</td>'
            f'<td style="padding:7px 0;color:#111"><strong>{esc(v)}</strong></td></tr>'
            for k, v in rows.items()
        )
        parts.append(
            f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;width:100%;'
            f'background:{GREEN_LIGHT};border-left:4px solid {GREEN};border-radius:8px">'
            f'<tr><td style="padding:10px 16px"><table role="presentation" cellpadding="0" cellspacing="0">{lines}</table></td></tr></table>'
        )
    if footer_html:
        parts.append(footer_html)
    if button and button[1]:
        parts.append(
            f'<p style="text-align:center;margin:22px 0 8px"><a href="{_html.escape(button[1], quote=True)}" '
            f'style="background:{GREEN};color:#ffffff;text-decoration:none;font-weight:bold;'
            f'padding:12px 26px;border-radius:8px;display:inline-block">{esc(button[0])}</a></p>'
        )
    return _shell("\n".join(parts))


def wrap_branded(body_html: str) -> str:
    """Habille un HTML brut (anciens emails) du thème vert, sauf s'il l'est déjà."""
    if THEME_MARKER in (body_html or ""):
        return body_html
    inner = re.sub(r"(?is)</?(html|body|head)[^>]*>", "", body_html or "")
    return _shell(inner)


Attachment = Tuple[str, bytes, str]  # (nom de fichier, contenu, type MIME)


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    attachments: Optional[List[Attachment]] = None,
) -> bool:
    """Envoyer un email via SMTP (Brevo : smtp-relay.brevo.com:587, STARTTLS).

    Tous les emails passent par le thème vert Mada Bien-être (wrap_branded).
    `attachments` : liste de (nom_fichier, octets, type_mime), ex. le certificat PDF.

    Retourne True/False et ne lève jamais d'exception.
    """
    if not to_email:
        return False
    if not settings.EMAIL_USER or not settings.EMAIL_PASSWORD:
        logger.error("Email non envoyé : EMAIL_USER / EMAIL_PASSWORD (clé SMTP Brevo) manquants dans .env")
        return False

    try:
        # Expéditeur : doit être une adresse/domaine VÉRIFIÉ dans Brevo (Expéditeurs, domaines & IP)
        _, from_addr = parseaddr(settings.EMAIL_FROM)
        from_addr = from_addr or settings.EMAIL_FROM

        html_content = wrap_branded(html_content)
        plain = text_content or _html_to_text(html_content)

        alt = MIMEMultipart('alternative')
        # Version texte (obligatoirement AVANT la version HTML)
        alt.attach(MIMEText(plain, 'plain', 'utf-8'))
        alt.attach(MIMEText(html_content, 'html', 'utf-8'))

        # Logo Zebutech intégré (cid) : multipart/related autour du texte + HTML
        body_part = alt
        logo = _logo_bytes()
        if logo and f"cid:{LOGO_CID}" in html_content:
            related = MIMEMultipart('related')
            related.attach(alt)
            img = MIMEImage(logo, _subtype='png')
            img.add_header('Content-ID', f'<{LOGO_CID}>')
            img.add_header('Content-Disposition', 'inline', filename='zebutech.png')
            related.attach(img)
            body_part = related

        if attachments:
            msg = MIMEMultipart('mixed')
            msg.attach(body_part)
            for filename, data, mime in attachments:
                maintype, _, subtype = (mime or "application/octet-stream").partition("/")
                part = MIMEApplication(data, _subtype=subtype or "octet-stream")
                part.add_header('Content-Disposition', 'attachment', filename=filename)
                msg.attach(part)
        else:
            msg = body_part

        msg['Subject'] = subject
        msg['From'] = formataddr((settings.EMAIL_FROM_NAME, from_addr))
        msg['To'] = to_email
        msg['Date'] = formatdate(localtime=True)
        msg['Message-ID'] = make_msgid(domain=from_addr.split("@")[-1] or None)

        context = ssl.create_default_context()
        timeout = settings.EMAIL_TIMEOUT

        if settings.EMAIL_USE_SSL or settings.EMAIL_PORT == 465:
            server = smtplib.SMTP_SSL(settings.EMAIL_HOST, settings.EMAIL_PORT, timeout=timeout, context=context)
        else:
            server = smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT, timeout=timeout)

        with server:
            server.ehlo()
            if not (settings.EMAIL_USE_SSL or settings.EMAIL_PORT == 465):
                server.starttls(context=context)
                server.ehlo()
            server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
            # enveloppe = adresse expéditeur vérifiée (et non le login technique Brevo)
            server.send_message(msg, from_addr=from_addr, to_addrs=[to_email])

        logger.info("Email envoyé à %s (%s)", to_email, subject)
        return True
    except smtplib.SMTPAuthenticationError as e:
        logger.error("Brevo SMTP : authentification refusée (EMAIL_USER / clé SMTP incorrects) : %s", e)
    except smtplib.SMTPSenderRefused as e:
        logger.error("Brevo SMTP : expéditeur refusé — vérifiez EMAIL_FROM dans Brevo (Expéditeurs) : %s", e)
    except Exception as e:
        logger.error("Email sending failed (%s): %s", to_email, e)
    return False

def send_otp_email(to_email: str, otp_code: str, fullname: str, reset: bool = False) -> bool:
    """Envoyer un email OTP"""
    action = (
        "Vous avez demand&eacute; &agrave; r&eacute;initialiser votre mot de passe."
        if reset else
        "Pour finaliser votre inscription, saisissez ce code dans l'application."
    )
    html_content = render_email(
        "Code de vérification",
        f"<p>Bonjour <strong>{esc(fullname)}</strong>,</p><p>Votre code de v&eacute;rification est :</p>",
        code=otp_code,
        footer_html=(
            f"<p>Ce code est valable pendant <strong>{settings.OTP_EXPIRY_MINUTES} minutes</strong>.</p>"
            f"<p>{action}</p>"
            '<p style="color:#7a8c7b;font-size:12px">Si vous n\'&ecirc;tes pas &agrave; l\'origine de cette demande, ignorez simplement cet email.</p>'
        ),
    )

    subject = "Mada Bien-être - Code de vérification" if not reset else "Mada Bien-être - Réinitialisation du mot de passe"
    intro = "Pour réinitialiser votre mot de passe" if reset else "Pour vérifier votre compte"
    text_content = (
        f"Bonjour {fullname},\n\n{intro}, utilisez le code : {otp_code}\n"
        f"Ce code expire dans {settings.OTP_EXPIRY_MINUTES} minutes.\n\n"
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n\nMada Bien-être"
    )

    return send_email(to_email, subject, html_content, text_content)

def send_emergency_email(
    user: User,
    location: str,
    alert_type: str,
    details: Optional[str] = None,
    booking: Optional[Booking] = None
) -> bool:
    """Envoyer un email d'urgence"""
    rows = {
        "Utilisateur": user.fullname,
        "Téléphone": user.phone,
        "Email": user.email,
        "Type": alert_type,
        "Localisation": location,
    }
    if booking:
        rows["Réservation"] = f"#{booking.id}"
        rows["Adresse"] = getattr(booking, "address", None)
    if details:
        rows["Détails"] = details
    rows["Heure de l'alerte"] = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    html_content = render_email(
        "🚨 Alerte urgence (SOS)",
        "<p>Une alerte SOS vient d'être déclenchée sur Mada Bien-être.</p>",
        rows=rows,
        footer_html='<p style="color:#7a8c7b;font-size:12px">Envoyé automatiquement suite à une alerte SOS.</p>',
        alert=True,
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
    html_content = render_email(
        "Confirmation de réservation",
        f"<p>Bonjour <strong>{esc(fullname)}</strong>,</p><p>Votre réservation a été confirmée avec succès !</p>",
        rows={"Type": massage_type, "Date": date, "Durée": f"{duration} minutes", "Prix": f"{price} Ar"},
        footer_html="<p>Vous pouvez suivre votre réservation dans l'application.</p>",
    )
    
    subject = "Mada Bien-être - Confirmation de réservation"
    
    return send_email(to_email, subject, html_content)

def send_sms(phone: str, message: str) -> bool:
    """Envoyer un SMS"""
    try:
        logger.info("SMS sent to %s: %s", phone, message)
        return True
    except Exception as e:
        logger.error("SMS sending failed: %s", e)
        return False