# app/models/finance.py
"""Tables « argent » supplémentaires.

Créées automatiquement par Base.metadata.create_all() au démarrage
(aucune migration à écrire : ce sont de NOUVELLES tables, rien n'est modifié).
"""
from sqlalchemy import JSON, TIMESTAMP, Column, DECIMAL, ForeignKey, Index, Integer, String, Text
from sqlalchemy.sql import func

from ..core.database import Base


class PlatformSetting(Base):
    """Paramètres de la plateforme modifiables par l'admin (commission, retraits...)."""

    __tablename__ = "platform_settings"

    key = Column(String(100), primary_key=True)
    value = Column(JSON, nullable=True)
    updated_by = Column(Integer, nullable=True)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class CommissionPayment(Base):
    """Paiement des frais de commission par le thérapeute à l'admin
    (commission due sur les paiements reçus en espèces)."""

    __tablename__ = "commission_payments"

    id = Column(Integer, primary_key=True, index=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    amount = Column(DECIMAL(10, 2), nullable=False)
    # wallet | mobile_money | bank_transfer | cash
    method = Column(String(30), nullable=False)
    provider = Column(String(30), nullable=True)
    phone_number = Column(String(20), nullable=True)
    transfer_reference = Column(String(100), nullable=True)  # preuve donnée par le thérapeute

    # pending | completed | rejected
    status = Column(String(20), default="pending", index=True)
    reference = Column(String(50), unique=True, nullable=True)  # CM-YYMMDD-XXXXXX
    notes = Column(Text, nullable=True)

    created_at = Column(TIMESTAMP, server_default=func.now())
    processed_at = Column(TIMESTAMP, nullable=True)
    completed_at = Column(TIMESTAMP, nullable=True)

    __table_args__ = (
        Index("idx_commission_payments_therapist", "therapist_id"),
        Index("idx_commission_payments_status", "status"),
    )
