# app/services/receipt_service.py
"""
Reçus PDF de Mada Bien-Être : paiement client, retrait thérapeute, commission.

Mise en page : A5, fond crème, bandeau vert, filets fins, QR code de
vérification + code-barres Code128 en bas. Une seule graisse de police
(Helvetica normale) : la hiérarchie vient de la taille et de la couleur,
jamais du gras.

Dépendances : reportlab (obligatoire), qrcode + pillow (QR en PNG pour l'app).
"""
import os
from datetime import datetime
from decimal import Decimal
from io import BytesIO
from typing import Any, Dict, List, Optional, Sequence, Tuple

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import code128
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from ..core.config import settings
from ..utils.date_utils import fmt_mada, iso_utc
from . import platform_settings

# ----------------------------- thème ---------------------------------------
GREEN = HexColor("#1F6B45")
GREEN_DARK = HexColor("#154A31")
GOLD = HexColor("#B8924A")
CREAM = HexColor("#FBF8F1")
INK = HexColor("#2B2B2B")
MUTED = HexColor("#8A8578")
LINE = HexColor("#E7E1D3")
OK_BG = HexColor("#E3F1E8")
WARN_BG = HexColor("#FBEFD5")
WARN = HexColor("#9A6A12")

FONT = "Helvetica"  # une seule graisse : pas de gras
PAGE_W, PAGE_H = 148 * mm, 210 * mm  # A5

LOGO_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "assets", "logo", "logo.png"
)

METHOD_LABELS = {
    "mvola": "MVola",
    "orange_money": "Orange Money",
    "airtel_money": "Airtel Money",
    "stripe": "Carte bancaire (Stripe)",
    "vanila_pay": "Vanila Pay",
}

Row = Tuple[str, str]
Section = Tuple[str, Sequence[Row]]


def ar(value: Any) -> str:
    try:
        n = int(Decimal(str(value or 0)).quantize(Decimal("1")))
    except Exception:  # noqa: BLE001
        n = 0
    return f"{n:,}".replace(",", " ") + " Ar"


def fmt_dt(value: Optional[datetime], convert: bool = True) -> str:
    """Date + heure.  convert=True : `value` est en UTC (base de données) -> HEURE DE MADAGASCAR (UTC+3).
    convert=False : `value` est déjà une heure locale (ex. date de séance saisie dans l'app)."""
    if not value:
        return "—"
    return fmt_mada(value) if convert else value.strftime("%d/%m/%Y à %H:%M")


def method_label(method: Optional[str], provider: Optional[str] = None) -> str:
    if provider and provider in METHOD_LABELS:
        return METHOD_LABELS[provider]
    return {
        "cash": "Espèces",
        "card": "Carte bancaire",
        "mobile_money": "Mobile Money",
        "vanila_pay": "Vanila Pay",
        "bank_transfer": "Virement bancaire",
        "wallet": "Solde du wallet",
    }.get(method or "", method or "—")


def verification_url(kind: str, ref: str) -> str:
    base = settings.BASE_URL.rstrip("/")
    if kind == "payment":
        return f"{base}/payments/receipt/verify/{ref}"
    return f"{base}/wallet/receipt/verify/{ref}"


def qr_png(data: str, box_size: int = 8) -> Optional[bytes]:
    """QR en PNG (pour l'affichage dans l'application). None si la lib manque."""
    try:
        import qrcode

        img = qrcode.QRCode(box_size=box_size, border=2)
        img.add_data(data)
        img.make(fit=True)
        buf = BytesIO()
        img.make_image(fill_color="#154A31", back_color="white").save(buf, format="PNG")
        return buf.getvalue()
    except Exception:  # noqa: BLE001
        return None


def _fit(c: canvas.Canvas, text: str, size: float, max_w: float) -> str:
    text = str(text)
    while c.stringWidth(text, FONT, size) > max_w and len(text) > 4:
        text = text[:-2]
    return text if c.stringWidth(text, FONT, size) <= max_w else text[:-1] + "…"


def build_document_pdf(
    *,
    doc_title: str,
    receipt_no: str,
    status_label: str,
    status_ok: bool,
    amount: Any,
    amount_caption: str,
    sections: Sequence[Section],
    qr_data: str,
    barcode_data: str,
    issued_at: Optional[datetime] = None,
) -> bytes:
    cfg = platform_settings.get_config()
    company = cfg.get("company_name") or "Mada Bien-Être"
    # hauteur dynamique : la page s'allonge si le contenu est long (rien ne se chevauche)
    row_h = 5.7 * mm
    content_h = 0.0
    for _h, _rows in sections:
        n = len([1 for _k, v in _rows if v not in (None, "")])
        if n:
            content_h += 6.2 * mm + n * row_h + 3 * mm
    H = max(PAGE_H, (34 + 10 + 24 + 11) * mm + content_h + 62 * mm)
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=(PAGE_W, H))
    c.setTitle(f"{doc_title} {receipt_no}")
    c.setAuthor(company)

    m = 12 * mm
    inner = PAGE_W - 2 * m

    # fond
    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE_W, H, stroke=0, fill=1)

    # bandeau
    head_h = 34 * mm
    c.setFillColor(GREEN)
    c.rect(0, H - head_h, PAGE_W, head_h, stroke=0, fill=1)
    c.setFillColor(GOLD)
    c.rect(0, H - head_h - 1.2 * mm, PAGE_W, 1.2 * mm, stroke=0, fill=1)

    text_x = m
    if os.path.exists(LOGO_PATH):
        try:
            c.setFillColor(white)
            c.circle(m + 8 * mm, H - 17 * mm, 9 * mm, stroke=0, fill=1)
            c.drawImage(
                LOGO_PATH, m + 1.5 * mm, H - 23.5 * mm, 13 * mm, 13 * mm,
                preserveAspectRatio=True, mask="auto",
            )
            text_x = m + 21 * mm
        except Exception:  # noqa: BLE001
            text_x = m
    c.setFillColor(white)
    c.setFont(FONT, 16)
    c.drawString(text_x, H - 14 * mm, company)
    c.setFont(FONT, 8)
    c.setFillColor(HexColor("#CFE5D8"))
    c.drawString(text_x, H - 19.5 * mm, "Bien-être et massages à domicile")
    c.setFont(FONT, 9)
    c.setFillColor(white)
    c.drawRightString(PAGE_W - m, H - 13 * mm, doc_title.upper())
    c.setFont(FONT, 8)
    c.setFillColor(HexColor("#CFE5D8"))
    c.drawRightString(PAGE_W - m, H - 18.5 * mm, f"N° {receipt_no}")
    c.drawRightString(PAGE_W - m, H - 23.5 * mm, f"Émis le {fmt_dt(issued_at or datetime.utcnow())} (heure de Madagascar)")

    # statut + montant
    y = H - head_h - 10 * mm
    box_h = 24 * mm
    c.setFillColor(white)
    c.setStrokeColor(LINE)
    c.roundRect(m, y - box_h, inner, box_h, 3 * mm, stroke=1, fill=1)
    c.setFillColor(MUTED)
    c.setFont(FONT, 7.5)
    c.drawCentredString(PAGE_W / 2, y - 6 * mm, amount_caption.upper())
    c.setFillColor(GREEN_DARK)
    c.setFont(FONT, 22)
    c.drawCentredString(PAGE_W / 2, y - 15 * mm, ar(amount))

    pill_w = 26 * mm
    c.setFillColor(OK_BG if status_ok else WARN_BG)
    c.roundRect(PAGE_W / 2 - pill_w / 2, y - box_h - 3.2 * mm, pill_w, 6.4 * mm, 3.2 * mm, stroke=0, fill=1)
    c.setFillColor(GREEN if status_ok else WARN)
    c.setFont(FONT, 7.5)
    c.drawCentredString(PAGE_W / 2, y - box_h - 1 * mm, status_label.upper())

    # sections
    y = y - box_h - 11 * mm
    for heading, rows in sections:
        rows = [(k, v) for k, v in rows if v not in (None, "")]
        if not rows:
            continue
        c.setFillColor(GOLD)
        c.setFont(FONT, 7.5)
        c.drawString(m, y, heading.upper())
        c.setStrokeColor(GOLD)
        c.setLineWidth(0.4)
        c.line(m, y - 1.6 * mm, m + inner, y - 1.6 * mm)
        y -= 6.2 * mm
        for label, value in rows:
            c.setFillColor(MUTED)
            c.setFont(FONT, 8)
            c.drawString(m, y, label)
            c.setFillColor(INK)
            c.setFont(FONT, 8.5)
            c.drawRightString(m + inner, y, _fit(c, value, 8.5, inner * 0.62))
            c.setStrokeColor(LINE)
            c.setLineWidth(0.3)
            c.line(m, y - 1.8 * mm, m + inner, y - 1.8 * mm)
            y -= row_h
        y -= 3 * mm

    # QR + code-barres (ancrés en bas)
    qr_size = 27 * mm
    qr_y = 24 * mm
    qr = QrCodeWidget(qr_data)
    x1, y1, x2, y2 = qr.getBounds()
    d = Drawing(qr_size, qr_size, transform=[qr_size / (x2 - x1), 0, 0, qr_size / (y2 - y1), 0, 0])
    d.add(qr)
    c.setFillColor(white)
    c.setStrokeColor(LINE)
    c.roundRect(m, qr_y - 2 * mm, qr_size + 4 * mm, qr_size + 4 * mm, 2 * mm, stroke=1, fill=1)
    renderPDF.draw(d, c, m + 2 * mm, qr_y)

    tx = m + qr_size + 9 * mm
    c.setFillColor(INK)
    c.setFont(FONT, 8.5)
    c.drawString(tx, qr_y + qr_size - 3 * mm, "Vérifiez ce document")
    c.setFillColor(MUTED)
    c.setFont(FONT, 7.5)
    c.drawString(tx, qr_y + qr_size - 8 * mm, "Scannez le QR code pour contrôler")
    c.drawString(tx, qr_y + qr_size - 12 * mm, "son authenticité en ligne.")
    c.setFont(FONT, 7)
    c.drawString(tx, qr_y + 2 * mm, _fit(c, f"Réf. {barcode_data}", 7, PAGE_W - tx - m))

    bar = code128.Code128(barcode_data, barHeight=10 * mm, barWidth=0.36, quiet=False)
    bar_x = max(m, (PAGE_W - bar.width) / 2)
    bar.drawOn(c, bar_x, 10.5 * mm)
    c.setFillColor(MUTED)
    c.setFont(FONT, 6.5)
    c.drawCentredString(PAGE_W / 2, 7 * mm, barcode_data)

    footer = cfg.get("receipt_footer") or ""
    contact = " · ".join(x for x in (cfg.get("company_phone"), cfg.get("company_email")) if x)
    c.setFont(FONT, 6.5)
    c.drawCentredString(PAGE_W / 2, 3.5 * mm, _fit(c, f"{footer}  {contact}".strip(), 6.5, inner))

    c.showPage()
    c.save()
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Images (affichage dans l'application) : QR code et code-barres Code128 en PNG
# ---------------------------------------------------------------------------
def barcode_png(data: str, module: int = 3, height: int = 110) -> Optional[bytes]:
    """Code-barres Code128 en PNG (noir sur blanc, zone de silence incluse)."""
    try:
        from PIL import Image, ImageDraw

        bar = code128.Code128(str(data), barWidth=1, quiet=False)
        bar.validate()
        bar.encode()
        bar.decompose()
        # reportlab : MAJUSCULE = barre, minuscule = espace ; A=1, B=2, C=3, D=4 modules
        symbols = [(ch.isupper(), ord(ch.upper()) - 64) for ch in bar.decomposed]
        quiet = 10 * module
        total = sum(w for _b, w in symbols) * module + 2 * quiet
        img = Image.new("RGB", (total, height), "white")
        draw = ImageDraw.Draw(img)
        x = quiet
        for is_bar, w in symbols:
            if is_bar:
                draw.rectangle([x, 0, x + w * module - 1, height], fill="#154A31")
            x += w * module
        buf = BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except Exception:  # noqa: BLE001
        return None


# ---------------------------------------------------------------------------
# Documents : un seul « modèle » sert au PDF ET à l'écran de l'application
# ---------------------------------------------------------------------------
def payment_doc(ctx: Dict[str, Any], view: str) -> Dict[str, Any]:
    """ctx : voir payments._receipt_context().  view = client | therapist | admin"""
    sections: List[Section] = [
        (
            "Paiement",
            [
                ("Payé le (heure de Madagascar)", ctx["paid_at_label"]),
                ("Paiement initié le", ctx.get("created_at_label")),
                ("Mode de paiement", ctx["method_label"]),
                ("Numéro payeur", ctx.get("payer_phone")),
                ("Transaction", ctx["transaction_id"]),
                ("Statut", ctx["status_label"]),
            ],
        ),
        (
            "Réservation",
            [
                ("Réservation", f"#{ctx['booking_id']}"),
                ("Service", ctx["service_name"]),
                ("Séance prévue", ctx.get("scheduled_label")),
                ("Client", ctx["client_name"]),
                ("Thérapeute", ctx["therapist_name"]),
            ],
        ),
    ]
    if view in ("therapist", "admin") and ctx.get("commission_amount") is not None:
        sections.append(
            (
                "Répartition",
                [
                    (f"Commission plateforme ({ctx.get('commission_rate')} %)", ar(ctx["commission_amount"])),
                    ("Net thérapeute", ar(ctx["net_amount"])),
                    ("Règlement", "Espèces remises au thérapeute" if ctx.get("settlement") == "cash_in_hand" else "Crédité au wallet"),
                ],
            )
        )
    return {
        "kind": "payment",
        "doc_title": "Reçu de paiement",
        "receipt_no": ctx["receipt_no"],
        "status_label": ctx["status_label"],
        "status_ok": ctx["status"] == "completed",
        "amount": ctx["amount"],
        "amount_caption": "Montant payé",
        "sections": sections,
        "verify_url": verification_url("payment", ctx["transaction_id"]),
        "barcode_data": ctx["transaction_id"],
        "issued_at": ctx.get("paid_at"),
    }


def withdrawal_doc(w: Any, therapist_name: str, therapist_phone: str = "") -> Dict[str, Any]:
    done = w.status == "completed"
    dest = (
        f"{method_label(w.provider or 'mobile_money')} · {w.phone_number}"
        if w.method == "mobile_money"
        else (f"{w.bank_name} · {w.account_number}" if w.method == "bank_transfer" else "Remise en main propre")
    )
    transfer_ref = ""
    if w.notes and "réf." in w.notes:
        transfer_ref = w.notes.split("réf.")[-1].strip().split("\n")[0]
    sections: List[Section] = [
        (
            "Retrait",
            [
                ("Demandé le", fmt_dt(w.created_at)),
                ("Accepté le", fmt_dt(w.processed_at) if getattr(w, "processed_at", None) else None),
                ("Payé le", fmt_dt(w.completed_at)),
                ("Mode de retrait", method_label(w.method, None)),
                ("Destination", dest),
                ("Titulaire", w.account_holder),
                ("Référence du transfert", transfer_ref),
                ("Statut", "Payé" if done else str(w.status)),
            ],
        ),
        (
            "Montants",
            [
                ("Montant demandé", ar(w.amount)),
                ("Frais de retrait", ar(w.fee or 0)),
                ("Montant versé", ar(w.net_amount)),
            ],
        ),
        ("Bénéficiaire", [("Thérapeute", therapist_name), ("Téléphone", therapist_phone)]),
    ]
    ref = w.reference or f"WD-{w.id}"
    return {
        "kind": "withdrawal",
        "doc_title": "Reçu de retrait",
        "receipt_no": ref,
        "status_label": "Payé" if done else str(w.status),
        "status_ok": done,
        "amount": w.net_amount,
        "amount_caption": "Montant versé",
        "sections": sections,
        "verify_url": verification_url("wallet", ref),
        "barcode_data": ref,
        "issued_at": w.completed_at or w.created_at,
    }


def commission_doc(cp: Any, therapist_name: str) -> Dict[str, Any]:
    done = cp.status == "completed"
    sections: List[Section] = [
        (
            "Paiement de commission",
            [
                ("Soumis le", fmt_dt(cp.created_at)),
                ("Validé le", fmt_dt(cp.completed_at) if cp.completed_at else None),
                ("Mode", method_label(cp.method, cp.provider)),
                ("Numéro", cp.phone_number),
                ("Référence du transfert", cp.transfer_reference),
                ("Statut", "Validé" if done else ("Refusé" if cp.status == "rejected" else "En attente")),
            ],
        ),
        ("Thérapeute", [("Nom", therapist_name)]),
    ]
    ref = cp.reference or f"CM-{cp.id}"
    return {
        "kind": "commission",
        "doc_title": "Reçu de commission",
        "receipt_no": ref,
        "status_label": "Validé" if done else "En attente",
        "status_ok": done,
        "amount": cp.amount,
        "amount_caption": "Commission réglée",
        "sections": sections,
        "verify_url": verification_url("wallet", ref),
        "barcode_data": ref,
        "issued_at": cp.completed_at or cp.created_at,
    }


def render_doc(doc: Dict[str, Any]) -> bytes:
    return build_document_pdf(
        doc_title=doc["doc_title"],
        receipt_no=doc["receipt_no"],
        status_label=doc["status_label"],
        status_ok=doc["status_ok"],
        amount=doc["amount"],
        amount_caption=doc["amount_caption"],
        sections=doc["sections"],
        qr_data=doc["verify_url"],
        barcode_data=doc["barcode_data"],
        issued_at=doc.get("issued_at"),
    )


def doc_json(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Version JSON pour l'écran « Reçu » de l'application."""
    cfg = platform_settings.get_config()
    return {
        "kind": doc["kind"],
        "company": cfg.get("company_name") or "Mada Bien-Être",
        "doc_title": doc["doc_title"],
        "receipt_no": doc["receipt_no"],
        "status_label": doc["status_label"],
        "status_ok": doc["status_ok"],
        "amount": float(doc["amount"] or 0),
        "amount_caption": doc["amount_caption"],
        "sections": [
            {"title": t, "rows": [[k, v] for k, v in rows if v not in (None, "")]} for t, rows in doc["sections"]
        ],
        "barcode_data": doc["barcode_data"],
        "verify_url": doc["verify_url"],
        "issued_at": iso_utc(doc.get("issued_at")),
        "issued_at_label": fmt_dt(doc.get("issued_at")) if doc.get("issued_at") else None,
        "footer": cfg.get("receipt_footer") or "",
    }


# Compatibilité
def payment_receipt_pdf(ctx: Dict[str, Any], view: str) -> bytes:
    return render_doc(payment_doc(ctx, view))


def withdrawal_receipt_pdf(w: Any, therapist_name: str, therapist_phone: str = "") -> bytes:
    return render_doc(withdrawal_doc(w, therapist_name, therapist_phone))


def commission_receipt_pdf(cp: Any, therapist_name: str) -> bytes:
    return render_doc(commission_doc(cp, therapist_name))
