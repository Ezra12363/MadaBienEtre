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

  data.badge       : « Information » | « À vérifier » | « Succès » | « Échec » | « À valider » | « Anomalie »
  data.actions     : actions que l'ADMIN peut lancer depuis la notification :
                     verify (Vérifier) · approve (Approuver) · reject (Rejeter) · handled (Marquer comme traité)
  data.action_labels : libellés spéciaux (ex. approve -> « Rembourser »)
  data.handled     : true une fois la notification traitée par un admin

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


METHOD_GROUPS = {
    "mobile_money": "Mobile Money",
    "bank_transfer": "virement bancaire",
    "cash": "espèces",
    "card": "carte bancaire (Stripe)",
    "vanila_pay": "Vanila Pay",
}


def _admin(
    title: str,
    body: str,
    ntype: str,
    data: Dict[str, Any],
    *,
    badge: str = "Information",
    actions: Optional[list] = None,
    labels: Optional[Dict[str, str]] = None,
    priority: str = "normal",
    booking_id: Optional[int] = None,
) -> None:
    """Notification ADMIN : cloche + historique, avec badge et boutons d'action."""
    data = dict(data)
    data["badge"] = badge
    acts = list(actions or [])
    if acts and "handled" not in acts:
        acts.append("handled")
    data["actions"] = acts
    if labels:
        data["action_labels"] = labels
    _safe(send_admin_notification, title, body, ntype, data, priority=priority, booking_id=booking_id)


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

    group = METHOD_GROUPS.get(payment.method, method_label)
    _admin(
        "Nouveau paiement reçu",
        f"Nouveau paiement reçu de {amount} par le client {client_name}. Réservation #{payment.booking_id}. "
        f"Mode : {method_label} ({group}) — {when}.",
        "payment_new",
        _pay_data(payment, "payment_new", "Payments", tab="payments", method_group=payment.method, method_label=method_label),
        badge="Information",
        booking_id=payment.booking_id,
    )


def payment_pending(payment, client_name: str, method_label: str) -> None:
    """Le fournisseur n'a pas encore confirmé : l'admin peut « Vérifier » (interroge le fournisseur)."""
    _admin(
        "Paiement en attente",
        f"Paiement de {fmt_ar(payment.amount)} en attente de confirmation ({client_name}, {method_label}, "
        f"réservation #{payment.booking_id}).",
        "payment_pending",
        _pay_data(payment, "payment_pending", "Payments", tab="payments", method_group=payment.method, method_label=method_label),
        badge="À vérifier",
        actions=["verify"],
        booking_id=payment.booking_id,
    )


def payment_failed(payment, client_name: str, reason: str = "") -> None:
    """Échec / refus du fournisseur (carte refusée, session expirée, Mobile Money refusé...)."""
    _admin(
        "Paiement échoué",
        f"Le paiement de {fmt_ar(payment.amount)} a échoué pour la réservation #{payment.booking_id} "
        f"({client_name})" + (f" : {reason}" if reason else ".") ,
        "payment_failed",
        _pay_data(payment, "payment_failed", "Payments", tab="payments", reason=reason or None),
        badge="Échec",
        actions=["verify"],
        priority="high",
        booking_id=payment.booking_id,
    )


def payment_anomaly(payment, client_name: str, anomaly: str, detail: str) -> None:
    """anomaly : amount_mismatch (montant encaissé ≠ montant attendu) | duplicate (doublon)."""
    if anomaly == "duplicate":
        _admin(
            "Doublon de paiement détecté",
            f"{client_name} a payé deux fois la réservation #{payment.booking_id} ({fmt_ar(payment.amount)}). "
            f"{detail} Le wallet du thérapeute n'a PAS été crédité deux fois : remboursez ce doublon.",
            "payment_anomaly",
            _pay_data(payment, "payment_duplicate", "Payments", tab="payments", anomaly=anomaly),
            badge="Anomalie",
            actions=["verify", "approve"],
            labels={"approve": "Rembourser"},
            priority="high",
            booking_id=payment.booking_id,
        )
        return
    _admin(
        "Montant de paiement non conforme",
        f"Paiement #{payment.id} ({client_name}, réservation #{payment.booking_id}) : {detail} "
        "Le paiement n'a pas été validé automatiquement.",
        "payment_anomaly",
        _pay_data(payment, "payment_anomaly", "Payments", tab="payments", anomaly=anomaly),
        badge="Anomalie",
        actions=["verify", "approve", "reject"],
        labels={"approve": "Valider quand même", "reject": "Rejeter / rembourser"},
        priority="high",
        booking_id=payment.booking_id,
    )


def refund_requested(payment, client_name: str, reason: str = "") -> None:
    _admin(
        "Demande de remboursement",
        f"Nouvelle demande de remboursement de {fmt_ar(payment.amount)} pour la réservation #{payment.booking_id} "
        f"({client_name})" + (f" — motif : {reason}" if reason else "."),
        "payment_refund_request",
        _pay_data(payment, "refund_requested", "Payments", tab="payments", reason=reason or None),
        badge="À vérifier",
        actions=["verify", "approve", "reject"],
        labels={"approve": "Rembourser"},
        priority="high",
        booking_id=payment.booking_id,
    )


def refund_done(payment, refunded_by_admin: bool = True) -> None:
    """Client prévenu : remboursement effectué."""
    _safe(
        send_notification,
        user_id=payment.user_id,
        title="Remboursement effectué",
        body=f"Votre paiement de {fmt_ar(payment.amount)} (réservation #{payment.booking_id}) a été remboursé ({now_label()}).",
        notification_type="payment_refund",
        data=_pay_data(payment, "refund_done", "BookingDetail", open_payment=True),
        priority="high",
        booking_id=payment.booking_id,
    )


def refund_rejected(payment, reason: str = "") -> None:
    _safe(
        send_notification,
        user_id=payment.user_id,
        title="Remboursement refusé",
        body=f"Votre demande de remboursement de {fmt_ar(payment.amount)} n'a pas été acceptée"
        + (f" : {reason}" if reason else "."),
        notification_type="payment_refund",
        data=_pay_data(payment, "refund_rejected", "BookingDetail", open_payment=True),
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
    _admin(
        "Paiement en attente",
        f"Paiement de {amount} en attente de confirmation : {client_name} dit avoir remis les espèces "
        f"(réservation #{payment.booking_id}, {when}). Le thérapeute doit confirmer la réception.",
        "payment_pending",
        _pay_data(payment, "payment_pending", "Payments", tab="payments", method_group="cash", method_label="Espèces"),
        badge="À vérifier",
        actions=["verify"],
        booking_id=payment.booking_id,
    )


def payment_completed(
    payment,
    therapist_id: Optional[int],
    client_name: str,
    net: Any,
    commission: Any,
    is_cash: bool,
    available: Any = None,
    therapist_name: Optional[str] = None,
    card_due: bool = False,
) -> None:
    """Paiement confirmé (fournisseur ou thérapeute) : client + thérapeute + admin."""
    when = fmt_mada(payment.completed_at) if payment.completed_at else now_label()
    amount = fmt_ar(payment.amount)
    card_label = ((payment.payment_metadata or {}).get("card") or {}).get("label")

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
            title="Paiement reçu" if is_cash else "Paiement par carte reçu ✓",
            body=(
                f"{amount} de {client_name} confirmés le {when} — votre part : {fmt_ar(net)} "
                + (
                    "(espèces : commission à régler à l'admin)."
                    if is_cash
                    else (
                        f"ajoutés à votre solde (paiement carte). Vous devez régler {fmt_ar(commission)} de commission à "
                        f"l'admin : Gains > Commissions"
                        + (f" (carte {card_label})" if card_label else "")
                        + (f". Solde disponible : {fmt_ar(available)}." if available is not None else ".")
                    )
                    if card_due
                    else (
                        f"ajoutés à votre solde, après déduction de la commission plateforme de {fmt_ar(commission)}"
                        + (f" (carte {card_label})" if card_label else "")
                        + (f". Nouveau solde disponible : {fmt_ar(available)}." if available is not None else ".")
                    )
                )
            ),
            notification_type="payment_received",
            data=_pay_data(payment, "payment_received", "BookingDetail", open_payment=True),
            booking_id=payment.booking_id,
        )
    _admin(
        "Paiement confirmé",
        f"Le paiement de {amount} a été confirmé ({client_name}, réservation #{payment.booking_id}, {when}).",
        "payment_completed",
        _pay_data(payment, "payment_completed", "Payments", tab="payments"),
        badge="Succès",
        booking_id=payment.booking_id,
    )
    # --- commission de la plateforme ---
    _admin(
        "Commission générée",
        f"Commission plateforme : {fmt_ar(commission)}"
        + (" (à encaisser : paiement reçu en espèces par le thérapeute)" if is_cash else "")
        + (" (à encaisser : le thérapeute doit la régler après ce paiement carte)" if card_due else "")
        + f" — réservation #{payment.booking_id}.",
        "payment_commission",
        _pay_data(payment, "commission_generated", "Payments", tab="commissions", commission=float(commission or 0)),
        badge="Information",
        booking_id=payment.booking_id,
    )
    # --- solde du thérapeute ---
    if available is not None and not is_cash:
        who = therapist_name or "du thérapeute"
        _admin(
            "Solde thérapeute mis à jour",
            f"Solde disponible {('de ' + therapist_name) if therapist_name else who} : {fmt_ar(available)} "
            f"(+ {fmt_ar(net)} — réservation #{payment.booking_id}).",
            "payment_balance",
            _pay_data(payment, "balance_updated", "Payments", tab="withdrawals", available=float(available or 0)),
            badge="Information",
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


WITHDRAW_METHODS = {
    "bank_transfer": "virement bancaire",
    "mobile_money": "Mobile Money",
    "cash": "espèces",
}


def withdrawal_requested(withdrawal, therapist_name: str) -> None:
    when = now_label()
    how = WITHDRAW_METHODS.get(withdrawal.method, withdrawal.method)
    _admin(
        "Nouvelle demande de retrait · à valider",
        f"Le thérapeute {therapist_name} demande le retrait de {fmt_ar(withdrawal.amount)} par {how}. "
        f"Demande de retrait #{withdrawal.id} en attente de validation administrative ({when}).",
        "payment_withdrawal",
        _wd_data(withdrawal, "withdrawal_requested", "Payments", "withdrawals"),
        badge="À valider",
        actions=["verify", "approve", "reject"],
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


def withdrawal_status(withdrawal, kind: str, title: str, body: str, therapist_name: Optional[str] = None, reason: str = "") -> None:
    """kind : withdrawal_accepted | withdrawal_paid | withdrawal_rejected -> ouvre la page Gains > Retraits.
    Les retraits payés / rejetés sont aussi journalisés côté ADMIN."""
    _safe(
        send_notification,
        user_id=withdrawal.therapist_id,
        title=title,
        body=body,
        notification_type="payment_withdrawal",
        data=_wd_data(withdrawal, kind, "Earnings", "retraits"),
        priority="high",
    )
    who = therapist_name or f"thérapeute #{withdrawal.therapist_id}"
    if kind == "withdrawal_paid":
        _admin(
            "Retrait effectué",
            f"Le retrait de {fmt_ar(withdrawal.amount)} ({who}) a été effectué avec succès ({now_label()}).",
            "payment_withdrawal",
            _wd_data(withdrawal, kind, "Payments", "withdrawals"),
            badge="Succès",
        )
    elif kind == "withdrawal_rejected":
        _admin(
            "Retrait rejeté",
            f"La demande de retrait #{withdrawal.id} de {fmt_ar(withdrawal.amount)} ({who}) a été rejetée"
            + (f" : {reason}" if reason else "."),
            "payment_withdrawal",
            _wd_data(withdrawal, kind, "Payments", "withdrawals"),
            badge="Information",
        )


def withdrawal_cancelled(withdrawal, therapist_name: str) -> None:
    _admin(
        "Retrait annulé",
        f"{therapist_name} a annulé sa demande de retrait #{withdrawal.id} de {fmt_ar(withdrawal.amount)}. "
        "Le montant est de nouveau disponible sur son solde.",
        "payment_withdrawal",
        _wd_data(withdrawal, "withdrawal_cancelled", "Payments", "withdrawals"),
        badge="Information",
    )


def insufficient_balance(therapist_name: str, requested: Any, available: Any, context: str = "retrait") -> None:
    """Le thérapeute a demandé plus que son solde disponible (retrait ou paiement de commission)."""
    _admin(
        "Solde insuffisant",
        f"{therapist_name} a tenté un {context} de {fmt_ar(requested)} alors que son solde disponible est de "
        f"{fmt_ar(available)} : le solde est insuffisant, l'opération a été refusée.",
        "payment_balance",
        {
            "kind": "insufficient_balance",
            "screen": "Payments",
            "tab": "withdrawals",
            "amount": float(requested or 0),
            "available": float(available or 0),
            "at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        badge="Information",
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
        _admin(
            "Commission réglée",
            f"{therapist_name} : {fmt_ar(cp.amount)} de commission réglés ({cp.method}) — {when}.",
            "payment_commission",
            _cm_data(cp, "commission_paid", "Payments", "commissions"),
            badge="Succès",
        )
    else:
        _admin(
            "Paiement de commission à valider",
            f"{therapist_name} déclare avoir payé {fmt_ar(cp.amount)} de commission "
            f"({cp.method}, réf. {cp.transfer_reference or '—'}) — {when}.",
            "payment_commission",
            _cm_data(cp, "commission_to_validate", "Payments", "commissions"),
            badge="À valider",
            actions=["verify", "approve", "reject"],
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
