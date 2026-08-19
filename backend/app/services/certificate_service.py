import os
import io
from pathlib import Path
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping

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
    
    img = qr.make_image(fill_color="#1B5E20", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    
    return ImageReader(buffer)


# ============================================================
# DESSIN DU PDF — VERSION AMÉLIORÉE (STYLE DIPLÔME)
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
    ✅ Génère le certificat professionnel PDF avec un style diplôme officiel.
    """
    
    os.makedirs(os.path.dirname(path), exist_ok=True)
    
    pdf = canvas.Canvas(path, pagesize=A4)
    width, height = A4
    
    # --------------------------------------------------------
    # COULEURS
    # --------------------------------------------------------
    
    primary = HexColor("#0D2B7E")      # Bleu foncé Mada
    gold = HexColor("#C9A227")          # Or
    gold_light = HexColor("#F5E6B8")    # Or clair
    dark = HexColor("#222222")          # Noir
    gray = HexColor("#666666")          # Gris
    light_gray = HexColor("#F8F8F8")    # Gris clair
    green = HexColor("#1B5E20")         # Vert foncé
    
    # --------------------------------------------------------
    # FOND BLANC
    # --------------------------------------------------------
    
    pdf.setFillColor(white)
    pdf.rect(0, 0, width, height, fill=1, stroke=0)
    
    # --------------------------------------------------------
    # CADRE DÉCORATIF DOUBLE
    # --------------------------------------------------------
    
    # Cadre extérieur (Or)
    pdf.setStrokeColor(gold)
    pdf.setLineWidth(3)
    pdf.rect(1.0 * cm, 1.0 * cm, width - 2.0 * cm, height - 2.0 * cm)
    
    # Cadre intérieur (Bleu)
    pdf.setStrokeColor(primary)
    pdf.setLineWidth(1.5)
    pdf.rect(1.35 * cm, 1.35 * cm, width - 2.7 * cm, height - 2.7 * cm)
    
    # --------------------------------------------------------
    # LOGO ZEBUTECH (en haut à droite)
    # --------------------------------------------------------
    
    if os.path.exists(LOGO_PATH):
        try:
            pdf.drawImage(
                str(LOGO_PATH),
                width - 4.5 * cm,
                height - 3.8 * cm,
                width=2.8 * cm,
                height=2.8 * cm,
                preserveAspectRatio=True,
                mask='auto',
            )
        except Exception:
            pass
    
    # --------------------------------------------------------
    # EN-TÊTE
    # --------------------------------------------------------
    
    y = height - 3.2 * cm
    
    pdf.setFont("Helvetica-Bold", 24)
    pdf.setFillColor(primary)
    pdf.drawCentredString(width / 2, y, "MADA BIEN-ÊTRE")
    
    pdf.setFont("Helvetica", 11)
    pdf.setFillColor(gray)
    pdf.drawCentredString(width / 2, y - 0.6 * cm, "Plateforme de réservation de massages à domicile")
    
    # Ligne décorative sous l'en-tête
    pdf.setStrokeColor(gold)
    pdf.setLineWidth(2)
    pdf.line(3 * cm, y - 1.0 * cm, width - 3 * cm, y - 1.0 * cm)
    
    # --------------------------------------------------------
    # TITRE PRINCIPAL
    # --------------------------------------------------------
    
    y = height - 5.5 * cm
    
    pdf.setFont("Helvetica-Bold", 18)
    pdf.setFillColor(primary)
    pdf.drawCentredString(width / 2, y, "CERTIFICAT PROFESSIONNEL")
    
    pdf.setFont("Helvetica-Bold", 14)
    pdf.setFillColor(dark)
    pdf.drawCentredString(width / 2, y - 0.6 * cm, "DE THÉRAPEUTE / MASSEUR")
    
    # Sous-titre "Généré par Zebutech"
    pdf.setFont("Helvetica-Oblique", 9)
    pdf.setFillColor(gray)
    pdf.drawCentredString(width / 2, y - 1.1 * cm, "Généré par Zebutech pour Mada Bien-être")
    
    # Ligne décorative
    pdf.setStrokeColor(gold)
    pdf.setLineWidth(1.5)
    pdf.line(5 * cm, y - 1.5 * cm, width - 5 * cm, y - 1.5 * cm)
    
    # --------------------------------------------------------
    # TEXTE D'INTRODUCTION (PHRASE COMPLÈTE)
    # --------------------------------------------------------
    
    y = height - 7.5 * cm
    
    intro_text = (
        "Le présent certificat atteste que la personne désignée ci-dessous est "
        "enregistrée comme thérapeute / masseur sur la plateforme Mada Bien-être, "
        "sous réserve de la vérification et de la validation de ses informations "
        "et documents par l'administrateur."
    )
    
    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(dark)
    
    # Formatage du texte sur plusieurs lignes
    lines = []
    words = intro_text.split()
    line = ""
    
    for word in words:
        test_line = line + " " + word if line else word
        if pdf.stringWidth(test_line, "Helvetica", 10) < (width - 5 * cm):
            line = test_line
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    
    for i, line in enumerate(lines):
        pdf.drawString(2.5 * cm, y - (i * 0.5 * cm), line)
    
    y = y - (len(lines) * 0.5 * cm) - 0.8 * cm
    
    # --------------------------------------------------------
    # INFORMATIONS DU THÉRAPEUTE (SOUS FORME DE PHRASES)
    # --------------------------------------------------------
    
    # Fond du tableau
    pdf.setFillColor(light_gray)
    pdf.rect(2.5 * cm, y - 5.5 * cm, width - 5 * cm, 5.5 * cm, fill=1, stroke=0)
    
    # Bordure du tableau
    pdf.setStrokeColor(HexColor("#E0E0E0"))
    pdf.setLineWidth(1)
    pdf.rect(2.5 * cm, y - 5.5 * cm, width - 5 * cm, 5.5 * cm, fill=0, stroke=1)
    
    y_tableau = y - 0.5 * cm
    row_height = 0.8 * cm
    
    def draw_info_row(label, value, is_important=False):
        nonlocal y_tableau
        if y_tableau < y - 5.5 * cm + 0.5 * cm:
            return
        
        # Ligne séparatrice
        if y_tableau < y - 0.5 * cm:
            pdf.setStrokeColor(HexColor("#E8E8E8"))
            pdf.setLineWidth(0.5)
            pdf.line(2.5 * cm, y_tableau + 0.1 * cm, width - 2.5 * cm, y_tableau + 0.1 * cm)
        
        # Label
        pdf.setFont("Helvetica-Bold", 10)
        pdf.setFillColor(gray)
        pdf.drawString(2.8 * cm, y_tableau, label)
        
        # Valeur
        pdf.setFont("Helvetica-Bold" if is_important else "Helvetica", 11)
        pdf.setFillColor(primary if is_important else dark)
        pdf.drawString(5.5 * cm, y_tableau, str(value) if value else "Non renseigné")
        
        y_tableau -= row_height
    
    draw_info_row("Nom et prénom :", therapist.fullname or "N/A", True)
    draw_info_row("Email :", therapist.email or "N/A")
    draw_info_row("Téléphone :", therapist.phone or "N/A")
    draw_info_row("Numéro CIN :", therapist.cin_number or "Non renseigné")
    draw_info_row("Adresse :", (therapist.address or "N/A")[:60])
    draw_info_row("Spécialité :", specialty or "Massage à domicile")
    
    y = y_tableau - 0.5 * cm
    
    # --------------------------------------------------------
    # NUMÉRO DU CERTIFICAT ET DATE (PHRASES)
    # --------------------------------------------------------
    
    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(dark)
    pdf.drawString(2.5 * cm, y, f"Numéro du certificat : {certificate_number}")
    y -= 0.5 * cm
    pdf.drawString(2.5 * cm, y, f"Date de validation : {issued_at.strftime('%d/%m/%Y')}")
    y -= 0.5 * cm
    pdf.drawString(2.5 * cm, y, f"Validé par (Admin) : {admin_fullname or 'Administration Mada Bien-être'}")
    y -= 0.8 * cm
    
    # --------------------------------------------------------
    # STATUT DE VALIDATION (PHRASE AVEC CHECKMARK)
    # --------------------------------------------------------
    
    pdf.setFont("Helvetica-Bold", 13)
    pdf.setFillColor(green)
    pdf.drawString(2.5 * cm, y, "✅ THÉRAPEUTE VÉRIFIÉ")
    y -= 0.6 * cm
    
    # --------------------------------------------------------
    # MENTION LÉGALE (PHRASE COMPLÈTE)
    # --------------------------------------------------------
    
    pdf.setFont("Helvetica-Oblique", 9)
    pdf.setFillColor(gray)
    
    legal_text = (
        "Ce document est destiné à l'identification et à la validation du profil professionnel "
        "dans le cadre du service Mada Bien-être. Il ne constitue pas, à lui seul, "
        "une licence d'exercice délivrée par une autorité publique."
    )
    
    lines = []
    words = legal_text.split()
    line = ""
    
    for word in words:
        test_line = line + " " + word if line else word
        if pdf.stringWidth(test_line, "Helvetica-Oblique", 9) < (width - 5 * cm):
            line = test_line
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    
    for i, line in enumerate(lines):
        pdf.drawString(2.5 * cm, y - (i * 0.4 * cm), line)
    
    y = y - (len(lines) * 0.4 * cm) - 0.8 * cm
    
    # --------------------------------------------------------
    # SIGNATURES
    # --------------------------------------------------------
    
    # Ligne de signature du thérapeute
    pdf.setStrokeColor(black)
    pdf.setLineWidth(1)
    pdf.line(2.5 * cm, y, 6.0 * cm, y)
    
    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(dark)
    pdf.drawString(2.5 * cm, y - 0.4 * cm, f"Signature du thérapeute")
    pdf.setFont("Helvetica-Oblique", 8)
    pdf.setFillColor(gray)
    pdf.drawString(2.5 * cm, y - 0.7 * cm, f"({therapist.fullname or 'Thérapeute'})")
    
    # Ligne de validation administrateur
    pdf.line(6.5 * cm, y, 10.0 * cm, y)
    
    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(dark)
    pdf.drawString(6.5 * cm, y - 0.4 * cm, "Validation administrateur")
    pdf.setFont("Helvetica-Oblique", 8)
    pdf.setFillColor(gray)
    pdf.drawString(6.5 * cm, y - 0.7 * cm, f"({admin_fullname or 'Administrateur'})")
    
    y = y - 1.2 * cm
    
    # --------------------------------------------------------
    # DATES
    # --------------------------------------------------------
    
    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(gray)
    pdf.drawString(2.5 * cm, y, f"Date : {issued_at.strftime('%d/%m/%Y')}")
    pdf.drawString(6.5 * cm, y, f"Date : {issued_at.strftime('%d/%m/%Y')}")
    
    # --------------------------------------------------------
    # QR CODE (en bas à droite)
    # --------------------------------------------------------
    
    try:
        qr_img = _build_qr_image(certificate_number)
        qr_size = 3.0 * cm
        pdf.drawImage(
            qr_img,
            width - 5.0 * cm,
            1.5 * cm,
            width=qr_size,
            height=qr_size,
        )
        pdf.setFont("Helvetica", 7)
        pdf.setFillColor(gray)
        pdf.drawCentredString(
            width - 5.0 * cm + qr_size / 2,
            1.2 * cm,
            "Scanner pour vérifier"
        )
    except Exception:
        pass
    
    # --------------------------------------------------------
    # PIED DE PAGE
    # --------------------------------------------------------
    
    pdf.setFont("Helvetica-Oblique", 8)
    pdf.setFillColor(HexColor("#AAAAAA"))
    pdf.drawCentredString(
        width / 2,
        0.8 * cm,
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