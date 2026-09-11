# app/models/notification.py
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    TIMESTAMP,
    Boolean,
    ForeignKey,
    Index,
    JSON,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base


class Notification(Base):
    """Notification persistée en base."""

    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)

    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    type = Column(String(50), nullable=False, index=True)

    data = Column(JSON, nullable=True)

    is_read = Column(Boolean, nullable=False, default=False, server_default="false", index=True)
    is_delivered = Column(Boolean, nullable=False, default=False, server_default="false")
    is_sent = Column(Boolean, nullable=False, default=False, server_default="false")

    priority = Column(
        String(20),
        nullable=False,
        default="normal",
        server_default="normal",
    )

    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now(), index=True)
    read_at = Column(TIMESTAMP, nullable=True)
    delivered_at = Column(TIMESTAMP, nullable=True)
    sent_at = Column(TIMESTAMP, nullable=True)

    user = relationship("User", back_populates="notifications")
    booking = relationship("Booking")

    __table_args__ = (
        Index("idx_notifications_user_read_created", "user_id", "is_read", "created_at"),
        Index("idx_notifications_user_created", "user_id", "created_at"),
        Index("idx_notifications_booking_id", "booking_id"),
        Index("idx_notifications_type", "type"),
    )

    @property
    def is_unread(self):
        return not self.is_read

    def mark_as_read(self):
        self.is_read = True
        self.read_at = func.now()

    def mark_as_delivered(self):
        self.is_delivered = True
        self.delivered_at = func.now()

    def mark_as_sent(self):
        self.is_sent = True
        self.sent_at = func.now()

    def __repr__(self):
        return f"<Notification(id={self.id}, user_id={self.user_id}, type={self.type})>"


class NotificationPreference(Base):
    """Préférences de notification."""

    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)

    push_enabled = Column(Boolean, default=True, server_default="true")
    email_enabled = Column(Boolean, default=True, server_default="true")
    sms_enabled = Column(Boolean, default=False, server_default="false")

    booking_notifications = Column(Boolean, default=True, server_default="true")
    offer_notifications = Column(Boolean, default=True, server_default="true")
    payment_notifications = Column(Boolean, default=True, server_default="true")
    review_notifications = Column(Boolean, default=True, server_default="true")
    sos_notifications = Column(Boolean, default=True, server_default="true")
    promotion_notifications = Column(Boolean, default=False, server_default="false")
    chat_notifications = Column(Boolean, default=True, server_default="true")

    silent_mode_start = Column(String(5), nullable=True)
    silent_mode_end = Column(String(5), nullable=True)

    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    user = relationship("User")
