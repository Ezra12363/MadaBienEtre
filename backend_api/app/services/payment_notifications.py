# app/services/payment_notifications.py
"""
Notifications « argent » centralisées (client, thérapeute, admin).

Chaque notification porte dans `data` de quoi ouvrir DIRECTEMENT le bon écran :

  data.kind        : payment_to_confirm | payment_received | payment_new | payment_completed |
                     withdrawal_requested | withdrawal_accepted | withdrawal_paid | withdrawal_rejected |
                     commission_to_validate | commission_validated | commission_rejected ...
  data.screen      : BookingDetail (client / thérapeute) | Earnings (thérapeute) | Payments (admin)
  data.tab         : onglet à ouvrir dans l'écran cible (retraits, commission, payments, withdrawals...)
  data.booking_id / payment_id / withdrawal_id / commission_payment_id
  data.requires_confirmation : true -> le thérapeute doit confirmer la réception

Les dates/heures affichées dans les textes sont à l'heure de Madagascar (UTC+3).
Aucune fonction ne lève d'exception : une notification ratée ne doit jamais faire échouer un paiement.
"""
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from ..utils.date_utils import fmt_mada
from .notification_service import send_admin_notification, send_notification

logger = logging.getLogger(__name__)


def fmt_ar(value: Any) -> str:
    try:
        return f"{int(round(float(value or 0))):,}".replace(",", " ") + " Ar"
    except (TypeError, ValueError):
        return "0 Ar"


def now_label() -> str:
    """Maintenant, à l'heure de Madagascar (ex. 21/10/2026 à 03:55)."""
    return fmt_mada(datetime.utcnow())


def _safe(fn, *args, **kwargs) -> None:
    try:
        fn(*args, **kwargs)
    except Exception:  # noqa: BLE001
        logger.exception("Notification de paiement non envoyée")


def _pay_data(payment, kind: str, screen: str, **extra) -> Dict[str, Any]:
    data = {
        "kind": kind,
        "screen": screen,
        "payment_id": payment.id,
        "booking_id": payment.booking_id,
        "amount": float(payment.amount or 0),
        "at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    data.update(extra)
    return data


# ---------------------------------------------------------------------------
# PAIEMENT CLIENT
# ---------------------------------------------------------------------------
def payment_initiated(payment, therapist_id: Optional[int], client_name: str, method_label: str) -> None:
    """Le client a lancé un paiement (carte, mobile money, espèces)."""
    when = now_label()
    amount = fmt_ar(payment.amount)
    is_cash = payment.method == "cash"

    if therapist_id and is_cash:
        _safe(
            send_notification,
            user_id=therapist_id,
            title="Paiement en espèces à confirmer",
            body=(
                f"{client_name} paiera {amount} en espèces (réservation #{payment.booking_id}, {when}). "
                "Confirmez la réception dès que vous avez reçu l'argent."
            ),
            notification_type="payment_to_confirm",
            data=_pay_data(payment, "payment_to_confirm", "BookingDetail", requires_confirmation=True, open_payment=True),
            priority="high",
            booking_id=payment.booking_id,
        )

    _safe(
        send_admin_notification,
        "Nouveau paiement" if not is_cash else "Nouveau paiement en espèces",
        f"{client_name} : {amount} ({method_label}) — réservation #{payment.booking_id}, {when}.",
        "payment_new",
        _pay_data(payment, "payment_new", "Payments", tab="payments"),
        booking_id=payment.booking_id,
    )


def client_sent_cash(payment, therapist_id: Optional[int], client_name: str) -> None:
    """Le client déclare avoir remis l'argent : le thérapeute doit confirmer la réception."""
    when = now_label()
    amount = fmt_ar(payment.amount)
    if therapist_id:
        _safe(
            send_notification,
            user_id=therapist_id,
            title="Paiement reçu à confirmer",
            body=(
                f"{client_name} indique vous avoir remis {amount} (réservation #{payment.booking_id}, {when}). "
                "Appuyez pour confirmer la réception."
            ),
            notification_type="payment_to_confirm",
            data=_pay_data(payment, "payment_to_confirm", "BookingDetail", requires_confirmation=True, open_payment=True),
            priority="high",
            booking_id=payment.booking_id,
        )
    _safe(
        send_notification,
        user_id=payment.user_id,
        title="Thérapeute prévenu",
        body=f"Votre thérapeute a été prévenu de votre paiement de {amount}. Il doit maintenant confirmer la réception.",
        notification_type="payment_pending",
        data=_pay_data(payment, "payment_pending", "BookingDetail", open_payment=True),
        booking_id=payment.booking_id,
    )
    _safe(
        send_admin_notification,
        "Paiement en espèces annoncé",
        f"{client_name} dit avoir remis {amount} (réservation #{payment.booking_id}, {when}) — en attente de confirmation du thérapeute.",
        "payment_new",
        _pay_data(payment, "payment_new", "Payments", tab="payments"),
        booking_id=payment.booking_id,
    )


def payment_completed(payment, therapist_id: Optional[int], client_name: str, net: Any, commission: Any, is_cash: bool) -> None:
    """Paiement confirmé (fournisseur ou thérapeute) : client + thérapeute + admin."""
    when = fmt_mada(payment.completed_at) if payment.completed_at else now_label()
    amount = fmt_ar(payment.amount)

    _safe(
        send_notification,
        user_id=payment.user_id,
        title="Paiement confirmé ✓",
        body=f"Votre paiement de {amount} est confirmé ({when}). Votre reçu PDF est disponible.",
        notification_type="payment_received",
        data=_pay_data(payment, "payment_completed", "BookingDetail", open_payment=True),
        booking_id=payment.booking_id,
    )
    if therapist_id:
        _safe(
            send_notification,
            user_id=therapist_id,
            title="Paiement reçu",
            body=(
                f"{amount} de {client_name} confirmés le {when} — votre part : {fmt_ar(net)} "
                + ("(espèces : commission à régler à l'admin)." if is_cash else f"ajoutés à votre solde (commission {fmt_ar(commission)}).")
            ),
            notification_type="payment_received",
            data=_pay_data(payment, "payment_received", "BookingDetail", open_payment=True),
            booking_id=payment.booking_id,
        )
    _safe(
        send_admin_notification,
        "Paiement confirmé",
        f"{amount} — commission {fmt_ar(commission)} (réservation #{payment.booking_id}, {when}).",
        "payment_completed",
        _pay_data(payment, "payment_completed", "Payments", tab="payments"),
        booking_id=payment.booking_id,
    )


# ---------------------------------------------------------------------------
# RETRAITS (thérapeute -> admin)
# ---------------------------------------------------------------------------
def _wd_data(withdrawal, kind: str, screen: str, tab: str) -> Dict[str, Any]:
    return {
        "kind": kind,
        "screen": screen,
        "tab": tab,
        "withdrawal_id": withdrawal.id,
        "amount": float(withdrawal.amount or 0),
        "at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def withdrawal_requested(withdrawal, therapist_name: str) -> None:
    when = now_label()
    _safe(
        send_admin_notification,
        "Demande de retrait",
        f"{therapist_name} demande {fmt_ar(withdrawal.amount)} ({withdrawal.method}) — {when}.",
        "payment_withdrawal",
        _wd_data(withdrawal, "withdrawal_requested", "Payments", "withdrawals"),
        priority="high",
    )
    _safe(
        send_notification,
        user_id=withdrawal.therapist_id,
        title="Demande de retrait envoyée",
        body=f"{fmt_ar(withdrawal.amount)} sont bloqués sur votre solde en attendant la décision de l'admin ({when}).",
        notification_type="payment_withdrawal",
        data=_wd_data(withdrawal, "withdrawal_requested", "Earnings", "retraits"),
    )


def withdrawal_status(withdrawal, kind: str, title: str, body: str) -> None:
    """kind : withdrawal_accepted | withdrawal_paid | withdrawal_rejected -> ouvre la page Gains > Retraits."""
    _safe(
        send_notification,
        user_id=withdrawal.therapist_id,
        title=title,
        body=body,
        notification_type="payment_withdrawal",
        data=_wd_data(withdrawal, kind, "Earnings", "retraits"),
        priority="high",
    )


# ---------------------------------------------------------------------------
# COMMISSIONS
# ---------------------------------------------------------------------------
def _cm_data(cp, kind: str, screen: str, tab: str) -> Dict[str, Any]:
    return {
        "kind": kind,
        "screen": screen,
        "tab": tab,
        "commission_payment_id": cp.id,
        "amount": float(cp.amount or 0),
        "at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def commission_submitted(cp, therapist_name: str, auto_validated: bool) -> None:
    when = now_label()
    if auto_validated:
        _safe(
            send_admin_notification,
            "Commission réglée",
            f"{therapist_name} : {fmt_ar(cp.amount)} prélevés sur son solde ({when}).",
            "payment_commission",
            _cm_data(cp, "commission_paid", "Payments", "commissions"),
        )
    else:
        _safe(
            send_admin_notification,
            "Paiement de commission à valider",
            f"{therapist_name} déclare avoir payé {fmt_ar(cp.amount)} de commission "
            f"({cp.method}, réf. {cp.transfer_reference or '—'}) — {when}.",
            "payment_commission",
            _cm_data(cp, "commission_to_validate", "Payments", "commissions"),
            priority="high",
        )


def commission_status(cp, kind: str, title: str, body: str) -> None:
    """kind : commission_validated | commission_rejected -> ouvre la page Gains > Commission."""
    _safe(
        send_notification,
        user_id=cp.therapist_id,
        title=title,
        body=body,
        notification_type="payment_commission",
        data=_cm_data(cp, kind, "Earnings", "commission"),
        priority="high",
    )
