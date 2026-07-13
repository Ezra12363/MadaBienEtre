# migrations/env.py
import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Ajouter le chemin du projet
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Importer les modèles
from app.core.database import Base
from app.core.config import settings

# ✅ Importer TOUS les modèles
from app.models import (
    User, Booking, MassageType, TherapistSpecialty,
    Negotiation, Offer, Payment, Refund, Transaction,
    Review, ReviewHelpful, ReviewReport,
    Notification, NotificationPreference,
    SOSAlert, SafetyCheck, EmergencyContact,
    UserAnalytics, BookingAnalytics, PlatformAnalytics,
    AIPrediction, AIModel, AIFeedback,
    TherapistAvailability, BlockedDate, BookingSlot,
    MassageSession, TherapistRating, TherapistEarnings, Withdrawal
)

# Configuration
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ✅ Métadonnées des modèles
target_metadata = Base.metadata

def get_url():
    return settings.DATABASE_URL

def run_migrations_offline():
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = get_url()
    
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()