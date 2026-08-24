import stripe
from typing import Optional, Dict, Any
import logging
from ..core.config import settings

logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY

class StripePaymentService:
    """Service de paiement Stripe"""
    
    def __init__(self):
        self.secret_key = settings.STRIPE_SECRET_KEY
        self.publishable_key = settings.STRIPE_PUBLISHABLE_KEY
        self.webhook_secret = settings.STRIPE_WEBHOOK_SECRET
    
    def create_payment_intent(
        self,
        amount: float,
        currency: str = "MGA",
        customer_id: Optional[str] = None,
        payment_method_id: Optional[str] = None,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Créer un PaymentIntent Stripe"""
        try:
            # Convertir le montant (Stripe utilise la plus petite unité)
            # MGA n'a pas de centimes, donc 1 MGA = 1 unité
            amount_in_cents = int(amount)
            
            payment_intent_params = {
                "amount": amount_in_cents,
                "currency": currency.lower(),
                "payment_method_types": ["card"],
                "description": description or "Mada Bien-être Payment",
                "metadata": {
                    "platform": "mada_bienetre",
                    "environment": settings.ENVIRONMENT,
                    **(metadata or {})
                }
            }
            
            if customer_id:
                payment_intent_params["customer"] = customer_id
            
            if payment_method_id:
                payment_intent_params["payment_method"] = payment_method_id
                payment_intent_params["confirm"] = True
                payment_intent_params["off_session"] = False
            
            payment_intent = stripe.PaymentIntent.create(**payment_intent_params)
            
            return {
                "id": payment_intent.id,
                "client_secret": payment_intent.client_secret,
                "status": payment_intent.status,
                "amount": amount,
                "currency": currency,
                "created": payment_intent.created
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error: {e}")
            return {
                "error": str(e),
                "error_type": type(e).__name__,
                "status": "failed"
            }
    
    def confirm_payment_intent(self, payment_intent_id: str) -> Dict[str, Any]:
        """Confirmer un PaymentIntent"""
        try:
            payment_intent = stripe.PaymentIntent.confirm(payment_intent_id)
            return {
                "id": payment_intent.id,
                "status": payment_intent.status,
                "amount": payment_intent.amount / 100,
                "currency": payment_intent.currency
            }
        except stripe.error.StripeError as e:
            logger.error(f"Stripe confirm error: {e}")
            return {"error": str(e), "status": "failed"}
    
    def create_refund(
        self,
        payment_intent_id: str,
        amount: Optional[float] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Créer un remboursement"""
        try:
            refund_params = {
                "payment_intent": payment_intent_id,
                "reason": reason or "requested_by_customer"
            }
            
            if amount:
                refund_params["amount"] = int(amount)
            
            refund = stripe.Refund.create(**refund_params)
            
            return {
                "id": refund.id,
                "status": refund.status,
                "amount": refund.amount / 100,
                "created": refund.created
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe refund error: {e}")
            return {"error": str(e), "status": "failed"}
    
    def create_customer(self, email: str, name: str, phone: Optional[str] = None) -> Dict[str, Any]:
        """Créer un client Stripe"""
        try:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                phone=phone,
                metadata={"platform": "mada_bienetre"}
            )
            return {
                "id": customer.id,
                "email": customer.email,
                "name": customer.name
            }
        except stripe.error.StripeError as e:
            logger.error(f"Stripe customer creation error: {e}")
            return {"error": str(e)}
    
    def attach_payment_method(self, customer_id: str, payment_method_id: str) -> bool:
        """Attacher une méthode de paiement à un client"""
        try:
            stripe.PaymentMethod.attach(
                payment_method_id,
                customer=customer_id
            )
            return True
        except stripe.error.StripeError as e:
            logger.error(f"Stripe attach payment method error: {e}")
            return False
    
    def handle_webhook(self, payload: bytes, sig_header: str) -> Dict[str, Any]:
        """Gérer un webhook Stripe"""
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, self.webhook_secret
            )
            
            return {
                "id": event.id,
                "type": event.type,
                "data": event.data.object,
                "created": event.created
            }
            
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Stripe webhook signature error: {e}")
            return {"error": "Invalid signature"}
        except Exception as e:
            logger.error(f"Stripe webhook error: {e}")
            return {"error": str(e)}

# Instance globale
stripe_service = StripePaymentService()