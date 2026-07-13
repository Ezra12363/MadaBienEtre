# app/models/user.py
from sqlalchemy import Column, Integer, String, Boolean, DECIMAL, TIMESTAMP, Text, Enum, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    fullname = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    
    role = Column(Enum('CLIENT', 'THERAPIST', 'ADMIN', name='user_role'), default='CLIENT')
    is_active = Column(Boolean, default=False)
    profile_image = Column(String(255), nullable=True)
    
    bio = Column(Text, nullable=True)
    experience_years = Column(Integer, default=0)
    rating = Column(DECIMAL(3,2), default=0.0)
    total_reviews = Column(Integer, default=0)
    is_online = Column(Boolean, default=False)
    is_available = Column(Boolean, default=True)
    service_radius = Column(Integer, default=10)
    base_price = Column(DECIMAL(10,2), nullable=True)
    
    verification_status = Column(
        Enum('pending', 'approved', 'rejected', name='verification_status'),
        default='pending'
    )
    identity_document_url = Column(String(255), nullable=True)
    certificate_url = Column(String(255), nullable=True)
    
    commission_rate = Column(DECIMAL(5,2), default=10.0)
    subscription_type = Column(String(20), default='standard')
    subscription_end_date = Column(TIMESTAMP, nullable=True)
    
    otp_code = Column(String(6), nullable=True)
    otp_expires_at = Column(TIMESTAMP, nullable=True)
    
    latitude = Column(DECIMAL(10,8), nullable=True)
    longitude = Column(DECIMAL(11,8), nullable=True)
    last_location = Column(String(255), nullable=True)
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    deleted_at = Column(TIMESTAMP, nullable=True)
    
    # ✅ Relations avec foreign_keys explicites
    bookings_as_client = relationship("Booking", foreign_keys="Booking.client_id", back_populates="client")
    bookings_as_therapist = relationship("Booking", foreign_keys="Booking.therapist_id", back_populates="therapist")
    reviews_given = relationship("Review", foreign_keys="Review.reviewer_id", back_populates="reviewer")
    reviews_received = relationship("Review", foreign_keys="Review.therapist_id", back_populates="therapist")
    notifications = relationship("Notification", back_populates="user")
    payments = relationship("Payment", back_populates="user")
    sos_alerts = relationship("SOSAlert", foreign_keys="SOSAlert.user_id", back_populates="user")
    analytics = relationship("UserAnalytics", back_populates="user", uselist=False)
    availabilities = relationship("TherapistAvailability", back_populates="therapist")
    blocked_dates = relationship("BlockedDate", back_populates="therapist")
    negotiations = relationship("Negotiation", foreign_keys="Negotiation.user_id", back_populates="user")
    emergency_contacts = relationship("EmergencyContact", back_populates="user")
    
    # ✅ Relations pour les gains et retraits
    earnings = relationship("TherapistEarnings", foreign_keys="TherapistEarnings.therapist_id", back_populates="therapist", uselist=False)
    withdrawals = relationship("Withdrawal", foreign_keys="Withdrawal.therapist_id", back_populates="therapist")
    
    __table_args__ = (
        Index('idx_users_email', 'email'),
        Index('idx_users_phone', 'phone'),
        Index('idx_users_role', 'role'),
        Index('idx_users_is_active', 'is_active'),
        Index('idx_users_verification_status', 'verification_status'),
    )
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"
    
    @property
    def is_therapist(self):
        return self.role == "THERAPIST"
    
    @property
    def is_client(self):
        return self.role == "CLIENT"
    
    @property
    def is_admin(self):
        return self.role == "ADMIN"
    
    @property
    def is_verified(self):
        return self.verification_status == "approved"
    
    @property
    def full_name(self):
        return self.fullname
    
    @property
    def display_name(self):
        if self.role == "THERAPIST":
            return f"{self.fullname} (Thérapeute)"
        return self.fullname
    
    def get_location(self):
        if self.latitude and self.longitude:
            return {
                "latitude": float(self.latitude),
                "longitude": float(self.longitude)
            }
        return None
    
    def get_rating(self):
        return float(self.rating) if self.rating else 0.0
    
    def to_dict(self):
        return {
            "id": self.id,
            "fullname": self.fullname,
            "email": self.email,
            "phone": self.phone,
            "role": self.role,
            "is_active": self.is_active,
            "profile_image": self.profile_image,
            "rating": self.get_rating(),
            "total_reviews": self.total_reviews,
            "verification_status": self.verification_status,
            "created_at": self.created_at
        }