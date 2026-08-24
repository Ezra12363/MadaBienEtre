from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from ..models.user import User
from ..models.booking import Booking
from ..models.payment import Payment
from ..models.review import Review
from .base import BaseRepository

class TherapistRepository(BaseRepository[User]):
    """Repository pour les thérapeutes"""
    
    def __init__(self, db: Session):
        super().__init__(User, db)
    
    def get_verified_therapists(self, is_online: Optional[bool] = None) -> List[User]:
        """Obtenir les thérapeutes vérifiés"""
        query = self.db.query(User).filter(
            User.role == "THERAPIST",
            User.verification_status == "approved",
            User.is_active == True
        )
        if is_online is not None:
            query = query.filter(User.is_online == is_online)
        return query.all()
    
    def get_pending_therapists(self) -> List[User]:
        """Obtenir les thérapeutes en attente de validation"""
        return self.db.query(User).filter(
            User.role == "THERAPIST",
            User.verification_status == "pending"
        ).all()
    
    def get_therapist_earnings(self, therapist_id: int, period: str = "month") -> Dict[str, Any]:
        """Obtenir les gains d'un thérapeute"""
        now = datetime.utcnow()
        
        if period == "day":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "week":
            start_date = now - timedelta(days=7)
        elif period == "month":
            start_date = now - timedelta(days=30)
        elif period == "year":
            start_date = now - timedelta(days=365)
        else:
            start_date = now - timedelta(days=30)
        
        # Réservations complétées
        bookings = self.db.query(Booking).filter(
            Booking.therapist_id == therapist_id,
            Booking.status == "completed",
            Booking.actual_end_time >= start_date
        ).all()
        
        total_revenue = sum(float(b.final_price or 0) for b in bookings)
        total_bookings = len(bookings)
        
        # Commission
        therapist = self.get(therapist_id)
        commission_rate = float(therapist.commission_rate or 10) / 100 if therapist else 0.10
        commission = total_revenue * commission_rate
        net_earnings = total_revenue - commission
        
        return {
            "period": period,
            "total_bookings": total_bookings,
            "total_revenue": total_revenue,
            "commission_rate": commission_rate * 100,
            "commission": commission,
            "net_earnings": net_earnings,
            "start_date": start_date,
            "end_date": now
        }
    
    def get_therapist_rating_stats(self, therapist_id: int) -> Dict[str, Any]:
        """Obtenir les statistiques de notation d'un thérapeute"""
        avg_rating = self.db.query(func.avg(Review.rating)).filter(
            Review.therapist_id == therapist_id
        ).scalar() or 0
        
        total_reviews = self.db.query(func.count(Review.id)).filter(
            Review.therapist_id == therapist_id
        ).scalar() or 0
        
        distribution = {}
        for i in range(1, 6):
            count = self.db.query(func.count(Review.id)).filter(
                Review.therapist_id == therapist_id,
                Review.rating == i
            ).scalar() or 0
            distribution[i] = count
        
        return {
            "average_rating": float(avg_rating),
            "total_reviews": total_reviews,
            "distribution": distribution
        }
    
    def get_top_therapists(self, limit: int = 10) -> List[User]:
        """Obtenir les meilleurs thérapeutes"""
        return self.db.query(User).filter(
            User.role == "THERAPIST",
            User.verification_status == "approved",
            User.is_active == True,
            User.total_reviews > 0
        ).order_by(User.rating.desc()).limit(limit).all()
    
    def approve_therapist(self, therapist_id: int) -> Optional[User]:
        """Approuver un thérapeute"""
        therapist = self.get(therapist_id)
        if therapist:
            therapist.verification_status = "approved"
            therapist.is_active = True
            self.db.commit()
            self.db.refresh(therapist)
        return therapist
    
    def reject_therapist(self, therapist_id: int) -> Optional[User]:
        """Rejeter un thérapeute"""
        therapist = self.get(therapist_id)
        if therapist:
            therapist.verification_status = "rejected"
            self.db.commit()
            self.db.refresh(therapist)
        return therapist