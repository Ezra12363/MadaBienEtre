# app/models/review.py
from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, Boolean, ForeignKey, Index, CheckConstraint, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class Review(Base):
    """Avis des clients"""
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, unique=True, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Note
    rating = Column(Integer, nullable=False)
    
    # Commentaires
    comment = Column(Text, nullable=True)
    response_from_therapist = Column(Text, nullable=True)
    
    # Anonymat
    is_anonymous = Column(Boolean, default=False)
    
    # Catégories d'évaluation
    professionalism = Column(Integer, nullable=True)  # 1-5
    quality = Column(Integer, nullable=True)  # 1-5
    punctuality = Column(Integer, nullable=True)  # 1-5
    cleanliness = Column(Integer, nullable=True)  # 1-5
    
    # Tags
    tags = Column(Text, nullable=True)  # JSON array de tags
    
    # Statut
    is_verified = Column(Boolean, default=False)
    is_flagged = Column(Boolean, default=False)
    flag_reason = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    therapist_responded_at = Column(TIMESTAMP, nullable=True)
    
    # Relations
    booking = relationship("Booking", back_populates="reviews")
    reviewer = relationship("User", foreign_keys=[reviewer_id], back_populates="reviews_given")
    therapist = relationship("User", foreign_keys=[therapist_id], back_populates="reviews_received")
    helpful_votes = relationship("ReviewHelpful", back_populates="review")
    
    __table_args__ = (
        Index('idx_reviews_therapist_id', 'therapist_id'),
        Index('idx_reviews_reviewer_id', 'reviewer_id'),
        Index('idx_reviews_booking_id', 'booking_id'),
        Index('idx_reviews_rating', 'rating'),
        CheckConstraint('rating BETWEEN 1 AND 5', name='check_rating_range'),
        CheckConstraint('professionalism BETWEEN 1 AND 5 OR professionalism IS NULL', name='check_professionalism'),
        CheckConstraint('quality BETWEEN 1 AND 5 OR quality IS NULL', name='check_quality'),
        CheckConstraint('punctuality BETWEEN 1 AND 5 OR punctuality IS NULL', name='check_punctuality'),
        CheckConstraint('cleanliness BETWEEN 1 AND 5 OR cleanliness IS NULL', name='check_cleanliness'),
    )
    
    def __repr__(self):
        return f"<Review(id={self.id}, booking_id={self.booking_id}, rating={self.rating})>"
    
    @property
    def rating_stars(self):
        return "⭐" * self.rating
    
    @property
    def has_response(self):
        return self.response_from_therapist is not None
    
    def get_average_category_rating(self):
        ratings = [self.professionalism, self.quality, self.punctuality, self.cleanliness]
        valid_ratings = [r for r in ratings if r is not None]
        if valid_ratings:
            return sum(valid_ratings) / len(valid_ratings)
        return None

class ReviewHelpful(Base):
    """Votes utiles sur les avis"""
    __tablename__ = "review_helpful"
    
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    is_helpful = Column(Boolean, default=True)
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    # Relations
    review = relationship("Review", back_populates="helpful_votes")
    user = relationship("User")
    
    __table_args__ = (
        Index('idx_review_helpful_review_id', 'review_id'),
        Index('idx_review_helpful_user_id', 'user_id'),
    )

class ReviewReport(Base):
    """Signalements d'avis"""
    __tablename__ = "review_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id"), nullable=False, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # ✅ Enum est maintenant importé
    reason = Column(
        Enum('inappropriate', 'fake', 'offensive', 'spam', 'other', name='report_reason'),
        nullable=False
    )
    description = Column(Text, nullable=True)
    
    status = Column(
        Enum('pending', 'reviewed', 'dismissed', 'action_taken', name='report_status'),
        default='pending'
    )
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    reviewed_at = Column(TIMESTAMP, nullable=True)
    admin_notes = Column(Text, nullable=True)
    
    # Relations
    review = relationship("Review")
    reporter = relationship("User", foreign_keys=[reporter_id])
    
    __table_args__ = (
        Index('idx_review_reports_review_id', 'review_id'),
        Index('idx_review_reports_status', 'status'),
    )