# app/models/payment.py
from sqlalchemy import Column, Integer, String, DECIMAL, TIMESTAMP, Text, ForeignKey, Enum, Index, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class Payment(Base):
    """Paiements"""
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Montant
    amount = Column(DECIMAL(10,2), nullable=False)
    currency = Column(String(3), default='MGA')
    
    # Méthode de paiement
    method = Column(
        Enum('mobile_money', 'card', 'cash', 'vanila_pay', name='payment_method'),
        nullable=False
    )
    
    # Provider
    provider = Column(
        Enum('mvola', 'orange_money', 'airtel_money', 'stripe', 'vanila_pay', name='payment_provider'),
        nullable=True
    )
    
    # Statut
    status = Column(
        Enum('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled', name='payment_status'),
        default='pending',
        index=True
    )
    
    # Références
    transaction_id = Column(String(100), unique=True, nullable=True, index=True)
    payment_intent_id = Column(String(100), nullable=True)
    
    # Données - ✅ Renommé de 'metadata' à 'payment_metadata'
    payment_data = Column(JSON, nullable=True)
    payment_metadata = Column(JSON, nullable=True)  # ← Renommé !
    
    # Détails du client
    payer_name = Column(String(100), nullable=True)
    payer_phone = Column(String(20), nullable=True)
    payer_email = Column(String(100), nullable=True)
    
    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    completed_at = Column(TIMESTAMP, nullable=True)
    refunded_at = Column(TIMESTAMP, nullable=True)
    
    # Relations
    booking = relationship("Booking", back_populates="payments")
    user = relationship("User", back_populates="payments")
    refunds = relationship("Refund", back_populates="payment")
    
    __table_args__ = (
        Index('idx_payments_booking_id', 'booking_id'),
        Index('idx_payments_user_id', 'user_id'),
        Index('idx_payments_status', 'status'),
        Index('idx_payments_transaction_id', 'transaction_id'),
    )
    
    def __repr__(self):
        return f"<Payment(id={self.id}, booking_id={self.booking_id}, amount={self.amount}, status={self.status})>"
    
    @property
    def is_completed(self):
        return self.status == "completed"
    
    @property
    def is_pending(self):
        return self.status == "pending"
    
    @property
    def is_failed(self):
        return self.status == "failed"
    
    @property
    def is_refunded(self):
        return self.status == "refunded"
    
    def get_amount(self):
        return float(self.amount)

class Refund(Base):
    """Remboursements"""
    __tablename__ = "refunds"
    
    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=False, index=True)
    
    # Montant
    amount = Column(DECIMAL(10,2), nullable=False)
    fee = Column(DECIMAL(10,2), default=0.0)
    net_amount = Column(DECIMAL(10,2), nullable=False)
    
    # Statut
    status = Column(
        Enum('pending', 'processing', 'completed', 'failed', name='refund_status'),
        default='pending'
    )
    
    # Raison
    reason = Column(Text, nullable=True)
    
    # Référence
    refund_id = Column(String(100), unique=True, nullable=True)
    
    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now())
    processed_at = Column(TIMESTAMP, nullable=True)
    completed_at = Column(TIMESTAMP, nullable=True)
    
    # Relations
    payment = relationship("Payment", back_populates="refunds")
    
    __table_args__ = (
        Index('idx_refunds_payment_id', 'payment_id'),
        Index('idx_refunds_status', 'status'),
    )

class Transaction(Base):
    """Historique des transactions"""
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Type
    type = Column(
        Enum('deposit', 'withdrawal', 'payment', 'refund', 'commission', 'bonus', name='transaction_type'),
        nullable=False
    )
    
    # Montant
    amount = Column(DECIMAL(10,2), nullable=False)
    balance_after = Column(DECIMAL(10,2), nullable=False)
    
    # Description
    description = Column(Text, nullable=True)
    
    # Références
    reference_id = Column(Integer, nullable=True)
    reference_type = Column(String(50), nullable=True)
    
    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    __table_args__ = (
        Index('idx_transactions_user_id', 'user_id'),
        Index('idx_transactions_type', 'type'),
        Index('idx_transactions_created_at', 'created_at'),
    )