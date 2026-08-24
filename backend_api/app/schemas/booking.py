from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class BookingCreate(BaseModel):
    massage_type_id: int = Field(..., gt=0)
    duration_minutes: int = Field(..., ge=30, le=180)
    preferred_gender: Optional[str] = Field("any", pattern="^(male|female|any)$")
    address: str = Field(..., min_length=5, max_length=500)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    scheduled_date: datetime
    client_price_proposed: float = Field(..., gt=0)
    special_instructions: Optional[str] = Field(None, max_length=500)

class BookingUpdate(BaseModel):
    status: Optional[str] = None
    therapist_id: Optional[int] = None
    final_price: Optional[float] = Field(None, gt=0)
    address: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    special_instructions: Optional[str] = None

class BookingCancelRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)

class BookingResponse(BaseModel):
    id: int
    client_id: int
    therapist_id: Optional[int]
    massage_type_id: Optional[int]
    status: str
    client_price_proposed: float
    final_price: Optional[float]
    address: str
    scheduled_date: datetime
    scheduled_duration_minutes: int
    preferred_gender: Optional[str]
    special_instructions: Optional[str]
    created_at: datetime
    updated_at: datetime
    client_name: Optional[str] = None
    therapist_name: Optional[str] = None
    massage_type_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class BookingDetailResponse(BookingResponse):
    client_phone: Optional[str] = None
    therapist_phone: Optional[str] = None
    client_latitude: Optional[float] = None
    client_longitude: Optional[float] = None
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    negotiation_history: Optional[List[dict]] = None

class BookingStatsResponse(BaseModel):
    total: int
    pending: int
    confirmed: int
    completed: int
    cancelled: int
    in_progress: int