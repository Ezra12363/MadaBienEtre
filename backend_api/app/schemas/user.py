# app/schemas/user.py
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime
import re

# ============================================================
# SCHÉMAS DE BASE
# ============================================================

class UserBase(BaseModel):
    fullname: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., pattern=r'^(\+261|0)[0-9]{9}$')
    role: Optional[str] = "CLIENT"

    @validator('phone')
    def validate_phone(cls, v):
        if v:
            v = re.sub(r'[\s\-]', '', v)
            if not re.match(r'^(\+261|0)[0-9]{9}$', v):
                raise ValueError('Format de téléphone invalide')
        return v


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Le mot de passe doit contenir au moins 8 caractères')
        return v


# ============================================================
# ✅ UserUpdate AVEC CIN
# ============================================================
class UserUpdate(BaseModel):
    fullname: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, pattern=r'^(\+261|0)[0-9]{9}$')
    profile_image: Optional[str] = None
    bio: Optional[str] = Field(None, max_length=500)
    experience_years: Optional[int] = Field(None, ge=0, le=50)
    is_online: Optional[bool] = None
    is_available: Optional[bool] = None
    service_radius: Optional[int] = Field(None, ge=1, le=100)
    base_price: Optional[float] = Field(None, ge=0)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    address: Optional[str] = Field(None, max_length=500)
    cin_number: Optional[str] = Field(None, max_length=30)  # ✅ CIN
    certificate_professionnel: Optional[str] = Field(None, max_length=255)  # ✅ Certificat professionnel

    @validator('phone')
    def validate_phone(cls, v):
        if v:
            v = re.sub(r'[\s\-]', '', v)
            if not re.match(r'^(\+261|0)[0-9]{9}$', v):
                raise ValueError('Format de téléphone invalide')
        return v


# ============================================================
# ✅ UserProfileUpdate AVEC CIN
# ============================================================
class UserProfileUpdate(BaseModel):
    fullname: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, pattern=r'^(\+261|0)[0-9]{9}$')
    bio: Optional[str] = Field(None, max_length=500)
    profile_image: Optional[str] = None
    experience_years: Optional[int] = Field(None, ge=0, le=50)
    service_radius: Optional[int] = Field(None, ge=1, le=100)
    base_price: Optional[float] = Field(None, ge=0)
    address: Optional[str] = Field(None, max_length=500)
    cin_number: Optional[str] = Field(None, max_length=30)  # ✅ CIN
    certificate_professionnel: Optional[str] = Field(None, max_length=255)  # ✅ Certificat professionnel

    @validator('phone')
    def validate_phone(cls, v):
        if v:
            v = re.sub(r'[\s\-]', '', v)
            if not re.match(r'^(\+261|0)[0-9]{9}$', v):
                raise ValueError('Format de téléphone invalide')
        return v


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=8)

    @validator('new_password')
    def validate_new_password(cls, v):
        if len(v) < 8:
            raise ValueError('Le nouveau mot de passe doit contenir au moins 8 caractères')
        return v


# ============================================================
# SCHÉMAS POUR LES ACTIONS ADMIN
# ============================================================
class UserActivateRequest(BaseModel):
    is_active: bool = Field(..., description="True pour activer, False pour désactiver")
    reason: Optional[str] = Field(None, max_length=500, description="Raison de l'action")


class UserPasswordResetRequest(BaseModel):
    send_email: bool = Field(True, description="Envoyer le nouveau mot de passe par email")


class UserBulkActionRequest(BaseModel):
    action: str = Field(..., description="Action: activate, deactivate, delete")
    user_ids: List[int] = Field(..., description="Liste des IDs des utilisateurs")
    reason: Optional[str] = Field(None, max_length=500, description="Raison de l'action")


# ============================================================
# SCHÉMAS DE RÉPONSE
# ============================================================

class UserResponse(UserBase):
    id: int
    is_active: bool = True
    profile_image: Optional[str] = None
    rating: float = 0.0
    total_reviews: int = 0
    verification_status: str = "pending"
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    
    bio: Optional[str] = None
    experience_years: Optional[int] = 0
    is_online: Optional[bool] = False
    is_available: Optional[bool] = True
    service_radius: Optional[int] = 10
    base_price: Optional[float] = None
    identity_document_url: Optional[str] = None
    certificate_url: Optional[str] = None
    commission_rate: Optional[float] = 10.0
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    cin_number: Optional[str] = None  # ✅ CIN
    certificate_professionnel: Optional[str] = None  # ✅ Certificat professionnel
    
    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    total: int
    page: int = 1
    page_size: int = 20
    items: List[UserResponse]


class UserStatsResponse(BaseModel):
    total: int = 0
    clients: int = 0
    therapists: int = 0
    admins: int = 0
    active: int = 0
    inactive: int = 0
    new_users_last_week: int = 0
    verified_therapists: int = 0
    online_therapists: int = 0


class TherapistProfileResponse(BaseModel):
    id: int
    fullname: str
    email: EmailStr
    phone: str
    profile_image: Optional[str] = None
    bio: Optional[str] = None
    experience_years: int = 0
    rating: float = 0.0
    total_reviews: int = 0
    base_price: Optional[float] = None
    service_radius: int = 10
    is_online: bool = False
    is_available: bool = True
    verification_status: str = "pending"
    identity_document_url: Optional[str] = None
    certificate_url: Optional[str] = None
    commission_rate: float = 10.0
    created_at: datetime
    total_bookings: int = 0
    total_revenue: float = 0.0
    response_rate: float = 0.0
    address: Optional[str] = None
    cin_number: Optional[str] = None  # ✅ CIN
    certificate_professionnel: Optional[str] = None  # ✅ Certificat professionnel
    
    class Config:
        from_attributes = True


# ============================================================
# ✅ SCHÉMAS POUR LA CANDIDATURE THÉRAPEUTE (manampy ireto)
# ============================================================
class TherapistApplicationRequest(BaseModel):
    bio: str = Field(..., min_length=10, max_length=1000)
    experience_years: int = Field(..., ge=0, le=50)
    base_price: float = Field(..., ge=0)
    service_radius: int = Field(10, ge=1, le=100)
    identity_document_url: Optional[str] = None
    certificate_url: Optional[str] = None


class TherapistApplicationResponse(BaseModel):
    message: str
    verification_status: str = "pending"
    application_id: int


class UserLocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

    @validator('latitude')
    def validate_latitude(cls, v):
        if v < -90 or v > 90:
            raise ValueError('La latitude doit être comprise entre -90 et 90')
        return v

    @validator('longitude')
    def validate_longitude(cls, v):
        if v < -180 or v > 180:
            raise ValueError('La longitude doit être comprise entre -180 et 180')
        return v


class UserSearchParams(BaseModel):
    query: str = Field(..., min_length=2)
    limit: int = Field(20, ge=1, le=100)
    role: Optional[str] = None


class TherapistFilters(BaseModel):
    online_only: bool = False
    verified_only: bool = False
    available_only: bool = False
    min_rating: Optional[float] = Field(None, ge=0, le=5)
    max_distance: Optional[float] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    limit: int = Field(20, ge=1, le=100)
    skip: int = Field(0, ge=0)