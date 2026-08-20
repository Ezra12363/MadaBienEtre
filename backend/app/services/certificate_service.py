import os
import io
from pathlib import Path
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor, white
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.graphics.barcode import code128

from sqlalchemy.orm import Session
import qrcode

from ..models.therapist_certificate import TherapistCertificate
from ..models.user import User
from ..core.config import settings

# ============================================================
# CHEMIN DU PROJET
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]

CERTIFICATES_DIR = BASE_DIR / "uploads" / "certificates"

# ✅ Chemin du logo Zebutech (apetrakao amin'ny toerana mety)
LOGO_PATH = BASE_DIR / "assets" / "logo" / "logo.png"

# ============================================================
# CRÉER LE DOSSIER SI NÉCESSAIRE
# ============================================================

CERTIFICATES_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# NUMÉRO CERTIFICAT
# ============================================================

def _generate_certificate_number(db: Session) -> str:
    year = datetime.utcnow().year
    prefix = f"MBE-TH-{year}-"

    last_certificate = (
        db.query(TherapistCertificate)
        .filter(TherapistCertificate.certificate_number.like(f"{prefix}%"))
        .order_by(TherapistCertificate.id.desc())
        .first()
    )

    if last_certificate:
        try:
            last_sequence = int(last_certificate.certificate_number.split("-")[-1])
            sequence = last_sequence + 1
        except (ValueError, AttributeError):
            sequence = 1
    else:
        sequence = 1

    return f"{prefix}{sequence:06d}"


# ============================================================
# QR CODE
# ============================================================

def _build_qr_image(certificate_number: str):
    """✅ QR code pointant vers la page de vérification publique."""
    base_url = getattr(settings, "BASE_URL", "https://madabienetre.com").rstrip('/')
    verify_url = f"{base_url}/certificates/verify/{certificate_number}"

    qr = qrcode.QRCode(box_size=6, border=2)
    qr.add_data(verify_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#0D2B7E", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    return ImageReader(buffer)


# ============================================================
# UTILITAIRE — RETOUR À LA LIGNE AUTOMATIQUE
# ============================================================

def _wrap_text(pdf, text, font_name, font_size, max_width):
    words = text.split()
    lines = []
    line = ""

    for word in words:
        test_line = f"{line} {word}".strip()
        if pdf.stringWidth(test_line, font_name, font_size) <= max_width:
            line = test_line
        else:
            if line:
                lines.append(line)
            line = word

    if line:
        lines.append(line)

    return lines


# ============================================================
# DESSIN DU PDF — DESIGN ÉPURÉ (STYLE CERTIFICAT PROFESSIONNEL)
# ============================================================

def _draw_certificate_pdf(
    path: str,
    therapist: User,
    certificate_number: str,
    issued_at: datetime,
    admin_fullname: str,
    specialty: str = None,
):
    """
    ✅ Génère le certificat professionnel PDF.
    Design épuré : un seul cadre fin, aucune ligne de séparation dans le texte,
    tailles de police normales (sauf le titre), QR code + code-barres.
    """

    os.makedirs(os.path.dirname(path), exist_ok=True)

    pdf = canvas.Canvas(path, pagesize=A4)
    width, height = A4

    # --------------------------------------------------------
    # COULEURS
    # --------------------------------------------------------

    primary = HexColor("#0D2B7E")       # Bleu foncé Mada
    dark = HexColor("#222222")          # Texte principal
    gray = HexColor("#6B7280")          # Texte secondaire
    light_gray = HexColor("#F6F6F9")    # Fond du bloc infos
    green = HexColor("#1B7A3D")         # Cadre + badge "vérifié"
    line_gray = HexColor("#D8D8DC")     # Traits de signature

    # --------------------------------------------------------
    # FOND BLANC
    # --------------------------------------------------------

    pdf.setFillColor(white)
    pdf.rect(0, 0, width, height, fill=1, stroke=0)

    # --------------------------------------------------------
    # CADRE UNIQUE, FIN ET DISCRET
    # --------------------------------------------------------

    margin = 1.3 * cm
    pdf.setStrokeColor(green)
    pdf.setLineWidth(1.1)
    pdf.rect(margin, margin, width - 2 * margin, height - 2 * margin)

    content_left = margin + 1.2 * cm
    content_right = width - margin - 1.2 * cm
    content_width = content_right - content_left

    # --------------------------------------------------------
    # LOGO ZEBUTECH
    # --------------------------------------------------------

    if os.path.exists(LOGO_PATH):
        try:
            pdf.drawImage(
                str(LOGO_PATH),
                content_left,
                height - margin - 2.4 * cm,
                width=2.0 * cm,
                height=2.0 * cm,
                preserveAspectRatio=True,
                mask='auto',
            )
        except Exception:
            pass

    # --------------------------------------------------------
    # EN-TÊTE
    # --------------------------------------------------------

    y = height - margin - 1.3 * cm

    pdf.setFont("Helvetica-Bold", 22)
    pdf.setFillColor(primary)
    pdf.drawCentredString(width / 2, y, "MADA BIEN-ÊTRE")

    y -= 0.55 * cm
    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(gray)
    pdf.drawCentredString(width / 2, y, "Plateforme de réservation de massages à domicile")

    # --------------------------------------------------------
    # TITRE PRINCIPAL (seul élément en grande taille)
    # --------------------------------------------------------

    y -= 1.1 * cm
    pdf.setFont("Helvetica-Bold", 16)
    pdf.setFillColor(dark)
    pdf.drawCentredString(width / 2, y, "CERTIFICAT PROFESSIONNEL DE THÉRAPEUTE")

    y -= 0.6 * cm
    pdf.setFont("Helvetica-Oblique", 9)
    pdf.setFillColor(gray)
    pdf.drawCentredString(width / 2, y, "Généré par Zebutech pour Mada Bien-être")

    # --------------------------------------------------------
    # TEXTE D'INTRODUCTION
    # --------------------------------------------------------

    y -= 1.1 * cm

    intro_text = (
        "Le présent certificat atteste que la personne désignée ci-dessous est "
        "enregistrée comme thérapeute / masseur sur la plateforme Mada Bien-être, "
        "sous réserve de la vérification et de la validation de ses informations "
        "et documents par l'administrateur."
    )

    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(dark)
    for line in _wrap_text(pdf, intro_text, "Helvetica", 10, content_width):
        pdf.drawString(content_left, y, line)
        y -= 0.45 * cm

    # --------------------------------------------------------
    # BLOC INFORMATIONS — fond doux, sans cadre lourd
    # --------------------------------------------------------

    y -= 0.35 * cm

    rows = [
        ("Nom et prénom", therapist.fullname or "N/A", True),
        ("Email", therapist.email or "N/A", False),
        ("Téléphone", therapist.phone or "N/A", False),
        ("Numéro CIN", therapist.cin_number or "Non renseigné", False),
        ("Adresse", (therapist.address or "N/A")[:60], False),
        ("Spécialité", specialty or "Massage à domicile", False),
    ]

    row_height = 0.75 * cm
    block_height = row_height * len(rows) + 0.4 * cm

    pdf.setFillColor(light_gray)
    pdf.roundRect(content_left, y - block_height, content_width, block_height, 5, stroke=0, fill=1)

    y_row = y - 0.55 * cm
    for label, value, important in rows:
        pdf.setFont("Helvetica", 9)
        pdf.setFillColor(gray)
        pdf.drawString(content_left + 0.4 * cm, y_row, label)

        pdf.setFont("Helvetica-Bold" if important else "Helvetica", 10)
        pdf.setFillColor(primary if important else dark)
        pdf.drawString(content_left + 5.2 * cm, y_row, str(value))

        y_row -= row_height

    y = y - block_height - 0.7 * cm

    # --------------------------------------------------------
    # NUMÉRO, DATE, VALIDATION
    # --------------------------------------------------------

    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(dark)
    pdf.drawString(content_left, y, f"Numéro du certificat : {certificate_number}")
    y -= 0.45 * cm
    pdf.drawString(content_left, y, f"Date de validation : {issued_at.strftime('%d/%m/%Y')}")
    y -= 0.45 * cm
    pdf.drawString(content_left, y, f"Validé par (Admin) : {admin_fullname or 'Administration Mada Bien-être'}")

    # --------------------------------------------------------
    # BADGE DE STATUT
    # --------------------------------------------------------

    y -= 0.9 * cm

    badge_text = "THÉRAPEUTE VÉRIFIÉ"
    badge_font_size = 10
    pdf.setFont("Helvetica-Bold", badge_font_size)
    badge_padding_x = 0.6 * cm
    badge_h = 0.8 * cm
    badge_w = pdf.stringWidth(badge_text, "Helvetica-Bold", badge_font_size) + badge_padding_x * 2

    badge_bottom = y - badge_h

    pdf.setFillColor(green)
    pdf.roundRect(content_left, badge_bottom, badge_w, badge_h, badge_h / 2, stroke=0, fill=1)

    # Centrage vertical réel du texte dans le pill (basé sur la hauteur de casse, pas sur la baseline)
    pdf.setFillColor(white)
    text_baseline = badge_bottom + (badge_h - badge_font_size * 0.7) / 2
    pdf.drawCentredString(content_left + badge_w / 2, text_baseline, badge_text)

    y = badge_bottom - 0.6 * cm

    # --------------------------------------------------------
    # MENTION LÉGALE
    # --------------------------------------------------------

    legal_text = (
        "Ce document est destiné à l'identification et à la validation du profil professionnel "
        "dans le cadre du service Mada Bien-être. Il ne constitue pas, à lui seul, "
        "une licence d'exercice délivrée par une autorité publique."
    )

    pdf.setFont("Helvetica-Oblique", 8.5)
    pdf.setFillColor(gray)
    for line in _wrap_text(pdf, legal_text, "Helvetica-Oblique", 8.5, content_width):
        pdf.drawString(content_left, y, line)
        y -= 0.38 * cm

    y -= 0.7 * cm

    # --------------------------------------------------------
    # SIGNATURES
    # --------------------------------------------------------

    sig_y = y

    pdf.setStrokeColor(line_gray)
    pdf.setLineWidth(0.7)
    pdf.line(content_left, sig_y, content_left + 4.5 * cm, sig_y)
    pdf.line(content_left + 6.5 * cm, sig_y, content_left + 11.0 * cm, sig_y)

    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(dark)
    pdf.drawString(content_left, sig_y - 0.4 * cm, "Signature du thérapeute")
    pdf.drawString(content_left + 6.5 * cm, sig_y - 0.4 * cm, "Validation administrateur")

    pdf.setFont("Helvetica-Oblique", 8)
    pdf.setFillColor(gray)
    pdf.drawString(content_left, sig_y - 0.7 * cm, f"({therapist.fullname or 'Thérapeute'})")
    pdf.drawString(content_left + 6.5 * cm, sig_y - 0.7 * cm, f"({admin_fullname or 'Administrateur'})")

    # --------------------------------------------------------
    # QR CODE + CODE-BARRES (bas de page, côte à côte)
    # --------------------------------------------------------

    bottom_y = margin + 0.9 * cm
    qr_size = 2.5 * cm

    # QR code — bas droite
    try:
        qr_img = _build_qr_image(certificate_number)
        qr_x = content_right - qr_size
        pdf.drawImage(qr_img, qr_x, bottom_y, width=qr_size, height=qr_size)

        pdf.setFont("Helvetica", 7)
        pdf.setFillColor(gray)
        pdf.drawCentredString(qr_x + qr_size / 2, bottom_y - 0.32 * cm, "Scanner pour vérifier")
    except Exception:
        pass

    # Code-barres Code128 — bas gauche
    try:
        barcode = code128.Code128(certificate_number, barHeight=1.5 * cm, barWidth=0.38 * mm)
        barcode_y = bottom_y + (qr_size - 1.5 * cm) / 2
        barcode.drawOn(pdf, content_left, barcode_y)

        pdf.setFont("Helvetica", 7)
        pdf.setFillColor(gray)
        pdf.drawString(content_left, barcode_y - 0.32 * cm, certificate_number)
    except Exception:
        pass

    # --------------------------------------------------------
    # PIED DE PAGE (hors cadre)
    # --------------------------------------------------------

    pdf.setFont("Helvetica", 7.5)
    pdf.setFillColor(HexColor("#AAAAAA"))
    pdf.drawCentredString(
        width / 2,
        margin - 0.6 * cm,
        f"Mada Bien-être • Certificat N° {certificate_number} • Généré le {issued_at.strftime('%d/%m/%Y à %H:%M')}"
    )

    pdf.showPage()
    pdf.save()


# ============================================================
# GÉNÉRER CERTIFICAT
# ============================================================

def generate_certificate_for_therapist(
    therapist: User,
    admin_id: int,
    admin_fullname: str,
    db: Session,
    specialty: str = None,
) -> TherapistCertificate:
    """
    ✅ Génère automatiquement le certificat.
    Idempotent : si un certificat valide existe déjà, aucun nouveau certificat n'est généré.
    """

    existing = (
        db.query(TherapistCertificate)
        .filter(
            TherapistCertificate.therapist_id == therapist.id,
            TherapistCertificate.status == "valid",
        )
        .order_by(TherapistCertificate.issued_at.desc())
        .first()
    )

    if existing:
        return existing

    # --------------------------------------------------------
    # NUMÉRO
    # --------------------------------------------------------

    certificate_number = _generate_certificate_number(db)
    issued_at = datetime.utcnow()
    filename = f"{certificate_number}.pdf"
    relative_path = f"uploads/certificates/{filename}"
    full_path = CERTIFICATES_DIR / filename

    # --------------------------------------------------------
    # GÉNÉRATION PDF
    # --------------------------------------------------------

    _draw_certificate_pdf(
        path=str(full_path),
        therapist=therapist,
        certificate_number=certificate_number,
        issued_at=issued_at,
        admin_fullname=admin_fullname,
        specialty=specialty,
    )

    # --------------------------------------------------------
    # BASE DE DONNÉES
    # --------------------------------------------------------

    certificate = TherapistCertificate(
        therapist_id=therapist.id,
        certificate_number=certificate_number,
        certificate_path=relative_path,
        issued_at=issued_at,
        status="valid",
        verified_by=admin_id,
    )

    db.add(certificate)
    db.commit()
    db.refresh(certificate)

    return certificate


# ============================================================
# RÉVOQUER CERTIFICAT
# ============================================================

def revoke_certificate(therapist_id: int, db: Session):
    """
    Révoque le certificat valide du thérapeute.
    """
    certificate = (
        db.query(TherapistCertificate)
        .filter(
            TherapistCertificate.therapist_id == therapist_id,
            TherapistCertificate.status == "valid",
        )
        .first()
    )

    if certificate:
        certificate.status = "revoked"
        db.commit()

    return certificate