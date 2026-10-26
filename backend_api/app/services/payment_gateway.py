# app/services/payment_gateway.py
"""
Passerelle de paiement : Vanila Pay (Mobile Money + carte) et Stripe (carte).

RÈGLE D'OR : un paiement n'est « completed » que si le FOURNISSEUR le confirme
(vérification serveur-à-serveur via check_payment(), ou webhook signé).
Jamais sur la simple déclaration du client / une capture d'écran.

┌──────────────────────────────────────────────────────────────────────┐
│ OÙ METTRE LES CLÉS API ?  ->  fichier  .env  du BACKEND (racine)     │
│                                                                      │
│   VANILA_PAY_API_KEY=...                                             │
│   VANILA_PAY_MERCHANT_ID=...                                         │
│   VANILA_PAY_API_URL=https://api.vanila-pay.com/v1                   │
│   VANILA_PAY_WEBHOOK_SECRET=...                                      │
│   STRIPE_SECRET_KEY=sk_live_...        (ou sk_test_...)              │
│   STRIPE_PUBLISHABLE_KEY=pk_live_...                                 │
│   STRIPE_WEBHOOK_SECRET=whsec_...                                    │
│   PAYMENT_SANDBOX=False                                              │
│                                                                      │
│ Jamais dans l'application mobile ni dans Git.                        │
└──────────────────────────────────────────────────────────────────────┘

⚠️ L'API Vanila Pay n'est pas documentée publiquement ici : les chemins
(VANILA_PAY_CREATE_PATH / VANILA_PAY_STATUS_PATH), les champs envoyés dans
start_payment() et la lecture du statut dans _map_status() sont à ajuster
selon la documentation officielle remise par Vanila Pay.
"""
import hashlib
import re
from urllib.parse import quote
import hmac
import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from urllib import error as urlerror
from urllib import request as urlrequest

from ..core.config import settings

logger = logging.getLogger(__name__)

try:  # Stripe est optionnel
    import stripe

    stripe.api_key = settings.STRIPE_SECRET_KEY or None
    STRIPE_AVAILABLE = True
except ImportError:  # pragma: no cover
    stripe = None
    STRIPE_AVAILABLE = False

MOBILE_PROVIDERS = ("mvola", "orange_money", "airtel_money")


class GatewayError(Exception):
    """Erreur de communication / configuration avec le fournisseur."""


# Devises Stripe « zéro décimale » (le montant s'envoie tel quel, sans ×100). MGA en fait partie.
_ZERO_DECIMAL = {
    "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg",
    "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
}


def stripe_amount(amount_mga: float):
    """(devise, montant) à envoyer à Stripe.

    - STRIPE_CURRENCY=mga (défaut) : montant en Ariary tel quel.
    - autre devise (eur, usd...) : conversion avec STRIPE_MGA_PER_UNIT (ex. 5000 Ar = 1 EUR).
    """
    cur = (settings.STRIPE_CURRENCY or "mga").lower()
    if cur == "mga":
        return cur, int(round(amount_mga))
    rate = float(settings.STRIPE_MGA_PER_UNIT or 0)
    if rate <= 0:
        raise GatewayError(
            f"Devise Stripe « {cur} » : renseignez STRIPE_MGA_PER_UNIT dans le .env du backend "
            "(nombre d'Ariary pour 1 unité de cette devise)."
        )
    value = float(amount_mga) / rate
    units = int(round(value)) if cur in _ZERO_DECIMAL else int(round(value * 100))
    return cur, max(units, 1)


def _with_query(base: str, params: str) -> str:
    """Ajoute des paramètres à une URL (gère le « ? » déjà présent). Ne pas encoder {CHECKOUT_SESSION_ID}."""
    base = (base or "").rstrip("/") if "?" not in (base or "") else base
    return f"{base}{'&' if '?' in base else '?'}{params}"


# ------------------------------------------------------------------
# Disponibilité des moyens de paiement
# ------------------------------------------------------------------
def vanila_configured() -> bool:
    return bool(settings.VANILA_PAY_API_KEY and settings.VANILA_PAY_MERCHANT_ID)


def default_return_url() -> str:
    """URL de retour après Stripe (web et mobile). Si FRONTEND_URL est vide ou pointe vers l'API elle-même,
    on utilise la petite page « Terminé, retournez dans l'application » servie par le backend."""
    base = (getattr(settings, "FRONTEND_URL", "") or "").strip().rstrip("/")
    api = (getattr(settings, "BASE_URL", "") or "").strip().rstrip("/")
    if not base or base == api:
        return f"{api}/cards/return"
    return base


def resolve_return(base: Optional[str]) -> str:
    """URL de retour après Stripe :
      - http(s)://...  -> l'application WEB (la page de l'app s'ouvre directement) ;
      - monappli://... -> deep link MOBILE : passe par la page /cards/return qui rouvre l'application ;
      - vide / invalide -> page de retour du backend."""
    base = (base or "").strip()
    if not base:
        return default_return_url()
    if base.lower().startswith(("http://", "https://")):
        return base
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", base) and not base.lower().startswith(("javascript:", "data:")):
        api = (getattr(settings, "BASE_URL", "") or "").strip().rstrip("/")
        return f"{api}/cards/return?app={quote(base, safe='')}"
    return default_return_url()


def stripe_configured() -> bool:
    return bool(STRIPE_AVAILABLE and settings.STRIPE_SECRET_KEY)


def available_methods() -> Dict[str, Any]:
    from . import platform_settings

    cfg = platform_settings.get_config()
    sandbox = bool(settings.PAYMENT_SANDBOX)
    mobile = (vanila_configured() or sandbox) and cfg["mobile_money_enabled"]
    card = (stripe_configured() or vanila_configured() or sandbox) and cfg["card_enabled"]
    return {
        "sandbox": sandbox,
        "mobile_money": {
            "enabled": mobile,
            "providers": [
                {"id": "mvola", "name": "MVola", "enabled": mobile and cfg["mvola_enabled"]},
                {"id": "orange_money", "name": "Orange Money", "enabled": mobile and cfg["orange_money_enabled"]},
                {"id": "airtel_money", "name": "Airtel Money", "enabled": mobile and cfg["airtel_money_enabled"]},
            ],
        },
        "card": {
            "enabled": card,
            "provider": "stripe" if stripe_configured() else "vanila_pay",
        },
        "cash": {"enabled": bool(cfg["cash_enabled"])},
    }


# ------------------------------------------------------------------
# HTTP minimal (stdlib) vers Vanila Pay
# ------------------------------------------------------------------
def _vanila_request(method: str, path: str, payload: Optional[dict] = None) -> Dict[str, Any]:
    url = settings.VANILA_PAY_API_URL.rstrip("/") + path
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urlrequest.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {settings.VANILA_PAY_API_KEY}")
    req.add_header("X-Merchant-Id", str(settings.VANILA_PAY_MERCHANT_ID))
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")
    try:
        with urlrequest.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8") or "{}"
            return json.loads(body)
    except urlerror.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")[:300]
        logger.error("Vanila Pay HTTP %s : %s", exc.code, detail)
        raise GatewayError(f"Vanila Pay a refusé la requête ({exc.code}).") from exc
    except Exception as exc:  # noqa: BLE001
        logger.error("Vanila Pay injoignable : %s", exc)
        raise GatewayError("Vanila Pay est injoignable. Réessayez plus tard.") from exc


def map_status(raw: Optional[str]) -> str:
    s = str(raw or "").lower()
    if s in ("completed", "success", "succeeded", "paid", "successful", "confirmed"):
        return "completed"
    if s in ("failed", "declined", "error", "rejected", "expired"):
        return "failed"
    if s in ("cancelled", "canceled"):
        return "cancelled"
    return "pending"


# ------------------------------------------------------------------
# Démarrer un paiement
# ------------------------------------------------------------------
def start_payment(
    *,
    method: str,
    provider: Optional[str],
    amount: float,
    payment_id: int,
    booking_id: int,
    phone: Optional[str],
    payer_name: Optional[str],
    payer_email: Optional[str],
    return_url: Optional[str] = None,
    saved_card: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Retourne : {transaction_id, status, provider, payment_url?, instructions}
    """
    amount_int = int(round(amount))
    reference = f"MBE-{payment_id}-{uuid.uuid4().hex[:8].upper()}"

    # ---- MODE TEST (explicite) ------------------------------------------------
    if settings.PAYMENT_SANDBOX:
        return {
            "transaction_id": f"SBX-{reference}",
            "status": "pending",
            "provider": provider or ("stripe" if method == "card" else "vanila_pay"),
            "payment_url": None,
            "instructions": "MODE TEST : le paiement sera confirmé automatiquement "
            "quelques secondes après la demande.",
            "sandbox": True,
        }

    # ---- Carte ENREGISTRÉE (profil > Mode de paiement) : débit direct chez Stripe ----
    # saved_card = {"customer": "cus_...", "payment_method": "pm_..."}
    # Aucun numéro de carte ne transite par l'application ni par notre serveur.
    if method == "card" and saved_card and stripe_configured():
        currency, unit_amount = stripe_amount(amount)
        try:
            intent = stripe.PaymentIntent.create(
                amount=unit_amount,
                currency=currency,
                customer=saved_card["customer"],
                payment_method=saved_card["payment_method"],
                confirm=True,
                automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
                description=f"Mada Bien-être — réservation #{booking_id}",
                receipt_email=payer_email or None,
                metadata={"payment_id": str(payment_id), "booking_id": str(booking_id)},
            )
        except Exception as exc:  # noqa: BLE001
            reason = str(getattr(exc, "user_message", None) or exc)
            logger.error("Stripe (carte enregistrée) : %s", reason)
            raise GatewayError(f"Carte refusée : {reason[:200]}") from exc

        if intent.status == "requires_action":
            # La banque exige une authentification 3D Secure : impossible sans page Stripe.
            # On annule cette tentative et on retombe sur la page sécurisée Stripe (ci-dessous).
            try:
                stripe.PaymentIntent.cancel(intent.id)
            except Exception:  # noqa: BLE001
                pass
            logger.info("3D Secure requis : bascule sur Stripe Checkout")
        else:
            return {
                "transaction_id": intent.id,
                "status": "pending",  # confirmé juste après par check_payment() (serveur-à-serveur)
                "provider": "stripe",
                "payment_url": None,
                "instructions": "Paiement par carte en cours de vérification…",
                "card": {k: v for k, v in saved_card.items() if k not in ("customer", "payment_method")},
            }

    # ---- Carte : Stripe Checkout hébergé (la carte ne passe JAMAIS par l'app) ---
    if method == "card" and stripe_configured():
        base = resolve_return(return_url)
        currency, unit_amount = stripe_amount(amount)
        try:
            # Stripe Checkout = page de paiement HÉBERGÉE par Stripe : le numéro de carte y est
            # saisi dans un champ masqué/formaté automatiquement (1234 1234 1234 1234, date, CVC,
            # détection de la marque). Aucune donnée de carte ne passe par notre application.
            session = stripe.checkout.Session.create(
                mode="payment",
                # (payment_method_types retiré : refusé par l'API Stripe récente, voir Dashboard)
                locale=(settings.STRIPE_LOCALE or "auto"),
                client_reference_id=str(payment_id),
                customer_email=payer_email or None,
                line_items=[
                    {
                        "quantity": 1,
                        "price_data": {
                            "currency": currency,
                            "unit_amount": unit_amount,
                            "product_data": {"name": f"Massage — réservation #{booking_id}"},
                        },
                    }
                ],
                metadata={"payment_id": str(payment_id), "booking_id": str(booking_id)},
                payment_intent_data={
                    "description": f"Mada Bien-être — réservation #{booking_id}",
                    "metadata": {"payment_id": str(payment_id), "booking_id": str(booking_id)},
                },
                success_url=_with_query(
                    base, f"paid=1&payment_id={payment_id}&booking_id={booking_id}&session_id={{CHECKOUT_SESSION_ID}}"
                ),
                cancel_url=_with_query(base, f"paid=0&payment_id={payment_id}&booking_id={booking_id}"),
            )
        except Exception as exc:  # noqa: BLE001
            reason = str(getattr(exc, "user_message", None) or exc)
            logger.error("Stripe : %s", reason)
            raise GatewayError(f"Stripe a refusé la création du paiement : {reason[:200]}") from exc
        return {
            "transaction_id": session.id,
            "status": "pending",
            "provider": "stripe",
            "payment_url": session.url,
            "instructions": "Terminez le paiement sécurisé dans la page ouverte.",
        }

    # ---- Mobile Money / carte via Vanila Pay -----------------------------------
    if method in ("mobile_money", "card", "vanila_pay"):
        if not vanila_configured():
            raise GatewayError(
                "Ce moyen de paiement n'est pas encore configuré (clés Vanila Pay manquantes)."
            )
        payload = {
            "merchant_id": settings.VANILA_PAY_MERCHANT_ID,
            "reference": reference,
            "amount": amount_int,
            "currency": "MGA",
            "description": f"Massage — réservation #{booking_id}",
            "channel": provider if method == "mobile_money" else "card",
            "phone": phone,
            "customer_name": payer_name,
            "customer_email": payer_email,
            "callback_url": f"{settings.BASE_URL}/payments/webhook/vanila-pay",
            "return_url": resolve_return(return_url),
        }
        data = _vanila_request("POST", settings.VANILA_PAY_CREATE_PATH, payload)
        tx = str(data.get("id") or data.get("transaction_id") or reference)
        return {
            "transaction_id": tx,
            "status": map_status(data.get("status")),
            "provider": provider if method == "mobile_money" else "vanila_pay",
            "payment_url": data.get("payment_url") or data.get("checkout_url"),
            "instructions": data.get("message")
            or "Validez le paiement sur votre téléphone (code USSD / notification).",
        }

    raise GatewayError("Moyen de paiement inconnu.")


# ------------------------------------------------------------------
# Contrôle du montant encaissé (anomalie « montant non conforme »)
# ------------------------------------------------------------------
def _with_amount_check(payment, result: Dict[str, Any], paid_units, paid_currency) -> Dict[str, Any]:
    """Compare ce que Stripe a réellement encaissé avec ce que le serveur attendait."""
    try:
        if paid_units is None:
            return result
        exp_currency, exp_units = stripe_amount(float(payment.amount or 0))
        got_currency = str(paid_currency or exp_currency).lower()
        if got_currency != exp_currency or abs(int(paid_units) - int(exp_units)) > 1:
            result = dict(result)
            result["mismatch"] = {
                "expected": f"{exp_units} {exp_currency.upper()}",
                "received": f"{int(paid_units)} {got_currency.upper()}",
            }
    except Exception:  # noqa: BLE001  (ne jamais bloquer la vérification pour ça)
        logger.exception("Contrôle du montant Stripe impossible")
    return result


_BRANDS = {"visa": "Visa", "mastercard": "Mastercard", "amex": "American Express", "discover": "Discover",
           "jcb": "JCB", "diners": "Diners Club", "unionpay": "UnionPay"}


def _card_info(pm) -> Optional[Dict[str, Any]]:
    """Marque / 4 derniers chiffres / expiration de la carte qui a payé (jamais le numéro complet)."""
    try:
        card = getattr(pm, "card", None)
        if card is None:
            return None
        brand = str(getattr(card, "brand", "") or "").lower()
        last4 = getattr(card, "last4", None)
        month, year = getattr(card, "exp_month", None), getattr(card, "exp_year", None)
        if not last4:
            return None
        label = f"{_BRANDS.get(brand, brand.title() or 'Carte')} •••• {last4}"
        exp = f"{int(month):02d}/{str(year)[-2:]}" if month and year else None
        return {
            "brand": brand, "last4": last4, "exp": exp, "label": label,
            "funding": getattr(card, "funding", None), "country": getattr(card, "country", None),
        }
    except Exception:  # noqa: BLE001
        return None


def _paid_card(kind: str, tx: str) -> Optional[Dict[str, Any]]:
    try:
        if kind == "pi":
            intent = stripe.PaymentIntent.retrieve(tx, expand=["payment_method"])
            return _card_info(intent.payment_method)
        session = stripe.checkout.Session.retrieve(tx, expand=["payment_intent.payment_method"])
        return _card_info(session.payment_intent.payment_method)
    except Exception:  # noqa: BLE001
        logger.warning("Carte du paiement %s illisible", tx)
        return None


def refund_stripe(payment) -> Optional[str]:
    """Rembourse VRAIMENT l'argent chez Stripe (paiement carte). Retourne l'id du remboursement,
    ou None si rien à rembourser chez un fournisseur (espèces, mode test...)."""
    tx = payment.transaction_id or ""
    if tx.startswith(("SBX-", "CASH-")) or not (payment.provider == "stripe" or tx.startswith(("cs_", "pi_"))):
        return None
    if not stripe_configured():
        raise GatewayError("Stripe n'est pas configuré : remboursement automatique impossible.")
    try:
        intent_id = tx
        if tx.startswith("cs_"):
            intent_id = stripe.checkout.Session.retrieve(tx).payment_intent
        refund = stripe.Refund.create(payment_intent=intent_id)
        return refund.id
    except Exception as exc:  # noqa: BLE001
        reason = str(getattr(exc, "user_message", None) or exc)
        logger.error("Remboursement Stripe : %s", reason)
        raise GatewayError(f"Remboursement Stripe refusé : {reason[:200]}") from exc


# ------------------------------------------------------------------
# Vérification serveur-à-serveur
# ------------------------------------------------------------------
def check_payment(payment) -> Dict[str, Any]:
    """Interroge le FOURNISSEUR. Retourne {status: pending|completed|failed|cancelled}."""
    tx = payment.transaction_id or ""

    if tx.startswith("SBX-"):
        if not settings.PAYMENT_SANDBOX:
            return {"status": "failed", "raw": "sandbox désactivé"}
        created = payment.created_at or datetime.utcnow()
        done = (datetime.utcnow() - created).total_seconds() >= 6
        return {"status": "completed" if done else "pending", "raw": "sandbox"}

    if tx.startswith("pi_"):
        # Paiement direct avec une carte enregistrée (PaymentIntent)
        if not stripe_configured():
            raise GatewayError("Stripe n'est pas configuré.")
        try:
            intent = stripe.PaymentIntent.retrieve(tx)
        except Exception as exc:  # noqa: BLE001
            raise GatewayError("Vérification Stripe impossible.") from exc
        if intent.status == "succeeded":
            return _with_amount_check(
                payment,
                {"status": "completed", "raw": intent.status, "card": _paid_card("pi", tx)},
                intent.amount,
                intent.currency,
            )
        if intent.status in ("canceled", "requires_payment_method"):
            return {"status": "failed", "raw": intent.status}
        return {"status": "pending", "raw": intent.status}

    if payment.provider == "stripe" or tx.startswith("cs_"):
        if not stripe_configured():
            raise GatewayError("Stripe n'est pas configuré.")
        try:
            session = stripe.checkout.Session.retrieve(tx)
        except Exception as exc:  # noqa: BLE001
            raise GatewayError("Vérification Stripe impossible.") from exc
        if session.payment_status == "paid":
            return _with_amount_check(
                payment,
                {"status": "completed", "raw": session.payment_status, "card": _paid_card("session", tx)},
                getattr(session, "amount_total", None),
                getattr(session, "currency", None),
            )
        if session.status == "expired":
            return {"status": "failed", "raw": "expired"}
        return {"status": "pending", "raw": session.payment_status}

    if not vanila_configured():
        raise GatewayError("Vanila Pay n'est pas configuré.")
    data = _vanila_request("GET", settings.VANILA_PAY_STATUS_PATH.format(id=tx))
    return {"status": map_status(data.get("status")), "raw": data.get("status")}


# ------------------------------------------------------------------
# Webhooks (signature obligatoire)
# ------------------------------------------------------------------
def verify_vanila_signature(body: bytes, signature: Optional[str]) -> bool:
    secret = settings.VANILA_PAY_WEBHOOK_SECRET
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.replace("sha256=", "").strip())


def parse_stripe_event(body: bytes, signature: Optional[str]):
    if not stripe_configured() or not settings.STRIPE_WEBHOOK_SECRET:
        raise GatewayError("Webhook Stripe non configuré.")
    try:
        return stripe.Webhook.construct_event(body, signature, settings.STRIPE_WEBHOOK_SECRET)
    except Exception as exc:  # noqa: BLE001
        raise GatewayError("Signature Stripe invalide.") from exc
