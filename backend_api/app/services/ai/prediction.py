import logging
from datetime import date, datetime, timedelta
from typing import Any, Dict, Optional, Tuple

from sqlalchemy.orm import Session

from ...models.booking import Booking
from ...models.user import User
from ...models.analytics import UserAnalytics
from ...ai import ml_models as ml
from ...ai.pricing_rules import (
    DEFAULT_EXPERIENCE_YEARS,
    estimate_demand,
    round_to_step,
)
from ...ai.recommender import haversine_km as calculate_distance
from ..mg_time import mg_now, to_mg
from . import model_registry
from .prediction_log import log_prediction


logger = logging.getLogger(__name__)

DEFAULT_DISTANCE_KM = 4.5
ACCEPTANCE_RULE_VERSION = "heuristic-v1"


def heuristic_ratio_probability(ratio: float) -> float:
    """Repli sans modèle : probabilité grossière selon le rapport prix / référence."""
    if ratio >= 1.0:
        return 0.9
    if ratio >= 0.9:
        return 0.7
    if ratio >= 0.8:
        return 0.5
    if ratio >= 0.65:
        return 0.25
    return 0.08


def acceptance_from_ratio(
    type_name: Optional[str],
    category: Optional[str],
    ratio: float,
    distance: float,
    hour: int,
    duration: float,
    demand: float,
) -> Tuple[float, str, str]:
    """Probabilité d'acceptation (0..1) via la régression logistique.

    Renvoie (probabilité, version du modèle, source) ; repli sur l'heuristique
    si le modèle est absent ou ne reconnaît pas le type.
    """
    model = model_registry.get_acceptance_model()
    if model is not None:
        resolved = ml.resolve_type(type_name, category, model.known_types)
        if resolved:
            try:
                prob = model.predict_proba(resolved, ratio, distance, hour, duration, demand)
                return max(0.0, min(1.0, prob)), model.version, "logistic_regression"
            except Exception:  # noqa: BLE001
                logger.exception("Modèle d'acceptation en échec : repli sur l'heuristique")
    return heuristic_ratio_probability(ratio), ACCEPTANCE_RULE_VERSION, "heuristic"


def _to_dt(value) -> Optional[datetime]:
    """date/datetime -> datetime naïf (None si vide)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day)
    return None


def _coords(obj, *pairs):
    for lat_name, lon_name in pairs:
        lat, lon = getattr(obj, lat_name, None), getattr(obj, lon_name, None)
        if lat is not None and lon is not None:
            try:
                return float(lat), float(lon)
            except (TypeError, ValueError):
                continue
    return None


async def predict_acceptance_probability(
    booking: Booking,
    proposed_price: float,
    db: Session,
    reference_price: Optional[float] = None,
) -> float:
    """
    Prédire la probabilité d'acceptation d'une offre (0..1).

    ✅ FIX 500 « La prédiction d'acceptation a échoué » : l'endpoint
    /ai/predict-acceptance (api/ai.py) appelle cette fonction avec
    `reference_price=...`, mais ce paramètre n'existait pas ici -> TypeError
    (unexpected keyword argument) -> HTTP 500.

    reference_price : offre actuelle de l'autre partie (celle qui doit
    accepter). Par défaut : prix initialement proposé par le client.
    """
    probability = 0.5
    proposed_price = float(proposed_price or 0)

    # 1. Prix proposé vs prix de référence (offre de l'autre partie,
    #    sinon prix demandé par le client)
    asked = float(reference_price or 0)
    if asked <= 0:
        asked = float(getattr(booking, "client_price_proposed", 0) or 0)
    if asked > 0 and proposed_price > 0:
        ratio = proposed_price / asked
        if 0.8 <= ratio <= 1.2:
            probability += 0.2
        elif 0.6 <= ratio <= 1.4:
            probability += 0.1
        else:
            probability -= 0.2

    therapist = None
    if booking.therapist_id:
        therapist = db.query(User).filter(User.id == booking.therapist_id).first()

    # 2. Distance
    if therapist is not None:
        t_pos = _coords(therapist, ("latitude", "longitude"))
        b_pos = _coords(
            booking,
            ("latitude", "longitude"),
            ("client_latitude", "client_longitude"),
            ("address_latitude", "address_longitude"),
        )
        if t_pos and b_pos:
            km = calculate_distance(t_pos[0], t_pos[1], b_pos[0], b_pos[1])
            probability += 0.1 if km < 5 else (0.05 if km < 10 else -0.05)
        else:
            probability += 0.05

    # 3. Heure de la demande
    created = _to_dt(getattr(booking, "created_at", None))
    if created and 9 <= created.hour <= 17:
        probability += 0.05

    # 4. Disponibilité
    if therapist is not None and therapist.is_available:
        probability += 0.1

    # 5. Historique du thérapeute
    if booking.therapist_id:
        total = db.query(Booking).filter(Booking.therapist_id == booking.therapist_id).count()
        if total > 0:
            accepted = db.query(Booking).filter(
                Booking.therapist_id == booking.therapist_id,
                Booking.status.in_(["confirmed", "in_progress", "completed"]),
            ).count()
            probability += (accepted / total) * 0.1

    # 6. Historique du client
    if booking.client_id:
        analytics = db.query(UserAnalytics).filter(
            UserAnalytics.user_id == booking.client_id
        ).first()
        if analytics and (getattr(analytics, "total_bookings", 0) or 0) > 5:
            probability += 0.05

    # 7. Saisonnalité
    scheduled = _to_dt(getattr(booking, "scheduled_date", None))
    if scheduled:
        if scheduled.month in (6, 7, 8, 12):
            probability -= 0.05
        elif scheduled.month in (1, 2, 3):
            probability += 0.05

    return round(max(0.0, min(1.0, probability)), 2)


async def predict_demand(
    massage_type_id: int,
    date: datetime,
    db: Session,
) -> Dict[str, Any]:
    """Prédire la demande pour un type de massage."""
    one_year_ago = date - timedelta(days=365)

    past_bookings = db.query(Booking).filter(
        Booking.massage_type_id == massage_type_id,
        Booking.scheduled_date.between(one_year_ago, date),
        Booking.status == "completed",
    ).count()

    future_bookings = db.query(Booking).filter(
        Booking.massage_type_id == massage_type_id,
        Booking.scheduled_date > date,
        Booking.status.in_(["confirmed", "pending"]),
    ).count()

    trend = "stable"
    if past_bookings > 0:
        growth_rate = future_bookings / past_bookings
        if growth_rate > 1.2:
            trend = "rising"
        elif growth_rate < 0.8:
            trend = "falling"

    total_bookings = past_bookings + future_bookings
    demand_level = "medium"
    if total_bookings > 100:
        demand_level = "high"
    elif total_bookings < 20:
        demand_level = "low"

    return {
        "past_bookings": past_bookings,
        "future_bookings": future_bookings,
        "total_bookings": total_bookings,
        "trend": trend,
        "demand_level": demand_level,
        "confidence": 0.75,
    }


async def predict_revenue(
    therapist_id: int,
    days_ahead: int = 30,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Prédire les revenus d'un thérapeute."""
    empty = {
        "predicted_revenue": 0,
        "confidence": 0,
        "daily_average": 0,
        "weekly_average": 0,
        "monthly_average": 0,
    }
    if db is None:
        return empty

    past_bookings = db.query(Booking).filter(
        Booking.therapist_id == therapist_id,
        Booking.status == "completed",
    ).order_by(Booking.scheduled_date.desc()).limit(90).all()

    if not past_bookings:
        return empty

    total_revenue = sum(float(b.final_price or 0) for b in past_bookings)

    dates = [d for d in (_to_dt(b.scheduled_date) for b in past_bookings) if d]
    if dates:
        days_covered = max((max(dates) - min(dates)).days, 1)
    else:
        days_covered = 30

    daily_average = total_revenue / days_covered
    return {
        "predicted_revenue": round(daily_average * days_ahead, 2),
        "confidence": 0.7,
        "daily_average": round(daily_average, 2),
        "weekly_average": round(daily_average * 7, 2),
        "monthly_average": round(daily_average * 30, 2),
        "based_on_bookings": len(past_bookings),
        "days_analyzed": days_covered,
    }


async def predict_price_elasticity(
    massage_type_id: int,
    current_price: float,
    db: Session,
) -> Dict[str, Any]:
    """Élasticité du prix par rapport au marché pour un type de massage."""
    bookings = db.query(Booking).filter(
        Booking.massage_type_id == massage_type_id,
        Booking.status == "completed",
    ).all()

    if len(bookings) < 10:
        return {
            "elasticity": 0.5,
            "confidence": 0.3,
            "suggested_price": current_price,
            "message": "Pas assez de données pour une prédiction précise",
        }

    prices = [float(b.final_price) for b in bookings if b.final_price]
    avg_price = sum(prices) / len(prices) if prices else current_price

    if avg_price > 0:
        elasticity = max(-1.0, min(1.0, 1 - (current_price / avg_price)))
    else:
        elasticity = 0.0

    if elasticity > 0.2:
        suggested_price = current_price * 0.9
    elif elasticity < -0.2:
        suggested_price = current_price * 1.1
    else:
        suggested_price = current_price

    return {
        "elasticity": elasticity,
        "confidence": 0.6,
        "suggested_price": suggested_price,
        "avg_price": avg_price,
        "based_on_bookings": len(bookings),
    }


async def predict_booking_success(booking: Booking, db: Session) -> Dict[str, Any]:
    """Probabilité de succès d'une réservation."""
    success_factors = []
    score = 0.5

    if booking.therapist_id:
        therapist = db.query(User).filter(User.id == booking.therapist_id).first()
        if therapist and therapist.is_available:
            score += 0.2
            success_factors.append("Thérapeute disponible")
        else:
            success_factors.append("Thérapeute non disponible")

    asked = float(getattr(booking, "client_price_proposed", 0) or 0)
    if asked > 0:
        if asked >= 20000:
            score += 0.15
            success_factors.append("Prix raisonnable")
        else:
            success_factors.append("Prix trop bas")

    scheduled = _to_dt(getattr(booking, "scheduled_date", None))
    if scheduled and 8 <= scheduled.hour <= 20:
        score += 0.1
        success_factors.append("Horaire convenable")

    if booking.client_id:
        analytics = db.query(UserAnalytics).filter(
            UserAnalytics.user_id == booking.client_id
        ).first()
        if analytics and (getattr(analytics, "total_bookings", 0) or 0) > 10:
            score += 0.05
            success_factors.append("Client fidèle")

    score = max(0.0, min(1.0, score))
    level = "high" if score > 0.7 else "medium" if score > 0.4 else "low"
    return {
        "score": round(score, 2),
        "success_level": level,
        "factors": success_factors,
        "confidence": 0.7,
    }


# ---------------------------------------------------------------------------
# Acceptation d'un prix proposé (POST /ai/predict-price {booking_id, proposed_price})
# ---------------------------------------------------------------------------

def _enum_value(value):
    return getattr(value, "value", value)


async def predict_acceptance_for_booking(
    booking: Booking,
    proposed_price: float,
    db: Session,
    reference_price: Optional[float] = None,
    viewer: Optional[User] = None,
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Probabilité d'acceptation d'un prix proposé + prix recommandé.

    Le modèle (régression logistique) travaille sur le rapport
    prix proposé / prix de référence, où le prix de référence est le prix conseillé
    par le modèle de prix pour cette réservation. `reference_price` (offre actuelle de
    l'autre partie) est conservé dans la réponse et sert au repli heuristique.
    La prédiction est journalisée dans ai_predictions.
    """
    from .pricing_service import suggest_price_core  # import tardif

    proposed_price = float(proposed_price or 0)
    massage_type = getattr(booking, "massage_type", None)
    duration = int(getattr(booking, "scheduled_duration_minutes", None) or 60)

    therapist = viewer if (viewer is not None and _enum_value(getattr(viewer, "role", "")) == "THERAPIST") else None
    if therapist is None and booking.therapist_id:
        therapist = db.query(User).filter(User.id == booking.therapist_id).first()

    distance = DEFAULT_DISTANCE_KM
    if therapist is not None:
        t_pos = _coords(therapist, ("latitude", "longitude"))
        b_pos = _coords(booking, ("client_latitude", "client_longitude"), ("latitude", "longitude"))
        if t_pos and b_pos:
            distance = calculate_distance(t_pos[0], t_pos[1], b_pos[0], b_pos[1])
    experience = float(getattr(therapist, "experience_years", None) or DEFAULT_EXPERIENCE_YEARS)

    scheduled = _to_dt(getattr(booking, "scheduled_date", None))
    core = suggest_price_core(
        massage_type=massage_type, duration=duration, distance=distance,
        scheduled_at=scheduled, experience=experience,
    )
    reference = core["suggested_price"]
    feats = core["features"]
    ratio = proposed_price / reference if reference > 0 else 1.0

    category = _enum_value(getattr(massage_type, "category", None))
    prob, version, source = acceptance_from_ratio(
        feats["type"], category, ratio, feats["distance"], feats["hour"], duration, feats["demand"]
    )
    if source == "heuristic":
        # Repli : heuristique historique à partir de la réservation et de la base
        try:
            prob = await predict_acceptance_probability(
                booking=booking, proposed_price=proposed_price, db=db, reference_price=reference_price,
            )
        except Exception:  # noqa: BLE001
            logger.exception("Heuristique d'acceptation en échec")

    recommended = float(round_to_step(reference))
    prob = round(float(prob), 4)

    log_prediction(
        db, "acceptance_prediction", user_id=user_id, booking_id=booking.id,
        predicted_price=proposed_price, recommended_price=recommended, acceptance_probability=prob,
        confidence_score=None,
        features={**feats, "price_ratio": round(ratio, 4), "proposed_price": proposed_price},
        factors={"reference_price": reference, "other_party_offer": reference_price, "source": source},
        model_version=version, model_used=source,
    )
    return {
        "booking_id": booking.id,
        "proposed_price": proposed_price,
        "reference_price": reference,
        "price_ratio": round(ratio, 4),
        "acceptance_probability": prob,
        "recommended_price": recommended,
        "model_version": version,
        "model_used": source,
        "other_party_offer": reference_price,
    }
