from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.massage import MassageType
from ..models.booking import Booking
from ..models.user import User
from ..services.ai.pricing_service import calculate_dynamic_price

router = APIRouter(prefix="/api/pricing", tags=["Dynamic Pricing"])

@router.post("/suggest")
async def suggest_price(
    massage_type_id: int,
    duration: int,
    distance: float,
    user_id: int = None,
    db: Session = Depends(get_db)
):
    """Suggérer un prix basé sur l'IA"""
    massage_type = db.query(MassageType).filter(MassageType.id == massage_type_id).first()
    if not massage_type:
        raise HTTPException(status_code=404, detail="Massage type not found")
    
    # Récupérer l'historique de l'utilisateur
    user_history = []
    if user_id:
        bookings = db.query(Booking).filter(
            Booking.client_id == user_id,
            Booking.status == "completed"
        ).order_by(Booking.created_at.desc()).limit(10).all()
        user_history = [float(b.final_price or b.client_price_proposed) for b in bookings]
    
    # Calculer le prix dynamique
    result = calculate_dynamic_price(
        base_price=float(massage_type.min_price or 30000),
        duration=duration,
        distance=distance,
        user_history=user_history,
        demand_factor=1.0
    )
    
    return {
        "suggested_price": result["price"],
        "min_price": result["min_price"],
        "max_price": result["max_price"],
        "confidence": result["confidence"],
        "factors": result["factors"]
    }

@router.post("/calculate")
async def calculate_price(
    massage_type: str,
    duration: int,
    distance: float,
    demand_level: str = "medium",
    db: Session = Depends(get_db)
):
    """Calculer le prix avec tous les facteurs"""
    # Récupérer le type de massage
    massage = db.query(MassageType).filter(MassageType.name.ilike(f"%{massage_type}%")).first()
    if not massage:
        raise HTTPException(status_code=404, detail="Massage type not found")
    
    # Facteurs de prix
    base_price = float(massage.min_price or 30000)
    
    # Facteur durée (ajout par minute)
    duration_factor = 1.0 + (duration - 60) * 0.005
    
    # Facteur distance
    distance_factor = 1.0 + (distance / 10) * 0.1
    
    # Facteur demande
    demand_factors = {"low": 0.9, "medium": 1.0, "high": 1.2}
    demand_factor = demand_factors.get(demand_level, 1.0)
    
    price = base_price * duration_factor * distance_factor * demand_factor
    
    return {
        "base_price": base_price,
        "final_price": round(price, 0),
        "duration_factor": duration_factor,
        "distance_factor": distance_factor,
        "demand_factor": demand_factor,
        "breakdown": {
            "base": base_price,
            "duration_adjustment": base_price * (duration_factor - 1),
            "distance_adjustment": base_price * (distance_factor - 1),
            "demand_adjustment": base_price * (demand_factor - 1)
        }
    }

@router.get("/market-analysis")
async def get_market_analysis(
    massage_type_id: int = None,
    db: Session = Depends(get_db)
):
    """Analyse des prix du marché"""
    query = db.query(Booking).filter(Booking.status == "completed")
    
    if massage_type_id:
        query = query.filter(Booking.massage_type_id == massage_type_id)
    
    bookings = query.all()
    
    if not bookings:
        return {
            "average_price": 0,
            "min_price": 0,
            "max_price": 0,
            "total_bookings": 0,
            "price_distribution": []
        }
    
    prices = [float(b.final_price or b.client_price_proposed) for b in bookings]
    
    # Distribution des prix
    distribution = []
    price_range = max(prices) - min(prices) if len(prices) > 1 else 10000
    step = price_range / 5 if price_range > 0 else 10000
    
    for i in range(5):
        low = min(prices) + i * step
        high = min(prices) + (i + 1) * step
        count = sum(1 for p in prices if low <= p < high)
        distribution.append({"range": f"{int(low)} - {int(high)}", "count": count})
    
    return {
        "average_price": sum(prices) / len(prices),
        "min_price": min(prices),
        "max_price": max(prices),
        "total_bookings": len(prices),
        "price_distribution": distribution
    }