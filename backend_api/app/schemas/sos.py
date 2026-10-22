# app/schemas/sos.py
import re
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, EmailStr, field_validator

ALERT_TYPES = "^(client|therapist|other|emergency)$"
SEVERITIES = "^(low|medium|high|critical)$"
CHECK_TYPES = "^(client_checkin|therapist_checkin|mid_session|post_session)$"
CHECK_STATUSES = "^(pending|ok|warning|emergency)$"

_PHONE_RE = re.compile(r"^(\+261|0)[0-9]{9}$")


def _normalize_phone(value: str) -> str:
    cleaned = re.sub(r"[\s.\-()]", "", value or "")
    if not _PHONE_RE.match(cleaned):
        raise ValueError("Numéro invalide (format attendu : 034 12 345 67 ou +261341234567)")
    return cleaned


# ----------------------------------------------------------------------
# Alertes SOS
# ----------------------------------------------------------------------
class SOSCreate(BaseModel):
    booking_id: Optional[int] = None
    alert_type: str = Field(..., pattern=ALERT_TYPES)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    address: Optional[str] = Field(None, max_length=500)
    details: Optional[str] = Field(None, max_length=500)
    severity: Optional[str] = Field("high", pattern=SEVERITIES)


class SOSResponse(BaseModel):
    id: int
    user_id: int
    booking_id: Optional[int] = None
    alert_type: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    status: str
    severity: Optional[str] = None
    details: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    responded_by: Optional[int] = None
    response_notes: Optional[str] = None

    class Config:
        from_attributes = True


class SOSCreateResponse(BaseModel):
    message: str
    sos_id: int
    status: str
    duplicate: bool = False
    # Ce qui a réellement été notifié — l'app ne doit jamais promettre
    # davantage (cf. note de sécurité : pas d'appel automatique à la police).
    notified_admins: int = 0
    notified_contacts: int = 0
    notified_counterpart: bool = False


class SOSResolveRequest(BaseModel):
    response_notes: Optional[str] = Field(None, max_length=500)
    # Message envoyé à la personne (notification) lors de la résolution.
    message_to_user: Optional[str] = Field(None, max_length=500)


class SOSMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=500)


class SOSCancelRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=300)


class SOSNoteRequest(BaseModel):
    note: str = Field(..., min_length=1, max_length=500)
    take_charge: bool = True  # l'admin qui note devient le responder


class SOSLocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: Optional[str] = Field(None, max_length=500)


class SOSStatsResponse(BaseModel):
    total_alerts: int
    active_alerts: int
    resolved_alerts: int
    cancelled_alerts: int = 0
    by_type: dict
    by_severity: dict
    average_response_time: Optional[float] = None  # minutes


# ----------------------------------------------------------------------
# Contacts d'urgence
# ----------------------------------------------------------------------
class EmergencyContactCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: str
    relationship: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    is_primary: bool = False

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        return _normalize_phone(v)


class EmergencyContactUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = None
    relationship: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    is_primary: Optional[bool] = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        return None if v is None else _normalize_phone(v)


class EmergencyContactResponse(BaseModel):
    id: int
    name: str
    phone: str
    relationship: Optional[str] = None
    email: Optional[str] = None
    is_primary: bool
    is_active: bool


# ----------------------------------------------------------------------
# Safety checks
# ----------------------------------------------------------------------
class SafetyCheckCreate(BaseModel):
    booking_id: int
    check_type: str = Field(..., pattern=CHECK_TYPES)
    # Si fourni (ok / warning / emergency), le check est répondu tout de suite.
    status: Optional[str] = Field(None, pattern=CHECK_STATUSES)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    notes: Optional[str] = Field(None, max_length=500)


class SafetyCheckRespond(BaseModel):
    status: str = Field(..., pattern="^(ok|warning|emergency)$")
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    notes: Optional[str] = Field(None, max_length=500)


class SafetyCheckResponse(BaseModel):
    id: int
    booking_id: int
    check_type: str
    status: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    checked_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    sos_id: Optional[int] = None

    class Config:
        from_attributes = True
