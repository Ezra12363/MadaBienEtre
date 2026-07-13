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
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=settings.DEBUG if hasattr(settings, 'DEBUG') else False,
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
    logger.info("Tables créées avec succès ✅")