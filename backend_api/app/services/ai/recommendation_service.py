"""Recommandation de masseurs : accès PostgreSQL + moteur de score pur.

Ce module interroge la base (candidats, spécialités, disponibilités), construit
les objets `Candidate`, puis délègue le classement à `app/ai/recommender.py`
(Python pur, mémoire §8.5.1 / figure 52). Le résultat est journalisé dans
ai_predictions par la route (api/ai.py).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Sequence, Tuple

from sqlalchemy.orm import Session

from ...ai.recommender import (
    AVAILABILITY_HORIZON_MIN,
    DEFAULT_MAX_DISTANCE_KM,
    DEFAULT_TOP_K,
    Candidate,
    ScoredCandidate,
    haversine_km,
    rank_candidates,
    suggest_when_empty,
)
from ...models.booking import Booking
from ...models.user import User
from ..mg_time import mg_now

logger = logging.getLogger(__name__)

# Symptôme (sans accent) -> catégories de massage conseillées
SYMPTOM_TO_CATEGORIES = {
    "dos": ["therapeutique"], "nuque": ["therapeutique"], "cou": ["therapeutique"],
    "epaule": ["therapeutique"], "stress": ["relaxant"], "fatigue": ["relaxant"],
    "sommeil": ["relaxant"], "sport": ["sportif"], "courbature": ["sportif"],
    "enceinte": ["prenatal"], "grossesse": ["prenatal"], "pied": ["reflexologie"],
    "jambe": ["reflexologie", "sportif"],
}

# Alias pour le code historique qui importait cette fonction d'ici
calculate_distance = haversine_km


def _strip(text: str) -> str:
    import unicodedata

    text = unicodedata.normalize("NFD", (text or "").lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def _enum(value: Any) -> Any:
    return getattr(value, "value", value)


# ---------------------------------------------------------------------------
# Accès base
# ---------------------------------------------------------------------------

def _eligible_therapists(db: Session, exclude_user_id: Optional[int] = None) -> List[User]:
    q = db.query(User).filter(
        User.role == "THERAPIST",
        User.verification_status == "approved",
        User.is_active == True,  # noqa: E712
        User.deleted_at.is_(None),
    )
    if exclude_user_id:
        q = q.filter(User.id != exclude_user_id)
    return q.all()


def _specialties_by_therapist(db: Session, therapist_ids: Sequence[int]) -> Dict[int, set]:
    if not therapist_ids:
        return {}
    try:
        from ...models.therapist import TherapistSpecialty

        rows = (
            db.query(TherapistSpecialty.therapist_id, TherapistSpecialty.massage_type_id)
            .filter(TherapistSpecialty.therapist_id.in_(list(therapist_ids)))
            .all()
        )
    except Exception:  # noqa: BLE001
        logger.debug("Spécialités indisponibles", exc_info=True)
        return {}
    out: Dict[int, set] = {}
    for tid, mid in rows:
        out.setdefault(tid, set()).add(mid)
    return out


def _busy_until(db: Session, therapist_ids: Sequence[int], now_utc: datetime) -> Dict[int, datetime]:
    """Fin de la prestation en cours / imminente de chaque masseur (UTC naïf)."""
    if not therapist_ids:
        return {}
    rows = (
        db.query(Booking.therapist_id, Booking.scheduled_date, Booking.scheduled_duration_minutes, Booking.status)
        .filter(
            Booking.therapist_id.in_(list(therapist_ids)),
            Booking.status.in_(["confirmed", "in_progress"]),
            Booking.scheduled_date <= now_utc + timedelta(minutes=AVAILABILITY_HORIZON_MIN),
        )
        .all()
    )
    busy: Dict[int, datetime] = {}
    for tid, start, minutes, _status in rows:
        end = start + timedelta(minutes=int(minutes or 60))
        if end > now_utc and (tid not in busy or end > busy[tid]):
            busy[tid] = end
    return busy


def _next_slot_delay(db: Session, therapist_ids: Sequence[int]) -> Dict[int, float]:
    """Délai (minutes) avant le prochain créneau récurrent du jour (heure de Madagascar)."""
    if not therapist_ids:
        return {}
    try:
        from ...models.availability import TherapistAvailability

        local = mg_now()
        dow = (local.weekday() + 1) % 7  # 0 = dimanche, comme dans le modèle
        slots = (
            db.query(TherapistAvailability)
            .filter(
                TherapistAvailability.therapist_id.in_(list(therapist_ids)),
                TherapistAvailability.day_of_week == dow,
                TherapistAvailability.is_available == True,  # noqa: E712
            )
            .all()
        )
    except Exception:  # noqa: BLE001
        logger.debug("Créneaux indisponibles", exc_info=True)
        return {}

    minutes_now = local.hour * 60 + local.minute
    delays: Dict[int, float] = {}
    for s in slots:
        start = s.start_time.hour * 60 + s.start_time.minute
        end = s.end_time.hour * 60 + s.end_time.minute
        if start <= minutes_now < end:
            delay = 0.0
        elif start > minutes_now:
            delay = float(start - minutes_now)
        else:
            continue
        if s.therapist_id not in delays or delay < delays[s.therapist_id]:
            delays[s.therapist_id] = delay
    return delays


def find_nearby_therapists(
    db: Session,
    latitude: Optional[float],
    longitude: Optional[float],
    massage_type_id: Optional[int] = None,
    preferred_gender: Optional[str] = None,
    exclude_user_id: Optional[int] = None,
    wanted_categories: Optional[Sequence[str]] = None,
) -> List[Candidate]:
    """Interroge PostgreSQL et construit les candidats (distance, délai, spécialités).

    Sans position (ni dans la requête ni dans le profil), la distance est inconnue :
    on la fixe à 0 km pour ne pas écarter le masseur (le rayon est alors ignoré).
    """
    therapists = _eligible_therapists(db, exclude_user_id)
    if not therapists:
        return []

    ids = [t.id for t in therapists]
    specialties = _specialties_by_therapist(db, ids)
    now_utc = datetime.utcnow()
    busy = _busy_until(db, ids, now_utc)
    slots = _next_slot_delay(db, ids)

    type_categories: Dict[int, str] = {}
    if wanted_categories:
        try:
            from ...models.massage import MassageType

            for mid, cat in db.query(MassageType.id, MassageType.category).all():
                type_categories[mid] = _enum(cat)
        except Exception:  # noqa: BLE001
            pass

    candidates: List[Candidate] = []
    for t in therapists:
        gender = getattr(t, "gender", None)
        if preferred_gender and preferred_gender != "any" and gender and str(_enum(gender)).lower() != preferred_gender.lower():
            continue

        # Distance
        if latitude is not None and longitude is not None and t.latitude is not None and t.longitude is not None:
            distance = haversine_km(latitude, longitude, float(t.latitude), float(t.longitude))
        else:
            distance = 0.0

        # Disponibilité : délai en minutes (None = indisponible)
        delay: Optional[float] = None
        if t.is_available and t.is_online:
            delay = 0.0
            if t.id in busy:
                delay = max((busy[t.id] - now_utc).total_seconds() / 60.0, 0.0)
        elif t.is_available and t.id in slots:
            delay = slots[t.id]
        elif t.id in busy and t.is_available:
            delay = max((busy[t.id] - now_utc).total_seconds() / 60.0, 0.0)

        # Type de massage
        offers: Optional[bool] = None
        known = specialties.get(t.id)
        if known:
            if massage_type_id:
                offers = massage_type_id in known
            elif wanted_categories:
                offers = any(type_categories.get(mid) in wanted_categories for mid in known)

        candidates.append(
            Candidate(
                therapist_id=t.id,
                distance_km=float(distance),
                price=float(t.base_price) if t.base_price else 0.0,
                rating=float(t.rating or 0),
                review_count=int(t.total_reviews or 0),
                experience_years=int(t.experience_years or 0),
                available_in_min=delay,
                offers_massage_type=offers,
                extra={
                    "fullname": t.fullname,
                    "profile_image": t.profile_image,
                    "base_price": float(t.base_price) if t.base_price else None,
                    "is_online": bool(t.is_online),
                    "has_price": bool(t.base_price),
                },
            )
        )
    return candidates


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------

def _to_item(s: ScoredCandidate) -> Dict[str, Any]:
    c = s.candidate
    labels = {
        "distance": "Proximité", "price": "Prix", "availability": "Disponibilité",
        "rating": "Note", "experience": "Expérience", "massage_type": "Type de massage",
    }
    best = sorted(s.sub_scores.items(), key=lambda kv: kv[1], reverse=True)[:3]
    reason = " | ".join(f"{labels[k]} {v * 100:.0f} %" for k, v in best)
    return {
        "therapist_id": c.therapist_id,
        "fullname": c.extra.get("fullname"),
        "score": round(s.score * 100, 2),  # 0..100
        "price": c.price,
        "price_suggested": c.price,
        "base_price": c.extra.get("base_price"),
        "distance_km": round(c.distance_km, 2),
        "rating": c.rating,
        "total_reviews": c.review_count,
        "availability": c.available_in_min is not None and c.available_in_min <= 0,
        "available_in_min": None if c.available_in_min is None else round(c.available_in_min),
        "experience_years": c.experience_years,
        "profile_image": c.extra.get("profile_image"),
        "sub_scores": {k: round(v, 4) for k, v in s.sub_scores.items()},
        "reason": reason,
        "rank": s.rank,
    }


async def recommend_therapists(
    user_id: int,
    db: Session,
    massage_type_id: Optional[int] = None,
    massage_type: Optional[str] = None,
    budget: Optional[float] = None,
    max_distance_km: Optional[float] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    preferred_gender: Optional[str] = None,
    symptoms: Optional[str] = None,
    top_k: int = DEFAULT_TOP_K,
) -> Dict[str, Any]:
    """Classe les masseurs pour une demande. Renvoie {items, suggestion, context}.

    `items` vide + `suggestion` renseignée : proposer d'élargir rayon / budget.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        return {"items": [], "suggestion": None, "context": {}}

    # Position : requête > profil
    if latitude is None or longitude is None:
        if user.latitude is not None and user.longitude is not None:
            latitude, longitude = float(user.latitude), float(user.longitude)

    # Type de massage : id, sinon nom, sinon symptômes
    type_id = massage_type_id
    if not type_id and massage_type:
        try:
            from ...models.massage import MassageType

            row = db.query(MassageType).filter(MassageType.name.ilike(massage_type.strip())).first()
            type_id = row.id if row else None
        except Exception:  # noqa: BLE001
            type_id = None

    wanted_categories: List[str] = []
    if symptoms:
        s = _strip(symptoms)
        for key, cats in SYMPTOM_TO_CATEGORIES.items():
            if key in s:
                wanted_categories.extend(cats)

    candidates = find_nearby_therapists(
        db, latitude, longitude, massage_type_id=type_id,
        preferred_gender=preferred_gender, exclude_user_id=user_id,
        wanted_categories=wanted_categories or None,
    )

    # Masseurs sans tarif : traités comme « prix inconnu » -> écartés seulement si budget fixé
    priced = [c for c in candidates if c.price > 0] if budget else candidates
    radius = float(max_distance_km) if max_distance_km else DEFAULT_MAX_DISTANCE_KM
    type_requested = bool(type_id or wanted_categories)

    ranked = rank_candidates(
        priced, budget=budget, max_distance_km=radius,
        type_requested=type_requested, top_k=top_k,
    )
    items = [_to_item(s) for s in ranked]

    suggestion = None
    if not items:
        sug = suggest_when_empty(priced, budget=budget, max_distance_km=radius)
        suggestion = {
            "message": sug.message,
            "suggested_max_distance_km": sug.suggested_max_distance_km,
            "suggested_budget": sug.suggested_budget,
        }

    return {
        "items": items,
        "suggestion": suggestion,
        "context": {
            "massage_type_id": type_id, "budget": budget, "max_distance_km": radius,
            "latitude": latitude, "longitude": longitude, "candidates": len(candidates),
        },
    }


# ---------------------------------------------------------------------------
# Fonctions annexes conservées
# ---------------------------------------------------------------------------

async def get_popular_therapists(db: Session, limit: int = 10) -> List[Dict[str, Any]]:
    """Thérapeutes les plus populaires."""
    therapists = (
        db.query(User)
        .filter(User.role == "THERAPIST", User.verification_status == "approved", User.is_active == True)  # noqa: E712
        .order_by(User.rating.desc(), User.total_reviews.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": t.id, "fullname": t.fullname, "rating": float(t.rating or 0),
            "total_reviews": t.total_reviews or 0, "profile_image": t.profile_image,
            "base_price": float(t.base_price) if t.base_price else None,
            "experience_years": t.experience_years or 0, "is_online": t.is_online,
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
        "therapist_id": therapist_id, "total_bookings": total, "completed_bookings": completed,
        "cancelled_bookings": cancelled,
        "completion_rate": round(completed / total * 100, 2) if total else 0,
        "rating": float(therapist.rating or 0), "total_reviews": therapist.total_reviews or 0,
        "is_online": therapist.is_online, "is_available": therapist.is_available,
    }
