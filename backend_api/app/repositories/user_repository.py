from sqlalchemy.orm import Session
from typing import Optional, List
from ..models.user import User
from .base import BaseRepository

class UserRepository(BaseRepository[User]):
    """Repository pour les utilisateurs"""
    
    def __init__(self, db: Session):
        super().__init__(User, db)
    
    def get_by_email(self, email: str) -> Optional[User]:
        """Obtenir un utilisateur par email"""
        return self.db.query(User).filter(User.email == email).first()
    
    def get_by_phone(self, phone: str) -> Optional[User]:
        """Obtenir un utilisateur par téléphone"""
        return self.db.query(User).filter(User.phone == phone).first()
    
    def get_therapists(self, is_online: Optional[bool] = None, verified_only: bool = True) -> List[User]:
        """Obtenir les thérapeutes"""
        query = self.db.query(User).filter(User.role == "THERAPIST")
        
        if verified_only:
            query = query.filter(User.verification_status == "approved")
        
        if is_online is not None:
            query = query.filter(User.is_online == is_online)
        
        return query.all()
    
    def get_active_therapists(self) -> List[User]:
        """Obtenir les thérapeutes actifs et en ligne"""
        return self.db.query(User).filter(
            User.role == "THERAPIST",
            User.is_online == True,
            User.is_available == True,
            User.verification_status == "approved",
            User.is_active == True
        ).all()
    
    def get_nearby_therapists(self, latitude: float, longitude: float, radius_km: int = 10) -> List[User]:
        """Obtenir les thérapeutes à proximité avec PostGIS"""
        from sqlalchemy import func
        
        return self.db.query(User).filter(
            User.role == "THERAPIST",
            User.verification_status == "approved",
            User.is_online == True,
            User.is_available == True,
            func.ST_DWithin(
                User.last_location,
                func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326),
                radius_km * 1000
            )
        ).all()
    
    def update_location(self, user_id: int, latitude: float, longitude: float) -> Optional[User]:
        """Mettre à jour la localisation d'un utilisateur"""
        user = self.get(user_id)
        if user:
            user.latitude = latitude
            user.longitude = longitude
            user.last_location = f"POINT({longitude} {latitude})"
            self.db.commit()
            self.db.refresh(user)
        return user
    
    def get_analytics(self, user_id: int) -> dict:
        """Obtenir les analytics d'un utilisateur"""
        user = self.get(user_id)
        if not user:
            return {}
        
        from ..models.booking import Booking
        from ..models.payment import Payment
        from ..models.review import Review
        
        # Statistiques des réservations
        total_bookings = self.db.query(Booking).filter(Booking.client_id == user_id).count()
        completed_bookings = self.db.query(Booking).filter(
            Booking.client_id == user_id,
            Booking.status == "completed"
        ).count()
        
        # Dépenses totales
        total_spent = self.db.query(func.sum(Payment.amount)).filter(
            Payment.user_id == user_id,
            Payment.status == "completed"
        ).scalar() or 0
        
        # Avis donnés
        reviews_given = self.db.query(Review).filter(Review.reviewer_id == user_id).count()
        
        return {
            "total_bookings": total_bookings,
            "completed_bookings": completed_bookings,
            "total_spent": float(total_spent),
            "reviews_given": reviews_given,
            "member_since": user.created_at
        }