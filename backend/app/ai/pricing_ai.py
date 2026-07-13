from typing import Dict, Any, List, Optional
import math
from datetime import datetime

def calculate_dynamic_price(
    base_price: float,
    duration: int,
    distance: float,
    user_history: List[float] = None,
    demand_factor: float = 1.0,
    time_of_day: Optional[str] = None,
    day_of_week: Optional[int] = None
) -> Dict[str, Any]:
    """
    Calculer un prix dynamique basé sur l'IA
    """
    # Facteur de durée (ajout de 5% par 30 minutes au-delà de 60 min)
    duration_factor = 1.0 + ((duration - 60) / 30) * 0.05
    duration_factor = max(duration_factor, 0.8)  # Minimum 0.8
    
    # Facteur de distance (1% par km)
    distance_factor = 1.0 + (distance / 10) * 0.01
    distance_factor = min(distance_factor, 1.5)  # Maximum 1.5
    
    # Facteur horaire
    time_factor = 1.0
    if time_of_day:
        time_factors = {
            "morning": 0.9,    # Moins cher le matin
            "afternoon": 1.0,   # Prix normal
            "evening": 1.1,     # Plus cher le soir
            "night": 1.2        # Plus cher la nuit
        }
        time_factor = time_factors.get(time_of_day, 1.0)
    
    # Facteur jour de semaine
    day_factor = 1.0
    if day_of_week is not None:
        # Week-end plus cher
        if day_of_week in [5, 6]:  # Samedi, Dimanche
            day_factor = 1.15
        else:
            day_factor = 0.95
    
    # Facteur historique utilisateur
    history_factor = 1.0
    if user_history and len(user_history) > 0:
        avg_user_price = sum(user_history) / len(user_history)
        if avg_user_price > 0:
            history_factor = avg_user_price / base_price
            history_factor = max(history_factor, 0.7)
            history_factor = min(history_factor, 1.3)
    
    # Calcul du prix
    base_price = float(base_price)
    price = base_price * duration_factor * distance_factor * demand_factor * time_factor * day_factor * history_factor
    
    # Arrondir
    final_price = round(price / 1000) * 1000  # Arrondir à 1000 Ar près
    
    # Prix minimum et maximum
    min_price = max(base_price * 0.7, 20000)
    max_price = base_price * 2
    
    # Assurer que le prix est dans les limites
    final_price = max(min_price, min(final_price, max_price))
    
    return {
        "price": final_price,
        "min_price": round(min_price, 0),
        "max_price": round(max_price, 0),
        "confidence": 85.0,  # Score de confiance
        "factors": {
            "base_price": base_price,
            "duration_factor": duration_factor,
            "distance_factor": distance_factor,
            "demand_factor": demand_factor,
            "time_factor": time_factor,
            "day_factor": day_factor,
            "history_factor": history_factor
        },
        "breakdown": {
            "base": base_price,
            "duration_adjustment": round(base_price * (duration_factor - 1), 0),
            "distance_adjustment": round(base_price * (distance_factor - 1), 0),
            "demand_adjustment": round(base_price * (demand_factor - 1), 0)
        }
    }

async def predict_price(
    massage_type: str,
    duration: int,
    distance: float,
    demand_level: str = "medium",
    db: Session = None
) -> Dict[str, Any]:
    """
    Prédire le prix d'un massage
    """
    # Facteur de demande
    demand_factors = {
        "low": 0.9,
        "medium": 1.0,
        "high": 1.15
    }
    demand_factor = demand_factors.get(demand_level, 1.0)
    
    # Prix de base selon le type de massage
    base_prices = {
        "relaxant": 35000,
        "therapeutique": 45000,
        "sportif": 40000,
        "reflexologie": 30000,
        "prenatal": 42000,
        "pierres chaudes": 55000,
        "shiatsu": 40000,
        "deep tissue": 45000
    }
    
    # Trouver le prix de base
    base_price = 35000  # Prix par défaut
    for key, value in base_prices.items():
        if key.lower() in massage_type.lower():
            base_price = value
            break
    
    # Calculer le prix dynamique
    result = calculate_dynamic_price(
        base_price=base_price,
        duration=duration,
        distance=distance,
        demand_factor=demand_factor
    )
    
    return {
        "suggested_price": result["price"],
        "min_price": result["min_price"],
        "max_price": result["max_price"],
        "confidence": result["confidence"],
        "factors": result["factors"],
        "breakdown": result["breakdown"]
    }

def calculate_market_price(bookings: List, massage_type_id: int) -> Dict[str, Any]:
    """
    Calculer le prix moyen du marché pour un type de massage
    """
    prices = []
    for booking in bookings:
        if booking.massage_type_id == massage_type_id and booking.final_price:
            prices.append(float(booking.final_price))
    
    if not prices:
        return {
            "average": 0,
            "min": 0,
            "max": 0,
            "median": 0,
            "count": 0
        }
    
    prices.sort()
    n = len(prices)
    
    return {
        "average": sum(prices) / n,
        "min": prices[0],
        "max": prices[-1],
        "median": prices[n // 2] if n % 2 == 1 else (prices[n // 2 - 1] + prices[n // 2]) / 2,
        "count": n
    }