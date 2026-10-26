# app/services/admin_actions.py
"""
Actions de l'ADMIN lancées DEPUIS une notification :

    Vérifier · Approuver · Rejeter · Marquer comme traité

La notification porte dans `data` : kind, actions (liste autorisée), payment_id / withdrawal_id /
commission_payment_id. Le backend exécute la VRAIE action métier (aucune confiance dans le client) :

  kind                  approve                         reject
  ───────────────────── ─────────────────────────────── ───────────────────────────────
  withdrawal_requested  accepte le retrait (processing)  refuse + le montant revient au solde
  commission_to_validate valide la commission            refuse la commission
  refund_requested      REMBOURSE (Stripe + wallet)      refuse la demande (client prévenu)
  payment_duplicate     REMBOURSE le doublon             —
  payment_anomaly       valide quand même le paiement    rejette (et rembourse chez Stripe)

« Vérifier » interroge le fournisseur (paiements) ou renvoie l'état actuel (retraits, commissions).
« Marquer comme traité » ne change rien au métier : la notification est simplement archivée comme traitée.
"""
import logging
from datetime import datetime
from typing import Any, Dict

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..models.finance import CommissionPayment
from ..models.notification import Notification
from ..models.payment import Payment
from ..models.therapist import Withdrawal
from ..models.user import User
from . import payment_gateway as gateway
from . import payment_notifications as pn
from . import wallet_service as ws
from .payment_gateway import GatewayError
from .wallet_service import WalletError

logger = logging.getLogger(__name__)

ACTIONS = ("verify", "approve", "reject", "handled")


class AdminActionError(Exception):
    """Erreur affichable à l'admin."""


def _fmt(value: Any) -> str:
    return pn.fmt_ar(value)


def _payment(db: Session, data: Dict[str, Any]) -> Payment:
    pid = data.get("payment_id")
    row = db.query(Payment).filter(Payment.id == pid).first() if pid else None
    if not row:
        raise AdminActionError("Paiement introuvable.")
    return row


def _withdrawal(db: Session, data: Dict[str, Any]) -> Withdrawal:
    wid = data.get("withdrawal_id")
    row = db.query(Withdrawal).filter(Withdrawal.id == wid).with_for_update().first() if wid else None
    if not row:
        raise AdminActionError("Demande de retrait introuvable.")
    return row


def _commission(db: Session, data: Dict[str, Any]) -> CommissionPayment:
    cid = data.get("commission_payment_id")
    row = db.query(CommissionPayment).filter(CommissionPayment.id == cid).with_for_update().first() if cid else None
    if not row:
        raise AdminActionError("Paiement de commission introuvable.")
    return row


# ---------------------------------------------------------------------------
# VÉRIFIER
# ---------------------------------------------------------------------------
def _verify(db: Session, data: Dict[str, Any]) -> str:
    kind = data.get("kind")

    if data.get("withdrawal_id"):
        w = db.query(Withdrawal).filter(Withdrawal.id == data["withdrawal_id"]).first()
        if not w:
            raise AdminActionError("Demande de retrait introuvable.")
        wallet = ws.wallet_summary(db, w.therapist_id)
        label = {
            "pending": "en attente de validation",
            "processing": "acceptée, transfert en cours",
            "completed": "payée",
            "failed": "refusée",
            "cancelled": "annulée",
        }.get(w.status, w.status)
        return (
            f"Retrait #{w.id} : {_fmt(w.amount)} — {label}. "
            f"Solde disponible du thérapeute : {_fmt(wallet['available'])}."
        )

    if data.get("commission_payment_id"):
        cp = db.query(CommissionPayment).filter(CommissionPayment.id == data["commission_payment_id"]).first()
        if not cp:
            raise AdminActionError("Paiement de commission introuvable.")
        label = {"pending": "à valider", "completed": "validé", "rejected": "refusé"}.get(cp.status, cp.status)
        return (
            f"Commission {cp.reference or cp.id} : {_fmt(cp.amount)} ({cp.method}) — {label}. "
            f"Référence du transfert : {cp.transfer_reference or '—'}."
        )

    if data.get("payment_id"):
        payment = _payment(db, data)
        if payment.method == "cash":
            return (
                f"Paiement #{payment.id} en espèces — statut « {payment.status} ». "
                "Seul le thérapeute peut confirmer la réception de l'argent."
            )
        if payment.status in ("pending", "processing"):
            try:
                result = gateway.check_payment(payment)
            except GatewayError as exc:
                raise AdminActionError(str(exc)) from exc
            payment = ws.apply_gateway_result(db, payment, result)
            mismatch = result.get("mismatch")
            if mismatch:
                return (
                    f"⚠️ Montant non conforme : attendu {mismatch['expected']}, encaissé {mismatch['received']}. "
                    "Approuvez ou rejetez ce paiement."
                )
            return f"Réponse du fournisseur : « {result.get('raw') or result.get('status')} » → paiement {payment.status}."
        return f"Paiement #{payment.id} : {_fmt(payment.amount)} — statut « {payment.status} »."

    return f"Rien à vérifier pour « {kind} »."


# ---------------------------------------------------------------------------
# APPROUVER / REJETER
# ---------------------------------------------------------------------------
def _approve(db: Session, data: Dict[str, Any]) -> str:
    kind = data.get("kind")

    if kind == "withdrawal_requested":
        w = ws.approve_withdrawal(db, _withdrawal(db, data))
        return f"Retrait #{w.id} accepté ({_fmt(w.amount)}). Effectuez le transfert puis enregistrez sa référence."

    if kind == "commission_to_validate":
        cp = ws.approve_commission(db, _commission(db, data))
        return f"Commission {cp.reference or cp.id} validée ({_fmt(cp.amount)})."

    if kind in ("refund_requested", "payment_duplicate"):
        payment = _payment(db, data)
        reason = (payment.payment_metadata or {}).get("refund_request", {}).get("reason") or (
            "Paiement en double" if kind == "payment_duplicate" else "Remboursement accepté par l'admin"
        )
        payment = ws.refund_payment(db, payment.id, reason)
        return f"Paiement #{payment.id} remboursé ({_fmt(payment.amount)})."

    if kind == "payment_anomaly":
        payment = _payment(db, data)
        if payment.status not in ("pending", "processing"):
            raise AdminActionError("Ce paiement est déjà clôturé.")
        payment, _ = ws.finalize_payment(db, payment.id)
        return f"Paiement #{payment.id} validé manuellement ({_fmt(payment.amount)})."

    raise AdminActionError("Aucune approbation possible pour cette notification.")


def _reject(db: Session, data: Dict[str, Any], reason: str) -> str:
    kind = data.get("kind")

    if kind == "withdrawal_requested":
        w = ws.reject_withdrawal(db, _withdrawal(db, data), reason)
        return f"Retrait #{w.id} rejeté : le montant est de nouveau disponible pour le thérapeute."

    if kind == "commission_to_validate":
        cp = ws.reject_commission(db, _commission(db, data), reason)
        return f"Commission {cp.reference or cp.id} refusée."

    if kind == "refund_requested":
        payment = _payment(db, data)
        meta = dict(payment.payment_metadata or {})
        req = dict(meta.get("refund_request") or {})
        if req.get("status") != "pending":
            raise AdminActionError("Cette demande de remboursement est déjà traitée.")
        req.update({"status": "rejected", "reject_reason": reason, "processed_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")})
        meta["refund_request"] = req
        payment.payment_metadata = meta
        db.commit()
        pn.refund_rejected(payment, reason)
        return "Demande de remboursement refusée : le client a été prévenu."

    if kind == "payment_anomaly":
        payment = _payment(db, data)
        if payment.status not in ("pending", "processing"):
            raise AdminActionError("Ce paiement est déjà clôturé.")
        note = ""
        if payment.provider == "stripe":
            try:
                if gateway.refund_stripe(payment):
                    note = " L'argent a été rendu au client chez Stripe."
            except GatewayError as exc:
                note = f" ⚠️ Remboursement Stripe impossible : {exc}"
        ws.mark_payment_failed(db, payment, "failed", reason=reason or "Rejeté par l'admin")
        return f"Paiement #{payment.id} rejeté.{note}"

    raise AdminActionError("Aucun rejet possible pour cette notification.")


# ---------------------------------------------------------------------------
# POINT D'ENTRÉE
# ---------------------------------------------------------------------------
def run(db: Session, admin: User, notification: Notification, action: str, reason: str = "") -> Dict[str, Any]:
    if action not in ACTIONS:
        raise AdminActionError("Action inconnue.")
    data = dict(notification.data or {})
    allowed = data.get("actions") or []
    if action not in allowed:
        raise AdminActionError("Cette action n'est pas disponible pour cette notification.")
    if data.get("handled") and action != "verify":
        raise AdminActionError("Cette notification est déjà traitée.")

    message = ""
    mark_handled = False
    try:
        if action == "verify":
            message = _verify(db, data)
        elif action == "approve":
            message = _approve(db, data)
            mark_handled = True
        elif action == "reject":
            message = _reject(db, data, (reason or "").strip())
            mark_handled = True
        else:  # handled
            message = "Notification marquée comme traitée."
            mark_handled = True
    except WalletError as exc:
        db.rollback()
        raise AdminActionError(str(exc)) from exc

    if mark_handled:
        data["handled"] = True
        data["handled_action"] = action
        data["handled_by"] = admin.id
        data["handled_at"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        notification.data = data
        flag_modified(notification, "data")
        notification.is_read = True
        notification.read_at = notification.read_at or datetime.utcnow()
        db.commit()
        db.refresh(notification)

    return {"success": True, "message": message, "handled": bool(data.get("handled")), "data": data}
