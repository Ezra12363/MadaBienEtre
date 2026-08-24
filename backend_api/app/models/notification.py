# app/models/notification.py
from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, Boolean, ForeignKey, Index, JSON, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class Notification(Base):
    """Notifications"""
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    
    # Contenu
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    
    # Type - ✅ Enum est maintenant importé
    type = Column(
        Enum(
            'booking', 'offer', 'payment', 'review', 'sos', 'system',
            'promotion', 'reminder', 'chat', 'therapist', name='notification_type'
        ),
        nullable=False,
        index=True
    )
    
    # Données
    data = Column(JSON, nullable=True)
    
    # Statut
    is_read = Column(Boolean, default=False, index=True)
    is_delivered = Column(Boolean, default=False)
    is_sent = Column(Boolean, default=False)
    
    # Priorité - ✅ Enum est maintenant importé
    priority = Column(
        Enum('low', 'normal', 'high', 'urgent', name='notification_priority'),
        default='normal'
    )
    
    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)
    read_at = Column(TIMESTAMP, nullable=True)
    delivered_at = Column(TIMESTAMP, nullable=True)
    sent_at = Column(TIMESTAMP, nullable=True)
    
    # Relations
    user = relationship("User", back_populates="notifications")
    booking = relationship("Booking")
    
    __table_args__ = (
        Index('idx_notifications_user_id', 'user_id'),
        Index('idx_notifications_is_read', 'is_read'),
        Index('idx_notifications_type', 'type'),
        Index('idx_notifications_created_at', 'created_at'),
    )
    
    def __repr__(self):
        return f"<Notification(id={self.id}, user_id={self.user_id}, type={self.type})>"
    
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

class NotificationPreference(Base):
    """Préférences de notification"""
    __tablename__ = "notification_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # Canaux
    push_enabled = Column(Boolean, default=True)
    email_enabled = Column(Boolean, default=True)
    sms_enabled = Column(Boolean, default=False)
    
    # Types
    booking_notifications = Column(Boolean, default=True)
    offer_notifications = Column(Boolean, default=True)
    payment_notifications = Column(Boolean, default=True)
    review_notifications = Column(Boolean, default=True)
    sos_notifications = Column(Boolean, default=True)
    promotion_notifications = Column(Boolean, default=False)
    chat_notifications = Column(Boolean, default=True)
    
    # Silent hours
    silent_mode_start = Column(String(5), nullable=True)  # HH:MM
    silent_mode_end = Column(String(5), nullable=True)  # HH:MM
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relations
    user = relationship("User")
    
    __table_args__ = (
        Index('idx_notification_preferences_user_id', 'user_id'),
    )