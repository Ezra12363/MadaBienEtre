import logging
import math
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from ...models.user import User
from ...models.booking import Booking

logger = logging.getLogger(__name__)

# Symptôme (sans accent) -> types de massage conseillés
SYMPTOM_TO_TYPES = {
    "dos": ["therapeutique", "deep tissue"],
    "nuque": ["therapeutique"],
    "cou": ["therapeutique"],
    "epaule": ["therapeutique"],
    "stress": ["relaxant"],
    "fatigue": ["relaxant"],
    "sommeil": ["relaxant"],
    "sport": ["sportif"],
    "courbature": ["sportif"],
    "enceinte": ["prenatal"],
    "grossesse": ["prenatal"],
    "pied": ["reflexologie"],
    "jambe": ["reflexologie", "sportif"],
}


def _strip(text: str) -> str:
    import unicodedata

    text = unicodedata.normalize("NFD", (text or "").lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance Haversine en km (accepte Decimal/float/str)."""
    lat1, lon1, lat2, lon2 = (float(v) for v in (lat1, lon1, lat2, lon2))
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _get_therapists(db: Session) -> List[User]:
    return (
        db.query(User)
        .filter(
            User.role == "THERAPIST",
            User.verification_status == "approved",
            User.is_active == True,  # noqa: E712
            User.is_online == True,  # noqa: E712
            User.deleted_at.is_(None),
        )
        .all()
    )


def _therapist_types(t: User) -> List[str]:
    """Types de massage du thérapeute (si la relation existe), sans accent."""
    for attr in ("specialties", "massage_types", "therapist_specialties"):
        try:
            items = getattr(t, attr, None)
        except Exception:  # noqa: BLE001
            items = None
        if items:
            names = []
            for it in items:
                name = it if isinstance(it, str) else (
                    getattr(it, "name", None) or getattr(getattr(it, "massage_type", None), "name", None)
                )
                if name:
                    names.append(_strip(str(name)))
            if names:
                return names
    return []


async def recommend_therapists(
    user_id: int,
    db: Session,
    massage_type: Optional[str] = None,
    budget_max: Optional[float] = None,
    distance_max: int = 10,
    preferred_gender: Optional[str] = None,
    symptoms: Optional[str] = None,
    preferred_date: Optional[datetime] = None,
    duration_minutes: int = 60,
) -> List[Dict[str, Any]]:
    """Recommander des thérapeutes (score sur 100)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return []

    therapists = [t for t in _get_therapists(db) if t.id != user_id]
    if not therapists:
        return []

    distance_max = distance_max or 10
    user_pos: Optional[Tuple[float, float]] = None
    if user.latitude is not None and user.longitude is not None:
        user_pos = (float(user.latitude), float(user.longitude))

    past_ids = {
        b.therapist_id
        for b in db.query(Booking)
        .filter(Booking.client_id == user_id, Booking.status == "completed")
        .order_by(Booking.created_at.desc())
        .limit(10)
        .all()
    }

    # Types de massage visés (explicites ou déduits des symptômes)
    wanted_types: List[str] = []
    if massage_type:
        wanted_types.append(_strip(massage_type))
    if symptoms:
        s = _strip(symptoms)
        for key, types in SYMPTOM_TO_TYPES.items():
            if key in s:
                wanted_types.extend(types)

    recommendations = []
    for t in therapists:
        parts: List[Tuple[float, str]] = []  # (points, libellé)

        # 1. Distance (25)
        distance = 0.0
        if user_pos and t.latitude is not None and t.longitude is not None:
            distance = calculate_distance(user_pos[0], user_pos[1], float(t.latitude), float(t.longitude))
            if distance > distance_max:
                continue  # trop loin
            pts = max(0.0, 1 - distance / distance_max) * 25
            parts.append((pts, f"Distance: {distance:.1f} km"))
        else:
            parts.append((12.0, "Distance inconnue"))

        # 2. Prix (20)
        price = float(t.base_price) if t.base_price else None
        if budget_max and price:
            if price <= budget_max:
                pts = 10 + 10 * (1 - price / budget_max)
                parts.append((pts, f"Prix: {price:.0f} Ar (dans le budget)"))
            else:
                parts.append((0.0, f"Prix: {price:.0f} Ar (hors budget)"))
        else:
            parts.append((10.0, "Prix standard"))

        # 3. Note (20)
        rating = float(t.rating or 0)
        parts.append((rating * 4, f"Note: {rating:.1f}/5"))

        # 4. Disponibilité (20)
        if t.is_available:
            parts.append((20.0, "Disponible"))
        else:
            parts.append((0.0, "Non disponible"))

        # 5. Expérience (10)
        years = t.experience_years or 0
        parts.append((float(min(years, 10)), f"Expérience: {years} ans"))

        # 6. Type de massage (5)
        if wanted_types:
            known = _therapist_types(t)
            if not known:
                parts.append((2.5, "Spécialités non renseignées"))
            elif any(w in k or k in w for w in wanted_types for k in known):
                parts.append((5.0, "Propose le massage souhaité"))

        # Bonus genre (5) — seulement si la colonne existe
        gender = getattr(t, "gender", None)
        if preferred_gender and preferred_gender != "any" and gender:
            if str(gender).lower() == preferred_gender.lower():
                parts.append((5.0, "Genre préféré"))

        # Bonus déjà réservé (5)
        if t.id in past_ids:
            parts.append((5.0, "Déjà réservé"))

        score = min(sum(p for p, _ in parts), 100.0)
        top = sorted(parts, key=lambda x: x[0], reverse=True)[:3]

        suggested = float(t.base_price or 30000)
        if budget_max:
            suggested = min(suggested, float(budget_max))

        recommendations.append({
            "therapist_id": t.id,
            "fullname": t.fullname,
            "rating": rating,
            "total_reviews": t.total_reviews or 0,
            "distance_km": round(distance, 2),
            "price_suggested": round(suggested, 0),
            "availability": bool(t.is_available),
            "score": round(score, 2),
            "reason": " | ".join(f"{label} ({pts:.0f})" for pts, label in top),
            "profile_image": t.profile_image,
            "experience_years": years,
            "base_price": price,
        })

    recommendations.sort(key=lambda r: r["score"], reverse=True)
    return recommendations[:10]


async def predict_price(
    db: Session,
    massage_type_id: int,
    therapist_id: int,
    duration_minutes: int = 60,
    distance_km: float = 0,
) -> Dict[str, Any]:
    """Prix recommandé pour un massage donné (base thérapeute / type de massage)."""
    try:
        from ...models.massage import MassageType

        massage_type = db.query(MassageType).filter(MassageType.id == massage_type_id).first()
    except Exception:  # noqa: BLE001
        massage_type = None
    if not massage_type:
        return {"suggested_price": 30000, "confidence": 0.5}

    therapist = db.query(User).filter(User.id == therapist_id).first()
    if not therapist:
        return {"suggested_price": 30000, "confidence": 0.5}

    min_price = getattr(massage_type, "min_price", None)
    base_price = float(therapist.base_price or min_price or 30000)
    duration_factor = duration_minutes / 60
    distance_factor = 1 + (distance_km / 100)

    suggested_price = round(base_price * duration_factor * distance_factor / 100) * 100
    return {
        "suggested_price": suggested_price,
        "confidence": 0.8,
        "base_price": base_price,
        "duration_factor": duration_factor,
        "distance_factor": distance_factor,
    }


async def get_popular_therapists(db: Session, limit: int = 10) -> List[Dict[str, Any]]:
    """Thérapeutes les plus populaires."""
    therapists = (
        db.query(User)
        .filter(
            User.role == "THERAPIST",
            User.verification_status == "approved",
            User.is_active == True,  # noqa: E712
        )
        .order_by(User.rating.desc(), User.total_reviews.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": t.id,
            "fullname": t.fullname,
            "rating": float(t.rating or 0),
            "total_reviews": t.total_reviews or 0,
            "profile_image": t.profile_image,
            "base_price": float(t.base_price) if t.base_price else None,
            "experience_years": t.experience_years or 0,
            "is_online": t.is_online,
        }
        for t in therapists
    ]


async def get_therapist_stats(db: Session, therapist_id: int) -> Dict[str, Any]:
    """Statistiques d'un thérapeute."""
    therapist = db.query(User).filter(User.id == therapist_id).first()
    if not therapist:
        return {}

    q = db.query(Booking).filter(Booking.therapist_id == therapist_id)
    total = q.count()
    completed = q.filter(Booking.status == "completed").count()
    cancelled = db.query(Booking).filter(
        Booking.therapist_id == therapist_id,
        Booking.status.in_(["cancelled_by_client", "cancelled_by_therapist", "cancelled"]),
    ).count()

    return {
        "therapist_id": therapist_id,
        "total_bookings": total,
        "completed_bookings": completed,
        "cancelled_bookings": cancelled,
        "completion_rate": round(completed / total * 100, 2) if total else 0,
        "rating": float(therapist.rating or 0),
        "total_reviews": therapist.total_reviews or 0,
        "is_online": therapist.is_online,
        "is_available": therapist.is_available,
    }
