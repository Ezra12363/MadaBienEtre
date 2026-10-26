# app/models/finance.py
"""Tables « argent » supplémentaires.

Créées automatiquement par Base.metadata.create_all() au démarrage
(aucune migration à écrire : ce sont de NOUVELLES tables, rien n'est modifié).
"""
from sqlalchemy import JSON, TIMESTAMP, Boolean, Column, DECIMAL, ForeignKey, Index, Integer, String, Text
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


class StripeCustomer(Base):
    """Lien utilisateur -> client Stripe (un seul par utilisateur : client, thérapeute ou admin)."""

    __tablename__ = "stripe_customers"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    stripe_customer_id = Column(String(64), unique=True, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())


class PaymentCard(Base):
    """Carte bancaire ENREGISTRÉE chez Stripe (jamais le numéro complet ni le CVC :
    on ne garde que l'identifiant Stripe, la marque, les 4 derniers chiffres et l'expiration)."""

    __tablename__ = "payment_cards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    stripe_payment_method_id = Column(String(80), unique=True, nullable=False)
    fingerprint = Column(String(64), nullable=True, index=True)
    brand = Column(String(30), nullable=True)
    last4 = Column(String(4), nullable=True)
    exp_month = Column(Integer, nullable=True)
    exp_year = Column(Integer, nullable=True)
    holder_name = Column(String(120), nullable=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (Index("idx_payment_cards_user", "user_id"),)
