# app/api/payments.py
"""
Paiements — flux complet :

 1. Client : réservation CONFIRMÉE par le thérapeute  -> peut payer
 2. POST /payments/initiate  (MVola / Orange / Airtel / carte / espèces)
 3. Le BACKEND interroge le fournisseur (POST /payments/{id}/verify) ou reçoit
    un webhook signé. Jamais de « j'ai payé » déclaratif.
 4. Paiement confirmé -> commission + net thérapeute -> wallet (wallet_service)
 5. Reçu PDF (QR + code-barres) : GET /payments/{id}/receipt.pdf
"""
import json
import logging
import re
import time
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.database import get_db
from ..core.dependencies import get_current_admin, get_current_user
from ..models.booking import Booking
from ..models.payment import Payment
from ..models.user import User
from ..services import payment_gateway as gateway
from ..services import platform_settings, receipt_links, receipt_service
from ..services import wallet_service as wallet
from ..services.payment_gateway import GatewayError
from ..services.wallet_service import WalletError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])

PAYABLE_BOOKING_STATUSES = ("confirmed", "in_progress", "completed")

# Préfixes Mobile Money malgaches par opérateur
OPERATOR_PREFIXES = {
    "mvola": ("034", "038"),
    "orange_money": ("032", "037"),
    "airtel_money": ("033",),
}


# ---------------------------------------------------------------------------
# Schémas
# ---------------------------------------------------------------------------
class InitiatePaymentRequest(BaseModel):
    booking_id: int = Field(..., gt=0)
    method: str = Field(..., pattern="^(mobile_money|card|cash)$")
    provider: Optional[str] = Field(None, pattern="^(mvola|orange_money|airtel_money)$")
    phone: Optional[str] = None


class RefundRequest(BaseModel):
    payment_id: int
    reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _role(user: User) -> str:
    return str(getattr(user, "role", "") or "").upper()


def _booking_amount(booking: Booking) -> float:
    for value in (booking.final_price, booking.therapist_initial_price, booking.client_price_proposed):
        if value is not None and float(value) > 0:
            return float(value)
    return 0.0


def _normalize_phone(phone: Optional[str]) -> str:
    digits = re.sub(r"[^0-9+]", "", phone or "")
    if digits.startswith("+261"):
        digits = "0" + digits[4:]
    elif digits.startswith("261") and len(digits) == 12:
        digits = "0" + digits[3:]
    return digits


def _can_access(user: User, payment: Payment, booking: Optional[Booking]) -> bool:
    if _role(user) == "ADMIN":
        return True
    if payment.user_id == user.id:
        return True
    return bool(booking and booking.therapist_id == user.id)


STATUS_LABELS = {
    "pending": "En attente",
    "processing": "En cours",
    "completed": "Payé",
    "failed": "Échoué",
    "cancelled": "Annulé",
    "refunded": "Remboursé",
}


def _ui_state(status: Optional[str]) -> str:
    """paid | pending | refunded : ce que l'écran doit afficher."""
    if status == "completed":
        return "paid"
    if status == "refunded":
        return "refunded"
    return "pending"


def _serialize(payment: Payment, include_split: bool = False) -> Dict[str, Any]:
    meta = payment.payment_metadata or {}
    data = {
        "id": payment.id,
        "booking_id": payment.booking_id,
        "user_id": payment.user_id,
        "amount": float(payment.amount or 0),
        "currency": payment.currency,
        "method": payment.method,
        "provider": payment.provider,
        "method_label": receipt_service.method_label(payment.method, payment.provider),
        "status": payment.status,
        "status_label": STATUS_LABELS.get(payment.status, payment.status),
        "ui_state": _ui_state(payment.status),
        "payment_status": payment.status,
        "transaction_id": payment.transaction_id,
        "payment_method": payment.provider or payment.method,
        "payer_name": payment.payer_name,
        "payer_phone": payment.payer_phone,
        "receipt_no": f"MBE-{payment.id:06d}",
        "created_at": payment.created_at.isoformat() if payment.created_at else None,
        "completed_at": payment.completed_at.isoformat() if payment.completed_at else None,
        "paid_at": payment.completed_at.isoformat() if payment.completed_at else None,
        "receipt_available": payment.status == "completed",
    }
    if include_split:
        data.update(
            {
                "commission_rate": meta.get("commission_rate"),
                "commission_amount": meta.get("commission_amount", 0),
                "net_amount": meta.get("net_amount", 0),
                "settlement": meta.get("settlement"),
            }
        )
    return data


def _viewer_view(user: User, requested: Optional[str]) -> str:
    """Quelle version du reçu ? client (sans commission) | therapist | admin."""
    role = _role(user)
    if role == "ADMIN":
        return requested if requested in ("client", "therapist") else "admin"
    return "therapist" if role == "THERAPIST" else "client"


def _receipt_context(db: Session, payment: Payment) -> Dict[str, Any]:
    booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
    client = db.query(User).filter(User.id == payment.user_id).first()
    therapist = (
        db.query(User).filter(User.id == booking.therapist_id).first()
        if booking and booking.therapist_id
        else None
    )
    service = ""
    if booking and booking.massage_type is not None:
        service = getattr(booking.massage_type, "name", "") or ""
    meta = payment.payment_metadata or {}
    paid_at = payment.completed_at or payment.created_at
    scheduled = getattr(booking, "scheduled_date", None)
    return {
        "payment_id": payment.id,
        "receipt_no": f"MBE-{payment.id:06d}",
        "transaction_id": payment.transaction_id or f"PAY-{payment.id}",
        "status": payment.status,
        "status_label": STATUS_LABELS.get(payment.status, payment.status),
        "amount": float(payment.amount or 0),
        "currency": payment.currency or "MGA",
        "method": payment.method,
        "provider": payment.provider,
        "method_label": receipt_service.method_label(payment.method, payment.provider),
        "payer_name": payment.payer_name or getattr(client, "fullname", None),
        "payer_phone": payment.payer_phone,
        "paid_at": paid_at,
        "paid_at_label": receipt_service.fmt_dt(paid_at),
        "booking_id": payment.booking_id,
        "service_name": service or "Massage",
        "scheduled_label": receipt_service.fmt_dt(scheduled) if scheduled else None,
        "client_name": getattr(client, "fullname", "") or "—",
        "therapist_name": getattr(therapist, "fullname", "") or "—",
        "commission_rate": meta.get("commission_rate"),
        "commission_amount": meta.get("commission_amount"),
        "net_amount": meta.get("net_amount"),
        "settlement": meta.get("settlement"),
    }


def _apply_gateway_status(db: Session, payment: Payment, status: str) -> Payment:
    if status == "completed":
        payment, _ = wallet.finalize_payment(db, payment.id)
    elif status in ("failed", "cancelled"):
        payment = wallet.mark_payment_failed(db, payment, status)
    return payment


# ---------------------------------------------------------------------------
# Moyens de paiement + devis
# ---------------------------------------------------------------------------
@router.get("/methods")
async def get_payment_methods(current_user: User = Depends(get_current_user)):
    return gateway.available_methods()


@router.get("/quote/{booking_id}")
async def quote(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Prix à payer + peut-on payer maintenant ?"""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Réservation introuvable.")
    if booking.client_id != current_user.id and _role(current_user) != "ADMIN":
        raise HTTPException(403, "Cette réservation ne vous appartient pas.")

    paid = (
        db.query(Payment)
        .filter(Payment.booking_id == booking.id, Payment.status == "completed")
        .first()
    )
    latest = (
        db.query(Payment)
        .filter(Payment.booking_id == booking.id)
        .order_by(Payment.id.desc())
        .first()
    )
    can_pay = booking.status in PAYABLE_BOOKING_STATUSES and paid is None
    reason = None
    if paid:
        reason = "Cette réservation est déjà payée."
    elif booking.status not in PAYABLE_BOOKING_STATUSES:
        reason = "Le paiement sera possible dès que le thérapeute aura confirmé la réservation."

    return {
        "booking_id": booking.id,
        "booking_status": booking.status,
        "amount": _booking_amount(booking),
        "currency": "MGA",
        "can_pay": can_pay,
        "reason": reason,
        "payment": _serialize(paid or latest) if (paid or latest) else None,
    }


# ---------------------------------------------------------------------------
# Initier un paiement
# ---------------------------------------------------------------------------
@router.post("/initiate")
async def initiate_payment(
    body: InitiatePaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == body.booking_id).first()
    if not booking:
        raise HTTPException(404, "Réservation introuvable.")
    if booking.client_id != current_user.id:
        raise HTTPException(403, "Vous ne pouvez payer que vos propres réservations.")
    if booking.status not in PAYABLE_BOOKING_STATUSES:
        raise HTTPException(
            400, "Le paiement n'est possible qu'après confirmation de la réservation."
        )
    if (
        db.query(Payment)
        .filter(Payment.booking_id == booking.id, Payment.status == "completed")
        .first()
    ):
        raise HTTPException(400, "Cette réservation est déjà payée.")

    # Le montant vient TOUJOURS du serveur, jamais du client.
    amount = _booking_amount(booking)
    if amount <= 0:
        raise HTTPException(400, "Le prix de la réservation est introuvable.")

    phone = None
    provider = body.provider
    if body.method == "mobile_money":
        if not provider:
            raise HTTPException(400, "Choisissez MVola, Orange Money ou Airtel Money.")
        phone = _normalize_phone(body.phone)
        if not re.fullmatch(r"0\d{9}", phone or ""):
            raise HTTPException(400, "Numéro de téléphone invalide (ex. 034 12 345 67).")
        if phone[:3] not in OPERATOR_PREFIXES[provider]:
            raise HTTPException(
                400, f"Ce numéro ne correspond pas à l'opérateur choisi ({provider})."
            )
    cfg = platform_settings.get_config()
    if body.method == "cash" and not cfg["cash_enabled"]:
        raise HTTPException(400, "Le paiement en espèces n'est pas disponible.")
    if body.method == "mobile_money" and not (
        cfg["mobile_money_enabled"] and cfg.get(f"{provider}_enabled", True)
    ):
        raise HTTPException(400, "Ce moyen de paiement est désactivé par l'administrateur.")
    if body.method == "card" and not cfg["card_enabled"]:
        raise HTTPException(400, "Le paiement par carte est désactivé par l'administrateur.")
    if body.method == "cash":
        provider = None

    # Les anciennes tentatives non abouties sont annulées (une seule en cours).
    for old in (
        db.query(Payment)
        .filter(Payment.booking_id == booking.id, Payment.status.in_(["pending", "processing"]))
        .all()
    ):
        old.status = "cancelled"
    db.flush()

    payment = Payment(
        booking_id=booking.id,
        user_id=current_user.id,
        amount=amount,
        currency="MGA",
        method=body.method,
        provider=provider,
        status="pending",
        payer_name=current_user.fullname,
        payer_phone=phone or getattr(current_user, "phone", None),
        payer_email=getattr(current_user, "email", None),
    )
    db.add(payment)
    db.flush()  # id disponible

    instructions = None
    payment_url = None

    if body.method == "cash":
        payment.transaction_id = f"CASH-{payment.id}-{int(time.time())}"
        instructions = (
            "Payez en espèces à la fin du massage. Le thérapeute confirmera la "
            "réception dans l'application ; votre reçu sera alors disponible."
        )
    else:
        try:
            result = gateway.start_payment(
                method=body.method,
                provider=provider,
                amount=amount,
                payment_id=payment.id,
                booking_id=booking.id,
                phone=phone,
                payer_name=current_user.fullname,
                payer_email=getattr(current_user, "email", None),
            )
        except GatewayError as exc:
            db.rollback()
            raise HTTPException(502, str(exc))
        payment.transaction_id = result["transaction_id"]
        payment.provider = result.get("provider") or payment.provider
        payment.status = "processing"
        payment.payment_data = {k: v for k, v in result.items() if k != "client_secret"}
        payment_url = result.get("payment_url")
        instructions = result.get("instructions")

    db.commit()
    db.refresh(payment)

    # Le fournisseur peut déjà avoir répondu « paid »
    if payment.status == "processing":
        try:
            fresh = gateway.check_payment(payment)
            payment = _apply_gateway_status(db, payment, fresh["status"])
        except GatewayError:
            pass

    return {
        **_serialize(payment),
        "payment_url": payment_url,
        "instructions": instructions,
        "sandbox": bool(settings.PAYMENT_SANDBOX),
    }


# ---------------------------------------------------------------------------
# Vérification côté serveur (le client « sonde » ; le backend interroge le fournisseur)
# ---------------------------------------------------------------------------
@router.post("/{payment_id}/verify")
async def verify_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(404, "Paiement introuvable.")
    booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
    if not _can_access(current_user, payment, booking):
        raise HTTPException(403, "Accès refusé.")

    if payment.status in ("pending", "processing") and payment.method != "cash":
        try:
            result = gateway.check_payment(payment)
        except GatewayError as exc:
            raise HTTPException(502, str(exc))
        payment = _apply_gateway_status(db, payment, result["status"])

    return _serialize(payment)


@router.post("/{payment_id}/cancel")
async def cancel_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment or payment.user_id != current_user.id:
        raise HTTPException(404, "Paiement introuvable.")
    if payment.status not in ("pending", "processing"):
        raise HTTPException(400, "Ce paiement ne peut plus être annulé.")
    payment = wallet.mark_payment_failed(db, payment, "cancelled")
    return _serialize(payment)


@router.post("/{payment_id}/confirm-cash")
async def confirm_cash(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Le thérapeute confirme avoir reçu les espèces."""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment or payment.method != "cash":
        raise HTTPException(404, "Paiement en espèces introuvable.")
    booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
    if not booking or booking.therapist_id != current_user.id:
        raise HTTPException(403, "Seul le thérapeute de la réservation peut confirmer.")
    if payment.status not in ("pending", "processing"):
        raise HTTPException(400, "Ce paiement est déjà clôturé.")
    try:
        payment, _ = wallet.finalize_payment(db, payment.id)
    except WalletError as exc:
        raise HTTPException(400, str(exc))
    return _serialize(payment, include_split=True)


# ---------------------------------------------------------------------------
# Webhooks (signature OBLIGATOIRE)
# ---------------------------------------------------------------------------
@router.post("/webhook/vanila-pay")
async def vanila_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_signature: Optional[str] = Header(None),
):
    body = await request.body()
    if not gateway.verify_vanila_signature(body, x_signature):
        raise HTTPException(401, "Signature invalide.")
    try:
        data = json.loads(body.decode() or "{}")
    except ValueError:
        raise HTTPException(400, "Corps invalide.")

    tx = str(data.get("id") or data.get("transaction_id") or "")
    payment = db.query(Payment).filter(Payment.transaction_id == tx).first()
    if payment:
        # On RE-vérifie auprès du fournisseur plutôt que de croire le corps du webhook
        try:
            status = gateway.check_payment(payment)["status"]
        except GatewayError:
            status = gateway.map_status(data.get("status"))
        _apply_gateway_status(db, payment, status)
    return {"received": True}


@router.post("/webhook/stripe")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
    stripe_signature: Optional[str] = Header(None, alias="Stripe-Signature"),
):
    body = await request.body()
    try:
        event = gateway.parse_stripe_event(body, stripe_signature)
    except GatewayError as exc:
        raise HTTPException(400, str(exc))

    if event["type"] in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        session = event["data"]["object"]
        pid = (session.get("metadata") or {}).get("payment_id") or session.get("client_reference_id")
        if pid and session.get("payment_status") == "paid":
            payment = db.query(Payment).filter(Payment.id == int(pid)).first()
            if payment:
                wallet.finalize_payment(db, payment.id)
    elif event["type"] in ("checkout.session.expired", "checkout.session.async_payment_failed"):
        pid = (event["data"]["object"].get("metadata") or {}).get("payment_id")
        payment = db.query(Payment).filter(Payment.id == int(pid)).first() if pid else None
        if payment:
            wallet.mark_payment_failed(db, payment, "failed")
    return {"received": True}


# ---------------------------------------------------------------------------
# Historique / détail
# ---------------------------------------------------------------------------
@router.get("/history")
async def payment_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(50, le=200),
):
    q = db.query(Payment)
    if _role(current_user) == "THERAPIST":
        q = q.join(Booking, Booking.id == Payment.booking_id).filter(
            Booking.therapist_id == current_user.id
        )
        split = True
    elif _role(current_user) == "ADMIN":
        split = True
    else:
        q = q.filter(Payment.user_id == current_user.id)
        split = False
    return [_serialize(p, include_split=split) for p in q.order_by(Payment.id.desc()).limit(limit)]


@router.get("/booking/{booking_id}")
async def payment_for_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Réservation introuvable.")
    if _role(current_user) != "ADMIN" and current_user.id not in (booking.client_id, booking.therapist_id):
        raise HTTPException(403, "Accès refusé.")
    payment = (
        db.query(Payment).filter(Payment.booking_id == booking_id).order_by(Payment.id.desc()).first()
    )
    return _serialize(payment, include_split=_role(current_user) != "CLIENT") if payment else None


# ---------------------------------------------------------------------------
# Reçu : données (écran), lien PDF, PDF, QR PNG
# ---------------------------------------------------------------------------
def _load_receivable(db: Session, payment_id: int, user: User) -> Payment:
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(404, "Paiement introuvable.")
    booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
    if not _can_access(user, payment, booking):
        raise HTTPException(403, "Accès refusé.")
    if payment.status != "completed":
        raise HTTPException(400, "Le reçu n'est disponible qu'après confirmation du paiement.")
    return payment


def _links(request: Request, payment_id: int, user_id: int, view: str, ttl: int = 900) -> Dict[str, str]:
    base = receipt_links.base_from_request(request)
    token = receipt_links.sign("pay", payment_id, user_id, ttl, view)
    path = f"/payments/{payment_id}"
    return {
        "qr_url": receipt_links.url(f"{path}/qr.png", token, base),
        "barcode_url": receipt_links.url(f"{path}/barcode.png", token, base),
        "pdf_url": receipt_links.url(f"{path}/receipt.pdf", token, base),
        "download_url": receipt_links.url(f"{path}/receipt.pdf", token, base, download=1),
    }


@router.get("/{payment_id}/receipt-link")
async def receipt_link(
    payment_id: int,
    request: Request,
    view: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lien temporaire (15 min) : ouvrir / télécharger le PDF."""
    payment = _load_receivable(db, payment_id, current_user)
    links = _links(request, payment.id, current_user.id, _viewer_view(current_user, view))
    return {"url": links["pdf_url"], "download_url": links["download_url"], "expires_in": 900}


@router.get("/{payment_id}/receipt-data")
async def receipt_data(
    payment_id: int,
    request: Request,
    view: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tout le reçu pour l'afficher dans l'application (écran « Reçu »)."""
    payment = _load_receivable(db, payment_id, current_user)
    v = _viewer_view(current_user, view)
    doc = receipt_service.payment_doc(_receipt_context(db, payment), v)
    out = receipt_service.doc_json(doc)
    out.update(_links(request, payment.id, current_user.id, v))
    out["payment_id"] = payment.id
    out["view"] = v
    out["pdf_name"] = f"recu-{doc['receipt_no']}.pdf"
    return out


def _pdf_response(pdf: bytes, name: str, download: int) -> Response:
    disposition = "attachment" if download else "inline"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{name}"',
            "Cache-Control": "no-store",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


def _completed_payment_for_token(db: Session, payment_id: int, token: str):
    checked = receipt_links.check(token, "pay", payment_id)
    if checked is None:
        raise HTTPException(401, "Lien expiré ou invalide.")
    uid, view = checked
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment or payment.status != "completed":
        raise HTTPException(404, "Reçu indisponible.")
    booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
    user = db.query(User).filter(User.id == uid).first()
    if not user or not _can_access(user, payment, booking):
        raise HTTPException(403, "Accès refusé.")
    return payment, user, view


@router.get("/{payment_id}/receipt.pdf")
async def receipt_pdf(
    payment_id: int,
    token: str = Query(...),
    download: int = 0,
    db: Session = Depends(get_db),
):
    payment, user, view = _completed_payment_for_token(db, payment_id, token)
    v = view if view != "auto" else _viewer_view(user, None)
    pdf = receipt_service.payment_receipt_pdf(_receipt_context(db, payment), v)
    return _pdf_response(pdf, f"recu-MBE-{payment.id:06d}.pdf", download)


@router.get("/{payment_id}/qr.png")
async def receipt_qr(payment_id: int, token: str = Query(...), db: Session = Depends(get_db)):
    payment, _u, _v = _completed_payment_for_token(db, payment_id, token)
    png = receipt_service.qr_png(
        receipt_service.verification_url("payment", payment.transaction_id or f"PAY-{payment.id}")
    )
    if png is None:
        raise HTTPException(404, "QR indisponible (pip install qrcode pillow).")
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "private, max-age=600"})


@router.get("/{payment_id}/barcode.png")
async def receipt_barcode(payment_id: int, token: str = Query(...), db: Session = Depends(get_db)):
    payment, _u, _v = _completed_payment_for_token(db, payment_id, token)
    png = receipt_service.barcode_png(payment.transaction_id or f"PAY-{payment.id}")
    if png is None:
        raise HTTPException(404, "Code-barres indisponible (pip install pillow reportlab).")
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "private, max-age=600"})


@router.get("/receipt/verify/{transaction_id}")
async def verify_receipt(transaction_id: str, db: Session = Depends(get_db)):
    """Public : cible du QR code. N'expose aucune donnée personnelle."""
    payment = db.query(Payment).filter(Payment.transaction_id == transaction_id).first()
    valid = bool(payment and payment.status == "completed")
    cfg = platform_settings.get_config()
    return {
        "valid": valid,
        "transaction_id": transaction_id,
        "amount": float(payment.amount) if valid else None,
        "currency": "MGA" if valid else None,
        "paid_at": payment.completed_at.isoformat() if valid and payment.completed_at else None,
        "issuer": cfg.get("company_name") or "Mada Bien-Être",
    }


# ---------------------------------------------------------------------------
# Statuts de paiement de plusieurs réservations d'un coup (listes)
# ---------------------------------------------------------------------------
@router.get("/batch")
async def payments_batch(
    booking_ids: str = Query(..., description="ids séparés par des virgules"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ids = [int(x) for x in booking_ids.split(",") if x.strip().isdigit()][:200]
    if not ids:
        return {}
    bookings = db.query(Booking).filter(Booking.id.in_(ids)).all()
    admin = _role(current_user) == "ADMIN"
    allowed = {
        b.id for b in bookings if admin or current_user.id in (b.client_id, b.therapist_id)
    }
    if not allowed:
        return {}
    split = _role(current_user) != "CLIENT"
    out: Dict[int, Dict[str, Any]] = {}
    rows = db.query(Payment).filter(Payment.booking_id.in_(allowed)).order_by(Payment.id.asc()).all()
    for p in rows:
        cur = out.get(p.booking_id)
        if cur is not None and cur["status"] == "completed":
            continue
        out[p.booking_id] = _serialize(p, include_split=split)
    return out


# ---------------------------------------------------------------------------
# Remboursement (admin)
# ---------------------------------------------------------------------------
@router.post("/refund")
async def refund_payment(
    body: RefundRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    payment = (
        db.query(Payment).filter(Payment.id == body.payment_id).with_for_update().first()
    )
    if not payment or payment.status != "completed":
        raise HTTPException(400, "Seul un paiement confirmé peut être remboursé.")

    meta = dict(payment.payment_metadata or {})
    net = wallet.D(meta.get("net_amount"))
    if meta.get("settlement") == "wallet" and meta.get("therapist_id"):
        w = wallet.get_or_create_earnings(db, int(meta["therapist_id"]))
        if wallet.D(w.available_earnings) < net:
            raise HTTPException(
                400,
                "Remboursement impossible : le thérapeute a déjà retiré ce montant. "
                "Traitez-le manuellement.",
            )
        w.available_earnings = wallet.D(w.available_earnings) - net
        w.total_earnings = wallet.D(w.total_earnings) - net
        w.total_commission = wallet.D(w.total_commission) - wallet.D(meta.get("commission_amount"))
    payment.status = "refunded"
    payment.refunded_at = datetime.utcnow()
    meta["refund_reason"] = body.reason
    payment.payment_metadata = meta
    db.commit()
    return _serialize(payment, include_split=True)


# ---------------------------------------------------------------------------
# Admin : liste + statistiques
# ---------------------------------------------------------------------------
def _admin_row(db: Session, p: Payment) -> Dict[str, Any]:
    data = _serialize(p, include_split=True)
    booking = db.query(Booking).filter(Booking.id == p.booking_id).first()
    client = db.query(User).filter(User.id == p.user_id).first()
    therapist = (
        db.query(User).filter(User.id == booking.therapist_id).first()
        if booking and booking.therapist_id
        else None
    )
    data["client_name"] = getattr(client, "fullname", None)
    data["therapist_name"] = getattr(therapist, "fullname", None)
    return data


@router.get("/admin/payments")
@router.get("")
async def admin_list_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
    status: Optional[str] = None,
    limit: int = Query(100, le=500),
):
    q = db.query(Payment)
    if status and status != "all":
        q = q.filter(Payment.status == status)
    return [_admin_row(db, p) for p in q.order_by(Payment.id.desc()).limit(limit)]


def _month_key(d: Optional[datetime]) -> str:
    return d.strftime("%Y-%m") if d else ""


def _last_months(n: int = 12):
    now = datetime.utcnow().replace(day=1)
    keys = []
    y, m = now.year, now.month
    for _ in range(n):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    return list(reversed(keys))


@router.get("/admin/stats")
async def admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    from datetime import timedelta

    def count(st):
        return db.query(Payment).filter(Payment.status == st).count()

    completed = db.query(Payment).filter(Payment.status == "completed").all()
    total = sum(float(p.amount or 0) for p in completed)
    commission = sum(float((p.payment_metadata or {}).get("commission_amount", 0)) for p in completed)
    net = sum(float((p.payment_metadata or {}).get("net_amount", 0)) for p in completed)
    by_method: Dict[str, float] = {}
    for p in completed:
        key = p.provider or p.method
        by_method[key] = by_method.get(key, 0) + float(p.amount or 0)

    today = datetime.utcnow().date()
    days = [(today - timedelta(days=i)) for i in range(29, -1, -1)]
    daily = {d.isoformat(): {"date": d.isoformat(), "gross": 0.0, "commission": 0.0, "count": 0} for d in days}
    months = {k: {"month": k, "gross": 0.0, "commission": 0.0, "net": 0.0, "count": 0} for k in _last_months(12)}
    therapists: Dict[int, Dict[str, Any]] = {}
    for p in completed:
        meta = p.payment_metadata or {}
        comm = float(meta.get("commission_amount", 0) or 0)
        when = p.completed_at or p.created_at
        if when and when.date().isoformat() in daily:
            row = daily[when.date().isoformat()]
            row["gross"] += float(p.amount or 0)
            row["commission"] += comm
            row["count"] += 1
        mk = _month_key(when)
        if mk in months:
            months[mk]["gross"] += float(p.amount or 0)
            months[mk]["commission"] += comm
            months[mk]["net"] += float(meta.get("net_amount", 0) or 0)
            months[mk]["count"] += 1
        tid = meta.get("therapist_id")
        if tid:
            t = therapists.setdefault(int(tid), {"therapist_id": int(tid), "gross": 0.0, "commission": 0.0, "count": 0})
            t["gross"] += float(p.amount or 0)
            t["commission"] += comm
            t["count"] += 1
    top = sorted(therapists.values(), key=lambda x: x["gross"], reverse=True)[:5]
    names = {u.id: u.fullname for u in db.query(User).filter(User.id.in_({t["therapist_id"] for t in top} or {0})).all()}
    for t in top:
        t["name"] = names.get(t["therapist_id"])

    return {
        "total_payments": db.query(func.count(Payment.id)).scalar() or 0,
        "completed_payments": len(completed),
        "pending_payments": count("pending") + count("processing"),
        "failed_payments": count("failed") + count("cancelled"),
        "refunded_payments": count("refunded"),
        "total_amount": total,
        "total_commission": commission,
        "total_net_therapists": net,
        "by_method": by_method,
        "daily": list(daily.values()),
        "monthly": list(months.values()),
        "top_therapists": top,
    }
