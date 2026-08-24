from typing import Optional, Dict, Any
import uuid
import logging
import requests
from datetime import datetime
from ..core.config import settings

logger = logging.getLogger(__name__)

class VanilaPayService:
    """Service de paiement Vanila Pay (Madagascar)"""
    
    def __init__(self):
        self.api_url = settings.VANILA_PAY_API_URL
        self.api_key = settings.VANILA_PAY_API_KEY
        self.merchant_id = settings.VANILA_PAY_MERCHANT_ID
    
    def create_payment(
        self,
        amount: float,
        user_id: int,
        description: Optional[str] = None,
        callback_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Créer un paiement Vanila Pay"""
        try:
            transaction_id = f"VP_{uuid.uuid4().hex[:16]}"
            
            # Simuler un paiement Vanila Pay
            result = {
                "status": "pending",
                "transaction_id": transaction_id,
                "amount": amount,
                "user_id": user_id,
                "payment_url": f"https://vanila-pay.com/pay/{transaction_id}",
                "message": "Paiement Vanila Pay en attente de validation",
                "reference": f"REF_{uuid.uuid4().hex[:8]}",
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Si l'API est configurée, faire l'appel réel
            if self.api_url and self.api_key:
                try:
                    payload = {
                        "amount": amount,
                        "merchant_id": self.merchant_id,
                        "transaction_id": transaction_id,
                        "description": description or "Mada Bien-être Payment",
                        "callback_url": callback_url or "https://api.mada-bienetre.com/payments/vanila-callback"
                    }
                    
                    response = requests.post(
                        f"{self.api_url}/payment/create",
                        json=payload,
                        headers={"Authorization": f"Bearer {self.api_key}"},
                        timeout=30
                    )
                    
                    if response.status_code == 200:
                        result.update(response.json())
                    else:
                        logger.error(f"Vanila Pay API error: {response.status_code}")
                except Exception as e:
                    logger.error(f"Vanila Pay API call error: {e}")
            
            return result
            
        except Exception as e:
            logger.error(f"Vanila Pay payment error: {e}")
            return {
                "status": "failed",
                "error": str(e)
            }
    
    def verify_payment(self, transaction_id: str) -> Dict[str, Any]:
        """Vérifier le statut d'un paiement Vanila Pay"""
        try:
            result = {
                "transaction_id": transaction_id,
                "status": "pending",
                "verified_at": datetime.utcnow().isoformat()
            }
            
            # Si l'API est configurée, faire l'appel réel
            if self.api_url and self.api_key:
                try:
                    response = requests.get(
                        f"{self.api_url}/payment/verify/{transaction_id}",
                        headers={"Authorization": f"Bearer {self.api_key}"},
                        timeout=30
                    )
                    
                    if response.status_code == 200:
                        result.update(response.json())
                except Exception as e:
                    logger.error(f"Vanila Pay verification error: {e}")
            
            return result
            
        except Exception as e:
            logger.error(f"Vanila Pay verification error: {e}")
            return {"status": "failed", "error": str(e)}
    
    def handle_callback(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Gérer le callback de Vanila Pay"""
        try:
            transaction_id = data.get("transaction_id")
            status = data.get("status")
            
            if status == "success":
                return {
                    "status": "completed",
                    "transaction_id": transaction_id,
                    "verified_at": datetime.utcnow().isoformat(),
                    "message": "Paiement confirmé"
                }
            elif status == "failed":
                return {
                    "status": "failed",
                    "transaction_id": transaction_id,
                    "message": "Paiement échoué"
                }
            else:
                return {
                    "status": "pending",
                    "transaction_id": transaction_id,
                    "message": "Paiement en attente"
                }
                
        except Exception as e:
            logger.error(f"Vanila Pay callback error: {e}")
            return {"status": "failed", "error": str(e)}

# Instance globale
vanila_pay_service = VanilaPayService()