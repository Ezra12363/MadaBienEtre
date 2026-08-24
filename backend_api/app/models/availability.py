# app/models/availability.py
from sqlalchemy import Column, Integer, String, Boolean, TIMESTAMP, Time, ForeignKey, Index, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class TherapistAvailability(Base):
    """Disponibilités des thérapeutes"""
    __tablename__ = "therapist_availability"
    
    id = Column(Integer, primary_key=True, index=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Jour de la semaine (0 = Dimanche, 6 = Samedi)
    day_of_week = Column(Integer, nullable=False)
    
    # Horaires
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    
    # Statut
    is_available = Column(Boolean, default=True)
    is_recurring = Column(Boolean, default=True)  # True = chaque semaine
    
    # Notes
    notes = Column(String(255), nullable=True)
    
    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relations
    therapist = relationship("User", back_populates="availabilities")
    
    __table_args__ = (
        Index('idx_therapist_availability_therapist_id', 'therapist_id'),
        Index('idx_therapist_availability_day_of_week', 'day_of_week'),
        UniqueConstraint('therapist_id', 'day_of_week', 'start_time', 'end_time', name='unique_availability_slot'),
    )
    
    def __repr__(self):
        return f"<TherapistAvailability(therapist_id={self.therapist_id}, day={self.day_of_week}, {self.start_time}-{self.end_time})>"
    
    @property
    def day_name(self):
        days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
        return days[self.day_of_week] if 0 <= self.day_of_week < 7 else str(self.day_of_week)
    
    def get_time_range(self):
        return f"{self.start_time.strftime('%H:%M')} - {self.end_time.strftime('%H:%M')}"

class BlockedDate(Base):
    """Dates bloquées pour les thérapeutes"""
    __tablename__ = "blocked_dates"
    
    id = Column(Integer, primary_key=True, index=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Période
    start_date = Column(TIMESTAMP, nullable=False, index=True)
    end_date = Column(TIMESTAMP, nullable=False, index=True)
    
    # Raison
    reason = Column(String(255), nullable=True)
    
    # Statut
    is_all_day = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relations
    therapist = relationship("User", back_populates="blocked_dates")
    
    __table_args__ = (
        Index('idx_blocked_dates_therapist_id', 'therapist_id'),
        Index('idx_blocked_dates_start_date', 'start_date'),
        Index('idx_blocked_dates_end_date', 'end_date'),
    )
    
    def __repr__(self):
        return f"<BlockedDate(therapist_id={self.therapist_id}, {self.start_date}-{self.end_date})>"
    
    @property
    def duration_days(self):
        delta = self.end_date - self.start_date
        return delta.days

class BookingSlot(Base):
    """Créneaux horaires disponibles pour réservation"""
    __tablename__ = "booking_slots"
    
    id = Column(Integer, primary_key=True, index=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Créneau
    slot_date = Column(TIMESTAMP, nullable=False, index=True)
    slot_duration = Column(Integer, default=60)  # minutes
    is_available = Column(Boolean, default=True)
    is_booked = Column(Boolean, default=False)
    
    # Réservation
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    
    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relations
    therapist = relationship("User")
    booking = relationship("Booking")
    
    __table_args__ = (
        Index('idx_booking_slots_therapist_id', 'therapist_id'),
        Index('idx_booking_slots_slot_date', 'slot_date'),
        Index('idx_booking_slots_is_available', 'is_available'),
        Index('idx_booking_slots_is_booked', 'is_booked'),
        UniqueConstraint('therapist_id', 'slot_date', name='unique_slot'),
    )