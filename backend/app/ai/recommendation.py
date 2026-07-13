from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any, Optional
import math
from datetime import datetime
from ..models.user import User
from ..models.booking import Booking
from ..models.review import Review
from ..models.user_analytics import UserAnalytics
from ..repositories.therapist_repository import TherapistRepository

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
    therapist_repo = TherapistRepository(db)
    therapists = therapist_repo.get_verified_therapists(is_online=True)
    
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
        # Calculer le score pour chaque thérapeute
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
            score += 10  # Score par défaut
        
        # 3. Note (20%)
        rating_score = float(therapist.rating or 0) * 4  # Max 20 (5*4=20)
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
        experience_score = min(therapist.experience_years or 0, 10)  # Max 10 ans
        score += experience_score
        reasons.append(f"Expérience: {therapist.experience_years or 0} ans ({experience_score:.0f}%)")
        
        # 6. Type de massage (5%)
        # Simuler la correspondance de type de massage
        if massage_type:
            # Vérifier si le thérapeute propose ce type de massage
            # (à implémenter avec therapist_specialties)
            massage_match = 5
            score += massage_match
            reasons.append(f"Correspond au type: {massage_type} (5%)")
        
        # Bonus: Préférences de genre (5%)
        if preferred_gender and preferred_gender != "any":
            # Vérifier le genre du thérapeute (à implémenter)
            if preferred_gender == "female" and therapist.fullname.endswith("a"):  # Simplification
                score += 5
                reasons.append("Genre préféré (5%)")
        
        # Bonus: Historique utilisateur
        if user_bookings and therapist.id in [b.therapist_id for b in user_bookings]:
            # Si l'utilisateur a déjà réservé ce thérapeute
            score += 5
            reasons.append("Déjà réservé (5%)")
        
        # Normaliser le score (max 100)
        final_score = min(score, 100)
        
        # Prix suggéré
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
            "reason": " | ".join(reasons[:3]),  # Top 3 raisons
            "profile_image": therapist.profile_image,
            "experience_years": therapist.experience_years or 0,
            "base_price": float(therapist.base_price) if therapist.base_price else None
        })
    
    # Trier par score décroissant
    recommendations.sort(key=lambda x: x["score"], reverse=True)
    
    # Limiter à 10 recommandations
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