# app/schemas/negotiation.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class NegotiationCreate(BaseModel):
    booking_id: int = Field(..., gt=0)
    price_offered: float = Field(..., gt=0)
    message: Optional[str] = Field(None, max_length=500)

class NegotiationResponse(BaseModel):
    id: int
    booking_id: int
    user_id: int
    user_type: str
    price_offered: float
    message: Optional[str]
    status: str
    created_at: datetime
    expires_at: Optional[datetime]
    user_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class OfferAcceptResponse(BaseModel):
    message: str
    final_price: float
    booking_id: int
    status: str = "confirmed"

class CounterOfferRequest(BaseModel):
    counter_price: float = Field(..., gt=0)
    message: Optional[str] = Field(None, max_length=500)