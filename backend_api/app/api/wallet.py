# app/api/wallet.py
"""
Wallet thérapeute, demandes de retrait, vue admin.

  Thérapeute : GET /wallet/me, POST /wallet/withdrawals, POST /wallet/withdrawals/{id}/cancel
  Admin      : GET /wallet/admin/summary | /transactions | /withdrawals
               POST /wallet/admin/withdrawals/{id}/approve | /complete | /reject
  Compat.    : POST /withdrawals/create   (ancien écran WithdrawScreen)

Le wallet est un REGISTRE de ce qui est dû au thérapeute. Un retrait n'est
« payé » que lorsque l'admin enregistre la référence du transfert réel.
"""
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_admin, get_current_therapist, get_current_user
from ..core.config import settings
from ..models.booking import Booking
from ..models.finance import CommissionPayment
from ..models.payment import Payment, Transaction
from ..models.therapist import TherapistEarnings, Withdrawal
from ..models.user import User
from ..services import platform_settings, receipt_links, receipt_service
from ..services.mg_time import iso_utc, mg_now, to_mg
from ..services import wallet_service as ws
from ..services.wallet_service import WalletError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/wallet", tags=["Wallet"])
withdrawals_router = APIRouter(prefix="/withdrawals", tags=["Withdrawals"])


# ---------------------------------------------------------------------------
# Schémas
# ---------------------------------------------------------------------------
class WithdrawalCreate(BaseModel):
    amount: float = Field(..., gt=0)
    method: str = Field(..., pattern="^(mobile_money|bank_transfer|cash)$")
    provider: Optional[str] = Field(None, pattern="^(mvola|orange_money|airtel_money)$")
    phone_number: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_holder: Optional[str] = None


class CompleteBody(BaseModel):
    transfer_reference: str = Field(..., min_length=4, max_length=100)


class RejectBody(BaseModel):
    reason: Optional[str] = ""


# ---------------------------------------------------------------------------
# Sérialisation
# ---------------------------------------------------------------------------
def _w(w: Withdrawal, therapist_name: Optional[str] = None) -> Dict[str, Any]:
    return {
        "id": w.id,
        "therapist_id": w.therapist_id,
        "therapist_name": therapist_name,
        "amount": float(w.amount or 0),
        "fee": float(w.fee or 0),
        "net_amount": float(w.net_amount or 0),
        "status": w.status,
        "method": w.method,
        "provider": w.provider,
        "phone_number": w.phone_number,
        "bank_name": w.bank_name,
        "account_number": w.account_number,
        "account_holder": w.account_holder,
        "reference": w.reference,
        "notes": w.notes,
        "receipt_available": w.status == "completed",
        "created_at": iso_utc(w.created_at),
        "processed_at": iso_utc(w.processed_at),
        "completed_at": iso_utc(w.completed_at),
    }


def _t(t: Transaction) -> Dict[str, Any]:
    return {
        "id": t.id,
        "type": t.type,
        "amount": float(t.amount or 0),
        "balance_after": float(t.balance_after or 0),
        "description": t.description,
        "reference_id": t.reference_id,
        "reference_type": t.reference_type,
        "created_at": iso_utc(t.created_at),
    }


# ---------------------------------------------------------------------------
# THÉRAPEUTE
# ---------------------------------------------------------------------------
@router.get("/me")
async def my_wallet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_therapist),
):
    summary = ws.wallet_summary(db, current_user.id)
    transactions = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.id.desc())
        .limit(50)
        .all()
    )
    withdrawals = (
        db.query(Withdrawal)
        .filter(Withdrawal.therapist_id == current_user.id)
        .order_by(Withdrawal.id.desc())
        .limit(30)
        .all()
    )
    # Espèces en attente de confirmation par le thérapeute
    cash_pending = (
        db.query(Payment)
        .join(Booking, Booking.id == Payment.booking_id)
        .filter(
            Booking.therapist_id == current_user.id,
            Payment.method == "cash",
            Payment.status.in_(["pending", "processing"]),
        )
        .order_by(Payment.id.desc())
        .all()
    )
    return {
        **summary,
        "commission_rate": float(ws.commission_rate_for(current_user)),
        "min_withdrawal": float(platform_settings.get_config()["min_withdrawal"]),
        "withdrawal_fee_percent": float(platform_settings.get_config()["withdrawal_fee_percent"]),
        "payment_config": _public_cfg(),
        "commission_payments": [
            _cp(c) for c in db.query(CommissionPayment)
            .filter(CommissionPayment.therapist_id == current_user.id)
            .order_by(CommissionPayment.id.desc()).limit(30).all()
        ],
        "transactions": [_t(t) for t in transactions],
        "withdrawals": [_w(w) for w in withdrawals],
        "cash_pending": [
            {
                "payment_id": p.id,
                "booking_id": p.booking_id,
                "amount": float(p.amount or 0),
                "created_at": iso_utc(p.created_at),
            }
            for p in cash_pending
        ],
    }


def _create_withdrawal(body: WithdrawalCreate, db: Session, user: User) -> Dict[str, Any]:
    try:
        w = ws.request_withdrawal(db, user, body.model_dump() if hasattr(body, "model_dump") else body.dict())
    except WalletError as exc:
        raise HTTPException(400, str(exc))
    return _w(w, user.fullname)


@router.post("/withdrawals")
async def create_withdrawal(
    body: WithdrawalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_therapist),
):
    return _create_withdrawal(body, db, current_user)


# Compatibilité avec l'écran existant (POST /withdrawals/create)
@withdrawals_router.post("/create")
async def create_withdrawal_legacy(
    body: WithdrawalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_therapist),
):
    return _create_withdrawal(body, db, current_user)


@withdrawals_router.get("")
async def list_my_withdrawals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_therapist),
):
    rows = (
        db.query(Withdrawal)
        .filter(Withdrawal.therapist_id == current_user.id)
        .order_by(Withdrawal.id.desc())
        .all()
    )
    return [_w(w) for w in rows]


@router.post("/withdrawals/{withdrawal_id}/cancel")
async def cancel_my_withdrawal(
    withdrawal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_therapist),
):
    w = (
        db.query(Withdrawal)
        .filter(Withdrawal.id == withdrawal_id, Withdrawal.therapist_id == current_user.id)
        .with_for_update()
        .first()
    )
    if not w:
        raise HTTPException(404, "Demande introuvable.")
    try:
        w = ws.cancel_withdrawal(db, w)
    except WalletError as exc:
        raise HTTPException(400, str(exc))
    return _w(w)


# ---------------------------------------------------------------------------
# ADMIN
# ---------------------------------------------------------------------------
@router.get("/admin/summary")
async def admin_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    completed = db.query(Payment).filter(Payment.status == "completed").all()
    gross = sum(float(p.amount or 0) for p in completed)
    commission = sum(float((p.payment_metadata or {}).get("commission_amount", 0)) for p in completed)
    net = sum(float((p.payment_metadata or {}).get("net_amount", 0)) for p in completed)

    def total_w(statuses):
        value = (
            db.query(func.coalesce(func.sum(Withdrawal.amount), 0))
            .filter(Withdrawal.status.in_(statuses))
            .scalar()
        )
        return float(value or 0)

    owed = db.query(func.coalesce(func.sum(TherapistEarnings.available_earnings), 0)).scalar()
    return {
        "total_payments": gross,
        "total_commission": commission,
        "total_net_therapists": net,
        "wallets_available": float(owed or 0),
        "withdrawals_pending": total_w(["pending", "processing"]),
        "withdrawals_paid": total_w(["completed"]),
        "payments_count": len(completed),
    }


@router.get("/admin/transactions")
async def admin_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
    limit: int = Query(100, le=500),
):
    rows = db.query(Transaction).order_by(Transaction.id.desc()).limit(limit).all()
    names = {
        u.id: u.fullname
        for u in db.query(User).filter(User.id.in_({r.user_id for r in rows} or {0})).all()
    }
    return [{**_t(r), "user_id": r.user_id, "user_name": names.get(r.user_id)} for r in rows]


@router.get("/admin/withdrawals")
async def admin_withdrawals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
    status: Optional[str] = None,
):
    q = db.query(Withdrawal)
    if status and status != "all":
        q = q.filter(Withdrawal.status == status)
    rows = q.order_by(Withdrawal.id.desc()).limit(200).all()
    names = {
        u.id: u.fullname
        for u in db.query(User).filter(User.id.in_({r.therapist_id for r in rows} or {0})).all()
    }
    return [_w(r, names.get(r.therapist_id)) for r in rows]


def _get_w(db: Session, withdrawal_id: int) -> Withdrawal:
    w = db.query(Withdrawal).filter(Withdrawal.id == withdrawal_id).with_for_update().first()
    if not w:
        raise HTTPException(404, "Demande introuvable.")
    return w


@router.post("/admin/withdrawals/{withdrawal_id}/approve")
async def admin_approve(
    withdrawal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    try:
        return _w(ws.approve_withdrawal(db, _get_w(db, withdrawal_id)))
    except WalletError as exc:
        raise HTTPException(400, str(exc))


@router.post("/admin/withdrawals/{withdrawal_id}/complete")
async def admin_complete(
    withdrawal_id: int,
    body: CompleteBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """À appeler APRÈS avoir réellement effectué le transfert (référence obligatoire)."""
    try:
        return _w(ws.complete_withdrawal(db, _get_w(db, withdrawal_id), body.transfer_reference))
    except WalletError as exc:
        raise HTTPException(400, str(exc))


@router.post("/admin/withdrawals/{withdrawal_id}/reject")
async def admin_reject(
    withdrawal_id: int,
    body: RejectBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    try:
        return _w(ws.reject_withdrawal(db, _get_w(db, withdrawal_id), body.reason or ""))
    except WalletError as exc:
        raise HTTPException(400, str(exc))



# ===========================================================================
# EXTENSIONS : commissions, reçus, statistiques, paramètres
# ===========================================================================
def _public_cfg() -> Dict[str, Any]:
    cfg = platform_settings.get_config()
    keep = (
        "cash_enabled", "mobile_money_enabled", "card_enabled", "mvola_enabled",
        "orange_money_enabled", "airtel_money_enabled", "withdraw_mobile_money_enabled",
        "withdraw_bank_enabled", "withdraw_cash_enabled", "min_withdrawal", "withdrawal_fee_percent",
    )
    return {k: cfg[k] for k in keep}


def _cp(c: CommissionPayment, therapist_name: Optional[str] = None) -> Dict[str, Any]:
    return {
        "id": c.id,
        "therapist_id": c.therapist_id,
        "therapist_name": therapist_name,
        "amount": float(c.amount or 0),
        "method": c.method,
        "provider": c.provider,
        "phone_number": c.phone_number,
        "transfer_reference": c.transfer_reference,
        "status": c.status,
        "reference": c.reference,
        "notes": c.notes,
        "receipt_available": c.status == "completed",
        "created_at": iso_utc(c.created_at),
        "completed_at": iso_utc(c.completed_at),
    }


class CommissionPayBody(BaseModel):
    amount: float = Field(..., gt=0)
    method: str = Field(..., pattern="^(wallet|mobile_money|bank_transfer|cash)$")
    provider: Optional[str] = Field(None, pattern="^(mvola|orange_money|airtel_money)$")
    phone_number: Optional[str] = None
    transfer_reference: Optional[str] = None


class SettingsBody(BaseModel):
    platform_commission_rate: Optional[float] = None
    min_withdrawal: Optional[float] = None
    withdrawal_fee_percent: Optional[float] = None
    cash_enabled: Optional[bool] = None
    mobile_money_enabled: Optional[bool] = None
    card_enabled: Optional[bool] = None
    mvola_enabled: Optional[bool] = None
    orange_money_enabled: Optional[bool] = None
    airtel_money_enabled: Optional[bool] = None
    withdraw_mobile_money_enabled: Optional[bool] = None
    withdraw_bank_enabled: Optional[bool] = None
    withdraw_cash_enabled: Optional[bool] = None
    company_name: Optional[str] = None
    company_phone: Optional[str] = None
    company_email: Optional[str] = None
    company_address: Optional[str] = None
    receipt_footer: Optional[str] = None


# ---------------- Thérapeute : commissions ----------------
@router.get("/commissions")
async def my_commissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_therapist),
):
    summary = ws.wallet_summary(db, current_user.id)
    rows = (
        db.query(CommissionPayment)
        .filter(CommissionPayment.therapist_id == current_user.id)
        .order_by(CommissionPayment.id.desc()).limit(100).all()
    )
    return {
        "commission_due": summary["commission_due"],
        "commission_in_review": summary["commission_in_review"],
        "available": summary["available"],
        "payments": [_cp(c) for c in rows],
    }


@router.post("/commissions/pay")
async def pay_my_commission(
    body: CommissionPayBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_therapist),
):
    try:
        data = body.model_dump() if hasattr(body, "model_dump") else body.dict()
        return _cp(ws.pay_commission(db, current_user, data), current_user.fullname)
    except WalletError as exc:
        db.rollback()
        raise HTTPException(400, str(exc))


# ---------------- Thérapeute : statistiques + graphiques ----------------
def _fill_series(payments, withdrawals, days: int = 30, months: int = 12):
    today = mg_now().date()
    daily = {
        (today - timedelta(days=i)).isoformat(): {"date": (today - timedelta(days=i)).isoformat(),
                                                  "gross": 0.0, "net": 0.0, "commission": 0.0, "count": 0}
        for i in range(days - 1, -1, -1)
    }
    from .payments import _last_months, _month_key

    monthly = {k: {"month": k, "gross": 0.0, "net": 0.0, "commission": 0.0, "withdrawn": 0.0, "count": 0}
               for k in _last_months(months)}
    for p in payments:
        meta = p.payment_metadata or {}
        when = to_mg(p.completed_at or p.created_at)
        g, n, c = float(p.amount or 0), float(meta.get("net_amount", 0) or 0), float(meta.get("commission_amount", 0) or 0)
        if when and when.date().isoformat() in daily:
            d = daily[when.date().isoformat()]
            d["gross"] += g; d["net"] += n; d["commission"] += c; d["count"] += 1
        mk = _month_key(when)
        if mk in monthly:
            m = monthly[mk]
            m["gross"] += g; m["net"] += n; m["commission"] += c; m["count"] += 1
    for w in withdrawals:
        mk = _month_key(to_mg(w.completed_at or w.created_at))
        if mk in monthly and w.status == "completed":
            monthly[mk]["withdrawn"] += float(w.amount or 0)
    return list(daily.values()), list(monthly.values())


@router.get("/me/stats")
async def my_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_therapist),
):
    q = (
        db.query(Payment).join(Booking, Booking.id == Payment.booking_id)
        .filter(Booking.therapist_id == current_user.id)
    )
    all_payments = q.all()
    done = [p for p in all_payments if p.status == "completed"]
    pending = [p for p in all_payments if p.status in ("pending", "processing")]
    withdrawals = db.query(Withdrawal).filter(Withdrawal.therapist_id == current_user.id).all()
    daily, monthly = _fill_series(done, withdrawals)

    by_method: Dict[str, float] = {}
    for p in done:
        key = p.provider or p.method
        by_method[key] = by_method.get(key, 0) + float((p.payment_metadata or {}).get("net_amount", 0) or 0)

    now = datetime.utcnow()
    def period_sum(delta_days):
        start = now - timedelta(days=delta_days)
        return sum(float((p.payment_metadata or {}).get("net_amount", 0) or 0)
                   for p in done if (p.completed_at or p.created_at) and (p.completed_at or p.created_at) >= start)

    # Réservations confirmées/terminées sans paiement confirmé
    booked = (
        db.query(Booking)
        .filter(Booking.therapist_id == current_user.id,
                Booking.status.in_(["confirmed", "in_progress", "completed"]))
        .all()
    )
    paid_ids = {p.booking_id for p in done}
    unpaid = [b for b in booked if b.id not in paid_ids]

    summary = ws.wallet_summary(db, current_user.id)
    return {
        **summary,
        "gross_total": sum(float(p.amount or 0) for p in done),
        "net_total": sum(float((p.payment_metadata or {}).get("net_amount", 0) or 0) for p in done),
        "commission_total": sum(float((p.payment_metadata or {}).get("commission_amount", 0) or 0) for p in done),
        "paid_count": len(done),
        "pending_count": len(pending),
        "unpaid_bookings": len(unpaid),
        "today": period_sum(1), "week": period_sum(7), "month": period_sum(30), "year": period_sum(365),
        "by_method": by_method,
        "daily": daily,
        "monthly": monthly,
    }


# ---------------- Reçus : retraits & commissions ----------------
# kind : "wd" = retrait, "cm" = paiement de commission
def _is_admin(user: User) -> bool:
    return str(getattr(user, "role", "")).upper() == "ADMIN"


def _load_doc(db: Session, kind: str, obj_id: int, user: User):
    """Retourne (doc, nom_fichier) ou lève 404/400. Contrôle l'accès."""
    th_of = lambda tid: db.query(User).filter(User.id == tid).first()  # noqa: E731
    if kind == "wd":
        w = db.query(Withdrawal).filter(Withdrawal.id == obj_id).first()
        if not w or not (_is_admin(user) or w.therapist_id == user.id):
            raise HTTPException(404, "Demande introuvable.")
        if w.status != "completed":
            raise HTTPException(400, "Le reçu n'est disponible qu'une fois le retrait payé.")
        th = th_of(w.therapist_id)
        doc = receipt_service.withdrawal_doc(w, getattr(th, "fullname", "") or "", getattr(th, "phone", "") or "")
        return doc, f"recu-retrait-{w.reference or w.id}.pdf"
    c = db.query(CommissionPayment).filter(CommissionPayment.id == obj_id).first()
    if not c or not (_is_admin(user) or c.therapist_id == user.id):
        raise HTTPException(404, "Paiement introuvable.")
    if c.status != "completed":
        raise HTTPException(400, "Le reçu n'est disponible qu'une fois la commission validée.")
    th = th_of(c.therapist_id)
    return receipt_service.commission_doc(c, getattr(th, "fullname", "") or ""), f"recu-commission-{c.reference or c.id}.pdf"


def _wallet_links(request: Request, kind: str, obj_id: int, user_id: int) -> Dict[str, str]:
    base = receipt_links.base_from_request(request)
    token = receipt_links.sign(kind, obj_id, user_id, 900)
    path = f"/wallet/receipt-file/{kind}/{obj_id}"
    return {
        "qr_url": receipt_links.url(f"{path}/qr.png", token, base),
        "barcode_url": receipt_links.url(f"{path}/barcode.png", token, base),
        "pdf_url": receipt_links.url(f"{path}/receipt.pdf", token, base),
        "download_url": receipt_links.url(f"{path}/receipt.pdf", token, base, download=1),
    }


def _receipt_data_for(kind: str, obj_id: int, request: Request, db: Session, user: User) -> Dict[str, Any]:
    doc, name = _load_doc(db, kind, obj_id, user)
    out = receipt_service.doc_json(doc)
    out.update(_wallet_links(request, kind, obj_id, user.id))
    out["pdf_name"] = name
    return out


@router.get("/withdrawals/{withdrawal_id}/receipt-data")
async def withdrawal_receipt_data(
    withdrawal_id: int, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return _receipt_data_for("wd", withdrawal_id, request, db, current_user)


@router.get("/commissions/{cp_id}/receipt-data")
async def commission_receipt_data(
    cp_id: int, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return _receipt_data_for("cm", cp_id, request, db, current_user)


@router.get("/withdrawals/{withdrawal_id}/receipt-link")
async def withdrawal_receipt_link(
    withdrawal_id: int, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    _load_doc(db, "wd", withdrawal_id, current_user)
    links = _wallet_links(request, "wd", withdrawal_id, current_user.id)
    return {"url": links["pdf_url"], "download_url": links["download_url"]}


@router.get("/commissions/{cp_id}/receipt-link")
async def commission_receipt_link(
    cp_id: int, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    _load_doc(db, "cm", cp_id, current_user)
    links = _wallet_links(request, "cm", cp_id, current_user.id)
    return {"url": links["pdf_url"], "download_url": links["download_url"]}


@router.get("/receipt-file/{kind}/{obj_id}/{filename}")
async def receipt_file(
    kind: str, obj_id: int, filename: str, token: str = Query(...), download: int = 0, db: Session = Depends(get_db)
):
    """PDF / QR / code-barres d'un reçu de retrait ou de commission (lien signé)."""
    if kind not in ("wd", "cm") or filename not in ("receipt.pdf", "qr.png", "barcode.png"):
        raise HTTPException(404, "Fichier introuvable.")
    checked = receipt_links.check(token, kind, obj_id)
    if checked is None:
        raise HTTPException(401, "Lien expiré ou invalide.")
    user = db.query(User).filter(User.id == checked[0]).first()
    if not user:
        raise HTTPException(401, "Lien invalide.")
    doc, name = _load_doc(db, kind, obj_id, user)
    if filename == "receipt.pdf":
        disp = "attachment" if download else "inline"
        return Response(
            receipt_service.render_doc(doc),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'{disp}; filename="{name}"',
                "Cache-Control": "no-store",
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    png = (
        receipt_service.qr_png(doc["verify_url"])
        if filename == "qr.png"
        else receipt_service.barcode_png(doc["barcode_data"])
    )
    if png is None:
        raise HTTPException(404, "Image indisponible (pip install qrcode pillow).")
    return Response(png, media_type="image/png", headers={"Cache-Control": "private, max-age=600"})


@router.get("/receipt/verify/{reference}")
async def verify_wallet_receipt(reference: str, db: Session = Depends(get_db)):
    """Public : cible du QR code des reçus de retrait / commission."""
    w = db.query(Withdrawal).filter(Withdrawal.reference == reference).first()
    if w:
        ok = w.status == "completed"
        return {"valid": ok, "type": "withdrawal", "reference": reference,
                "amount": float(w.net_amount) if ok else None, "currency": "MGA" if ok else None,
                "paid_at": iso_utc(w.completed_at) if ok else None,
                "issuer": platform_settings.get_config()["company_name"]}
    c = db.query(CommissionPayment).filter(CommissionPayment.reference == reference).first()
    ok = bool(c and c.status == "completed")
    return {"valid": ok, "type": "commission", "reference": reference,
            "amount": float(c.amount) if ok else None, "currency": "MGA" if ok else None,
            "paid_at": iso_utc(c.completed_at) if ok else None,
            "issuer": platform_settings.get_config()["company_name"]}


# ---------------- Admin : commissions ----------------
@router.get("/admin/commissions")
async def admin_commissions(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    q = db.query(CommissionPayment)
    if status and status != "all":
        q = q.filter(CommissionPayment.status == status)
    rows = q.order_by(CommissionPayment.id.desc()).limit(200).all()
    names = {u.id: u.fullname for u in db.query(User).filter(User.id.in_({r.therapist_id for r in rows} or {0})).all()}
    return [_cp(r, names.get(r.therapist_id)) for r in rows]


@router.get("/admin/commissions/due")
async def admin_commissions_due(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)
):
    """Commission encore due par chaque thérapeute (paiements en espèces)."""
    rows = db.query(TherapistEarnings).filter(TherapistEarnings.pending_commission > 0).all()
    names = {u.id: u.fullname for u in db.query(User).filter(User.id.in_({r.therapist_id for r in rows} or {0})).all()}
    return [
        {"therapist_id": r.therapist_id, "therapist_name": names.get(r.therapist_id),
         "due": float(r.pending_commission or 0)}
        for r in sorted(rows, key=lambda r: float(r.pending_commission or 0), reverse=True)
    ]


def _get_cp(db: Session, cp_id: int) -> CommissionPayment:
    c = db.query(CommissionPayment).filter(CommissionPayment.id == cp_id).with_for_update().first()
    if not c:
        raise HTTPException(404, "Paiement de commission introuvable.")
    return c


@router.post("/admin/commissions/{cp_id}/approve")
async def admin_commission_approve(
    cp_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)
):
    try:
        return _cp(ws.approve_commission(db, _get_cp(db, cp_id)))
    except WalletError as exc:
        raise HTTPException(400, str(exc))


@router.post("/admin/commissions/{cp_id}/reject")
async def admin_commission_reject(
    cp_id: int, body: RejectBody, db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    try:
        return _cp(ws.reject_commission(db, _get_cp(db, cp_id), body.reason or ""))
    except WalletError as exc:
        raise HTTPException(400, str(exc))


# ---------------- Admin : statistiques + graphiques ----------------
@router.get("/admin/stats")
async def admin_wallet_stats(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)
):
    done = db.query(Payment).filter(Payment.status == "completed").all()
    withdrawals = db.query(Withdrawal).all()
    daily, monthly = _fill_series(done, withdrawals)
    comm_done = (
        db.query(func.coalesce(func.sum(CommissionPayment.amount), 0))
        .filter(CommissionPayment.status == "completed").scalar()
    )
    comm_review = (
        db.query(func.coalesce(func.sum(CommissionPayment.amount), 0))
        .filter(CommissionPayment.status == "pending").scalar()
    )
    comm_due = db.query(func.coalesce(func.sum(TherapistEarnings.pending_commission), 0)).scalar()
    by_status: Dict[str, Dict[str, float]] = {}
    for w in withdrawals:
        row = by_status.setdefault(w.status, {"count": 0, "amount": 0.0})
        row["count"] += 1
        row["amount"] += float(w.amount or 0)
    return {
        "daily": daily,
        "monthly": monthly,
        "withdrawals_by_status": by_status,
        "commission_collected": float(comm_done or 0),
        "commission_in_review": float(comm_review or 0),
        "commission_due": float(comm_due or 0),
    }


# ---------------- Admin : paramètres de paiement ----------------
@router.get("/admin/settings")
async def admin_get_settings(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)
):
    from ..services import payment_gateway as gw

    return {
        "settings": platform_settings.get_config(),
        "gateways": {
            "stripe_configured": gw.stripe_configured(),
            "stripe_reason": gw.stripe_status()["reason"],
            "vanila_configured": gw.vanila_configured(),
            "sandbox": bool(settings.PAYMENT_SANDBOX),
            "stripe_webhook_url": f"{settings.BASE_URL.rstrip('/')}/payments/webhook/stripe",
            "vanila_webhook_url": f"{settings.BASE_URL.rstrip('/')}/payments/webhook/vanila-pay",
        },
        "keys_help": (
            "Les clés API (Stripe, Vanila Pay) se placent dans le fichier .env du BACKEND, "
            "jamais ici ni dans l'application. Redémarrez le serveur après modification."
        ),
    }


@router.put("/admin/settings")
async def admin_update_settings(
    body: SettingsBody, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)
):
    data = body.model_dump(exclude_none=True) if hasattr(body, "model_dump") else body.dict(exclude_none=True)
    try:
        return {"settings": platform_settings.save_config(db, data, current_user.id)}
    except ValueError as exc:
        raise HTTPException(400, str(exc))


@router.post("/admin/settings/apply-commission")
async def admin_apply_commission(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)
):
    """Applique la commission globale à TOUS les thérapeutes (écrase les taux individuels)."""
    rate = platform_settings.get_config()["platform_commission_rate"]
    n = db.query(User).filter(User.role == "THERAPIST").update({User.commission_rate: rate}, synchronize_session=False)
    db.commit()
    return {"updated": n, "rate": rate}
