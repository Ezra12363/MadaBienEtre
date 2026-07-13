from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..core.database import get_db
from ..core.dependencies import get_current_user, get_current_admin, get_current_therapist
from ..models.user import User
from ..models.booking import Booking
from ..models.review import Review
from ..schemas.user import UserResponse
from ..services.upload_service import upload_image
from geoalchemy2 import functions as geo_func
from datetime import datetime

router = APIRouter(prefix="/api/therapists", tags=["Therapists"])

@router.post("/apply")
async def apply_as_therapist(
    bio: str = Form(...),
    experience_years: int = Form(...),
    base_price: float = Form(...),
    service_radius: int = Form(10),
    cin_file: UploadFile = File(...),
    certificate_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Candidature pour devenir thérapeute"""
    if current_user.role == "THERAPIST":
        raise HTTPException(status_code=400, detail="Already a therapist")
    
    # Upload des documents
    cin_url = upload_image(cin_file, "cin")
    cert_url = upload_image(certificate_file, "certificates")
    
    current_user.role = "THERAPIST"
    current_user.bio = bio
    current_user.experience_years = experience_years
    current_user.base_price = base_price
    current_user.service_radius = service_radius
    current_user.verification_status = "pending"
    current_user.identity_document_url = cin_url
    current_user.certificate_url = cert_url
    
    db.commit()
    
    return {
        "message": "Application submitted successfully",
        "verification_status": "pending"
    }

@router.get("/")
async def get_therapists(
    latitude: float = None,
    longitude: float = None,
    radius_km: int = 10,
    rating_min: float = 0,
    db: Session = Depends(get_db)
):
    """Liste des thérapeutes avec filtres et géolocalisation"""
    query = db.query(User).filter(
        User.role == "THERAPIST",
        User.verification_status == "approved",
        User.is_active == True,
        User.deleted_at.is_(None)
    )
    
    if latitude and longitude:
        # Filtrer par distance avec PostGIS
        query = query.filter(
            func.ST_DWithin(
                User.last_location,
                func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326),
                radius_km * 1000
            )
        )
    
    if rating_min > 0:
        query = query.filter(User.rating >= rating_min)
    
    therapists = query.all()
    
    result = []
    for therapist in therapists:
        # Calculer la distance
        distance = None
        if latitude and longitude:
            distance = db.query(
                func.ST_Distance(
                    User.last_location,
                    func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
                )
            ).filter(User.id == therapist.id).scalar()
        
        result.append({
            "id": therapist.id,
            "fullname": therapist.fullname,
            "profile_image": therapist.profile_image,
            "bio": therapist.bio,
            "experience_years": therapist.experience_years,
            "rating": float(therapist.rating) if therapist.rating else 0,
            "total_reviews": therapist.total_reviews,
            "base_price": float(therapist.base_price) if therapist.base_price else 0,
            "is_online": therapist.is_online,
            "is_available": therapist.is_available,
            "distance_meters": distance if distance else 0,
            "verification_status": therapist.verification_status
        })
    
    return sorted(result, key=lambda x: x["distance_meters"] if x["distance_meters"] else 0)

@router.get("/{therapist_id}")
async def get_therapist(
    therapist_id: int,
    db: Session = Depends(get_db)
):
    """Détails d'un thérapeute"""
    therapist = db.query(User).filter(
        User.id == therapist_id,
        User.role == "THERAPIST",
        User.deleted_at.is_(None)
    ).first()
    
    if not therapist:
        raise HTTPException(status_code=404, detail="Therapist not found")
    
    # Récupérer les avis
    reviews = db.query(Review).filter(Review.therapist_id == therapist_id).all()
    
    return {
        "id": therapist.id,
        "fullname": therapist.fullname,
        "profile_image": therapist.profile_image,
        "bio": therapist.bio,
        "experience_years": therapist.experience_years,
        "rating": float(therapist.rating) if therapist.rating else 0,
        "total_reviews": therapist.total_reviews,
        "base_price": float(therapist.base_price) if therapist.base_price else 0,
        "service_radius": therapist.service_radius,
        "is_online": therapist.is_online,
        "is_available": therapist.is_available,
        "verification_status": therapist.verification_status,
        "reviews": [{"rating": r.rating, "comment": r.comment, "created_at": r.created_at} for r in reviews[:5]]
    }

@router.put("/{therapist_id}")
async def update_therapist(
    therapist_id: int,
    bio: str = None,
    base_price: float = None,
    service_radius: int = None,
    is_available: bool = None,
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db)
):
    """Mettre à jour les informations du thérapeute"""
    if current_user.id != therapist_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if bio is not None:
        current_user.bio = bio
    if base_price is not None:
        current_user.base_price = base_price
    if service_radius is not None:
        current_user.service_radius = service_radius
    if is_available is not None:
        current_user.is_available = is_available
    
    db.commit()
    db.refresh(current_user)
    return {"message": "Therapist updated successfully"}

@router.post("/toggle-online")
async def toggle_online(
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db)
):
    """Basculer le mode en ligne/hors ligne"""
    current_user.is_online = not current_user.is_online
    db.commit()
    return {
        "message": f"Therapist is now {'online' if current_user.is_online else 'offline'}",
        "is_online": current_user.is_online
    }

@router.get("/status")
async def get_verification_status(
    current_user: User = Depends(get_current_therapist)
):
    """Obtenir le statut de vérification"""
    return {
        "verification_status": current_user.verification_status,
        "is_active": current_user.is_active
    }

@router.get("/earnings")
async def get_earnings(
    period: str = "month",  # day, week, month, year
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db)
):
    """Obtenir les gains du thérapeute"""
    from datetime import datetime, timedelta
    
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
    
    # Calculer les gains à partir des réservations complétées
    bookings = db.query(Booking).filter(
        Booking.therapist_id == current_user.id,
        Booking.status == "completed",
        Booking.actual_end_time >= start_date
    ).all()
    
    total_earnings = sum(float(b.final_price or 0) for b in bookings)
    commission = total_earnings * (float(current_user.commission_rate or 10) / 100)
    net_earnings = total_earnings - commission
    
    return {
        "period": period,
        "total_bookings": len(bookings),
        "total_earnings": total_earnings,
        "commission_rate": current_user.commission_rate,
        "commission_amount": commission,
        "net_earnings": net_earnings,
        "start_date": start_date,
        "end_date": now
    }