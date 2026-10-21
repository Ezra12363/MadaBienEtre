# app/services/mg_time.py
"""Heure de Madagascar (UTC+3, pas d'heure d'été).

La base enregistre des dates « naïves » (sans fuseau). Par défaut on suppose qu'elles
sont en UTC (datetime.utcnow() / func.now() d'un serveur en UTC). Si votre serveur
MySQL tourne à l'heure locale de Madagascar, mettez dans le .env :  DB_UTC_OFFSET_HOURS=3
"""
import os
from datetime import datetime, timedelta
from typing import Optional

MG_OFFSET_HOURS = 3
DB_OFFSET_HOURS = float(os.environ.get("DB_UTC_OFFSET_HOURS", "0") or 0)


def to_mg(value: Optional[datetime]) -> Optional[datetime]:
    """Date de la base -> heure de Madagascar (naïve)."""
    if value is None:
        return None
    return value + timedelta(hours=MG_OFFSET_HOURS - DB_OFFSET_HOURS)


def mg_now() -> datetime:
    return to_mg(datetime.utcnow() + timedelta(hours=DB_OFFSET_HOURS))  # type: ignore[arg-type]


def iso_utc(value: Optional[datetime]) -> Optional[str]:
    """ISO 8601 en UTC avec « Z » : l'application convertit en heure de Madagascar."""
    if value is None:
        return None
    return (value - timedelta(hours=DB_OFFSET_HOURS)).replace(microsecond=0).isoformat() + "Z"


def fmt_mg(value: Optional[datetime], with_time: bool = True) -> str:
    v = to_mg(value)
    if v is None:
        return "—"
    return v.strftime("%d/%m/%Y à %H:%M") if with_time else v.strftime("%d/%m/%Y")
