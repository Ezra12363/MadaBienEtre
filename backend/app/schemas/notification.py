from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    booking_id: Optional[int]
    title: str
    body: str
    type: str
    data: Optional[Dict[str, Any]]
    is_read: bool
    priority: str
    created_at: datetime
    read_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class NotificationPreferenceUpdate(BaseModel):
    push_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    sms_enabled: Optional[bool] = None
    booking_notifications: Optional[bool] = None
    offer_notifications: Optional[bool] = None
    payment_notifications: Optional[bool] = None
    review_notifications: Optional[bool] = None
    sos_notifications: Optional[bool] = None
    promotion_notifications: Optional[bool] = None
    chat_notifications: Optional[bool] = None
    silent_mode_start: Optional[str] = Field(None, pattern=r'^([0-1][0-9]|2[0-3]):[0-5][0-9]$')
    silent_mode_end: Optional[str] = Field(None, pattern=r'^([0-1][0-9]|2[0-3]):[0-5][0-9]$')

class NotificationSendRequest(BaseModel):
    user_id: int
    title: str = Field(..., min_length=3, max_length=255)
    body: str = Field(..., min_length=3, max_length=1000)
    type: str = Field(..., pattern="^(booking|offer|payment|review|sos|system|promotion|reminder|chat|therapist)$")
    data: Optional[Dict[str, Any]] = None
    priority: Optional[str] = "normal"

class PushNotificationToken(BaseModel):
    token: str = Field(..., min_length=10)
    platform: str = Field(..., pattern="^(ios|android|web)$")
    device_id: Optional[str] = None