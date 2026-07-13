from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from ..core.database import get_db
from ..core.dependencies import get_current_user, get_current_admin
from ..models.user import User
from ..models.booking import Booking
from ..models.payment import Payment
from ..models.review import Review
from ..models.sos import SOSAlert
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("/dashboard")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Dashboard Admin - Statistiques globales"""
    # Nombre d'utilisateurs
    total_users = db.query(User).filter(User.deleted_at.is_(None)).count()
    total_clients = db.query(User).filter(User.role == "CLIENT", User.deleted_at.is_(None)).count()
    total_therapists = db.query(User).filter(User.role == "THERAPIST", User.deleted_at.is_(None)).count()
    active_therapists = db.query(User).filter(
        User.role == "THERAPIST",
        User.is_online == True,
        User.is_active == True
    ).count()
    
    # Réservations
    total_bookings = db.query(Booking).count()
    completed_bookings = db.query(Booking).filter(Booking.status == "completed").count()
    pending_bookings = db.query(Booking).filter(Booking.status == "pending").count()
    cancelled_bookings = db.query(Booking).filter(
        Booking.status.in_(["cancelled_by_client", "cancelled_by_therapist"])
    ).count()
    
    # Revenus
    total_revenue = db.query(func.sum(Booking.final_price)).filter(
        Booking.status == "completed"
    ).scalar() or 0
    
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_revenue = db.query(func.sum(Booking.final_price)).filter(
        Booking.status == "completed",
        Booking.actual_end_time >= today
    ).scalar() or 0
    
    # Paiements
    total_payments = db.query(Payment).filter(Payment.status == "completed").count()
    total_payment_amount = db.query(func.sum(Payment.amount)).filter(
        Payment.status == "completed"
    ).scalar() or 0
    
    # Avis
    avg_rating = db.query(func.avg(Review.rating)).scalar() or 0
    
    # SOS
    active_sos = db.query(SOSAlert).filter(SOSAlert.status == "active").count()
    
    return {
        "users": {
            "total": total_users,
            "clients": total_clients,
            "therapists": total_therapists,
            "active_therapists": active_therapists
        },
        "bookings": {
            "total": total_bookings,
            "completed": completed_bookings,
            "pending": pending_bookings,
            "cancelled": cancelled_bookings
        },
        "revenue": {
            "total": float(total_revenue),
            "today": float(today_revenue)
        },
        "payments": {
            "total": total_payments,
            "amount": float(total_payment_amount)
        },
        "reviews": {
            "average_rating": float(avg_rating),
            "total": db.query(Review).count()
        },
        "sos": {
            "active": active_sos
        }
    }

@router.get("/revenue")
async def get_revenue_analytics(
    period: str = "month",  # day, week, month, year
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Analyse des revenus"""
    from datetime import datetime, timedelta
    
    now = datetime.utcnow()
    
    if period == "day":
        start_date = now - timedelta(days=1)
        group_by = func.date_trunc('hour', Booking.actual_end_time)
    elif period == "week":
        start_date = now - timedelta(days=7)
        group_by = func.date_trunc('day', Booking.actual_end_time)
    elif period == "month":
        start_date = now - timedelta(days=30)
        group_by = func.date_trunc('day', Booking.actual_end_time)
    elif period == "year":
        start_date = now - timedelta(days=365)
        group_by = func.date_trunc('month', Booking.actual_end_time)
    else:
        start_date = now - timedelta(days=30)
        group_by = func.date_trunc('day', Booking.actual_end_time)
    
    data = db.query(
        group_by.label('date'),
        func.count(Booking.id).label('bookings'),
        func.sum(Booking.final_price).label('revenue')
    ).filter(
        Booking.status == "completed",
        Booking.actual_end_time >= start_date
    ).group_by('date').order_by('date').all()
    
    return {
        "period": period,
        "data": [
            {
                "date": str(r[0]),
                "bookings": r[1],
                "revenue": float(r[2] or 0)
            }
            for r in data
        ]
    }

@router.get("/therapists")
async def get_therapist_analytics(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Analyse des thérapeutes"""
    therapists = db.query(User).filter(
        User.role == "THERAPIST",
        User.deleted_at.is_(None)
    ).all()
    
    result = []
    for t in therapists:
        bookings = db.query(Booking).filter(
            Booking.therapist_id == t.id,
            Booking.status == "completed"
        ).all()
        
        total_earnings = sum(float(b.final_price or 0) for b in bookings)
        total_bookings = len(bookings)
        
        result.append({
            "id": t.id,
            "name": t.fullname,
            "rating": float(t.rating) if t.rating else 0,
            "total_reviews": t.total_reviews,
            "total_bookings": total_bookings,
            "total_earnings": total_earnings,
            "is_online": t.is_online,
            "verification_status": t.verification_status
        })
    
    return sorted(result, key=lambda x: x["total_earnings"], reverse=True)

@router.get("/geo")
async def get_geo_analytics(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Analyse géographique des réservations"""
    # Les zones les plus actives
    bookings = db.query(Booking).filter(
        Booking.status == "completed",
        Booking.client_latitude.isnot(None),
        Booking.client_longitude.isnot(None)
    ).all()
    
    zones = {}
    for booking in bookings:
        # Arrondir les coordonnées pour créer des zones
        lat = round(float(booking.client_latitude), 2)
        lng = round(float(booking.client_longitude), 2)
        key = f"{lat},{lng}"
        
        if key not in zones:
            zones[key] = {
                "latitude": lat,
                "longitude": lng,
                "count": 0,
                "total_revenue": 0
            }
        zones[key]["count"] += 1
        zones[key]["total_revenue"] += float(booking.final_price or 0)
    
    return list(zones.values())