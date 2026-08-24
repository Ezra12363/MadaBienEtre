# app/schemas/payment.py
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, Literal  # ✅ Ajout de Literal
from datetime import datetime

# ✅ Définition des types
PaymentMethod = Literal['mobile_money', 'card', 'cash', 'vanila_pay']
PaymentProvider = Literal['mvola', 'orange_money', 'airtel_money', 'stripe', 'vanila_pay']
PaymentStatus = Literal['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled']

class PaymentCreate(BaseModel):
    booking_id: int = Field(..., gt=0)
    method: PaymentMethod
    provider: Optional[PaymentProvider] = None
    phone_number: Optional[str] = Field(None, pattern=r'^(\+261|0)[0-9]{9}$')
    payment_method_id: Optional[str] = None
    card_token: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)

class PaymentResponse(BaseModel):
    id: int
    booking_id: int
    user_id: int
    amount: float
    currency: str
    method: str
    provider: Optional[str]
    status: str
    transaction_id: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class MobileMoneyPaymentRequest(BaseModel):
    phone: str = Field(..., pattern=r'^(\+261|0)[0-9]{9}$')
    amount: float = Field(..., gt=0)
    booking_id: int = Field(..., gt=0)
    provider: Literal['mvola', 'orange_money', 'airtel_money']

class CardPaymentRequest(BaseModel):
    amount: float = Field(..., gt=0)
    booking_id: int = Field(..., gt=0)
    payment_method_id: str
    currency: str = "MGA"

class VanilaPayPaymentRequest(BaseModel):
    amount: float = Field(..., gt=0)
    booking_id: int = Field(..., gt=0)
    description: Optional[str] = None

class PaymentHistoryResponse(BaseModel):
    id: int
    amount: float
    method: str
    status: str
    created_at: datetime
    booking_id: int
    massage_type: Optional[str] = None

class RefundRequest(BaseModel):
    payment_id: int = Field(..., gt=0)
    amount: Optional[float] = Field(None, gt=0)
    reason: str = Field(..., min_length=3, max_length=500)

class WithdrawalRequest(BaseModel):
    amount: float = Field(..., gt=0)
    method: Literal['bank_transfer', 'mobile_money', 'cash']
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_holder: Optional[str] = None
    phone_number: Optional[str] = Field(None, pattern=r'^(\+261|0)[0-9]{9}$')
    provider: Optional[str] = None

class PaymentMethodResponse(BaseModel):
    methods: list = [
        {"id": "mobile_money", "name": "Mobile Money", "icon": "phone"},
        {"id": "card", "name": "Carte Bancaire", "icon": "credit-card"},
        {"id": "vanila_pay", "name": "Vanila Pay", "icon": "shield"},
        {"id": "cash", "name": "Espèces", "icon": "cash"}
    ]
    
    class Config:
        from_attributes = True

# ✅ Export
__all__ = [
    'PaymentMethod',
    'PaymentProvider',
    'PaymentStatus',
    'PaymentCreate',
    'PaymentResponse',
    'MobileMoneyPaymentRequest',
    'CardPaymentRequest',
    'VanilaPayPaymentRequest',
    'PaymentHistoryResponse',
    'RefundRequest',
    'WithdrawalRequest',
    'PaymentMethodResponse'
]