# app/schemas/notification.py
from datetime import datetime
from typing import Optional, Dict, Any

from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    booking_id: Optional[int] = None
    title: str
    body: str
    type: str
    data: Optional[Dict[str, Any]] = None
    is_read: bool
    priority: str
    created_at: datetime
    read_at: Optional[datetime] = None

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
    silent_mode_start: Optional[str] = Field(
        None, pattern=r"^([0-1][0-9]|2[0-3]):[0-5][0-9]$"
    )
    silent_mode_end: Optional[str] = Field(
        None, pattern=r"^([0-1][0-9]|2[0-3]):[0-5][0-9]$"
    )


class NotificationSendRequest(BaseModel):
    user_id: int
    title: str = Field(..., min_length=3, max_length=255)
    body: str = Field(..., min_length=1, max_length=1000)
    type: str = Field(..., min_length=2, max_length=50)
    data: Optional[Dict[str, Any]] = None
    priority: Optional[str] = "normal"


class PushNotificationToken(BaseModel):
    token: str = Field(..., min_length=10)
    platform: str = Field(..., pattern=r"^(ios|android|web)$")
    device_id: Optional[str] = None
