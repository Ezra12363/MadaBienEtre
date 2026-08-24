# app/schemas/sos.py
from pydantic import BaseModel, Field, EmailStr  # ✅ Ajouter EmailStr
from typing import Optional
from datetime import datetime

class SOSCreate(BaseModel):
    booking_id: Optional[int] = None
    alert_type: str = Field(..., pattern="^(client|therapist|other|emergency)$")
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    address: Optional[str] = None
    details: Optional[str] = Field(None, max_length=500)
    severity: Optional[str] = Field("high", pattern="^(low|medium|high|critical)$")

class SOSResponse(BaseModel):
    id: int
    user_id: int
    booking_id: Optional[int]
    alert_type: str
    latitude: Optional[float]
    longitude: Optional[float]
    address: Optional[str]
    status: str
    severity: str
    details: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]
    responded_by: Optional[int]
    response_notes: Optional[str]
    
    class Config:
        from_attributes = True

class SOSResolveRequest(BaseModel):
    response_notes: Optional[str] = Field(None, max_length=500)

class SOSStatsResponse(BaseModel):
    total_alerts: int
    active_alerts: int
    resolved_alerts: int
    by_type: dict
    by_severity: dict
    average_response_time: Optional[float]

class EmergencyContactCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., pattern=r'^(\+261|0)[0-9]{9}$')
    relationship: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None  # ✅ EmailStr est maintenant importé
    is_primary: bool = False

class EmergencyContactResponse(BaseModel):
    id: int
    name: str
    phone: str
    relationship: Optional[str]
    email: Optional[str]
    is_primary: bool
    is_active: bool
    
    class Config:
        from_attributes = True