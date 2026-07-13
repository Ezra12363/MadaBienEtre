# app/services/ai/prediction.py
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from ...models.booking import Booking
from ...models.user import User
from ...models.user_analytics import UserAnalytics

async def predict_acceptance_probability(
    booking: Booking,
    proposed_price: float,
    db: Session
) -> float:
    """
    Prédire la probabilité d'acceptation d'une offre
    """
    probability = 0.5
    
    # 1. Facteur: Prix proposé vs prix demandé
    if booking.client_price_proposed > 0:
        price_ratio = proposed_price / float(booking.client_price_proposed)
        if 0.8 <= price_ratio <= 1.2:
            probability += 0.2
        elif 0.6 <= price_ratio <= 1.4:
            probability += 0.1
        else:
            probability -= 0.2
    
    # 2. Facteur: Distance
    if booking.therapist_id:
        therapist = db.query(User).filter(User.id == booking.therapist_id).first()
        if therapist and therapist.last_location and booking.client_location:
            probability += 0.1
        else:
            probability += 0.05
    
    # 3. Facteur: Heure de la demande
    if booking.created_at:
        hour = booking.created_at.hour
        if 9 <= hour <= 17:
            probability += 0.05
    
    # 4. Facteur: Disponibilité du thérapeute
    if booking.therapist_id:
        therapist = db.query(User).filter(User.id == booking.therapist_id).first()
        if therapist and therapist.is_available:
            probability += 0.1
    
    # 5. Facteur: Historique du thérapeute
    if booking.therapist_id:
        total_offers = db.query(Booking).filter(
            Booking.therapist_id == booking.therapist_id
        ).count()
        
        if total_offers > 0:
            accepted_offers = db.query(Booking).filter(
                Booking.therapist_id == booking.therapist_id,
                Booking.status == "confirmed"
            ).count()
            acceptance_rate = accepted_offers / total_offers
            probability += acceptance_rate * 0.1
    
    # 6. Facteur: Historique du client
    if booking.client_id:
        analytics = db.query(UserAnalytics).filter(
            UserAnalytics.user_id == booking.client_id
        ).first()
        
        if analytics and analytics.total_bookings > 5:
            probability += 0.05
    
    # Normaliser
    probability = max(0, min(1, probability))
    
    return probability

async def predict_demand(
    massage_type_id: int,
    date: datetime,
    db: Session
) -> Dict[str, Any]:
    """
    Prédire la demande pour un type de massage
    """
    one_year_ago = date - timedelta(days=365)
    
    past_bookings = db.query(Booking).filter(
        Booking.massage_type_id == massage_type_id,
        Booking.scheduled_date.between(one_year_ago, date),
        Booking.status == "completed"
    ).count()
    
    future_bookings = db.query(Booking).filter(
        Booking.massage_type_id == massage_type_id,
        Booking.scheduled_date > date,
        Booking.status.in_(["confirmed", "pending"])
    ).count()
    
    trend = "stable"
    if past_bookings > 0:
        growth_rate = future_bookings / past_bookings
        if growth_rate > 1.2:
            trend = "rising"
        elif growth_rate < 0.8:
            trend = "falling"
    
    demand_level = "medium"
    total_bookings = past_bookings + future_bookings
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
        "confidence": 0.75
    }

async def predict_revenue(
    therapist_id: int,
    days_ahead: int = 30,
    db: Session = None
) -> Dict[str, Any]:
    """
    Prédire les revenus d'un thérapeute
    """
    past_bookings = db.query(Booking).filter(
        Booking.therapist_id == therapist_id,
        Booking.status == "completed"
    ).order_by(Booking.scheduled_date.desc()).limit(90).all()
    
    if not past_bookings:
        return {
            "predicted_revenue": 0,
            "confidence": 0,
            "daily_average": 0,
            "weekly_average": 0,
            "monthly_average": 0
        }
    
    total_revenue = sum(float(b.final_price or 0) for b in past_bookings)
    days_covered = (datetime.utcnow() - past_bookings[0].scheduled_date).days or 1
    daily_average = total_revenue / days_covered
    
    predicted_revenue = daily_average * days_ahead
    
    return {
        "predicted_revenue": predicted_revenue,
        "confidence": 0.7,
        "daily_average": daily_average,
        "weekly_average": daily_average * 7,
        "monthly_average": daily_average * 30,
        "based_on_bookings": len(past_bookings),
        "days_analyzed": days_covered
    }