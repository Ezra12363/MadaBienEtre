# app/models/booking.py (ajout des foreign_keys explicites)
from sqlalchemy import Column, Integer, String, DECIMAL, TIMESTAMP, Text, Enum, ForeignKey, Index, CheckConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class Booking(Base):
    __tablename__ = "bookings"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    massage_type_id = Column(Integer, ForeignKey("massage_types.id"), nullable=True)
    
    status = Column(
        Enum('pending', 'negotiating', 'confirmed', 'in_progress', 'completed', 
             'cancelled_by_client', 'cancelled_by_therapist', 'expired', 
             name='booking_status'),
        default='pending',
        index=True
    )
    
    client_price_proposed = Column(DECIMAL(10,2), nullable=False)
    therapist_initial_price = Column(DECIMAL(10,2), nullable=True)
    final_price = Column(DECIMAL(10,2), nullable=True)
    
    client_latitude = Column(DECIMAL(10,8), nullable=True)
    client_longitude = Column(DECIMAL(11,8), nullable=True)
    address = Column(Text, nullable=False)
    client_location = Column(String(255), nullable=True)
    
    scheduled_date = Column(TIMESTAMP, nullable=False, index=True)
    scheduled_duration_minutes = Column(Integer, default=60)
    actual_start_time = Column(TIMESTAMP, nullable=True)
    actual_end_time = Column(TIMESTAMP, nullable=True)
    
    preferred_gender = Column(Enum('male', 'female', 'any', name='gender_preference'), nullable=True)
    special_instructions = Column(Text, nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    expires_at = Column(TIMESTAMP, nullable=True, index=True)
    
    # ✅ Relations avec foreign_keys explicites
    client = relationship("User", foreign_keys=[client_id], back_populates="bookings_as_client")
    therapist = relationship("User", foreign_keys=[therapist_id], back_populates="bookings_as_therapist")
    massage_type = relationship("MassageType", back_populates="bookings")
    negotiations = relationship("Negotiation", foreign_keys="Negotiation.booking_id", back_populates="booking")
    payments = relationship("Payment", back_populates="booking")
    reviews = relationship("Review", back_populates="booking")
    sos_alerts = relationship("SOSAlert", foreign_keys="SOSAlert.booking_id", back_populates="booking")
    session = relationship("MassageSession", back_populates="booking", uselist=False)
    
    __table_args__ = (
        Index('idx_bookings_client_id', 'client_id'),
        Index('idx_bookings_therapist_id', 'therapist_id'),
        Index('idx_bookings_status', 'status'),
        Index('idx_bookings_scheduled_date', 'scheduled_date'),
        Index('idx_bookings_expires_at', 'expires_at'),
        CheckConstraint('client_price_proposed >= 0', name='check_price_positive'),
    )
    
    def __repr__(self):
        return f"<Booking(id={self.id}, client_id={self.client_id}, status={self.status})>"
    
    @property
    def is_pending(self):
        return self.status == "pending"
    
    @property
    def is_confirmed(self):
        return self.status == "confirmed"
    
    @property
    def is_completed(self):
        return self.status == "completed"
    
    @property
    def is_cancelled(self):
        return self.status in ["cancelled_by_client", "cancelled_by_therapist"]
    
    @property
    def is_negotiating(self):
        return self.status == "negotiating"
    
    @property
    def is_in_progress(self):
        return self.status == "in_progress"
    
    @property
    def has_therapist(self):
        return self.therapist_id is not None
    
    @property
    def duration_hours(self):
        return self.scheduled_duration_minutes / 60
    
    def get_final_price(self):
        return float(self.final_price) if self.final_price else None
    
    def get_client_location(self):
        if self.client_latitude and self.client_longitude:
            return {
                "latitude": float(self.client_latitude),
                "longitude": float(self.client_longitude)
            }
        return None
    
    def is_expired(self):
        from datetime import datetime
        if self.expires_at:
            return datetime.utcnow() > self.expires_at
        return False
    
    def can_cancel(self, user_id: int):
        if self.is_completed or self.is_cancelled:
            return False
        if self.is_in_progress:
            return False
        return user_id in [self.client_id, self.therapist_id]
    
    def to_dict(self):
        return {
            "id": self.id,
            "client_id": self.client_id,
            "therapist_id": self.therapist_id,
            "massage_type_id": self.massage_type_id,
            "status": self.status,
            "client_price_proposed": float(self.client_price_proposed),
            "final_price": self.get_final_price(),
            "address": self.address,
            "scheduled_date": self.scheduled_date,
            "duration_minutes": self.scheduled_duration_minutes,
            "created_at": self.created_at
        }