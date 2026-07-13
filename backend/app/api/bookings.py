from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from ..core.database import get_db
from ..core.dependencies import get_current_user, get_current_therapist
from ..models.user import User
from ..models.booking import Booking
from ..models.massage import MassageType
from ..models.negotiation import Negotiation
from ..schemas.booking import BookingCreate, BookingResponse, BookingUpdate
from ..services.notification_service import send_notification
from datetime import datetime, timedelta
import json

router = APIRouter(prefix="/api/bookings", tags=["Bookings"])

@router.post("/", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_data: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Créer une nouvelle réservation"""
    if current_user.role != "CLIENT":
        raise HTTPException(status_code=403, detail="Only clients can create bookings")
    
    # Vérifier le type de massage
    massage_type = db.query(MassageType).filter(MassageType.id == booking_data.massage_type_id).first()
    if not massage_type:
        raise HTTPException(status_code=404, detail="Massage type not found")
    
    # Vérifier le prix minimum
    if booking_data.client_price_proposed < float(massage_type.min_price):
        raise HTTPException(
            status_code=400, 
            detail=f"Price must be at least {massage_type.min_price} Ar"
        )
    
    # Vérifier la date
    if booking_data.scheduled_date < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Scheduled date must be in the future")
    
    # Créer la réservation
    new_booking = Booking(
        client_id=current_user.id,
        massage_type_id=booking_data.massage_type_id,
        client_price_proposed=booking_data.client_price_proposed,
        address=booking_data.address,
        client_latitude=booking_data.latitude,
        client_longitude=booking_data.longitude,
        client_location=f"POINT({booking_data.longitude} {booking_data.latitude})",
        scheduled_date=booking_data.scheduled_date,
        scheduled_duration_minutes=booking_data.duration_minutes,
        preferred_gender=booking_data.preferred_gender,
        special_instructions=booking_data.special_instructions,
        status="pending",
        expires_at=datetime.utcnow() + timedelta(minutes=30)
    )
    
    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)
    
    # Trouver les thérapeutes à proximité
    nearby_therapists = db.query(User).filter(
        User.role == "THERAPIST",
        User.is_online == True,
        User.is_available == True,
        User.verification_status == "approved",
        User.is_active == True,
        User.deleted_at.is_(None),
        func.ST_DWithin(
            User.last_location,
            func.ST_SetSRID(func.ST_MakePoint(booking_data.longitude, booking_data.latitude), 4326),
            User.service_radius * 1000
        )
    ).all()
    
    # Envoyer des notifications aux thérapeutes à proximité
    for therapist in nearby_therapists:
        send_notification(
            therapist.id,
            "Nouvelle demande de massage",
            f"{current_user.fullname} cherche un massage {massage_type.name} à {booking_data.client_price_proposed} Ar",
            "new_booking",
            {"booking_id": new_booking.id}
        )
    
    return new_booking

@router.get("/", response_model=list[BookingResponse])
async def get_bookings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: str = None,
    limit: int = 50
):
    """Liste des réservations de l'utilisateur"""
    query = db.query(Booking)
    
    if current_user.role == "CLIENT":
        query = query.filter(Booking.client_id == current_user.id)
    elif current_user.role == "THERAPIST":
        query = query.filter(Booking.therapist_id == current_user.id)
    elif current_user.role == "ADMIN":
        pass  # Admin voit tout
    
    if status:
        query = query.filter(Booking.status == status)
    
    return query.order_by(Booking.created_at.desc()).limit(limit).all()

@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtenir les détails d'une réservation"""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Vérifier les autorisations
    if current_user.role == "CLIENT" and booking.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if current_user.role == "THERAPIST" and booking.therapist_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return booking

@router.put("/{booking_id}", response_model=BookingResponse)
async def update_booking(
    booking_id: int,
    booking_data: BookingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mettre à jour une réservation"""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    for key, value in booking_data.dict(exclude_unset=True).items():
        setattr(booking, key, value)
    
    db.commit()
    db.refresh(booking)
    return booking

@router.put("/cancel/{booking_id}")
async def cancel_booking(
    booking_id: int,
    reason: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Annuler une réservation"""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if current_user.id == booking.client_id:
        booking.status = "cancelled_by_client"
    elif current_user.id == booking.therapist_id:
        booking.status = "cancelled_by_therapist"
    else:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    booking.cancellation_reason = reason or "User cancelled"
    db.commit()
    
    # Notifier l'autre partie
    recipient_id = booking.therapist_id if current_user.id == booking.client_id else booking.client_id
    if recipient_id:
        send_notification(
            recipient_id,
            "Réservation annulée",
            f"La réservation a été annulée par {current_user.fullname}",
            "booking_cancelled",
            {"booking_id": booking.id}
        )
    
    return {"message": "Booking cancelled"}

@router.put("/start/{booking_id}")
async def start_booking(
    booking_id: int,
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db)
):
    """Démarrer le massage (thérapeute)"""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.therapist_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your booking")
    
    booking.status = "in_progress"
    booking.actual_start_time = datetime.utcnow()
    db.commit()
    
    # Notifier le client
    send_notification(
        booking.client_id,
        "Massage en cours",
        f"{current_user.fullname} a commencé votre massage",
        "booking_started",
        {"booking_id": booking.id}
    )
    
    return {"message": "Booking started", "start_time": booking.actual_start_time}

@router.put("/complete/{booking_id}")
async def complete_booking(
    booking_id: int,
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db)
):
    """Terminer le massage (thérapeute)"""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.therapist_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your booking")
    
    booking.status = "completed"
    booking.actual_end_time = datetime.utcnow()
    db.commit()
    
    # Notifier le client pour avis
    send_notification(
        booking.client_id,
        "Massage terminé",
        f"Merci de noter votre séance avec {current_user.fullname}",
        "booking_completed",
        {"booking_id": booking.id}
    )
    
    # Mettre à jour les statistiques du thérapeute
    from ..services.rating_service import update_therapist_rating
    update_therapist_rating(current_user.id, db)
    
    return {"message": "Booking completed", "end_time": booking.actual_end_time}