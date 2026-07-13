# app/models/analytics.py
from sqlalchemy import Column, Integer, String, DECIMAL, TIMESTAMP, JSON, ForeignKey, Index, BigInteger, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class UserAnalytics(Base):
    __tablename__ = "user_analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    total_bookings = Column(Integer, default=0)
    total_spent = Column(DECIMAL(10,2), default=0.0)
    total_earnings = Column(DECIMAL(10,2), default=0.0)
    
    favorite_massage_types = Column(JSON, nullable=True)
    average_rating_given = Column(DECIMAL(3,2), nullable=True)
    average_rating_received = Column(DECIMAL(3,2), nullable=True)
    
    preferred_price_range = Column(JSON, nullable=True)
    preferred_gender = Column(String(10), nullable=True)
    preferred_distance = Column(Integer, default=5)
    preferred_time_slots = Column(JSON, nullable=True)
    
    user_segment = Column(String(50), nullable=True)
    engagement_score = Column(DECIMAL(5,2), default=0.0)
    churn_risk = Column(DECIMAL(5,2), default=0.0)
    
    embedding_vector = Column(JSON, nullable=True)
    
    last_active = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    user = relationship("User", back_populates="analytics")
    
    __table_args__ = (
        Index('idx_user_analytics_user_id', 'user_id'),
        Index('idx_user_analytics_user_segment', 'user_segment'),
    )
    
    @property
    def is_high_engagement(self):
        return self.engagement_score >= 70

class BookingAnalytics(Base):
    __tablename__ = "booking_analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, unique=True, index=True)
    
    response_time_seconds = Column(Integer, nullable=True)
    confirmation_time_seconds = Column(Integer, nullable=True)
    completion_time_seconds = Column(Integer, nullable=True)
    
    client_satisfaction = Column(Integer, nullable=True)
    therapist_satisfaction = Column(Integer, nullable=True)
    
    revenue = Column(DECIMAL(10,2), nullable=True)
    commission = Column(DECIMAL(10,2), nullable=True)
    net_revenue = Column(DECIMAL(10,2), nullable=True)
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    booking = relationship("Booking")

class PlatformAnalytics(Base):
    __tablename__ = "platform_analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    
    date = Column(TIMESTAMP, nullable=False, unique=True, index=True)
    
    total_users = Column(Integer, default=0)
    new_users = Column(Integer, default=0)
    active_users = Column(Integer, default=0)
    
    total_therapists = Column(Integer, default=0)
    active_therapists = Column(Integer, default=0)
    online_therapists = Column(Integer, default=0)
    
    total_bookings = Column(Integer, default=0)
    completed_bookings = Column(Integer, default=0)
    cancelled_bookings = Column(Integer, default=0)
    
    total_revenue = Column(DECIMAL(10,2), default=0.0)
    total_commission = Column(DECIMAL(10,2), default=0.0)
    net_revenue = Column(DECIMAL(10,2), default=0.0)
    
    total_payments = Column(Integer, default=0)
    payment_amount = Column(DECIMAL(10,2), default=0.0)
    
    total_reviews = Column(Integer, default=0)
    average_rating = Column(DECIMAL(3,2), default=0.0)
    
    sos_alerts = Column(Integer, default=0)
    resolved_sos = Column(Integer, default=0)
    
    predicted_revenue = Column(DECIMAL(10,2), nullable=True)
    growth_rate = Column(DECIMAL(5,2), nullable=True)
    churn_rate = Column(DECIMAL(5,2), nullable=True)
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())