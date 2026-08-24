# app/models/offer.py
from sqlalchemy import Column, Integer, String, DECIMAL, Text, TIMESTAMP, ForeignKey, Enum, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base


class Offer(Base):
    """Offres de massage proposées par les thérapeutes"""
    __tablename__ = "offers"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, index=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Prix
    price = Column(DECIMAL(10,2), nullable=False)
    counter_price = Column(DECIMAL(10,2), nullable=True)
    message = Column(Text, nullable=True)
    
    # Statut
    status = Column(
        Enum('pending', 'accepted', 'rejected', 'countered', 'expired', name='offer_status'),
        default='pending',
        index=True
    )
    
    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now())
    expires_at = Column(TIMESTAMP, nullable=True)
    responded_at = Column(TIMESTAMP, nullable=True)
    
    # Relations
    booking = relationship("Booking", foreign_keys=[booking_id])
    therapist = relationship("User", foreign_keys=[therapist_id])
    
    __table_args__ = (
        Index('idx_offers_booking_id', 'booking_id'),
        Index('idx_offers_therapist_id', 'therapist_id'),
        Index('idx_offers_status', 'status'),
    )
    
    def __repr__(self):
        return f"<Offer(id={self.id}, booking_id={self.booking_id}, price={self.price})>"
    
    @property
    def is_pending(self):
        return self.status == "pending"
    
    @property
    def is_accepted(self):
        return self.status == "accepted"
    
    @property
    def is_rejected(self):
        return self.status == "rejected"
    
    @property
    def is_countered(self):
        return self.status == "countered"
    
    @property
    def is_expired(self):
        from datetime import datetime
        if self.expires_at:
            return datetime.utcnow() > self.expires_at
        return False
    
    def get_price(self):
        return float(self.price)
    
    def get_counter_price(self):
        return float(self.counter_price) if self.counter_price else None
    
    def to_dict(self):
        return {
            "id": self.id,
            "booking_id": self.booking_id,
            "therapist_id": self.therapist_id,
            "price": float(self.price),
            "counter_price": self.get_counter_price(),
            "message": self.message,
            "status": self.status,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "responded_at": self.responded_at
        }