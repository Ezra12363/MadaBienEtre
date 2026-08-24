from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from ..models.booking import Booking
from ..models.user import User
from .base import BaseRepository

class BookingRepository(BaseRepository[Booking]):
    """Repository pour les réservations"""
    
    def __init__(self, db: Session):
        super().__init__(Booking, db)
    
    def get_by_client(self, client_id: int, status: Optional[str] = None) -> List[Booking]:
        """Obtenir les réservations d'un client"""
        query = self.db.query(Booking).filter(Booking.client_id == client_id)
        if status:
            query = query.filter(Booking.status == status)
        return query.order_by(Booking.created_at.desc()).all()
    
    def get_by_therapist(self, therapist_id: int, status: Optional[str] = None) -> List[Booking]:
        """Obtenir les réservations d'un thérapeute"""
        query = self.db.query(Booking).filter(Booking.therapist_id == therapist_id)
        if status:
            query = query.filter(Booking.status == status)
        return query.order_by(Booking.created_at.desc()).all()
    
    def get_active_bookings(self, user_id: int) -> List[Booking]:
        """Obtenir les réservations actives d'un utilisateur"""
        return self.db.query(Booking).filter(
            (Booking.client_id == user_id) | (Booking.therapist_id == user_id),
            Booking.status.in_(['pending', 'confirmed', 'in_progress'])
        ).all()
    
    def get_bookings_by_date_range(
        self,
        start_date: datetime,
        end_date: datetime,
        therapist_id: Optional[int] = None
    ) -> List[Booking]:
        """Obtenir les réservations dans une plage de dates"""
        query = self.db.query(Booking).filter(
            Booking.scheduled_date.between(start_date, end_date),
            Booking.status.in_(['confirmed', 'in_progress', 'completed'])
        )
        if therapist_id:
            query = query.filter(Booking.therapist_id == therapist_id)
        return query.all()
    
    def get_booking_stats(self, therapist_id: int) -> Dict[str, Any]:
        """Obtenir les statistiques de réservations d'un thérapeute"""
        total = self.db.query(Booking).filter(Booking.therapist_id == therapist_id).count()
        completed = self.db.query(Booking).filter(
            Booking.therapist_id == therapist_id,
            Booking.status == "completed"
        ).count()
        cancelled = self.db.query(Booking).filter(
            Booking.therapist_id == therapist_id,
            Booking.status.in_(['cancelled_by_client', 'cancelled_by_therapist'])
        ).count()
        
        return {
            "total": total,
            "completed": completed,
            "cancelled": cancelled,
            "completion_rate": (completed / total * 100) if total > 0 else 0
        }
    
    def update_status(self, booking_id: int, status: str) -> Optional[Booking]:
        """Mettre à jour le statut d'une réservation"""
        booking = self.get(booking_id)
        if booking:
            booking.status = status
            if status == "completed":
                booking.actual_end_time = datetime.utcnow()
            elif status == "in_progress":
                booking.actual_start_time = datetime.utcnow()
            self.db.commit()
            self.db.refresh(booking)
        return booking
    
    def get_expired_bookings(self) -> List[Booking]:
        """Obtenir les réservations expirées"""
        now = datetime.utcnow()
        return self.db.query(Booking).filter(
            Booking.status == "pending",
            Booking.expires_at < now
        ).all()
    
    def get_nearby_bookings(self, latitude: float, longitude: float, radius_km: int = 5) -> List[Booking]:
        """Obtenir les réservations à proximité"""
        from sqlalchemy import func
        
        return self.db.query(Booking).filter(
            Booking.status.in_(['pending', 'negotiating']),
            Booking.expires_at > datetime.utcnow(),
            func.ST_DWithin(
                Booking.client_location,
                func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326),
                radius_km * 1000
            )
        ).all()