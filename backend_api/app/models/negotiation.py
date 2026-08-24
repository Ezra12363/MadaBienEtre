# app/models/negotiation.py
from sqlalchemy import Column, Integer, String, DECIMAL, Text, TIMESTAMP, ForeignKey, Enum, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base


class Negotiation(Base):
    """Négociation des prix entre client et thérapeute"""
    __tablename__ = "negotiations"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    user_type = Column(
        Enum('client', 'therapist', name='user_type_enum'),
        nullable=False
    )
    
    price_offered = Column(DECIMAL(10,2), nullable=False)
    message = Column(Text, nullable=True)
    
    status = Column(
        Enum('sent', 'accepted', 'rejected', 'expired', name='negotiation_status'),
        default='sent',
        index=True
    )
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    expires_at = Column(TIMESTAMP, nullable=True, index=True)
    
    # Relations
    booking = relationship("Booking", foreign_keys=[booking_id], back_populates="negotiations")
    user = relationship("User", foreign_keys=[user_id], back_populates="negotiations")
    
    __table_args__ = (
        Index('idx_negotiations_booking_id', 'booking_id'),
        Index('idx_negotiations_user_id', 'user_id'),
        Index('idx_negotiations_status', 'status'),
    )
    
    def __repr__(self):
        return f"<Negotiation(id={self.id}, booking_id={self.booking_id}, price={self.price_offered})>"
    
    @property
    def is_accepted(self):
        return self.status == "accepted"
    
    @property
    def is_rejected(self):
        return self.status == "rejected"
    
    @property
    def is_expired(self):
        from datetime import datetime
        if self.expires_at:
            return datetime.utcnow() > self.expires_at
        return False
    
    def get_price(self):
        return float(self.price_offered)
    
    def to_dict(self):
        return {
            "id": self.id,
            "booking_id": self.booking_id,
            "user_id": self.user_id,
            "user_type": self.user_type,
            "price_offered": float(self.price_offered),
            "message": self.message,
            "status": self.status,
            "created_at": self.created_at,
            "expires_at": self.expires_at
        }