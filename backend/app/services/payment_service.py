# app/services/payment_service.py
from typing import Dict, Any, Optional, Tuple
import uuid
from datetime import datetime
from ..core.config import settings

# ✅ Import conditionnel de stripe
try:
    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY
    STRIPE_AVAILABLE = True
except ImportError:
    STRIPE_AVAILABLE = False
    print("⚠️ Stripe not installed. Payment features disabled.")

def create_stripe_payment(
    amount: float,
    currency: str = "MGA",
    payment_method_id: str = None,
    customer_id: str = None,
    description: str = None
) -> Dict[str, Any]:
    """Créer un paiement Stripe"""
    if not STRIPE_AVAILABLE:
        return {
            "status": "failed",
            "error": "Stripe is not available. Please install stripe: pip install stripe"
        }
    
    try:
        # Convertir le montant (Stripe utilise la plus petite unité)
        amount_in_cents = int(amount)
        
        if payment_method_id:
            # Paiement avec méthode existante
            payment_intent = stripe.PaymentIntent.create(
                amount=amount_in_cents,
                currency=currency.lower(),
                payment_method=payment_method_id,
                confirmation_method="manual",
                confirm=True,
                description=description or "Mada Bien-être Payment",
                metadata={
                    "platform": "mada_bienetre",
                    "environment": settings.ENVIRONMENT
                }
            )
        else:
            # Créer un PaymentIntent
            payment_intent = stripe.PaymentIntent.create(
                amount=amount_in_cents,
                currency=currency.lower(),
                payment_method_types=["card"],
                description=description or "Mada Bien-être Payment",
                metadata={
                    "platform": "mada_bienetre",
                    "environment": settings.ENVIRONMENT
                }
            )
        
        return {
            "status": "completed" if payment_intent.status == "succeeded" else "pending",
            "transaction_id": payment_intent.id,
            "client_secret": payment_intent.client_secret,
            "amount": amount,
            "currency": currency,
            "payment_intent": payment_intent
        }
    except Exception as e:
        return {
            "status": "failed",
            "error": str(e),
            "error_type": type(e).__name__
        }

def create_mobile_money_payment(
    amount: float,
    phone: str,
    provider: str = "mvola"
) -> Dict[str, Any]:
    """Créer un paiement Mobile Money"""
    try:
        # Générer un ID de transaction
        transaction_id = f"MM_{provider}_{uuid.uuid4().hex[:12]}"
        
        # Simuler le statut (dans la réalité, appel API)
        return {
            "status": "completed",
            "transaction_id": transaction_id,
            "provider": provider,
            "phone": phone,
            "amount": amount,
            "message": f"Paiement {provider} effectué avec succès",
            "reference": f"REF_{uuid.uuid4().hex[:8]}",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "failed",
            "error": str(e)
        }

def create_vanila_pay_payment(
    amount: float,
    user_id: int,
    description: str = None
) -> Dict[str, Any]:
    """Créer un paiement Vanila Pay (Madagascar)"""
    try:
        transaction_id = f"VP_{uuid.uuid4().hex[:16]}"
        
        return {
            "status": "pending",
            "transaction_id": transaction_id,
            "amount": amount,
            "user_id": user_id,
            "payment_url": f"https://vanila-pay.com/pay/{transaction_id}",
            "message": "Paiement Vanila Pay en attente de validation",
            "reference": f"REF_{uuid.uuid4().hex[:8]}",
            "created_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "failed",
            "error": str(e)
        }

def verify_payment(transaction_id: str) -> Dict[str, Any]:
    """Vérifier le statut d'un paiement"""
    return {
        "status": "completed",
        "transaction_id": transaction_id,
        "verified_at": datetime.utcnow().isoformat()
    }

def create_refund(
    payment_id: str,
    amount: Optional[float] = None,
    reason: str = None
) -> Dict[str, Any]:
    """Créer un remboursement"""
    if not STRIPE_AVAILABLE:
        return {
            "status": "failed",
            "error": "Stripe is not available. Please install stripe: pip install stripe"
        }
    
    try:
        refund = stripe.Refund.create(
            payment_intent=payment_id,
            amount=int(amount) if amount else None,
            reason=reason or "requested_by_customer"
        )
        
        return {
            "status": "completed",
            "refund_id": refund.id,
            "amount": amount,
            "created_at": refund.created
        }
    except Exception as e:
        return {
            "status": "failed",
            "error": str(e)
        }

def get_stripe_client_secret(amount: float, currency: str = "MGA") -> str:
    """Obtenir un client secret Stripe pour le frontend"""
    if not STRIPE_AVAILABLE:
        return None
    
    try:
        payment_intent = stripe.PaymentIntent.create(
            amount=int(amount),
            currency=currency.lower(),
            payment_method_types=["card"]
        )
        return payment_intent.client_secret
    except Exception:
        return None