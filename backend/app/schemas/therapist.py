# app/schemas/therapist.py
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime

class TherapistBase(BaseModel):
    fullname: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., pattern=r'^(\+261|0)[0-9]{9}$')
    bio: Optional[str] = Field(None, max_length=1000)
    experience_years: int = Field(0, ge=0, le=50)
    base_price: Optional[float] = Field(None, ge=0)
    service_radius: int = Field(10, ge=1, le=100)

class TherapistCreate(TherapistBase):
    password: str = Field(..., min_length=8)
    identity_document_url: Optional[str] = None
    certificate_url: Optional[str] = None

class TherapistUpdate(BaseModel):
    fullname: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, pattern=r'^(\+261|0)[0-9]{9}$')
    bio: Optional[str] = Field(None, max_length=1000)
    experience_years: Optional[int] = Field(None, ge=0, le=50)
    base_price: Optional[float] = Field(None, ge=0)
    service_radius: Optional[int] = Field(None, ge=1, le=100)
    is_online: Optional[bool] = None
    is_available: Optional[bool] = None
    profile_image: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)

class TherapistResponse(TherapistBase):
    id: int
    rating: float
    total_reviews: int
    verification_status: str
    is_online: bool
    is_available: bool
    profile_image: Optional[str]
    identity_document_url: Optional[str]
    certificate_url: Optional[str]
    commission_rate: float
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class TherapistApplicationRequest(BaseModel):
    bio: str = Field(..., min_length=10, max_length=1000)
    experience_years: int = Field(..., ge=0, le=50)
    base_price: float = Field(..., ge=0)
    service_radius: int = Field(10, ge=1, le=100)

class TherapistApplicationResponse(BaseModel):
    message: str
    verification_status: str = "pending"
    application_id: int

class TherapistListResponse(BaseModel):
    id: int
    fullname: str
    profile_image: Optional[str]
    rating: float
    total_reviews: int
    base_price: Optional[float]
    is_online: bool
    is_available: bool
    distance_meters: Optional[float] = 0
    experience_years: int
    
    class Config:
        from_attributes = True

class TherapistDetailResponse(TherapistResponse):
    specialties: Optional[List[str]] = []
    availability: Optional[List[dict]] = []
    recent_reviews: Optional[List[dict]] = []

class TherapistStatusResponse(BaseModel):
    verification_status: str
    is_active: bool
    is_online: bool
    is_available: bool

class TherapistEarningsResponse(BaseModel):
    period: str
    total_bookings: int
    total_earnings: float
    commission_rate: float
    commission_amount: float
    net_earnings: float
    start_date: datetime
    end_date: datetime

class TherapistLocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    is_online: Optional[bool] = None

class TherapistSpecialtyCreate(BaseModel):
    massage_type_id: int = Field(..., gt=0)

class TherapistSpecialtyResponse(BaseModel):
    id: int
    therapist_id: int
    massage_type_id: int
    massage_type_name: Optional[str] = None
    
    class Config:
        from_attributes = True