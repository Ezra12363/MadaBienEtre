from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, Boolean, ForeignKey, Index, CheckConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class MassageSession(Base):
    """Historique des sessions de massage"""
    __tablename__ = "massage_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, unique=True, index=True)
    
    # Durée
    actual_duration_minutes = Column(Integer, nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    therapist_notes = Column(Text, nullable=True)
    client_feedback = Column(Text, nullable=True)
    
    # Satisfaction
    client_satisfaction = Column(Integer, nullable=True)  # 1-5
    therapist_satisfaction = Column(Integer, nullable=True)  # 1-5
    
    # Évaluation
    pressure_level = Column(String(20), nullable=True)  # 'light', 'medium', 'firm'
    client_relaxation = Column(Integer, nullable=True)  # 1-5
    client_pain_relief = Column(Integer, nullable=True)  # 1-5
    
    # Statut
    is_completed = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    completed_at = Column(TIMESTAMP, nullable=True)
    
    # Relations
    booking = relationship("Booking", back_populates="session")
    
    __table_args__ = (
        Index('idx_massage_sessions_booking_id', 'booking_id'),
        CheckConstraint('client_satisfaction BETWEEN 1 AND 5 OR client_satisfaction IS NULL', name='check_client_satisfaction'),
        CheckConstraint('therapist_satisfaction BETWEEN 1 AND 5 OR therapist_satisfaction IS NULL', name='check_therapist_satisfaction'),
    )
    
    def __repr__(self):
        return f"<MassageSession(booking_id={self.booking_id}, completed={self.is_completed})>"
    
    @property
    def duration_hours(self):
        if self.actual_duration_minutes:
            return self.actual_duration_minutes / 60
        return 0
    
    def get_average_satisfaction(self):
        ratings = [self.client_satisfaction, self.therapist_satisfaction]
        valid = [r for r in ratings if r is not None]
        if valid:
            return sum(valid) / len(valid)
        return None