"""Suggestion tarifaire : Gradient Boosting + règle métier de repli.

  * Le modèle sérialisé est chargé au démarrage (model_registry).
  * S'il est absent / illisible, ou si le type de massage est inconnu du modèle,
    on applique la règle métier (ai/pricing_rules.py).
  * Le prix est arrondi à 500 Ar et ne descend jamais sous le prix minimum du
    type de massage (la création de réservation l'exige).
  * Chaque suggestion est journalisée dans ai_predictions.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from ...ai import ml_models as ml
from ...ai.pricing_rules import (
    DEFAULT_EXPERIENCE_YEARS,
    estimate_demand,
    round_to_step,
    round_up_to_step,
    rule_based_price,
)
from ..mg_time import mg_now, to_mg
from . import model_registry
from .prediction_log import log_prediction

logger = logging.getLogger(__name__)

RULE_VERSION = "rule-v1"
RULE_CONFIDENCE = 70.0  # % : indication prudente pour la règle de repli
DEFAULT_DISTANCE_KM = 4.5

# Prix de base de repli quand le type de massage est inconnu de la base
FALLBACK_BASE_PRICES = {
    "relaxant": 35000, "therapeutique": 45000, "sportif": 40000,
    "reflexologie": 30000, "prenatal": 42000, "pierres chaudes": 55000,
    "shiatsu": 40000, "deep tissue": 45000,
}


# ---------------------------------------------------------------------------
# Ancienne fonction conservée (prix dynamique + historique client)
# ---------------------------------------------------------------------------

def calculate_dynamic_price(
    base_price: float,
    duration: int,
    distance: float,
    user_history: Optional[List[float]] = None,
    demand_factor: float = 1.0,
    time_of_day: Optional[str] = None,
    day_of_week: Optional[int] = None,
) -> Dict[str, Any]:
    """Prix dynamique à coefficients fixes (conservé pour compatibilité)."""
    base_price = float(base_price)
    distance = max(float(distance or 0), 0.0)
    duration_factor = max(1.0 + ((duration - 60) / 30) * 0.05, 0.8)
    distance_factor = min(1.0 + distance * 0.01, 1.5)
    time_factor = {"morning": 0.9, "afternoon": 1.0, "evening": 1.1, "night": 1.2}.get(time_of_day or "", 1.0)
    day_factor = 1.0
    if day_of_week is not None:
        day_factor = 1.15 if day_of_week in (5, 6) else 0.95
    history_factor = 1.0
    if user_history:
        avg_user_price = sum(user_history) / len(user_history)
        if avg_user_price > 0 and base_price > 0:
            history_factor = min(max(avg_user_price / base_price, 0.7), 1.3)

    price = base_price * duration_factor * distance_factor * demand_factor * time_factor * day_factor * history_factor
    min_price = max(base_price * 0.7, 20000)
    max_price = max(base_price * 2, min_price)
    final_price = max(min_price, min(round_to_step(price), max_price))
    return {
        "price": final_price,
        "min_price": round(min_price, 0),
        "max_price": round(max_price, 0),
        "confidence": 85.0,
        "factors": {
            "base_price": base_price, "duration_factor": duration_factor,
            "distance_factor": distance_factor, "demand_factor": demand_factor,
            "time_factor": time_factor, "day_factor": day_factor, "history_factor": history_factor,
        },
        "breakdown": {
            "base": base_price,
            "duration_adjustment": round(base_price * (duration_factor - 1), 0),
            "distance_adjustment": round(base_price * (distance_factor - 1), 0),
            "demand_adjustment": round(base_price * (demand_factor - 1), 0),
        },
    }


# ---------------------------------------------------------------------------
# Contexte temporel
# ---------------------------------------------------------------------------

def time_context(scheduled_at: Optional[datetime] = None) -> Dict[str, int]:
    """Heure (0-23) et jour (1=lundi … 7=dimanche) à l'heure de Madagascar."""
    local = to_mg(scheduled_at) if scheduled_at is not None else mg_now()
    return {"hour": int(local.hour), "day": int(local.isoweekday())}


def _find_massage_type(db: Optional[Session], name: Optional[str], type_id: Optional[int] = None):
    if db is None:
        return None
    try:
        from ...models.massage import MassageType

        q = db.query(MassageType)
        if type_id:
            return q.filter(MassageType.id == type_id).first()
        if name:
            return q.filter(MassageType.name.ilike(name.strip())).first()
    except Exception:  # noqa: BLE001
        logger.debug("Type de massage introuvable", exc_info=True)
    return None


def _base_price(massage_type: Any, name: Optional[str]) -> float:
    if massage_type is not None:
        value = getattr(massage_type, "recommended_price", None) or getattr(massage_type, "min_price", None)
        if value:
            return float(value)
    wanted = (name or "").lower()
    for key, price in FALLBACK_BASE_PRICES.items():
        if key in wanted:
            return float(price)
    return 35000.0


# ---------------------------------------------------------------------------
# Cœur : suggestion de prix
# ---------------------------------------------------------------------------

def suggest_price_core(
    *,
    massage_type: Any = None,
    massage_type_name: Optional[str] = None,
    duration: int = 60,
    distance: float = DEFAULT_DISTANCE_KM,
    scheduled_at: Optional[datetime] = None,
    experience: Optional[float] = None,
    demand: Optional[float] = None,
) -> Dict[str, Any]:
    """Calcule le prix conseillé (sans accès base). Renvoie un dict complet."""
    name = massage_type_name or getattr(massage_type, "name", None)
    category = getattr(massage_type, "category", None)
    category = getattr(category, "value", category)
    min_price = float(getattr(massage_type, "min_price", None) or 0)

    tc = time_context(scheduled_at)
    demand_value = float(demand) if demand is not None else estimate_demand(tc["hour"], tc["day"])
    exp = float(experience) if experience is not None else float(DEFAULT_EXPERIENCE_YEARS)
    distance = max(float(distance or 0.0), 0.0)

    model = model_registry.get_price_model()
    source, version, confidence = "rule_based", RULE_VERSION, RULE_CONFIDENCE
    raw: Optional[float] = None

    if model is not None:
        type_name = ml.resolve_type(name, category, model.known_types)
        if type_name:
            try:
                raw = model.predict(type_name, duration, distance, tc["hour"], tc["day"], exp, demand_value)
                source, version = "gradient_boosting", model.version
                mape = float(model.meta.get("metrics", {}).get("mape", 5.0))
                confidence = round(max(0.0, 100.0 - mape), 1)
            except Exception:  # noqa: BLE001
                logger.exception("Prédiction du modèle de prix impossible : repli sur la règle métier")
                raw = None

    if raw is None:
        raw = rule_based_price(_base_price(massage_type, name), duration, distance, tc["hour"], demand_value)

    price = round_to_step(raw)
    if min_price > 0:
        price = max(price, round_up_to_step(min_price))

    mae = float((model.meta.get("metrics", {}) if model else {}).get("mae", 0) or 0) or max(price * 0.12, 2500.0)
    low = max(round_to_step(price - 1.5 * mae), round_up_to_step(min_price) if min_price > 0 else 0)
    high = round_to_step(price + 1.5 * mae)

    return {
        "suggested_price": float(price),
        "min_price": float(min(low, price)),
        "max_price": float(max(high, price)),
        "confidence": confidence,
        "model_version": version,
        "model_used": source,
        "demand_index": round(demand_value, 2),
        "features": {
            "type": name, "duration": duration, "distance": round(distance, 2),
            "hour": tc["hour"], "day": tc["day"], "experience": exp, "demand": round(demand_value, 2),
        },
    }


def suggest_price_with_acceptance(
    db: Optional[Session],
    *,
    massage_type_id: Optional[int] = None,
    massage_type_name: Optional[str] = None,
    duration: int = 60,
    distance: float = DEFAULT_DISTANCE_KM,
    scheduled_at: Optional[datetime] = None,
    proposed_price: Optional[float] = None,
    experience: Optional[float] = None,
    user_id: Optional[int] = None,
    booking_id: Optional[int] = None,
    log: bool = True,
) -> Dict[str, Any]:
    """Prix conseillé + probabilité d'acceptation (du prix saisi, sinon du prix conseillé).

    Réponse : {suggested_price, acceptance_probability, model_version, …}
    """
    from .prediction import acceptance_from_ratio  # import tardif (évite le cycle)

    massage_type = _find_massage_type(db, massage_type_name, massage_type_id)
    result = suggest_price_core(
        massage_type=massage_type, massage_type_name=massage_type_name, duration=duration,
        distance=distance, scheduled_at=scheduled_at, experience=experience,
    )
    feats = result["features"]
    reference = result["suggested_price"]
    price_for_acceptance = float(proposed_price) if proposed_price else reference
    ratio = price_for_acceptance / reference if reference > 0 else 1.0
    prob, acc_version, acc_source = acceptance_from_ratio(
        massage_type_name or getattr(massage_type, "name", None),
        getattr(getattr(massage_type, "category", None), "value", getattr(massage_type, "category", None)),
        ratio, feats["distance"], feats["hour"], duration, feats["demand"],
    )
    result.update({
        "acceptance_probability": round(prob, 4),
        "acceptance_model_version": acc_version,
        "massage_type_id": getattr(massage_type, "id", massage_type_id),
        "massage_type": getattr(massage_type, "name", massage_type_name),
        "evaluated_price": price_for_acceptance,
    })
    if log:
        log_prediction(
            db, "price_suggestion", user_id=user_id, booking_id=booking_id,
            predicted_price=result["suggested_price"], recommended_price=result["suggested_price"],
            acceptance_probability=prob, confidence_score=result["confidence"] / 100.0,
            recommended_massage_type_id=result["massage_type_id"],
            features=feats, factors={"price_ratio": round(ratio, 4), "acceptance_source": acc_source},
            model_version=result["model_version"], model_used=result["model_used"],
        )
    return result


async def predict_price(
    massage_type: str,
    duration: int,
    distance: float,
    demand_level: str = "medium",
    db: Optional[Session] = None,
    user_id: Optional[int] = None,
    scheduled_at: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Prédire le prix d'un massage (route POST /ai/predict-price, ancien format)."""
    demand_override = {"low": 0.25, "high": 0.8}.get((demand_level or "").lower())
    mt = _find_massage_type(db, massage_type)
    core = suggest_price_core(
        massage_type=mt, massage_type_name=massage_type, duration=duration, distance=distance,
        scheduled_at=scheduled_at, demand=demand_override,
    )
    from .prediction import acceptance_from_ratio

    prob, acc_version, _ = acceptance_from_ratio(
        massage_type, getattr(getattr(mt, "category", None), "value", getattr(mt, "category", None)),
        1.0, core["features"]["distance"], core["features"]["hour"], duration, core["features"]["demand"],
    )
    log_prediction(
        db, "price_suggestion", user_id=user_id, predicted_price=core["suggested_price"],
        recommended_price=core["suggested_price"], acceptance_probability=prob,
        confidence_score=core["confidence"] / 100.0,
        recommended_massage_type_id=getattr(mt, "id", None), features=core["features"],
        model_version=core["model_version"], model_used=core["model_used"],
    )
    return {
        "suggested_price": core["suggested_price"],
        "min_price": core["min_price"],
        "max_price": core["max_price"],
        "confidence": core["confidence"],
        "acceptance_probability": round(prob, 4),
        "model_version": core["model_version"],
        "factors": {k: float(v) for k, v in core["features"].items() if isinstance(v, (int, float))},
        "breakdown": None,
    }


def calculate_market_price(bookings: List, massage_type_id: int) -> Dict[str, Any]:
    """Prix moyen du marché pour un type de massage."""
    prices = sorted(
        float(b.final_price) for b in bookings if b.massage_type_id == massage_type_id and b.final_price
    )
    if not prices:
        return {"average": 0, "min": 0, "max": 0, "median": 0, "count": 0}
    n = len(prices)
    median = prices[n // 2] if n % 2 == 1 else (prices[n // 2 - 1] + prices[n // 2]) / 2
    return {"average": sum(prices) / n, "min": prices[0], "max": prices[-1], "median": median, "count": n}
