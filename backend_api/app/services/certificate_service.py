import io
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import code128
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from sqlalchemy.orm import Session

from ..models.therapist_certificate import TherapistCertificate
from ..models.user import User
from ..core.config import settings
from . import certificate_settings as cert_cfg
from .mg_time import to_mg

logger = logging.getLogger(__name__)

# ============================================================
# CHEMIN DU PROJET
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]

CERTIFICATES_DIR = BASE_DIR / "uploads" / "certificates"
CERTIFICATES_DIR.mkdir(parents=True, exist_ok=True)


def resolve_certificate_path(stored_path: Optional[str]) -> Optional[str]:
    """Chemin absolu du PDF, quel que soit le dossier de lancement du serveur
    (en base on stocke un chemin relatif « uploads/certificates/xxx.pdf »)."""
    if not stored_path:
        return None
    p = Path(stored_path)
    if not p.is_absolute():
        p = BASE_DIR / p
    return str(p) if p.is_file() else None


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
# UTILITAIRES DE DESSIN
# ============================================================

# Modèle « certificat_style9 » : A4 paysage, 841.89 x 595.28 pt.
PAGE_W, PAGE_H = landscape(A4)

PANEL_W = 290          # panneau vert à gauche
STRIP_W = 3            # filet doré
RIGHT_X = 330          # début de la colonne de droite
RIGHT_END = PAGE_W - 40
VALUE_X = 480          # colonne des valeurs
VALUE_W = RIGHT_END - VALUE_X

# Couleurs fixes du modèle (le vert / l'or / le fond sont paramétrables)
C_MUTED = "#8A8578"    # libellés, mentions
C_DARK = "#2B2B2B"     # valeurs
C_ROW_LINE = "#E3DCCB" # filets entre les lignes
C_LIGHT_TXT = "#D6E6DC"  # texte clair sur le vert
C_BADGE_BG = "#E1EFE7"
C_QR = "#0D2B7E"


def _t(value: Any) -> str:
    """Texte compatible police Helvetica (WinAnsi) : un caractère non géré
    devient « ? » au lieu de faire échouer toute la génération."""
    return str(value if value is not None else "").encode("cp1252", "replace").decode("cp1252")


def _split_long_word(word: str, font: str, size: float, max_w: float) -> List[str]:
    parts, cur = [], ""
    for ch in word:
        if stringWidth(cur + ch, font, size) <= max_w or not cur:
            cur += ch
        else:
            parts.append(cur)
            cur = ch
    if cur:
        parts.append(cur)
    return parts


def _wrap(text: str, font: str, size: float, max_w: float) -> List[str]:
    """Retour à la ligne glouton ; respecte les « \\n » ; coupe les mots trop longs."""
    lines: List[str] = []
    for paragraph in str(text).split("\n"):
        line = ""
        for word in paragraph.split():
            if stringWidth(word, font, size) > max_w:
                if line:
                    lines.append(line)
                    line = ""
                chunks = _split_long_word(word, font, size, max_w)
                lines.extend(chunks[:-1])
                line = chunks[-1]
                continue
            test = f"{line} {word}".strip()
            if stringWidth(test, font, size) <= max_w:
                line = test
            else:
                lines.append(line)
                line = word
        lines.append(line)
    return lines


def _spaced_width(text: str, font: str, size: float, char_space: float) -> float:
    return stringWidth(text, font, size) + char_space * max(len(text) - 1, 0)


def _text(pdf, x, y, text, font, size, color, char_space=0.0):
    t = pdf.beginText(x, y)
    t.setFont(font, size)
    t.setFillColor(color)
    t.setCharSpace(char_space)
    t.textOut(text)
    pdf.drawText(t)


def _text_centered(pdf, cx, y, text, font, size, color, char_space=0.0):
    w = _spaced_width(text, font, size, char_space)
    _text(pdf, cx - w / 2, y, text, font, size, color, char_space)


def _draw_image_contain(pdf, path, x, y, w, h, align="center", valign="center"):
    """Dessine une image dans la boîte (x, y, w, h) sans la déformer."""
    try:
        img = ImageReader(str(path))
        iw, ih = img.getSize()
        if not iw or not ih:
            return
        scale = min(w / iw, h / ih)
        dw, dh = iw * scale, ih * scale
        dx = x + (w - dw) / 2 if align == "center" else x
        dy = y + (h - dh) / 2 if valign == "center" else y
        pdf.drawImage(img, dx, dy, width=dw, height=dh, mask="auto")
    except Exception:  # noqa: BLE001
        logger.warning("Image du certificat illisible : %s", path)


def _draw_qr(pdf, data: str, x: float, y: float, size: float, color: str):
    """QR code vectoriel (ReportLab) — net à tous les zooms, sans dépendance externe."""
    widget = QrCodeWidget(data)
    widget.barFillColor = HexColor(color)
    widget.barBorder = 2
    x0, y0, x1, y1 = widget.getBounds()
    bw, bh = x1 - x0, y1 - y0
    drawing = Drawing(size, size, transform=[size / bw, 0, 0, size / bh, 0, 0])
    drawing.add(widget)
    renderPDF.draw(drawing, pdf, x, y)


def _verify_url(certificate_number: str) -> str:
    base_url = str(getattr(settings, "BASE_URL", "https://madabienetre.com")).rstrip("/")
    return f"{base_url}/certificates/verify/{certificate_number}"


# ============================================================
# DESSIN DU PDF — IDENTIQUE AU MODÈLE « certificat_style9 »
# ============================================================

def _draw_certificate_pdf(
    path,
    therapist,
    certificate_number: str,
    issued_at: datetime,
    admin_fullname: str,
    specialty: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
):
    """
    Génère le certificat professionnel (A4 paysage) avec EXACTEMENT la mise en
    page du modèle fourni : panneau vert à gauche (logo rond, titre, texte,
    QR code, code-barres), colonne d'informations à droite, badge « THÉRAPEUTE
    VÉRIFIÉ », signatures, mention légale.

    `path` peut être un chemin de fichier ou un buffer (BytesIO).
    Textes, couleurs, logo et signature viennent des paramètres admin.
    """
    cfg = config or cert_cfg.get_config()

    green = HexColor(cfg["color_primary"])
    gold = HexColor(cfg["color_accent"])
    cream = HexColor(cfg["color_background"])
    muted = HexColor(C_MUTED)
    dark = HexColor(C_DARK)
    row_line = HexColor(C_ROW_LINE)
    light_txt = HexColor(C_LIGHT_TXT)
    white = HexColor("#FFFFFF")

    if isinstance(path, (str, Path)):
        os.makedirs(os.path.dirname(str(path)), exist_ok=True)

    fullname = _t(getattr(therapist, "fullname", None) or "N/A")
    admin_name = _t(admin_fullname or "Administration Mada Bien-être")

    pdf = canvas.Canvas(path, pagesize=(PAGE_W, PAGE_H))
    pdf.setTitle(f"Certificat professionnel de thérapeute - {certificate_number}")
    pdf.setAuthor("Zebutech")
    pdf.setSubject("Certificat professionnel de thérapeute")

    # --------------------------------------------------------
    # FONDS
    # --------------------------------------------------------
    pdf.setFillColor(cream)
    pdf.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    pdf.setFillColor(green)
    pdf.rect(0, 0, PANEL_W, PAGE_H, stroke=0, fill=1)
    pdf.setFillColor(gold)
    pdf.rect(PANEL_W, 0, STRIP_W, PAGE_H, stroke=0, fill=1)

    # --------------------------------------------------------
    # LOGO ROND (centre 72, 523.28, rayon 36)
    # --------------------------------------------------------
    cx, cy = 72, PAGE_H - 72
    pdf.setFillColor(white)
    pdf.circle(cx, cy, 36, stroke=0, fill=1)
    logo = cert_cfg.image_path("logo", cfg)
    if logo:
        _draw_image_contain(pdf, logo, cx - 29.16, cy - 29.16, 58.32, 58.32)

    # Nom de la plateforme + slogan
    _text(pdf, 124, PAGE_H - 66, _t(cfg["platform_name"]), "Helvetica", 13, white)
    ty = PAGE_H - 80
    for line in _wrap(_t(cfg["platform_tagline"]), "Helvetica", 8, 130)[:3]:
        _text(pdf, 124, ty, line, "Helvetica", 8, light_txt)
        ty -= 10.5

    # --------------------------------------------------------
    # TITRE (34 pt) + filet doré + texte d'introduction
    # --------------------------------------------------------
    y = 423.2756
    title_lines = _wrap(_t(cfg["title"]), "Helvetica", 34, 218)[:4]
    for line in title_lines:
        _text(pdf, 36, y, line, "Helvetica", 34, white)
        y += -38
    y += 38                      # retour sur la dernière ligne du titre
    bar_y = y - 16
    pdf.setStrokeColor(gold)
    pdf.setLineWidth(1.8)
    pdf.line(36, bar_y, 76, bar_y)

    # Intro : taille réduite si le texte est long (pour ne pas toucher le QR code)
    intro = _t(cfg["intro_text"])
    for size in (9, 8.5, 8, 7.5, 7, 6.5):
        lines = _wrap(intro, "Helvetica", size, 218)
        lead = size * 1.3889       # 9 pt -> interligne 12.5 (modèle)
        last_y = bar_y - 22 - lead * (len(lines) - 1)
        if last_y >= 252:
            break
    iy = bar_y - 22
    for line in lines:
        _text(pdf, 36, iy, line, "Helvetica", size, light_txt)
        iy -= lead

    # --------------------------------------------------------
    # CARTE QR CODE (77..213 x 100..240)
    # --------------------------------------------------------
    pdf.setFillColor(white)
    pdf.roundRect(77, 100, 136, 140, 10, stroke=0, fill=1)
    _draw_qr(pdf, _verify_url(certificate_number), 93, 124, 104, C_QR)
    _text_centered(pdf, 145, 112, "SCANNEZ POUR VÉRIFIER", "Helvetica", 6.5, muted, 0.4)

    # --------------------------------------------------------
    # CARTE CODE-BARRES (77..213 x 30..90)
    # --------------------------------------------------------
    pdf.setFillColor(white)
    pdf.roundRect(77, 30, 136, 60, 10, stroke=0, fill=1)
    try:
        bc = code128.Code128(
            certificate_number, barHeight=26, barWidth=0.367491, lquiet=18, rquiet=18
        )
        scale = min(1.0, 112 / bc.width) if bc.width else 1.0
        pdf.saveState()
        pdf.translate(145 - bc.width * scale / 2, 52)
        pdf.scale(scale, 1)
        pdf.setFillColor(dark)
        pdf.setStrokeColor(dark)
        bc.drawOn(pdf, 0, 0)
        pdf.restoreState()
    except Exception:  # noqa: BLE001
        logger.warning("Code-barres du certificat impossible pour %s", certificate_number)
    _text_centered(pdf, 145, 40, certificate_number, "Helvetica", 7, muted)

    # --------------------------------------------------------
    # EN-TÊTE DE DROITE
    # --------------------------------------------------------
    _text(pdf, RIGHT_X, PAGE_H - 46, "CERTIFICAT", "Helvetica", 17, green, 3)
    _text(pdf, RIGHT_X, PAGE_H - 72, f"N° {certificate_number}", "Helvetica", 10.5, dark)
    issued_mg = to_mg(issued_at) or issued_at
    _text(pdf, RIGHT_X, PAGE_H - 90, f"Validé le {issued_mg.strftime('%d/%m/%Y')}", "Helvetica", 10.5, muted)

    top_line = PAGE_H - 112
    pdf.setStrokeColor(dark)
    pdf.setLineWidth(1.2)
    pdf.line(RIGHT_X, top_line, RIGHT_END, top_line)

    # --------------------------------------------------------
    # TABLEAU D'INFORMATIONS
    # --------------------------------------------------------
    rows = [
        ("N° UTILISATEUR", str(getattr(therapist, "id", None) or "N/A"), dark),
        ("NOM ET PRÉNOM", fullname, dark),
        ("EMAIL", _t(getattr(therapist, "email", None) or "N/A"), dark),
        ("TÉLÉPHONE", _t(getattr(therapist, "phone", None) or "N/A"), dark),
        ("NUMÉRO CIN", _t(getattr(therapist, "cin_number", None) or "Non renseigné"), dark),
        ("ADRESSE", _t(getattr(therapist, "address", None) or "N/A"), dark),
        ("SPÉCIALITÉ(S)", _t(specialty or "Massage à domicile"), dark),
        ("VALIDÉ PAR (ADMIN)", admin_name, green),
    ]

    # Taille de police adaptée : le tableau ne doit pas descendre sur le badge
    # ni sur les signatures, même avec une adresse / une liste de spécialités longue.
    MIN_LAST_SEP = 188.0
    chosen = None
    for font_size in (12, 11, 10.5, 10, 9.5, 9, 8.5, 8):
        lead = font_size * 14.5 / 12
        wrapped = [_wrap(v, "Helvetica", font_size, VALUE_W) for _, v, _ in rows]
        yy = top_line
        for lines in wrapped:
            yy -= 20 + lead * (len(lines) - 1) + 10
        chosen = (font_size, lead, wrapped)
        if yy >= MIN_LAST_SEP:
            break
    font_size, lead, wrapped = chosen

    y = top_line
    last_sep = top_line
    for i, ((label, _value, vcolor), lines) in enumerate(zip(rows, wrapped)):
        base = y - 20
        _text(pdf, RIGHT_X, base, label, "Helvetica", 7.5, muted, 0.8)
        for k, line in enumerate(lines):
            _text(pdf, VALUE_X, base - k * lead, line, "Helvetica", font_size, vcolor)
        sep = base - lead * (len(lines) - 1) - 10
        is_last = i == len(rows) - 1
        pdf.setStrokeColor(dark if is_last else row_line)
        pdf.setLineWidth(0.6)
        pdf.line(RIGHT_X, sep, RIGHT_END, sep)
        y = sep
        last_sep = sep

    # --------------------------------------------------------
    # BADGE « THÉRAPEUTE VÉRIFIÉ »
    # --------------------------------------------------------
    badge_text = _t(cfg["badge_text"])
    badge_w = max(170, _spaced_width(badge_text, "Helvetica", 9, 1) + 56)
    badge_top = last_sep - 21
    pdf.setFillColor(HexColor(C_BADGE_BG))
    pdf.setStrokeColor(cream)
    pdf.setLineWidth(2)
    pdf.roundRect(RIGHT_X, badge_top - 20, badge_w, 20, 10, stroke=1, fill=1)
    _text_centered(pdf, RIGHT_X + badge_w / 2, badge_top - 13.2, badge_text, "Helvetica", 9, green, 1)

    # --------------------------------------------------------
    # SIGNATURES
    # --------------------------------------------------------
    sig_y = 88
    pdf.setStrokeColor(muted)
    pdf.setLineWidth(0.8)
    pdf.line(330, sig_y, 520, sig_y)
    pdf.line(610, sig_y, 800, sig_y)

    # Signature / cachet de l'administrateur (au-dessus du trait de droite)
    signature = cert_cfg.image_path("signature", cfg)
    if signature:
        _draw_image_contain(pdf, signature, 642.5, sig_y + 2, 125, 58, valign="bottom")

    _text_centered(pdf, 425, 76, _t(f"( {fullname} )"), "Helvetica-Oblique", 9, muted)
    _text_centered(pdf, 705, 76, _t(f"( {admin_name} )"), "Helvetica-Oblique", 9, muted)
    _text_centered(pdf, 425, 62, _t(cfg["therapist_signature_label"]), "Helvetica", 8, gold, 1)
    _text_centered(pdf, 705, 62, _t(cfg["admin_signature_label"]), "Helvetica", 8, gold, 1)

    # --------------------------------------------------------
    # MENTION LÉGALE (pied de page)
    # --------------------------------------------------------
    ly = 40
    legal_lines: List[str] = []
    for paragraph in _t(cfg["legal_text"]).split("\n"):
        legal_lines.extend(_wrap(paragraph, "Helvetica", 7, RIGHT_END - RIGHT_X))
    for line in legal_lines[:4]:
        _text(pdf, RIGHT_X, ly, line, "Helvetica", 7, muted)
        ly -= 9

    pdf.showPage()
    pdf.save()


def build_demo_certificate_pdf(config: Optional[Dict[str, Any]] = None) -> bytes:
    """Aperçu : certificat factice généré avec les paramètres courants (ou fournis)."""

    class _Demo:
        id = 0
        fullname = "RASOANANDRASANA Marie Céléstine"
        email = "exemple@madabienetre.mg"
        phone = "0386470015"
        cin_number = None
        address = "Lot II M 45 Bis Ambohimanarina, près de l'école publique, Antananarivo 101, Madagascar"

    buf = io.BytesIO()
    _draw_certificate_pdf(
        buf,
        _Demo(),
        "MBE-TH-APERCU-000000",
        datetime.utcnow(),
        "Administrateur",
        specialty=(
            "Massage à domicile, massage californien, massage suédois, "
            "massage relaxant, massage sportif et réflexologie plantaire"
        ),
        config=config,
    )
    return buf.getvalue()


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
# FICHIER PDF INTROUVABLE => RÉGÉNÉRATION AUTOMATIQUE
# ============================================================

def ensure_certificate_pdf(certificate: TherapistCertificate, db: Session) -> Optional[str]:
    """
    Retourne le chemin absolu du PDF du certificat. Si le fichier a disparu du
    disque (hébergement à disque éphémère, déploiement, nettoyage...), il est
    régénéré à l'identique : même numéro, même date, même validateur.
    """
    path = resolve_certificate_path(certificate.certificate_path)
    if path:
        return path

    therapist = certificate.therapist
    if therapist is None:
        return None

    specialty_str = None
    try:
        from ..models.massage import MassageType
        from ..models.therapist import TherapistSpecialty

        rows = (
            db.query(MassageType.name)
            .join(TherapistSpecialty, TherapistSpecialty.massage_type_id == MassageType.id)
            .filter(TherapistSpecialty.therapist_id == therapist.id)
            .all()
        )
        names = [n for (n,) in rows]
        specialty_str = ", ".join(names) if names else None
    except Exception:  # noqa: BLE001
        logger.exception("Spécialités introuvables pour la régénération du certificat")

    full_path = CERTIFICATES_DIR / f"{certificate.certificate_number}.pdf"
    admin_name = certificate.verifier.fullname if certificate.verifier else None
    try:
        _draw_certificate_pdf(
            path=str(full_path),
            therapist=therapist,
            certificate_number=certificate.certificate_number,
            issued_at=certificate.issued_at,
            admin_fullname=admin_name,
            specialty=specialty_str,
        )
    except Exception:  # noqa: BLE001
        logger.exception("Régénération du certificat %s impossible", certificate.certificate_number)
        return None
    return str(full_path)


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
