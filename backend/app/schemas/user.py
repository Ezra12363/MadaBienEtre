from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    fullname: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., pattern=r'^(\+261|0)[0-9]{9}$')
    role: Optional[str] = "CLIENT"

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserUpdate(BaseModel):
    fullname: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, pattern=r'^(\+261|0)[0-9]{9}$')
    profile_image: Optional[str] = None
    bio: Optional[str] = None
    experience_years: Optional[int] = Field(None, ge=0, le=50)
    is_online: Optional[bool] = None
    is_available: Optional[bool] = None
    service_radius: Optional[int] = Field(None, ge=1, le=100)
    base_price: Optional[float] = Field(None, ge=0)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)

class UserResponse(UserBase):
    id: int
    is_active: bool
    profile_image: Optional[str]
    rating: float
    total_reviews: int
    verification_status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class TherapistProfileResponse(BaseModel):
    id: int
    fullname: str
    email: EmailStr
    phone: str
    profile_image: Optional[str]
    bio: Optional[str]
    experience_years: int
    rating: float
    total_reviews: int
    base_price: Optional[float]
    service_radius: int
    is_online: bool
    is_available: bool
    verification_status: str
    identity_document_url: Optional[str]
    certificate_url: Optional[str]
    commission_rate: float
    created_at: datetime
    
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

class UserLocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)