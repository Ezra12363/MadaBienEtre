# app/services/wallet_service.py
"""
Logique métier « argent » de Mada Bien-Être (sans nouvelle table) :

  Payment (confirmé par le fournisseur)
      -> commission plateforme + net thérapeute (stockés dans payment_metadata)
      -> TherapistEarnings (wallet = FIRMANDALANA / registre de ce qui est dû)
      -> Transaction (historique de toutes les opérations)

  Withdrawal (retrait)
      pending -> processing -> completed (UNIQUEMENT avec la référence du
      transfert réel) | failed / cancelled (le montant retourne au wallet)

Règles :
  - pending / processing / failed / cancelled  => n'augmentent JAMAIS le wallet ;
  - completed seulement après confirmation du fournisseur ;
  - un paiement n'est finalisé qu'UNE fois (idempotent) -> pas de doublon ;
  - le wallet n'est pas de l'argent déjà reçu sur Mobile Money : un retrait
    n'est « payé » que lorsque l'admin enregistre la référence du transfert.
"""
import logging
import uuid
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Dict, Optional, Tuple

from sqlalchemy.orm import Session

from ..core.config import settings
from ..models.booking import Booking
from ..models.finance import CommissionPayment
from ..models.payment import Payment, Transaction
from ..models.therapist import TherapistEarnings, Withdrawal
from ..models.user import User
from . import platform_settings
from .notification_service import send_admin_notification, send_notification

logger = logging.getLogger(__name__)

ZERO = Decimal("0")


class WalletError(Exception):
    """Erreur métier (message affichable à l'utilisateur)."""


def D(value: Any) -> Decimal:
    if value is None or value == "":
        return ZERO
    return Decimal(str(value))


def money(value: Any) -> Decimal:
    """Arrondi à l'Ariary entier."""
    return D(value).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def commission_rate_for(therapist: Optional[User]) -> Decimal:
    default = D(platform_settings.get_config()["platform_commission_rate"])
    rate = getattr(therapist, "commission_rate", None) if therapist else None
    rate = D(rate) if rate not in (None, "") else default
    if rate < 0 or rate > 100:
        rate = default
    return rate


def compute_split(amount: Any, rate: Any) -> Tuple[Decimal, Decimal]:
    """50 000 Ar à 10 % -> commission 5 000 Ar, net thérapeute 45 000 Ar."""
    gross = money(amount)
    commission = money(gross * D(rate) / Decimal("100"))
    return commission, gross - commission


def get_or_create_earnings(db: Session, therapist_id: int) -> TherapistEarnings:
    row = (
        db.query(TherapistEarnings)
        .filter(TherapistEarnings.therapist_id == therapist_id)
        .with_for_update()
        .first()
    )
    if row is None:
        row = TherapistEarnings(
            therapist_id=therapist_id,
            total_earnings=ZERO,
            pending_earnings=ZERO,
            available_earnings=ZERO,
            total_commission=ZERO,
            pending_commission=ZERO,
        )
        db.add(row)
        db.flush()
    return row


def _tx(db, user_id, tx_type, amount, balance_after, description, ref_id, ref_type):
    db.add(
        Transaction(
            user_id=user_id,
            type=tx_type,
            amount=amount,
            balance_after=balance_after,
            description=description,
            reference_id=ref_id,
            reference_type=ref_type,
        )
    )


def fmt_ar(value: Any) -> str:
    return f"{int(money(value)):,}".replace(",", " ") + " Ar"


# ---------------------------------------------------------------------------
# PAIEMENT CONFIRMÉ -> commission + wallet
# ---------------------------------------------------------------------------
def finalize_payment(db: Session, payment_id: int) -> Tuple[Payment, bool]:
    """
    Marque le paiement « completed » et crédite le wallet. IDEMPOTENT :
    un second appel (webhook + vérification, double clic...) ne recrédite pas.
    Retourne (payment, newly_completed).
    """
    payment = (
        db.query(Payment).filter(Payment.id == payment_id).with_for_update().first()
    )
    if payment is None:
        raise WalletError("Paiement introuvable.")
    if payment.status == "completed":
        return payment, False
    if payment.status in ("refunded",):
        raise WalletError("Ce paiement a été remboursé.")

    booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
    therapist = (
        db.query(User).filter(User.id == booking.therapist_id).first()
        if booking and booking.therapist_id
        else None
    )

    rate = commission_rate_for(therapist)
    commission, net = compute_split(payment.amount, rate)
    is_cash = payment.method == "cash"

    meta = dict(payment.payment_metadata or {})
    meta.update(
        {
            "commission_rate": float(rate),
            "commission_amount": float(commission),
            "net_amount": float(net),
            "gross_amount": float(money(payment.amount)),
            "settlement": "cash_in_hand" if is_cash else "wallet",
            "therapist_id": therapist.id if therapist else None,
        }
    )
    payment.payment_metadata = meta
    payment.status = "completed"
    payment.completed_at = datetime.utcnow()

    if therapist:
        wallet = get_or_create_earnings(db, therapist.id)
        wallet.total_earnings = D(wallet.total_earnings) + net
        wallet.total_commission = D(wallet.total_commission) + commission
        wallet.completed_bookings = (wallet.completed_bookings or 0) + 1

        if is_cash:
            # Le thérapeute a reçu l'argent en main propre : il DOIT la commission.
            wallet.pending_commission = D(wallet.pending_commission) + commission
            _tx(
                db, therapist.id, "commission", commission, wallet.available_earnings,
                f"Commission due (paiement espèces, {rate}%) — réservation #{payment.booking_id}",
                payment.id, "payment",
            )
        else:
            wallet.available_earnings = D(wallet.available_earnings) + net
            _tx(
                db, therapist.id, "payment", net, wallet.available_earnings,
                f"Paiement reçu — réservation #{payment.booking_id} "
                f"({fmt_ar(payment.amount)} − commission {fmt_ar(commission)})",
                payment.id, "payment",
            )
            _tx(
                db, therapist.id, "commission", commission, wallet.available_earnings,
                f"Commission Mada Bien-Être ({rate}%)",
                payment.id, "payment",
            )

    db.commit()
    db.refresh(payment)

    # --- notifications (hors transaction ; ne doivent jamais faire échouer) ---
    try:
        send_notification(
            user_id=payment.user_id,
            title="Paiement confirmé ✓",
            body=f"Votre paiement de {fmt_ar(payment.amount)} est confirmé. "
            "Votre reçu PDF est disponible.",
            notification_type="payment_received",
            data={"payment_id": payment.id, "booking_id": payment.booking_id},
            booking_id=payment.booking_id,
        )
        if therapist:
            send_notification(
                user_id=therapist.id,
                title="Espèces confirmées" if is_cash else "Paiement reçu — à confirmer",
                body=(
                    f"Réception de {fmt_ar(payment.amount)} en espèces enregistrée. "
                    f"Commission à régler à l'administrateur : {fmt_ar(commission)}."
                    if is_cash
                    else f"Le client a payé {fmt_ar(payment.amount)} ({fmt_ar(net)} nets ajoutés à votre wallet, "
                    f"commission {fmt_ar(commission)}). Ouvrez la réservation pour confirmer la réception."
                ),
                notification_type="payment_received",
                data={
                    "payment_id": payment.id,
                    "booking_id": payment.booking_id,
                    **({} if is_cash else {"action": "confirm_payment"}),
                },
                booking_id=payment.booking_id,
                priority="high",
            )
        send_admin_notification(
            "Paiement confirmé",
            f"{fmt_ar(payment.amount)} — commission {fmt_ar(commission)} "
            f"(réservation #{payment.booking_id}).",
            "payment",
            {"payment_id": payment.id, "booking_id": payment.booking_id},
            booking_id=payment.booking_id,
        )
    except Exception:  # noqa: BLE001
        logger.exception("Notifications de paiement non envoyées")

    return payment, True


def mark_payment_failed(db: Session, payment: Payment, status: str = "failed") -> Payment:
    """Échec / annulation : le wallet n'est JAMAIS modifié."""
    if payment.status in ("completed", "refunded"):
        return payment
    payment.status = status if status in ("failed", "cancelled") else "failed"
    db.commit()
    db.refresh(payment)
    return payment


# ---------------------------------------------------------------------------
# RETRAITS
# ---------------------------------------------------------------------------
def _new_reference() -> str:
    return f"WD-{datetime.utcnow():%y%m%d}-{uuid.uuid4().hex[:6].upper()}"


def request_withdrawal(db: Session, therapist: User, data: Dict[str, Any]) -> Withdrawal:
    amount = money(data.get("amount"))
    method = data.get("method")

    if amount <= 0:
        raise WalletError("Montant invalide.")
    cfg = platform_settings.get_config()
    if amount < D(cfg["min_withdrawal"]):
        raise WalletError(f"Retrait minimum : {fmt_ar(cfg['min_withdrawal'])}.")
    if method not in ("mobile_money", "bank_transfer", "cash"):
        raise WalletError("Méthode de retrait invalide.")
    flag = {"mobile_money": "withdraw_mobile_money_enabled", "bank_transfer": "withdraw_bank_enabled", "cash": "withdraw_cash_enabled"}[method]
    if not cfg[flag]:
        raise WalletError("Ce mode de retrait est désactivé par l'administrateur.")

    if method == "mobile_money" and not (data.get("phone_number") or "").strip():
        raise WalletError("Numéro Mobile Money requis.")
    if method == "bank_transfer" and not all(
        (data.get(k) or "").strip() for k in ("bank_name", "account_number", "account_holder")
    ):
        raise WalletError("Informations bancaires incomplètes.")

    wallet = get_or_create_earnings(db, therapist.id)
    available = D(wallet.available_earnings)
    if amount > available:
        raise WalletError(f"Solde insuffisant (disponible : {fmt_ar(available)}).")

    fee = money(amount * D(cfg["withdrawal_fee_percent"]) / Decimal("100"))
    # Le montant est BLOQUÉ immédiatement : impossible de le retirer deux fois.
    wallet.available_earnings = available - amount

    withdrawal = Withdrawal(
        therapist_id=therapist.id,
        amount=amount,
        fee=fee,
        net_amount=amount - fee,
        status="pending",
        method=method,
        bank_name=data.get("bank_name"),
        account_number=data.get("account_number"),
        account_holder=data.get("account_holder"),
        phone_number=data.get("phone_number"),
        provider=data.get("provider"),
        reference=_new_reference(),
    )
    db.add(withdrawal)
    db.commit()
    db.refresh(withdrawal)

    try:
        send_admin_notification(
            "Demande de retrait",
            f"{therapist.fullname} demande {fmt_ar(amount)} ({method}).",
            "payment",
            {"withdrawal_id": withdrawal.id},
            priority="high",
        )
    except Exception:  # noqa: BLE001
        logger.exception("Notification admin retrait non envoyée")
    return withdrawal


def _release_hold(db: Session, withdrawal: Withdrawal) -> None:
    wallet = get_or_create_earnings(db, withdrawal.therapist_id)
    wallet.available_earnings = D(wallet.available_earnings) + D(withdrawal.amount)


def _notify_therapist(withdrawal: Withdrawal, title: str, body: str) -> None:
    try:
        send_notification(
            user_id=withdrawal.therapist_id,
            title=title,
            body=body,
            notification_type="payment",
            data={"withdrawal_id": withdrawal.id},
        )
    except Exception:  # noqa: BLE001
        logger.exception("Notification retrait non envoyée")


def cancel_withdrawal(db: Session, withdrawal: Withdrawal) -> Withdrawal:
    """Annulation par le thérapeute (seulement tant que « pending »)."""
    if withdrawal.status != "pending":
        raise WalletError("Seule une demande en attente peut être annulée.")
    withdrawal.status = "cancelled"
    _release_hold(db, withdrawal)
    db.commit()
    db.refresh(withdrawal)
    return withdrawal


def approve_withdrawal(db: Session, withdrawal: Withdrawal) -> Withdrawal:
    if withdrawal.status != "pending":
        raise WalletError("Cette demande n'est plus en attente.")
    withdrawal.status = "processing"
    withdrawal.processed_at = datetime.utcnow()
    db.commit()
    db.refresh(withdrawal)
    _notify_therapist(
        withdrawal,
        "Retrait accepté",
        f"Votre retrait de {fmt_ar(withdrawal.amount)} est en cours de traitement.",
    )
    return withdrawal


def complete_withdrawal(
    db: Session, withdrawal: Withdrawal, transfer_reference: str
) -> Withdrawal:
    """« Payé » UNIQUEMENT avec la référence du transfert réellement effectué."""
    ref = (transfer_reference or "").strip()
    if len(ref) < 4:
        raise WalletError("La référence du transfert (≥ 4 caractères) est obligatoire.")
    if withdrawal.status not in ("pending", "processing"):
        raise WalletError("Cette demande est déjà clôturée.")

    note = f"Transfert effectué — réf. {ref}"
    withdrawal.notes = f"{withdrawal.notes}\n{note}" if withdrawal.notes else note
    withdrawal.status = "completed"
    withdrawal.processed_at = withdrawal.processed_at or datetime.utcnow()
    withdrawal.completed_at = datetime.utcnow()

    wallet = get_or_create_earnings(db, withdrawal.therapist_id)
    _tx(
        db, withdrawal.therapist_id, "withdrawal", withdrawal.amount,
        wallet.available_earnings,
        f"Retrait payé ({withdrawal.method}) — réf. {ref}",
        withdrawal.id, "withdrawal",
    )
    db.commit()
    db.refresh(withdrawal)
    _notify_therapist(
        withdrawal,
        "Retrait payé ✓",
        f"{fmt_ar(withdrawal.amount)} ont été transférés (réf. {ref}).",
    )
    return withdrawal


def reject_withdrawal(db: Session, withdrawal: Withdrawal, reason: str = "") -> Withdrawal:
    if withdrawal.status not in ("pending", "processing"):
        raise WalletError("Cette demande est déjà clôturée.")
    withdrawal.status = "failed"
    withdrawal.notes = (
        f"{withdrawal.notes}\nRefusé : {reason}" if withdrawal.notes else f"Refusé : {reason}"
    ).strip()
    withdrawal.processed_at = datetime.utcnow()
    _release_hold(db, withdrawal)
    db.commit()
    db.refresh(withdrawal)
    _notify_therapist(
        withdrawal,
        "Retrait refusé",
        f"Votre demande de {fmt_ar(withdrawal.amount)} a été refusée"
        + (f" : {reason}" if reason else ".")
        + " Le montant est de nouveau disponible.",
    )
    return withdrawal


# ---------------------------------------------------------------------------
# VUES
# ---------------------------------------------------------------------------
def wallet_summary(db: Session, therapist_id: int) -> Dict[str, Any]:
    wallet = (
        db.query(TherapistEarnings)
        .filter(TherapistEarnings.therapist_id == therapist_id)
        .first()
    )
    held = sum(
        D(w.amount)
        for w in db.query(Withdrawal).filter(
            Withdrawal.therapist_id == therapist_id,
            Withdrawal.status.in_(["pending", "processing"]),
        )
    )
    paid = sum(
        D(w.amount)
        for w in db.query(Withdrawal).filter(
            Withdrawal.therapist_id == therapist_id, Withdrawal.status == "completed"
        )
    )
    return {
        "available": float(D(wallet.available_earnings)) if wallet else 0.0,
        "total_earnings": float(D(wallet.total_earnings)) if wallet else 0.0,
        "total_commission": float(D(wallet.total_commission)) if wallet else 0.0,
        "pending_commission": float(D(wallet.pending_commission)) if wallet else 0.0,
        "withdrawals_pending": float(held),
        "withdrawals_paid": float(paid),
        "commission_due": float(
            D(wallet.pending_commission) - commission_in_review(db, therapist_id)
        ) if wallet else 0.0,
        "commission_in_review": float(commission_in_review(db, therapist_id)),
    }


# ---------------------------------------------------------------------------
# COMMISSIONS DUES PAR LE THÉRAPEUTE (paiements reçus en espèces)
# ---------------------------------------------------------------------------
def commission_in_review(db: Session, therapist_id: int) -> Decimal:
    return sum(
        (D(c.amount) for c in db.query(CommissionPayment).filter(
            CommissionPayment.therapist_id == therapist_id,
            CommissionPayment.status == "pending",
        )),
        ZERO,
    )


def _new_cm_reference() -> str:
    return f"CM-{datetime.utcnow():%y%m%d}-{uuid.uuid4().hex[:6].upper()}"


def pay_commission(db: Session, therapist: User, data: Dict[str, Any]) -> CommissionPayment:
    """
    method = wallet        : prélevé sur le solde disponible -> validé tout de suite ;
    method = mobile_money / bank_transfer / cash : le thérapeute a payé l'admin
             hors application ; il donne sa référence, l'ADMIN valide ensuite.
    """
    amount = money(data.get("amount"))
    method = data.get("method")
    if amount <= 0:
        raise WalletError("Montant invalide.")
    if method not in ("wallet", "mobile_money", "bank_transfer", "cash"):
        raise WalletError("Mode de paiement invalide.")

    wallet = get_or_create_earnings(db, therapist.id)
    due = D(wallet.pending_commission) - commission_in_review(db, therapist.id)
    if amount > due:
        raise WalletError(f"Commission restante à payer : {fmt_ar(max(due, ZERO))}.")

    if method == "mobile_money" and not (data.get("phone_number") or "").strip():
        raise WalletError("Numéro Mobile Money utilisé requis.")
    if method in ("mobile_money", "bank_transfer") and len((data.get("transfer_reference") or "").strip()) < 4:
        raise WalletError("La référence de la transaction (≥ 4 caractères) est obligatoire.")

    cp = CommissionPayment(
        therapist_id=therapist.id,
        amount=amount,
        method=method,
        provider=data.get("provider"),
        phone_number=data.get("phone_number"),
        transfer_reference=(data.get("transfer_reference") or "").strip() or None,
        status="pending",
        reference=_new_cm_reference(),
    )
    db.add(cp)
    db.flush()

    if method == "wallet":
        if D(wallet.available_earnings) < amount:
            raise WalletError(f"Solde insuffisant (disponible : {fmt_ar(wallet.available_earnings)}).")
        wallet.available_earnings = D(wallet.available_earnings) - amount
        wallet.pending_commission = D(wallet.pending_commission) - amount
        cp.status = "completed"
        cp.processed_at = cp.completed_at = datetime.utcnow()
        _tx(
            db, therapist.id, "commission", amount, wallet.available_earnings,
            f"Commission réglée depuis le wallet — réf. {cp.reference}", cp.id, "commission_payment",
        )
    db.commit()
    db.refresh(cp)

    try:
        if cp.status == "pending":
            send_admin_notification(
                "Paiement de commission à valider",
                f"{therapist.fullname} déclare avoir payé {fmt_ar(amount)} de commission "
                f"({method}, réf. {cp.transfer_reference or '—'}).",
                "payment",
                {"commission_payment_id": cp.id},
                priority="high",
            )
        else:
            send_admin_notification(
                "Commission réglée", f"{therapist.fullname} : {fmt_ar(amount)} prélevés sur son wallet.",
                "payment", {"commission_payment_id": cp.id},
            )
    except Exception:  # noqa: BLE001
        logger.exception("Notification commission non envoyée")
    return cp


def approve_commission(db: Session, cp: CommissionPayment) -> CommissionPayment:
    if cp.status != "pending":
        raise WalletError("Ce paiement de commission est déjà traité.")
    wallet = get_or_create_earnings(db, cp.therapist_id)
    amount = D(cp.amount)
    wallet.pending_commission = max(D(wallet.pending_commission) - amount, ZERO)
    cp.status = "completed"
    cp.processed_at = cp.completed_at = datetime.utcnow()
    _tx(
        db, cp.therapist_id, "commission", amount, wallet.available_earnings,
        f"Commission validée par l'admin — réf. {cp.reference}", cp.id, "commission_payment",
    )
    db.commit()
    db.refresh(cp)
    try:
        send_notification(
            user_id=cp.therapist_id, title="Commission validée ✓",
            body=f"Votre paiement de {fmt_ar(amount)} est validé. Votre reçu est disponible.",
            notification_type="payment", data={"commission_payment_id": cp.id},
        )
    except Exception:  # noqa: BLE001
        logger.exception("Notification commission non envoyée")
    return cp


def reject_commission(db: Session, cp: CommissionPayment, reason: str = "") -> CommissionPayment:
    if cp.status != "pending":
        raise WalletError("Ce paiement de commission est déjà traité.")
    cp.status = "rejected"
    cp.processed_at = datetime.utcnow()
    cp.notes = f"Refusé : {reason}".strip()
    db.commit()
    db.refresh(cp)
    try:
        send_notification(
            user_id=cp.therapist_id, title="Commission refusée",
            body=f"Votre paiement de {fmt_ar(cp.amount)} n'a pas pu être validé"
            + (f" : {reason}" if reason else "."),
            notification_type="payment", data={"commission_payment_id": cp.id},
        )
    except Exception:  # noqa: BLE001
        logger.exception("Notification commission non envoyée")
    return cp
