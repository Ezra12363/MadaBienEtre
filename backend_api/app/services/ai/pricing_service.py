from typing import Dict, Any, List, Optional

from sqlalchemy.orm import Session


def calculate_dynamic_price(
    base_price: float,
    duration: int,
    distance: float,
    user_history: Optional[List[float]] = None,
    demand_factor: float = 1.0,
    time_of_day: Optional[str] = None,
    day_of_week: Optional[int] = None,
) -> Dict[str, Any]:
    """Calculer un prix dynamique."""
    base_price = float(base_price)
    distance = max(float(distance or 0), 0.0)

    # Durée : +5% par tranche de 30 min au-delà de 60 min
    duration_factor = max(1.0 + ((duration - 60) / 30) * 0.05, 0.8)

    # Distance : +1% par km (max x1.5)
    distance_factor = min(1.0 + distance * 0.01, 1.5)

    time_factor = 1.0
    if time_of_day:
        time_factor = {
            "morning": 0.9,
            "afternoon": 1.0,
            "evening": 1.1,
            "night": 1.2,
        }.get(time_of_day, 1.0)

    day_factor = 1.0
    if day_of_week is not None:
        day_factor = 1.15 if day_of_week in (5, 6) else 0.95

    history_factor = 1.0
    if user_history:
        avg_user_price = sum(user_history) / len(user_history)
        if avg_user_price > 0 and base_price > 0:
            history_factor = min(max(avg_user_price / base_price, 0.7), 1.3)

    price = (
        base_price * duration_factor * distance_factor * demand_factor
        * time_factor * day_factor * history_factor
    )
    final_price = round(price / 1000) * 1000

    min_price = max(base_price * 0.7, 20000)
    max_price = max(base_price * 2, min_price)
    final_price = max(min_price, min(final_price, max_price))

    return {
        "price": final_price,
        "min_price": round(min_price, 0),
        "max_price": round(max_price, 0),
        "confidence": 85.0,
        "factors": {
            "base_price": base_price,
            "duration_factor": duration_factor,
            "distance_factor": distance_factor,
            "demand_factor": demand_factor,
            "time_factor": time_factor,
            "day_factor": day_factor,
            "history_factor": history_factor,
        },
        "breakdown": {
            "base": base_price,
            "duration_adjustment": round(base_price * (duration_factor - 1), 0),
            "distance_adjustment": round(base_price * (distance_factor - 1), 0),
            "demand_adjustment": round(base_price * (demand_factor - 1), 0),
        },
    }


async def predict_price(
    massage_type: str,
    duration: int,
    distance: float,
    demand_level: str = "medium",
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Prédire le prix d'un massage."""
    demand_factor = {"low": 0.9, "medium": 1.0, "high": 1.15}.get(demand_level, 1.0)

    base_prices = {
        "relaxant": 35000,
        "therapeutique": 45000,
        "thérapeutique": 45000,
        "sportif": 40000,
        "reflexologie": 30000,
        "réflexologie": 30000,
        "prenatal": 42000,
        "prénatal": 42000,
        "pierres chaudes": 55000,
        "shiatsu": 40000,
        "deep tissue": 45000,
    }

    base_price = 35000
    wanted = (massage_type or "").lower()
    for key, value in base_prices.items():
        if key in wanted:
            base_price = value
            break

    result = calculate_dynamic_price(
        base_price=base_price,
        duration=duration,
        distance=distance,
        demand_factor=demand_factor,
    )

    return {
        "suggested_price": result["price"],
        "min_price": result["min_price"],
        "max_price": result["max_price"],
        "confidence": result["confidence"],
        "factors": result["factors"],
        "breakdown": result["breakdown"],
    }


def calculate_market_price(bookings: List, massage_type_id: int) -> Dict[str, Any]:
    """Prix moyen du marché pour un type de massage."""
    prices = sorted(
        float(b.final_price)
        for b in bookings
        if b.massage_type_id == massage_type_id and b.final_price
    )
    if not prices:
        return {"average": 0, "min": 0, "max": 0, "median": 0, "count": 0}

    n = len(prices)
    median = prices[n // 2] if n % 2 == 1 else (prices[n // 2 - 1] + prices[n // 2]) / 2
    return {
        "average": sum(prices) / n,
        "min": prices[0],
        "max": prices[-1],
        "median": median,
        "count": n,
    }
