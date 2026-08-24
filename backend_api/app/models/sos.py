# app/models/sos.py
from sqlalchemy import Column, Integer, String, DECIMAL, TIMESTAMP, Text, ForeignKey, Enum, Index, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class SOSAlert(Base):
    __tablename__ = "sos_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    
    alert_type = Column(
        Enum('client', 'therapist', 'other', 'emergency', name='alert_type_enum'),
        nullable=False
    )
    
    latitude = Column(DECIMAL(10,8), nullable=True)
    longitude = Column(DECIMAL(11,8), nullable=True)
    alert_location = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    
    status = Column(
        Enum('active', 'resolved', 'cancelled', name='sos_status'),
        default='active',
        index=True
    )
    
    details = Column(Text, nullable=True)
    severity = Column(
        Enum('low', 'medium', 'high', 'critical', name='sos_severity'),
        default='high'
    )
    
    responded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    response_notes = Column(Text, nullable=True)
    
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    resolved_at = Column(TIMESTAMP, nullable=True)
    cancelled_at = Column(TIMESTAMP, nullable=True)
    
    # ✅ Relations avec foreign_keys explicites
    user = relationship("User", foreign_keys=[user_id], back_populates="sos_alerts")
    booking = relationship("Booking", foreign_keys=[booking_id], back_populates="sos_alerts")
    responder = relationship("User", foreign_keys=[responded_by])
    
    __table_args__ = (
        Index('idx_sos_alerts_user_id', 'user_id'),
        Index('idx_sos_alerts_status', 'status'),
        Index('idx_sos_alerts_booking_id', 'booking_id'),
    )
    
    def __repr__(self):
        return f"<SOSAlert(id={self.id}, user_id={self.user_id}, status={self.status})>"
    
    @property
    def is_active(self):
        return self.status == "active"
    
    @property
    def is_resolved(self):
        return self.status == "resolved"
    
    def get_location(self):
        if self.latitude and self.longitude:
            return {
                "latitude": float(self.latitude),
                "longitude": float(self.longitude)
            }
        return None

class SafetyCheck(Base):
    __tablename__ = "safety_checks"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, index=True)
    
    check_type = Column(
        Enum('client_checkin', 'therapist_checkin', 'mid_session', 'post_session', name='safety_check_type'),
        nullable=False
    )
    
    status = Column(
        Enum('pending', 'ok', 'warning', 'emergency', name='safety_check_status'),
        default='pending'
    )
    
    latitude = Column(DECIMAL(10,8), nullable=True)
    longitude = Column(DECIMAL(11,8), nullable=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    checked_at = Column(TIMESTAMP, nullable=True)
    expires_at = Column(TIMESTAMP, nullable=True)
    
    booking = relationship("Booking")
    
    __table_args__ = (
        Index('idx_safety_checks_booking_id', 'booking_id'),
        Index('idx_safety_checks_status', 'status'),
    )

class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=False)
    relation = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    
    is_primary = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    user = relationship("User", foreign_keys=[user_id], back_populates="emergency_contacts")
    
    __table_args__ = (
        Index('idx_emergency_contacts_user_id', 'user_id'),
    )