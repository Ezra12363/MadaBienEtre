# app/api/ai.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from ..core.database import get_db
from ..core.dependencies import get_current_user, get_current_admin
from ..models.user import User
from ..models.booking import Booking
from ..schemas.ai import (
    AIRecommendationRequest,
    AIRecommendationResponse,
    AIPricingRequest,
    AIPricingResponse,
    AIAcceptancePrediction,
    ChatbotRequest,
    ChatbotResponse,
    AIFraudDetectionRequest,
    AIFraudDetectionResponse
)

# ✅ Imports corrigés
from ..services.ai.recommendation_service import recommend_therapists
from ..services.ai.pricing_service import predict_price, calculate_dynamic_price
from ..services.ai.fraud_detection import detect_fraud
from ..services.ai.prediction import predict_acceptance_probability, predict_revenue, predict_demand
from ..services.ai.chatbot_service import get_chatbot_response

router = APIRouter(prefix="/api/ai", tags=["AI"])

@router.post("/recommend-therapist", response_model=List[AIRecommendationResponse])
async def recommend_therapist(
    request: AIRecommendationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Recommandation de thérapeutes par IA"""
    if current_user.id != request.user_id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    recommendations = await recommend_therapists(
        user_id=request.user_id,
        massage_type=request.massage_type,
        budget_max=request.budget_max,
        distance_max=request.distance_max,
        preferred_gender=request.preferred_gender,
        symptoms=request.symptoms,
        db=db
    )
    
    # Sauvegarder la prédiction
    if recommendations:
        from ..models.ai_prediction import AIPrediction
        prediction = AIPrediction(
            booking_id=None,
            predicted_price=recommendations[0].get("price_suggested"),
            confidence_score=85.0,
            model_version="1.0",
            factors={
                "user_id": request.user_id,
                "massage_type": request.massage_type,
                "budget_max": request.budget_max
            }
        )
        db.add(prediction)
        db.commit()
    
    return recommendations

@router.post("/predict-price", response_model=AIPricingResponse)
async def predict_price_endpoint(
    request: AIPricingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Prédiction de prix par IA"""
    result = await predict_price(
        massage_type=request.massage_type,
        duration=request.duration,
        distance=request.distance,
        demand_level=request.demand_level,
        db=db
    )
    
    return result

@router.post("/predict-acceptance")
async def predict_acceptance(
    booking_id: int,
    price: float,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Prédire la probabilité d'acceptation d'une offre"""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    probability = await predict_acceptance_probability(
        booking=booking,
        proposed_price=price,
        db=db
    )
    
    return {
        "probability": probability,
        "price": price,
        "booking_id": booking_id
    }

@router.post("/fraud-detection")
async def fraud_detection(
    request: AIFraudDetectionRequest,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Détection de fraude par IA"""
    booking = db.query(Booking).filter(Booking.id == request.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    result = await detect_fraud(booking=booking, db=db)
    return result

@router.get("/popular-services")
async def get_popular_services(
    period: str = "month",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Services les plus populaires (IA)"""
    from datetime import datetime, timedelta
    
    now = datetime.utcnow()
    if period == "day":
        start_date = now - timedelta(days=1)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = now - timedelta(days=30)
    
    from sqlalchemy import func
    result = db.query(
        Booking.massage_type_id,
        func.count(Booking.id).label('count')
    ).filter(
        Booking.created_at >= start_date,
        Booking.status == "completed"
    ).group_by(Booking.massage_type_id).order_by(func.count(Booking.id).desc()).limit(5).all()
    
    return [
        {
            "massage_type_id": r[0],
            "bookings_count": r[1]
        }
        for r in result
    ]

@router.get("/best-therapists")
async def get_best_therapists(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Meilleurs thérapeutes selon l'IA"""
    therapists = db.query(User).filter(
        User.role == "THERAPIST",
        User.verification_status == "approved",
        User.is_active == True,
        User.total_reviews > 0
    ).order_by(User.rating.desc()).limit(limit).all()
    
    return [
        {
            "id": t.id,
            "fullname": t.fullname,
            "rating": float(t.rating),
            "total_reviews": t.total_reviews,
            "experience_years": t.experience_years,
            "base_price": float(t.base_price) if t.base_price else 0,
            "profile_image": t.profile_image
        }
        for t in therapists
    ]

@router.get("/revenue-prediction")
async def revenue_prediction(
    therapist_id: Optional[int] = None,
    days_ahead: int = 30,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Prédiction des revenus par IA"""
    if therapist_id:
        result = await predict_revenue(
            therapist_id=therapist_id,
            days_ahead=days_ahead,
            db=db
        )
        return result
    else:
        # Prédiction globale
        from datetime import datetime, timedelta
        from sqlalchemy import func
        
        six_months_ago = datetime.utcnow() - timedelta(days=180)
        
        monthly_revenue = db.query(
            func.date_trunc('month', Booking.actual_end_time).label('month'),
            func.sum(Booking.final_price).label('revenue')
        ).filter(
            Booking.status == "completed",
            Booking.actual_end_time >= six_months_ago
        ).group_by('month').order_by('month').all()
        
        revenues = [float(r[1] or 0) for r in monthly_revenue]
        if len(revenues) >= 3:
            avg_growth = sum(revenues[i] - revenues[i-1] for i in range(1, len(revenues))) / (len(revenues) - 1)
            next_month = revenues[-1] + avg_growth
        else:
            next_month = revenues[-1] if revenues else 0
        
        return {
            "monthly_data": [{"month": str(r[0]), "revenue": float(r[1] or 0)} for r in monthly_revenue],
            "predicted_next_month": next_month,
            "total_6_months": sum(revenues),
            "average_monthly": sum(revenues) / len(revenues) if revenues else 0
        }

@router.get("/insights")
async def get_ai_insights(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Insights IA pour l'admin"""
    from sqlalchemy import func
    from datetime import datetime, timedelta
    
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)
    
    # Réservations des 30 derniers jours
    recent_bookings = db.query(Booking).filter(
        Booking.created_at >= thirty_days_ago
    ).count()
    
    # Taux de complétion
    completed = db.query(Booking).filter(
        Booking.status == "completed",
        Booking.created_at >= thirty_days_ago
    ).count()
    completion_rate = (completed / recent_bookings * 100) if recent_bookings > 0 else 0
    
    # Revenus des 30 derniers jours
    revenue = db.query(func.sum(Booking.final_price)).filter(
        Booking.status == "completed",
        Booking.created_at >= thirty_days_ago
    ).scalar() or 0
    
    return {
        "period": "30_days",
        "total_bookings": recent_bookings,
        "completion_rate": round(completion_rate, 2),
        "total_revenue": float(revenue),
        "average_booking_value": float(revenue / recent_bookings) if recent_bookings > 0 else 0
    }