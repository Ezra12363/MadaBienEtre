# app/services/ai/recommendation_service.py
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import math
from datetime import datetime
from ...models.user import User
from ...models.booking import Booking
from ...models.review import Review
from ...models.analytics import UserAnalytics  # ✅ Modifié: user_analytics -> analytics
from ...repositories.therapist_repository import TherapistRepository


async def recommend_therapists(
    user_id: int,
    db: Session,
    massage_type: Optional[str] = None,
    budget_max: Optional[float] = None,
    distance_max: int = 10,
    preferred_gender: Optional[str] = None,
    symptoms: Optional[str] = None,
    preferred_date: Optional[datetime] = None,
    duration_minutes: int = 60
) -> List[Dict[str, Any]]:
    """
    Recommander des thérapeutes basé sur l'IA
    """
    # Récupérer l'utilisateur
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return []
    
    # Récupérer les thérapeutes disponibles
    therapists = db.query(User).filter(
        User.role == "THERAPIST",
        User.verification_status == "approved",
        User.is_active == True,
        User.is_online == True,
        User.deleted_at.is_(None)
    ).all()
    
    if not therapists:
        return []
    
    # Position de l'utilisateur
    user_lat = user.latitude
    user_lon = user.longitude
    
    # Récupérer l'historique de l'utilisateur
    user_bookings = db.query(Booking).filter(
        Booking.client_id == user_id,
        Booking.status == "completed"
    ).order_by(Booking.created_at.desc()).limit(10).all()
    
    user_preferences = db.query(UserAnalytics).filter(UserAnalytics.user_id == user_id).first()
    
    recommendations = []
    
    for therapist in therapists:
        score = 0.0
        reasons = []
        
        # 1. Distance (25%)
        distance = 0
        if user_lat and user_lon and therapist.latitude and therapist.longitude:
            distance = calculate_distance(
                user_lat, user_lon,
                float(therapist.latitude), float(therapist.longitude)
            )
            if distance <= distance_max:
                distance_score = max(0, 1 - (distance / distance_max)) * 25
                score += distance_score
                reasons.append(f"Distance: {distance:.1f} km ({distance_score:.0f}%)")
        
        # 2. Prix (20%)
        if budget_max and therapist.base_price:
            price_score = max(0, 1 - (float(therapist.base_price) / budget_max)) * 20
            score += price_score
            reasons.append(f"Prix: {float(therapist.base_price):.0f} Ar ({price_score:.0f}%)")
        else:
            score += 10
        
        # 3. Note (20%)
        rating_score = float(therapist.rating or 0) * 4
        score += rating_score
        reasons.append(f"Note: {float(therapist.rating or 0):.1f}/5 ({rating_score:.0f}%)")
        
        # 4. Disponibilité (20%)
        if therapist.is_available:
            availability_score = 20
            reasons.append("Disponible (20%)")
        else:
            availability_score = 0
            reasons.append("Non disponible (0%)")
        score += availability_score
        
        # 5. Expérience (10%)
        experience_score = min(therapist.experience_years or 0, 10)
        score += experience_score
        reasons.append(f"Expérience: {therapist.experience_years or 0} ans ({experience_score:.0f}%)")
        
        # 6. Type de massage (5%)
        if massage_type:
            massage_match = 5
            score += massage_match
            reasons.append(f"Correspond au type: {massage_type} (5%)")
        
        # Bonus: Préférences de genre (5%)
        if preferred_gender and preferred_gender != "any":
            if preferred_gender == "female" and therapist.fullname.endswith("a"):
                score += 5
                reasons.append("Genre préféré (5%)")
        
        # Bonus: Historique utilisateur
        if user_bookings and therapist.id in [b.therapist_id for b in user_bookings]:
            score += 5
            reasons.append("Déjà réservé (5%)")
        
        final_score = min(score, 100)
        
        suggested_price = float(therapist.base_price or 30000)
        if budget_max:
            suggested_price = min(suggested_price, budget_max)
        
        recommendations.append({
            "therapist_id": therapist.id,
            "fullname": therapist.fullname,
            "rating": float(therapist.rating or 0),
            "total_reviews": therapist.total_reviews or 0,
            "distance_km": round(distance, 2) if distance else 0,
            "price_suggested": round(suggested_price, 0),
            "availability": therapist.is_available,
            "score": round(final_score, 2),
            "reason": " | ".join(reasons[:3]),
            "profile_image": therapist.profile_image,
            "experience_years": therapist.experience_years or 0,
            "base_price": float(therapist.base_price) if therapist.base_price else None
        })
    
    recommendations.sort(key=lambda x: x["score"], reverse=True)
    
    return recommendations[:10]


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculer la distance entre deux points en kilomètres (Haversine)"""
    R = 6371  # Rayon de la Terre en km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


async def predict_price(
    db: Session,
    massage_type_id: int,
    therapist_id: int,
    duration_minutes: int = 60,
    distance_km: float = 0
) -> Dict[str, Any]:
    """
    Prédire le prix recommandé pour un massage
    """
    from ...models.massage import MassageType
    from ...models.therapist import TherapistEarnings
    
    # Récupérer le type de massage
    massage_type = db.query(MassageType).filter(MassageType.id == massage_type_id).first()
    if not massage_type:
        return {"suggested_price": 30000, "confidence": 0.5}
    
    # Récupérer le thérapeute
    therapist = db.query(User).filter(User.id == therapist_id).first()
    if not therapist:
        return {"suggested_price": 30000, "confidence": 0.5}
    
    # Prix de base
    base_price = float(therapist.base_price or massage_type.min_price or 30000)
    
    # Ajustements
    duration_factor = duration_minutes / 60
    distance_factor = 1 + (distance_km / 100)
    
    # Prix suggéré
    suggested_price = base_price * duration_factor * distance_factor
    
    # Arrondir à la centaine près
    suggested_price = round(suggested_price / 100) * 100
    
    return {
        "suggested_price": suggested_price,
        "confidence": 0.8,
        "base_price": base_price,
        "duration_factor": duration_factor,
        "distance_factor": distance_factor
    }


async def get_popular_therapists(
    db: Session,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Récupérer les thérapeutes les plus populaires
    """
    therapists = db.query(User).filter(
        User.role == "THERAPIST",
        User.verification_status == "approved",
        User.is_active == True
    ).order_by(
        User.rating.desc(),
        User.total_reviews.desc()
    ).limit(limit).all()
    
    results = []
    for therapist in therapists:
        results.append({
            "id": therapist.id,
            "fullname": therapist.fullname,
            "rating": float(therapist.rating or 0),
            "total_reviews": therapist.total_reviews or 0,
            "profile_image": therapist.profile_image,
            "base_price": float(therapist.base_price) if therapist.base_price else None,
            "experience_years": therapist.experience_years or 0,
            "is_online": therapist.is_online
        })
    
    return results


async def get_therapist_stats(
    db: Session,
    therapist_id: int
) -> Dict[str, Any]:
    """
    Récupérer les statistiques d'un thérapeute
    """
    therapist = db.query(User).filter(User.id == therapist_id).first()
    if not therapist:
        return {}
    
    # Compter les réservations
    total_bookings = db.query(Booking).filter(Booking.therapist_id == therapist_id).count()
    completed_bookings = db.query(Booking).filter(
        Booking.therapist_id == therapist_id,
        Booking.status == "completed"
    ).count()
    cancelled_bookings = db.query(Booking).filter(
        Booking.therapist_id == therapist_id,
        Booking.status.in_(["cancelled_by_client", "cancelled_by_therapist"])
    ).count()
    
    # Calculer le taux de complétion
    completion_rate = (completed_bookings / total_bookings * 100) if total_bookings > 0 else 0
    
    return {
        "therapist_id": therapist_id,
        "total_bookings": total_bookings,
        "completed_bookings": completed_bookings,
        "cancelled_bookings": cancelled_bookings,
        "completion_rate": round(completion_rate, 2),
        "rating": float(therapist.rating or 0),
        "total_reviews": therapist.total_reviews or 0,
        "is_online": therapist.is_online,
        "is_available": therapist.is_available
    }