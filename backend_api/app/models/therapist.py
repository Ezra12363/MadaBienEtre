# app/models/therapist.py
from sqlalchemy import Column, Integer, String, Boolean, DECIMAL, TIMESTAMP, Text, Enum, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class TherapistSpecialty(Base):
    """Spécialités des thérapeutes"""
    __tablename__ = "therapist_specialties"
    
    id = Column(Integer, primary_key=True, index=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    massage_type_id = Column(Integer, ForeignKey("massage_types.id"), nullable=False, index=True)
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    # Relations
    therapist = relationship("User", foreign_keys=[therapist_id])
    massage_type = relationship("MassageType")
    
    __table_args__ = (
        Index('idx_therapist_specialties_therapist_id', 'therapist_id'),
        Index('idx_therapist_specialties_massage_type_id', 'massage_type_id'),
    )

class TherapistRating(Base):
    """Évaluation agrégée des thérapeutes"""
    __tablename__ = "therapist_ratings"
    
    id = Column(Integer, primary_key=True, index=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    average_rating = Column(DECIMAL(3,2), default=0.0)
    total_reviews = Column(Integer, default=0)
    
    rating_1_count = Column(Integer, default=0)
    rating_2_count = Column(Integer, default=0)
    rating_3_count = Column(Integer, default=0)
    rating_4_count = Column(Integer, default=0)
    rating_5_count = Column(Integer, default=0)
    
    last_month_rating = Column(DECIMAL(3,2), default=0.0)
    last_month_reviews = Column(Integer, default=0)
    
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relations
    therapist = relationship("User", foreign_keys=[therapist_id])
    
    def get_distribution(self):
        return {
            1: self.rating_1_count,
            2: self.rating_2_count,
            3: self.rating_3_count,
            4: self.rating_4_count,
            5: self.rating_5_count
        }

class TherapistEarnings(Base):
    """Gains des thérapeutes"""
    __tablename__ = "therapist_earnings"
    
    id = Column(Integer, primary_key=True, index=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Gains
    total_earnings = Column(DECIMAL(10,2), default=0.0)
    pending_earnings = Column(DECIMAL(10,2), default=0.0)
    available_earnings = Column(DECIMAL(10,2), default=0.0)
    
    # Commission
    total_commission = Column(DECIMAL(10,2), default=0.0)
    pending_commission = Column(DECIMAL(10,2), default=0.0)
    
    # Statistiques
    total_bookings = Column(Integer, default=0)
    completed_bookings = Column(Integer, default=0)
    cancelled_bookings = Column(Integer, default=0)
    
    # Périodes
    today_earnings = Column(DECIMAL(10,2), default=0.0)
    week_earnings = Column(DECIMAL(10,2), default=0.0)
    month_earnings = Column(DECIMAL(10,2), default=0.0)
    year_earnings = Column(DECIMAL(10,2), default=0.0)
    
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # ✅ Relations avec foreign_keys explicites
    therapist = relationship("User", foreign_keys=[therapist_id], back_populates="earnings")
    
    # ✅ Correction: Supprimer la relation withdrawals ici
    # La relation est gérée uniquement depuis Withdrawal

class Withdrawal(Base):
    """Demandes de retrait d'argent"""
    __tablename__ = "withdrawals"
    
    id = Column(Integer, primary_key=True, index=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Montant
    amount = Column(DECIMAL(10,2), nullable=False)
    fee = Column(DECIMAL(10,2), default=0.0)
    net_amount = Column(DECIMAL(10,2), nullable=False)
    
    # Statut
    status = Column(
        Enum('pending', 'processing', 'completed', 'failed', 'cancelled', name='withdrawal_status'),
        default='pending'
    )
    
    # Méthode
    method = Column(
        Enum('bank_transfer', 'mobile_money', 'cash', name='withdrawal_method'),
        nullable=False
    )
    
    # Détails
    bank_name = Column(String(100), nullable=True)
    account_number = Column(String(50), nullable=True)
    account_holder = Column(String(100), nullable=True)
    phone_number = Column(String(20), nullable=True)
    provider = Column(String(50), nullable=True)
    
    # Référence
    reference = Column(String(100), unique=True, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now())
    processed_at = Column(TIMESTAMP, nullable=True)
    completed_at = Column(TIMESTAMP, nullable=True)
    
    # ✅ Relations correctes
    therapist = relationship("User", foreign_keys=[therapist_id], back_populates="withdrawals")
    
    # ✅ Relation vers TherapistEarnings (MANY-TO-ONE)
    earnings = relationship(
        "TherapistEarnings",
        primaryjoin="TherapistEarnings.therapist_id == Withdrawal.therapist_id",
        foreign_keys="TherapistEarnings.therapist_id",
        viewonly=True,
        uselist=False
    )
    
    __table_args__ = (
        Index('idx_withdrawals_therapist_id', 'therapist_id'),
        Index('idx_withdrawals_status', 'status'),
    )