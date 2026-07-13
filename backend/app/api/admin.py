from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..core.database import get_db
from ..core.dependencies import get_current_admin
from ..models.user import User
from ..models.booking import Booking
from ..models.payment import Payment
from ..models.review import Review
from ..models.sos import SOSAlert
from ..schemas.user import UserResponse
from ..services.notification_service import send_notification
from datetime import datetime

router = APIRouter(prefix="/api/admin", tags=["Admin"])

@router.get("/pending-therapists")
async def get_pending_therapists(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Thérapeutes en attente de validation"""
    therapists = db.query(User).filter(
        User.role == "THERAPIST",
        User.verification_status == "pending",
        User.is_active == True
    ).all()
    
    return [
        {
            "id": t.id,
            "fullname": t.fullname,
            "email": t.email,
            "phone": t.phone,
            "bio": t.bio,
            "experience_years": t.experience_years,
            "base_price": float(t.base_price) if t.base_price else 0,
            "identity_document_url": t.identity_document_url,
            "certificate_url": t.certificate_url,
            "created_at": t.created_at
        }
        for t in therapists
    ]

@router.put("/approve-therapist/{therapist_id}")
async def approve_therapist(
    therapist_id: int,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Approuver un thérapeute"""
    therapist = db.query(User).filter(
        User.id == therapist_id,
        User.role == "THERAPIST"
    ).first()
    
    if not therapist:
        raise HTTPException(status_code=404, detail="Therapist not found")
    
    therapist.verification_status = "approved"
    therapist.is_active = True
    db.commit()
    
    # Notifier le thérapeute
    send_notification(
        therapist.id,
        "Compte approuvé",
        "Votre compte thérapeute a été approuvé. Vous pouvez maintenant recevoir des demandes.",
        "therapist_approved",
        {"therapist_id": therapist.id}
    )
    
    return {"message": "Therapist approved successfully"}

@router.put("/reject-therapist/{therapist_id}")
async def reject_therapist(
    therapist_id: int,
    reason: str = None,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Rejeter un thérapeute"""
    therapist = db.query(User).filter(
        User.id == therapist_id,
        User.role == "THERAPIST"
    ).first()
    
    if not therapist:
        raise HTTPException(status_code=404, detail="Therapist not found")
    
    therapist.verification_status = "rejected"
    db.commit()
    
    # Notifier le thérapeute
    send_notification(
        therapist.id,
        "Compte rejeté",
        f"Votre compte thérapeute a été rejeté. Raison: {reason or 'Non spécifiée'}",
        "therapist_rejected",
        {"therapist_id": therapist.id}
    )
    
    return {"message": "Therapist rejected"}

@router.put("/activate-user/{user_id}")
async def activate_user(
    user_id: int,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Activer un utilisateur"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = True
    db.commit()
    return {"message": "User activated"}

@router.put("/deactivate-user/{user_id}")
async def deactivate_user(
    user_id: int,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Désactiver un utilisateur"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = False
    db.commit()
    return {"message": "User deactivated"}

@router.get("/dashboard")
async def admin_dashboard(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Dashboard administrateur"""
    # Statistiques générales
    total_users = db.query(User).filter(User.deleted_at.is_(None)).count()
    total_therapists = db.query(User).filter(
        User.role == "THERAPIST",
        User.deleted_at.is_(None)
    ).count()
    pending_therapists = db.query(User).filter(
        User.role == "THERAPIST",
        User.verification_status == "pending"
    ).count()
    
    total_bookings = db.query(Booking).count()
    completed_bookings = db.query(Booking).filter(Booking.status == "completed").count()
    
    total_revenue = db.query(func.sum(Booking.final_price)).filter(
        Booking.status == "completed"
    ).scalar() or 0
    
    active_sos = db.query(SOSAlert).filter(SOSAlert.status == "active").count()
    
    return {
        "users": {
            "total": total_users,
            "therapists": total_therapists,
            "pending_therapists": pending_therapists
        },
        "bookings": {
            "total": total_bookings,
            "completed": completed_bookings,
            "completion_rate": round((completed_bookings / total_bookings * 100) if total_bookings > 0 else 0, 2)
        },
        "revenue": {
            "total": float(total_revenue)
        },
        "sos": {
            "active": active_sos
        },
        "recent_activity": {
            "recent_bookings": db.query(Booking).order_by(Booking.created_at.desc()).limit(5).all(),
            "recent_users": db.query(User).filter(User.deleted_at.is_(None)).order_by(User.created_at.desc()).limit(5).all()
        }
    }

@router.get("/statistics")
async def admin_statistics(
    period: str = "month",
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Statistiques détaillées"""
    from datetime import datetime, timedelta
    
    now = datetime.utcnow()
    
    if period == "day":
        start = now - timedelta(days=1)
    elif period == "week":
        start = now - timedelta(days=7)
    elif period == "month":
        start = now - timedelta(days=30)
    elif period == "year":
        start = now - timedelta(days=365)
    else:
        start = now - timedelta(days=30)
    
    # Nouveaux utilisateurs
    new_users = db.query(User).filter(
        User.created_at >= start,
        User.deleted_at.is_(None)
    ).count()
    
    # Nouvelles réservations
    new_bookings = db.query(Booking).filter(Booking.created_at >= start).count()
    
    # Revenus
    revenue = db.query(func.sum(Booking.final_price)).filter(
        Booking.status == "completed",
        Booking.actual_end_time >= start
    ).scalar() or 0
    
    # Avis
    reviews = db.query(Review).filter(Review.created_at >= start).count()
    avg_rating = db.query(func.avg(Review.rating)).filter(
        Review.created_at >= start
    ).scalar() or 0
    
    return {
        "period": period,
        "new_users": new_users,
        "new_bookings": new_bookings,
        "revenue": float(revenue),
        "reviews": reviews,
        "average_rating": float(avg_rating),
        "start_date": start,
        "end_date": now
    }

@router.get("/revenues")
async def admin_revenues(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Revenus détaillés"""
    # Revenus par méthode de paiement
    payment_methods = db.query(
        Payment.method,
        func.count(Payment.id).label('count'),
        func.sum(Payment.amount).label('total')
    ).filter(
        Payment.status == "completed"
    ).group_by(Payment.method).all()
    
    # Revenus par mois
    monthly_revenue = db.query(
        func.date_trunc('month', Booking.actual_end_time).label('month'),
        func.sum(Booking.final_price).label('revenue')
    ).filter(
        Booking.status == "completed"
    ).group_by('month').order_by('month.desc()).limit(12).all()')
    
    return {
        "by_payment_method": [
            {
                "method": r[0],
                "count": r[1],
                "total": float(r[2] or 0)
            }
            for r in payment_methods
        ],
        "monthly": [
            {
                "month": str(r[0]),
                "revenue": float(r[1] or 0)
            }
            for r in monthly_revenue
        ]
    }

@router.get("/users-count")
async def get_users_count(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Nombre d'utilisateurs"""
    return {
        "total": db.query(User).filter(User.deleted_at.is_(None)).count(),
        "clients": db.query(User).filter(User.role == "CLIENT", User.deleted_at.is_(None)).count(),
        "therapists": db.query(User).filter(User.role == "THERAPIST", User.deleted_at.is_(None)).count(),
        "admins": db.query(User).filter(User.role == "ADMIN", User.deleted_at.is_(None)).count()
    }

@router.get("/bookings-count")
async def get_bookings_count(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Nombre de réservations par statut"""
    statuses = ['pending', 'negotiating', 'confirmed', 'in_progress', 'completed', 'cancelled_by_client', 'cancelled_by_therapist', 'expired']
    
    result = {}
    for status in statuses:
        count = db.query(Booking).filter(Booking.status == status).count()
        result[status] = count
    
    return result