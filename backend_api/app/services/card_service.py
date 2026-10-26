# app/services/card_service.py
"""
Cartes bancaires ENREGISTRÉES (Profil > Mode de paiement) — client, thérapeute, admin.

PRINCIPE DE SÉCURITÉ
  * Le numéro de carte est saisi UNIQUEMENT dans la page sécurisée de Stripe
    (Stripe Checkout en mode « setup »). Ni l'application, ni notre serveur ne le voient.
  * Chez nous on garde seulement : l'identifiant Stripe de la carte (pm_...), la marque,
    les 4 derniers chiffres et la date d'expiration.
  * La SOURCE DE VÉRITÉ est Stripe : à chaque lecture de la liste, on synchronise avec les
    cartes réellement attachées au client Stripe (pas besoin de gérer un retour de page).

MODE TEST (PAYMENT_SANDBOX=True) : aucune requête Stripe, une carte de démonstration est créée.
"""
import logging
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from ..core.config import settings
from ..models.finance import PaymentCard, StripeCustomer
from ..models.user import User
from . import payment_gateway as gateway
from .payment_gateway import GatewayError, _with_query, stripe, stripe_configured

logger = logging.getLogger(__name__)

BRAND_LABELS = {
    "visa": "Visa",
    "mastercard": "Mastercard",
    "amex": "American Express",
    "discover": "Discover",
    "diners": "Diners Club",
    "jcb": "JCB",
    "unionpay": "UnionPay",
}


class CardError(Exception):
    """Erreur métier affichable à l'utilisateur."""


def is_available() -> bool:
    return bool(settings.PAYMENT_SANDBOX or stripe_configured())


def serialize(card: PaymentCard, fallback_name: Optional[str] = None) -> Dict[str, Any]:
    brand = (card.brand or "").lower()
    label = BRAND_LABELS.get(brand, (card.brand or "Carte").title())
    exp = (
        f"{int(card.exp_month):02d}/{str(card.exp_year)[-2:]}"
        if card.exp_month and card.exp_year
        else None
    )
    return {
        "id": card.id,
        "brand": brand or "card",
        "brand_label": label,
        "last4": card.last4,
        "exp_month": card.exp_month,
        "exp_year": card.exp_year,
        "exp_label": exp,
        "holder_name": card.holder_name or fallback_name,
        "funding_label": "Carte bancaire",
        "is_default": bool(card.is_default),
        "label": f"{label} •••• {card.last4}",
        "sandbox": str(card.stripe_payment_method_id or "").startswith("sbx_"),
    }


def _d(obj: Any) -> Dict[str, Any]:
    """Objet Stripe -> dict Python (stripe-python récent : ListObject / StripeObject ne sont plus des dict)."""
    for name in ("to_dict_recursive", "to_dict"):
        fn = getattr(obj, name, None)
        if callable(fn):
            try:
                return fn()
            except Exception:  # noqa: BLE001
                pass
    return dict(obj)


def _items(listobj: Any) -> List[Any]:
    """Éléments d'un ListObject Stripe, quelle que soit la version de stripe-python."""
    data = getattr(listobj, "data", None)
    if data is None:
        data = _d(listobj).get("data", [])
    return list(data)


def _customer_row(db: Session, user_id: int) -> Optional[StripeCustomer]:
    return db.query(StripeCustomer).filter(StripeCustomer.user_id == user_id).first()


def get_customer_id(db: Session, user: User, create: bool = True) -> Optional[str]:
    row = _customer_row(db, user.id)
    if row:
        return row.stripe_customer_id
    if not create:
        return None
    if settings.PAYMENT_SANDBOX:
        cid = f"sbx_cus_{uuid.uuid4().hex[:12]}"
    else:
        if not stripe_configured():
            raise CardError("Le paiement par carte n'est pas encore configuré par l'administrateur.")
        try:
            customer = stripe.Customer.create(
                email=getattr(user, "email", None) or None,
                name=getattr(user, "fullname", None) or None,
                phone=getattr(user, "phone", None) or None,
                metadata={"user_id": str(user.id), "platform": "mada_bienetre"},
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("Stripe Customer.create : %s", exc)
            raise CardError("Stripe est injoignable. Réessayez dans un instant.") from exc
        cid = customer.id
    db.add(StripeCustomer(user_id=user.id, stripe_customer_id=cid))
    db.commit()
    return cid


# ---------------------------------------------------------------------------
# Lecture + synchronisation avec Stripe
# ---------------------------------------------------------------------------
def _ensure_default(db: Session, user_id: int) -> None:
    cards = db.query(PaymentCard).filter(PaymentCard.user_id == user_id).order_by(PaymentCard.id).all()
    if cards and not any(c.is_default for c in cards):
        cards[0].is_default = True


def sync_cards(db: Session, user: User) -> Optional[str]:
    """Aligne la base sur les cartes réellement attachées au client Stripe.
    Ne lève jamais d'erreur : retourne le texte de l'erreur (ou None si tout va bien)."""
    try:
        _sync_cards(db, user)
        return None
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.exception("Synchronisation des cartes Stripe échouée")
        return f"{type(exc).__name__}: {str(getattr(exc, 'user_message', None) or exc)[:300]}"


def _sync_cards(db: Session, user: User) -> None:
    if settings.PAYMENT_SANDBOX or not stripe_configured():
        return
    cid = get_customer_id(db, user, create=False)
    if not cid:
        return
    remote = stripe.PaymentMethod.list(customer=cid, type="card", limit=20)

    local = {
        c.stripe_payment_method_id: c
        for c in db.query(PaymentCard).filter(PaymentCard.user_id == user.id).all()
    }
    seen = set()
    for raw_pm in _items(remote):
        pm = _d(raw_pm)
        pm_id = pm["id"]
        seen.add(pm_id)
        if pm_id in local:
            continue
        info = pm.get("card") or {}
        fp = info.get("fingerprint")
        if fp and any(c.fingerprint == fp for c in local.values()):
            # La même carte a été ajoutée deux fois : on détache le doublon chez Stripe.
            try:
                stripe.PaymentMethod.detach(pm_id)
            except Exception:  # noqa: BLE001
                pass
            continue
        card = PaymentCard(
            user_id=user.id,
            stripe_payment_method_id=pm_id,
            fingerprint=fp,
            brand=info.get("brand"),
            last4=info.get("last4"),
            exp_month=info.get("exp_month"),
            exp_year=info.get("exp_year"),
            holder_name=(pm.get("billing_details") or {}).get("name"),
            is_default=False,
        )
        db.add(card)
        local[pm_id] = card
    for pm_id, card in list(local.items()):
        if pm_id not in seen and not pm_id.startswith("sbx_"):
            db.delete(card)  # supprimée côté Stripe
    db.flush()
    _ensure_default(db, user.id)
    db.commit()


def list_cards(db: Session, user: User, sync: bool = True) -> List[Dict[str, Any]]:
    if sync:
        sync_cards(db, user)
    rows = (
        db.query(PaymentCard)
        .filter(PaymentCard.user_id == user.id)
        .order_by(PaymentCard.is_default.desc(), PaymentCard.id.desc())
        .all()
    )
    return [serialize(c, getattr(user, "fullname", None)) for c in rows]


def get_card(db: Session, user_id: int, card_id: int) -> PaymentCard:
    card = (
        db.query(PaymentCard)
        .filter(PaymentCard.id == card_id, PaymentCard.user_id == user_id)
        .first()
    )
    if not card:
        raise CardError("Carte introuvable.")
    return card


def saved_card_for_payment(db: Session, user: User, card_id: int) -> Dict[str, Any]:
    """Données envoyées à Stripe pour débiter la carte choisie (la carte DOIT appartenir à l'utilisateur)."""
    card = get_card(db, user.id, card_id)
    cid = get_customer_id(db, user, create=False)
    if not cid:
        raise CardError("Aucune carte enregistrée pour ce compte.")
    return {
        "customer": cid,
        "payment_method": card.stripe_payment_method_id,
        "label": f"{BRAND_LABELS.get((card.brand or '').lower(), 'Carte')} •••• {card.last4}",
        "last4": card.last4,
        "brand": card.brand,
    }


# ---------------------------------------------------------------------------
# Ajout d'une carte : formulaire sécurisé Stripe
# ---------------------------------------------------------------------------
def start_setup(db: Session, user: User, return_url: Optional[str] = None) -> Dict[str, Any]:
    """Retourne {url} (page Stripe) ou, en mode test, {added: carte de démonstration}."""
    if settings.PAYMENT_SANDBOX:
        cid = get_customer_id(db, user)  # noqa: F841 (crée le lien client de démonstration)
        has_default = (
            db.query(PaymentCard).filter(PaymentCard.user_id == user.id, PaymentCard.is_default.is_(True)).count() > 0
        )
        card = PaymentCard(
            user_id=user.id,
            stripe_payment_method_id=f"sbx_pm_{uuid.uuid4().hex[:14]}",
            fingerprint=None,
            brand="visa",
            last4="4242",
            exp_month=12,
            exp_year=2030,
            holder_name=getattr(user, "fullname", None),
            is_default=not has_default,
        )
        db.add(card)
        db.commit()
        db.refresh(card)
        return {"url": None, "added": serialize(card, getattr(user, "fullname", None)), "sandbox": True}

    if not stripe_configured():
        raise CardError("Le paiement par carte n'est pas encore configuré par l'administrateur.")
    cid = get_customer_id(db, user)
    base = gateway.resolve_return(return_url)
    # Sans payment_method_types, Stripe exige une devise en mode « setup » (même devise que les paiements).
    setup_currency = gateway.stripe_amount(1000)[0]
    try:
        session = stripe.checkout.Session.create(
            mode="setup",
            currency=setup_currency,
            # ⚠️ pas de payment_method_types : l'API Stripe récente le refuse sur Checkout.
            # Les moyens de paiement se activent dans Dashboard > Paramètres > Moyens de paiement.
            customer=cid,
            locale=(settings.STRIPE_LOCALE or "auto"),
            metadata={"user_id": str(user.id), "purpose": "save_card"},
            success_url=_with_query(base, "card_setup=1&session_id={CHECKOUT_SESSION_ID}"),
            cancel_url=_with_query(base, "card_setup=0"),
        )
    except Exception as exc:  # noqa: BLE001
        reason = str(getattr(exc, "user_message", None) or exc)
        logger.error("Stripe setup session : %s", reason)
        raise CardError(f"Stripe a refusé l'ouverture du formulaire : {reason[:200]}") from exc
    return {"url": session.url, "session_id": session.id, "sandbox": False}


# ---------------------------------------------------------------------------
# Formulaire INTÉGRÉ (Stripe Elements) : SetupIntent
# ---------------------------------------------------------------------------
def create_setup_intent(db: Session, user: User) -> Dict[str, Any]:
    """Prépare l'enregistrement d'une carte SANS quitter l'application.
    Le navigateur / le SDK mobile envoie la carte directement à Stripe avec le client_secret retourné ;
    notre serveur ne voit jamais le numéro."""
    if settings.PAYMENT_SANDBOX:
        raise CardError("Mode test : utilisez la carte de démonstration.")
    if not stripe_configured() or not settings.STRIPE_PUBLISHABLE_KEY:
        raise CardError("Le paiement par carte n'est pas encore configuré par l'administrateur (clés Stripe).")
    cid = get_customer_id(db, user)
    try:
        intent = stripe.SetupIntent.create(
            customer=cid,
            # ⚠️ pas de payment_method_types (refusé par l'API Stripe récente) : on laisse Stripe gérer
            # les moyens de paiement du Dashboard ; allow_redirects=never = uniquement les cartes.
            automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
            usage="off_session",
            metadata={"user_id": str(user.id), "purpose": "save_card"},
        )
    except Exception as exc:  # noqa: BLE001
        reason = str(getattr(exc, "user_message", None) or exc)
        logger.error("Stripe SetupIntent : %s", reason)
        raise CardError(f"Stripe a refusé la préparation du formulaire : {reason[:200]}") from exc
    return {"client_secret": intent.client_secret, "publishable_key": settings.STRIPE_PUBLISHABLE_KEY}


# ---------------------------------------------------------------------------
# Carte par défaut / suppression
# ---------------------------------------------------------------------------
def set_default(db: Session, user: User, card_id: int) -> None:
    card = get_card(db, user.id, card_id)
    for c in db.query(PaymentCard).filter(PaymentCard.user_id == user.id).all():
        c.is_default = c.id == card.id
    db.commit()


def delete_card(db: Session, user: User, card_id: int) -> None:
    card = get_card(db, user.id, card_id)
    pm_id = card.stripe_payment_method_id
    if not pm_id.startswith("sbx_") and stripe_configured():
        try:
            stripe.PaymentMethod.detach(pm_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Détachement Stripe impossible (%s) : %s", pm_id, exc)
            raise CardError("Stripe n'a pas pu supprimer cette carte. Réessayez.") from exc
    was_default = bool(card.is_default)
    db.delete(card)
    db.flush()
    if was_default:
        _ensure_default(db, user.id)
    db.commit()


# ---------------------------------------------------------------------------
# Thérapeute : régler une commission avec une carte enregistrée
# ---------------------------------------------------------------------------
def charge_for_commission(db: Session, user: User, card_id: int, amount: float, reference: str) -> Dict[str, Any]:
    """Débite la carte choisie (on-session). Retourne {id, status}. Lève CardError si refusée."""
    saved = saved_card_for_payment(db, user, card_id)
    if settings.PAYMENT_SANDBOX or str(saved["payment_method"]).startswith("sbx_"):
        return {"id": f"SBX-CM-{uuid.uuid4().hex[:10].upper()}", "status": "succeeded"}
    currency, units = gateway.stripe_amount(float(amount))
    try:
        intent = stripe.PaymentIntent.create(
            amount=units,
            currency=currency,
            customer=saved["customer"],
            payment_method=saved["payment_method"],
            confirm=True,
            automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
            description=f"Mada Bien-être — commission {reference}",
            metadata={"purpose": "commission", "reference": reference, "user_id": str(user.id)},
        )
    except Exception as exc:  # noqa: BLE001
        reason = str(getattr(exc, "user_message", None) or exc)
        raise CardError(f"Carte refusée : {reason[:200]}") from exc
    if intent.status != "succeeded":
        try:
            stripe.PaymentIntent.cancel(intent.id)
        except Exception:  # noqa: BLE001
            pass
        raise CardError(
            "Votre banque demande une authentification supplémentaire : "
            "réglez la commission par Mobile Money, virement ou depuis votre solde."
        )
    return {"id": intent.id, "status": intent.status}
