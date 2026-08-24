import os
import io
from pathlib import Path
from datetime import datetime

from reportlab.lib.pagesizes import A4, landscape
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

    # box_size plus élevé => image plus nette, car la boîte QR est plus grande sur ce nouveau design
    qr = qrcode.QRCode(box_size=9, border=2)
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
# DESSIN DU PDF — FORMAT PAYSAGE, CALQUÉ SUR LE MODÈLE MADA BIEN-ÊTRE
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
    ✅ Génère le certificat professionnel PDF au format PAYSAGE (A4 landscape),
    avec la même mise en page, les mêmes proportions de police et la même
    disposition que le modèle officiel Mada Bien-être (cadre double,
    en-tête MADA BIEN-ÊTRE / CERTIFICAT / PROFESSIONNEL DE THÉRAPEUTE,
    tableau d'informations à pointillés, bloc numéro/date/validation,
    badge "THÉRAPEUTE VÉRIFIÉ", signatures, code-barres + QR code à droite).
    """

    os.makedirs(os.path.dirname(path), exist_ok=True)

    pdf = canvas.Canvas(path, pagesize=landscape(A4))
    width, height = landscape(A4)

    # --------------------------------------------------------
    # COULEURS (identiques au modèle)
    # --------------------------------------------------------

    dark_green = HexColor("#1B5E3A")    # Vert titre / cadre principal
    mid_green = HexColor("#1B7A3D")     # Vert cadre intérieur + badge vérifié
    gold = HexColor("#C8892E")          # Or/orange du sous-titre plateforme
    dark = HexColor("#222222")          # Texte principal
    gray = HexColor("#5A5A5A")          # Texte secondaire (mention légale)
    dotted_line = HexColor("#B8B8B8")   # Pointillés sous les valeurs
    box_gray = HexColor("#9A9A9A")      # Contour des encadrés code-barres/QR

    # --------------------------------------------------------
    # FOND BLANC
    # --------------------------------------------------------

    pdf.setFillColor(white)
    pdf.rect(0, 0, width, height, fill=1, stroke=0)

    # --------------------------------------------------------
    # DOUBLE CADRE (vert + or, comme le modèle)
    # --------------------------------------------------------

    outer_margin = 0.45 * cm
    pdf.setStrokeColor(dark_green)
    pdf.setLineWidth(1.1)
    pdf.roundRect(outer_margin, outer_margin, width - 2 * outer_margin, height - 2 * outer_margin, 8, stroke=1, fill=0)

    inner_margin = outer_margin + 0.32 * cm
    pdf.setStrokeColor(gold)
    pdf.setLineWidth(0.9)
    pdf.roundRect(inner_margin, inner_margin, width - 2 * inner_margin, height - 2 * inner_margin, 6, stroke=1, fill=0)

    content_left = inner_margin + 0.85 * cm
    content_right = width - inner_margin - 0.85 * cm
    right_col_w = 5.15 * cm
    text_right = content_right - right_col_w - 0.5 * cm
    text_width = text_right - content_left

    center_x = (content_left + text_right) / 2

    # Centre réel de la page, utilisé pour l'en-tête (titres) comme dans le modèle
    page_center_x = width / 2
    intro_max_width = 2 * ((content_right - right_col_w) - page_center_x - 0.4 * cm)

    top = height - inner_margin - 0.85 * cm

    # --------------------------------------------------------
    # LOGO ZEBUTECH (haut gauche)
    # --------------------------------------------------------

    logo_w = 4.9 * cm
    logo_h = 2.35 * cm
    if os.path.exists(LOGO_PATH):
        try:
            pdf.drawImage(
                str(LOGO_PATH),
                content_left,
                top - logo_h + 0.4 * cm,
                width=logo_w,
                height=logo_h,
                preserveAspectRatio=True,
                anchor='sw',
                mask='auto',
            )
        except Exception:
            pass

    # --------------------------------------------------------
    # EN-TÊTE
    # --------------------------------------------------------

    y = top

    pdf.setFont("Helvetica-Bold", 27)
    pdf.setFillColor(dark_green)
    pdf.drawCentredString(page_center_x, y, "MADA BIEN-ÊTRE")

    y -= 0.72 * cm
    pdf.setFont("Helvetica-Bold", 11.5)
    pdf.setFillColor(gold)
    pdf.drawCentredString(page_center_x, y, "Plateforme de réservation de massages à domicile")

    # --------------------------------------------------------
    # TITRE PRINCIPAL
    # --------------------------------------------------------

    y -= 1.3 * cm
    pdf.setFont("Helvetica-Bold", 36)
    pdf.setFillColor(dark_green)
    pdf.drawCentredString(page_center_x, y, "CERTIFICAT")

    y -= 0.78 * cm
    pdf.setFont("Helvetica-Bold", 17)
    pdf.setFillColor(HexColor("#333333"))
    pdf.drawCentredString(page_center_x, y, "PROFESSIONNEL DE THÉRAPEUTE")

    # --------------------------------------------------------
    # TEXTE D'INTRODUCTION (centré sur la page, comme le modèle)
    # --------------------------------------------------------

    y -= 0.95 * cm

    intro_text = (
        "Le présent certificat atteste que la personne désignée ci-dessous est "
        "enregistrée comme thérapeute / masseur sur la plateforme Mada Bien-être, "
        "sous réserve de la vérification et de la validation de ses informations "
        "et documents par l'administrateur."
    )

    pdf.setFont("Helvetica", 11)
    pdf.setFillColor(dark)
    for line in _wrap_text(pdf, intro_text, "Helvetica", 11, intro_max_width):
        pdf.drawCentredString(page_center_x, y, line)
        y -= 0.5 * cm

    # --------------------------------------------------------
    # BLOC INFORMATIONS — libellé + valeur + ligne pointillée
    # --------------------------------------------------------

    y -= 0.5 * cm

    rows = [
        ("N° UTILISATEUR", getattr(therapist, "id", None) or "N/A"),
        ("NOM ET PRÉNOM", therapist.fullname or "N/A"),
        ("EMAIL", therapist.email or "N/A"),
        ("TÉLÉPHONE", therapist.phone or "N/A"),
        ("NUMÉRO CIN", therapist.cin_number or "Non renseigné"),
        ("ADRESSE", (therapist.address or "N/A")[:70]),
        ("SPÉCIALITÉ", specialty or "Massage à domicile"),
    ]

    label_x = content_left
    colon_x = content_left + 4.3 * cm
    value_x = colon_x + 0.4 * cm
    row_h = 0.75 * cm
    label_font = 11
    value_font = 11.5

    pdf.setDash(1, 2)
    for label, value in rows:
        pdf.setFont("Helvetica-Bold", label_font)
        pdf.setFillColor(dark)
        pdf.drawString(label_x, y, label)

        pdf.setFont("Helvetica-Bold", value_font)
        pdf.setFillColor(dark)
        pdf.drawString(colon_x, y, ":")
        pdf.drawString(value_x, y, str(value))

        val_w = pdf.stringWidth(str(value), "Helvetica-Bold", value_font)
        line_y = y - 0.10 * cm
        pdf.setStrokeColor(dotted_line)
        pdf.setLineWidth(0.6)
        pdf.line(value_x + val_w + 0.15 * cm, line_y, text_right, line_y)

        y -= row_h
    pdf.setDash()

    y -= 0.14 * cm
    pdf.setStrokeColor(dark_green)
    pdf.setLineWidth(1.2)
    pdf.line(content_left, y, text_right, y)
    y -= 0.7 * cm

    # --------------------------------------------------------
    # NUMÉRO, DATE, VALIDATION
    # --------------------------------------------------------

    meta_rows = [
        ("N° DU CERTIFICAT", certificate_number),
        ("DATE DE VALIDATION", issued_at.strftime('%d/%m/%Y')),
        ("VALIDÉ PAR (ADMIN)", admin_fullname or "Administration Mada Bien-être"),
    ]
    for label, value in meta_rows:
        pdf.setFont("Helvetica-Bold", 11)
        pdf.setFillColor(dark)
        pdf.drawString(label_x, y, label)
        pdf.drawString(colon_x, y, ":")

        pdf.setFont("Helvetica-Bold", 11.5)
        pdf.setFillColor(dark_green)
        pdf.drawString(value_x, y, str(value))

        y -= 0.66 * cm

    # --------------------------------------------------------
    # BADGE "THÉRAPEUTE VÉRIFIÉ" (coche verte + texte, comme le modèle)
    # --------------------------------------------------------

    y -= 0.3 * cm
    check_r = 0.34 * cm
    cx0 = label_x + check_r
    cy0 = y + check_r * 0.35

    pdf.setFillColor(mid_green)
    pdf.circle(cx0, cy0, check_r, stroke=0, fill=1)

    pdf.setStrokeColor(white)
    pdf.setLineWidth(1.6)
    p = pdf.beginPath()
    p.moveTo(cx0 - 0.14 * cm, cy0 - 0.02 * cm)
    p.lineTo(cx0 - 0.03 * cm, cy0 - 0.13 * cm)
    p.lineTo(cx0 + 0.16 * cm, cy0 + 0.14 * cm)
    pdf.drawPath(p, stroke=1, fill=0)

    pdf.setFont("Helvetica-Bold", 13)
    pdf.setFillColor(mid_green)
    pdf.drawString(label_x + check_r * 2 + 0.25 * cm, y, "THÉRAPEUTE VÉRIFIÉ")

    y -= 0.85 * cm

    # --------------------------------------------------------
    # MENTION LÉGALE
    # --------------------------------------------------------

    legal_text = (
        "Ce document est destiné à l'identification et à la validation du profil professionnel "
        "dans le cadre du service Mada Bien-être. Il ne constitue pas, à lui seul, "
        "une licence d'exercice délivrée par une autorité publique."
    )

    pdf.setFont("Helvetica", 9.5)
    pdf.setFillColor(gray)
    for line in _wrap_text(pdf, legal_text, "Helvetica", 9.5, text_width):
        pdf.drawString(label_x, y, line)
        y -= 0.42 * cm

    # --------------------------------------------------------
    # SIGNATURES
    # --------------------------------------------------------

    y -= 0.95 * cm
    sig_label_y = y
    line_y = y - 0.42 * cm
    name_y = line_y - 0.42 * cm

    sig1_x1, sig1_x2 = content_left, content_left + 6.4 * cm
    sig2_x1, sig2_x2 = content_left + 8.6 * cm, text_right

    pdf.setFont("Helvetica-Bold", 9.5)
    pdf.setFillColor(dark)
    pdf.drawCentredString((sig1_x1 + sig1_x2) / 2, sig_label_y, "SIGNATURE DU THÉRAPEUTE")
    pdf.drawCentredString((sig2_x1 + sig2_x2) / 2, sig_label_y, "VALIDATION ADMINISTRATEUR")

    pdf.setStrokeColor(dark)
    pdf.setLineWidth(0.7)
    pdf.line(sig1_x1, line_y, sig1_x2, line_y)
    pdf.line(sig2_x1, line_y, sig2_x2, line_y)

    pdf.setFont("Helvetica-Oblique", 9.5)
    pdf.setFillColor(dark)
    pdf.drawCentredString((sig1_x1 + sig1_x2) / 2, name_y, f"( {therapist.fullname or 'Thérapeute'} )")
    pdf.drawCentredString((sig2_x1 + sig2_x2) / 2, name_y, f"( {admin_fullname or 'Administrateur'} )")

    # --------------------------------------------------------
    # PIED DE PAGE
    # --------------------------------------------------------

    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(dark_green)
    footer = (
        f"Mada Bien-être  •  Certificat N° {certificate_number}  •  "
        f"Plateforme de réservation de massages à domicile  •  Généré par Zebutech"
    )
    pdf.drawCentredString(width / 2, inner_margin + 0.35 * cm, footer)

    # --------------------------------------------------------
    # COLONNE DROITE : CODE-BARRES (haut) + QR CODE (bas)
    # --------------------------------------------------------

    box_w = right_col_w
    box_x = content_right - box_w
    box_border = dark_green

    # --- Encadré code-barres ---
    barcode_box_h = 3.8 * cm
    barcode_box_top = top - 6.36 * cm
    barcode_box_y = barcode_box_top - barcode_box_h

    pdf.setStrokeColor(box_border)
    pdf.setLineWidth(0.9)
    pdf.roundRect(box_x, barcode_box_y, box_w, barcode_box_h, 8, stroke=1, fill=0)

    try:
        barcode = code128.Code128(certificate_number, barHeight=1.4 * cm, barWidth=0.24 * mm)
        bw = barcode.width
        available_w = box_w - 0.9 * cm
        scale = available_w / bw if bw else 1.0
        draw_x = box_x + (box_w - bw * scale) / 2
        barcode_y = barcode_box_y + barcode_box_h - 2.0 * cm

        pdf.saveState()
        pdf.setFillColor(HexColor("#000000"))
        pdf.setStrokeColor(HexColor("#000000"))
        pdf.translate(draw_x, barcode_y)
        pdf.scale(scale, 1)
        barcode.drawOn(pdf, 0, 0)
        pdf.restoreState()
    except Exception:
        pass

    pdf.setFont("Helvetica-Bold", 9.5)
    pdf.setFillColor(dark)
    pdf.drawCentredString(box_x + box_w / 2, barcode_box_y + 0.65 * cm, certificate_number)

    # --- Encadré QR code ---
    qr_box_h = 5.8 * cm
    qr_box_y = barcode_box_y - 0.5 * cm - qr_box_h

    pdf.setStrokeColor(box_border)
    pdf.setLineWidth(0.9)
    pdf.roundRect(box_x, qr_box_y, box_w, qr_box_h, 8, stroke=1, fill=0)

    try:
        qr_img = _build_qr_image(certificate_number)
        qr_size = 3.9 * cm
        pdf.drawImage(
            qr_img,
            box_x + (box_w - qr_size) / 2,
            qr_box_y + qr_box_h - qr_size - 0.4 * cm,
            width=qr_size,
            height=qr_size,
        )
    except Exception:
        pass

    pdf.setFont("Helvetica-Bold", 9)
    pdf.setFillColor(dark)
    pdf.drawCentredString(box_x + box_w / 2, qr_box_y + 0.55 * cm, "SCANNEZ POUR VÉRIFIER")

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