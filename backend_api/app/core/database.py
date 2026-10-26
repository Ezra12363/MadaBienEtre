# app/core/database.py
from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
from typing import Generator
import logging

from .config import settings

logger = logging.getLogger(__name__)

# ✅ ESORINA NY PostGIS
GEOALCHEMY_AVAILABLE = False

# ✅ Mamorona kilasy Geometry sandoka
class Geometry:
    """Fake Geometry class - tsy mampiasa PostGIS"""
    def __init__(self, *args, **kwargs):
        pass

# Configuration ny moteur
# ⏱️ Heures : TOUTES les dates sont stockées en UTC. Sans cela, `server_default=func.now()`
# (created_at des paiements, retraits, notifications...) utiliserait le fuseau du serveur
# PostgreSQL et se mélangerait avec `datetime.utcnow()` -> heures décalées dans l'app.
# L'application convertit ensuite en heure de Madagascar (UTC+3) à l'affichage.
_connect_args = {}
if str(settings.DATABASE_URL).startswith("postgresql"):
    _connect_args = {"options": "-c timezone=UTC"}

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=settings.DEBUG if hasattr(settings, 'DEBUG') else False,
    connect_args=_connect_args,
)

# Métadonnées
metadata = MetaData()

# Base ho an'ny modely
Base = declarative_base(metadata=metadata)

# Session locale
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def init_database():
    """Mamorona ny tables rehetra"""
    Base.metadata.create_all(bind=engine)
    # ✅ Avis : ajoute les colonnes de modération si la table existait déjà
    from .review_migration import ensure_review_schema
    ensure_review_schema(engine)
    logger.info("Tables créées avec succès ✅")