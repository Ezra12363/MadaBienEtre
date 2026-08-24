# app/models/ai_prediction.py
from sqlalchemy import (
    Column, Integer, String, Boolean, DECIMAL, TIMESTAMP, 
    Text, JSON, ForeignKey, Index
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base


class AIPrediction(Base):
    """Prédictions de l'IA"""
    __tablename__ = "ai_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    # Type de prédiction
    prediction_type = Column(
        String(50),
        nullable=False,
        index=True
    )
    
    # Résultats
    predicted_price = Column(DECIMAL(10,2), nullable=True)
    recommended_price = Column(DECIMAL(10,2), nullable=True)
    acceptance_probability = Column(DECIMAL(5,2), nullable=True)
    confidence_score = Column(DECIMAL(5,2), nullable=True)
    
    # Recommandations
    recommended_therapist_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    recommended_massage_type_id = Column(Integer, ForeignKey("massage_types.id"), nullable=True)
    
    # Facteurs
    factors = Column(JSON, nullable=True)
    features = Column(JSON, nullable=True)
    
    # Modèle
    model_version = Column(String(50), nullable=True)
    model_used = Column(String(50), nullable=True)
    
    # Performance
    actual_value = Column(DECIMAL(10,2), nullable=True)
    error = Column(DECIMAL(10,2), nullable=True)
    
    # Statut
    is_validated = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now())
    validated_at = Column(TIMESTAMP, nullable=True)
    
    # Relations
    booking = relationship("Booking")
    user = relationship("User", foreign_keys=[user_id])
    recommended_therapist = relationship("User", foreign_keys=[recommended_therapist_id])
    recommended_massage_type = relationship("MassageType")
    
    __table_args__ = (
        Index('idx_ai_predictions_booking_id', 'booking_id'),
        Index('idx_ai_predictions_user_id', 'user_id'),
        Index('idx_ai_predictions_prediction_type', 'prediction_type'),
        Index('idx_ai_predictions_created_at', 'created_at'),
    )


class AIModel(Base):
    """Modèles d'IA"""
    __tablename__ = "ai_models"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    version = Column(String(50), nullable=False)
    
    # Type
    model_type = Column(String(50), nullable=False)
    
    # Métriques
    accuracy = Column(DECIMAL(5,2), nullable=True)
    precision = Column(DECIMAL(5,2), nullable=True)
    recall = Column(DECIMAL(5,2), nullable=True)
    f1_score = Column(DECIMAL(5,2), nullable=True)
    
    # Path
    model_path = Column(String(255), nullable=False)
    config = Column(JSON, nullable=True)
    
    # Statut
    is_active = Column(Boolean, default=False)
    is_production = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    trained_at = Column(TIMESTAMP, nullable=True)
    deployed_at = Column(TIMESTAMP, nullable=True)
    
    __table_args__ = (
        Index('idx_ai_models_model_type', 'model_type'),
        Index('idx_ai_models_is_active', 'is_active'),
    )


class AIFeedback(Base):
    """Feedback sur les prédictions IA"""
    __tablename__ = "ai_feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    prediction_id = Column(Integer, ForeignKey("ai_predictions.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Feedback
    rating = Column(Integer, nullable=True)  # 1-5
    comment = Column(Text, nullable=True)  # ✅ Text est maintenant importé
    is_helpful = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    # Relations
    prediction = relationship("AIPrediction")
    user = relationship("User")
    
    __table_args__ = (
        Index('idx_ai_feedback_prediction_id', 'prediction_id'),
        Index('idx_ai_feedback_user_id', 'user_id'),
    )