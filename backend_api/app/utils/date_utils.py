from datetime import datetime, timedelta, date, timezone
from typing import Optional, List, Tuple
import calendar

def now() -> datetime:
    """Obtenir la date/heure actuelle UTC"""
    return datetime.utcnow()

def today() -> date:
    """Obtenir la date actuelle"""
    return datetime.utcnow().date()

def format_datetime(dt: datetime, format_str: str = "%Y-%m-%d %H:%M:%S") -> str:
    """Formatter une date/heure"""
    if not dt:
        return ""
    return dt.strftime(format_str)

def parse_datetime(dt_str: str, format_str: str = "%Y-%m-%d %H:%M:%S") -> Optional[datetime]:
    """Parser une date/heure"""
    try:
        return datetime.strptime(dt_str, format_str)
    except ValueError:
        try:
            return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        except ValueError:
            return None

def get_start_of_day(dt: datetime = None) -> datetime:
    """Obtenir le début de la journée"""
    if not dt:
        dt = datetime.utcnow()
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)

def get_end_of_day(dt: datetime = None) -> datetime:
    """Obtenir la fin de la journée"""
    if not dt:
        dt = datetime.utcnow()
    return dt.replace(hour=23, minute=59, second=59, microsecond=999999)

def get_start_of_week(dt: datetime = None) -> datetime:
    """Obtenir le début de la semaine (lundi)"""
    if not dt:
        dt = datetime.utcnow()
    start = dt - timedelta(days=dt.weekday())
    return start.replace(hour=0, minute=0, second=0, microsecond=0)

def get_end_of_week(dt: datetime = None) -> datetime:
    """Obtenir la fin de la semaine (dimanche)"""
    if not dt:
        dt = datetime.utcnow()
    start = get_start_of_week(dt)
    return start + timedelta(days=6, hours=23, minutes=59, seconds=59, microseconds=999999)

def get_start_of_month(dt: datetime = None) -> datetime:
    """Obtenir le début du mois"""
    if not dt:
        dt = datetime.utcnow()
    return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

def get_end_of_month(dt: datetime = None) -> datetime:
    """Obtenir la fin du mois"""
    if not dt:
        dt = datetime.utcnow()
    next_month = dt.replace(day=28) + timedelta(days=4)
    return next_month.replace(day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(microseconds=1)

def get_start_of_year(dt: datetime = None) -> datetime:
    """Obtenir le début de l'année"""
    if not dt:
        dt = datetime.utcnow()
    return dt.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

def get_end_of_year(dt: datetime = None) -> datetime:
    """Obtenir la fin de l'année"""
    if not dt:
        dt = datetime.utcnow()
    return dt.replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=999999)

def get_days_between(start: datetime, end: datetime) -> int:
    """Obtenir le nombre de jours entre deux dates"""
    return (end - start).days

def get_hours_between(start: datetime, end: datetime) -> float:
    """Obtenir le nombre d'heures entre deux dates"""
    return (end - start).total_seconds() / 3600

def get_minutes_between(start: datetime, end: datetime) -> float:
    """Obtenir le nombre de minutes entre deux dates"""
    return (end - start).total_seconds() / 60

def get_date_range(start: datetime, end: datetime) -> List[datetime]:
    """Obtenir une liste de dates entre deux dates"""
    dates = []
    current = start
    while current <= end:
        dates.append(current)
        current += timedelta(days=1)
    return dates

def is_within_range(dt: datetime, start: datetime, end: datetime) -> bool:
    """Vérifier si une date est dans une plage"""
    return start <= dt <= end

def add_days(dt: datetime, days: int) -> datetime:
    """Ajouter des jours à une date"""
    return dt + timedelta(days=days)

def add_hours(dt: datetime, hours: int) -> datetime:
    """Ajouter des heures à une date"""
    return dt + timedelta(hours=hours)

def add_minutes(dt: datetime, minutes: int) -> datetime:
    """Ajouter des minutes à une date"""
    return dt + timedelta(minutes=minutes)

def get_timezone_offset() -> int:
    """Obtenir le décalage horaire (heure locale - UTC)"""
    # Madagascar est UTC+3
    return 3

def to_local_time(dt: datetime) -> datetime:
    """Convertir UTC en heure locale (Madagascar)"""
    return dt + timedelta(hours=get_timezone_offset())

def to_utc_time(dt: datetime) -> datetime:
    """Convertir heure locale en UTC"""
    return dt - timedelta(hours=get_timezone_offset())

def get_day_name(dt: datetime, lang: str = "fr") -> str:
    """Obtenir le nom du jour"""
    if lang == "fr":
        days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
    else:
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    return days[dt.weekday()]

def get_month_name(dt: datetime, lang: str = "fr") -> str:
    """Obtenir le nom du mois"""
    if lang == "fr":
        months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
    else:
        months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    return months[dt.month - 1]


# ---------------------------------------------------------------------------
# Heure de Madagascar (Indian/Antananarivo = UTC+3 toute l'année, pas d'heure d'été)
#
# RÈGLE : la base de données stocke TOUJOURS des datetime « naïfs » en UTC
# (voir core/database.py : session PostgreSQL forcée en UTC). Pour l'API on renvoie
# des chaînes ISO terminées par « Z » (iso_utc) afin que l'application sache qu'il
# s'agit d'UTC et affiche l'heure de Madagascar ; pour les PDF on convertit avec fmt_mada.
# ---------------------------------------------------------------------------
MADAGASCAR_TZ = timezone(timedelta(hours=3), name="EAT")


def as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """datetime naïf (= UTC) ou aware -> datetime aware en UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def iso_utc(dt: Optional[datetime]) -> Optional[str]:
    """ISO 8601 en UTC avec suffixe Z (ex. 2026-10-20T21:55:00Z) ou None."""
    d = as_utc(dt)
    return d.strftime("%Y-%m-%dT%H:%M:%SZ") if d else None


def to_mada(dt: Optional[datetime]) -> Optional[datetime]:
    """datetime naïf (UTC) -> datetime à l'heure de Madagascar (UTC+3)."""
    d = as_utc(dt)
    return d.astimezone(MADAGASCAR_TZ) if d else None


def fmt_mada(dt: Optional[datetime], fmt: str = "%d/%m/%Y à %H:%M") -> str:
    """Date/heure lisible à l'heure de Madagascar ; « — » si vide."""
    d = to_mada(dt)
    return d.strftime(fmt) if d else "—"


def now_mada() -> datetime:
    return datetime.now(MADAGASCAR_TZ)
