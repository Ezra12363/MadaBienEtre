# app/schemas/negotiation.py

from pydantic import BaseModel, Field

from typing import Optional

from datetime import datetime


# ============================================================
# CREATE OFFER
# ============================================================

class NegotiationCreate(BaseModel):

    booking_id: int = Field(
        ...,
        gt=0,
    )

    price_offered: float = Field(
        ...,
        gt=0,
    )

    message: Optional[str] = Field(
        None,
        max_length=500,
    )


# ============================================================
# OFFER RESPONSE
# ============================================================

class NegotiationResponse(BaseModel):

    id: int

    booking_id: int

    user_id: int

    user_type: str

    price_offered: float

    message: Optional[str] = None

    status: str

    created_at: datetime

    expires_at: Optional[datetime] = None

    user_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================
# ACCEPT RESPONSE
# ============================================================

class OfferAcceptResponse(BaseModel):

    message: str

    final_price: float

    booking_id: int

    status: str = "confirmed"

    therapist_id: Optional[int] = None


# ============================================================
# COUNTER OFFER
# ============================================================

class CounterOfferRequest(BaseModel):

    counter_price: float = Field(
        ...,
        gt=0,
    )

    message: Optional[str] = Field(
        None,
        max_length=500,
    )