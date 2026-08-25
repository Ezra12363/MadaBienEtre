# app/api/bookings.py
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

# ✅ Prefix corrigé : plus de "/api", cohérent avec auth.router (routes à la racine)
router = APIRouter(prefix="/bookings", tags=["Bookings"])


def _maybe_expire(booking: Booking, db: Session) -> Booking:
    """
    ✅ Si une réservation "pending" ou "negotiating" a dépassé son
    expires_at sans avoir été confirmée, on la fait basculer
    automatiquement en statut "expired" au moment où elle est lue.
    Évite d'avoir des demandes fantômes bloquées en "pending" pour
    toujours et libère le thérapeute assigné le cas échéant.
    """
    if (
        booking.status in ("pending", "negotiating")
        and booking.expires_at
        and booking.expires_at < datetime.utcnow()
    ):
        booking.status = "expired"
        db.commit()
        db.refresh(booking)
    return booking


def _can_view_booking(booking: Booking, current_user: User) -> bool:
    """
    ✅ Règles de visibilité d'une demande :
    - Le client propriétaire peut toujours la voir.
    - Le thérapeute déjà assigné (booking.therapist_id) peut la voir.
    - Un thérapeute NON encore assigné peut voir une demande tant
      qu'elle est encore "pending" (non attribuée) — c'est
      indispensable pour qu'il puisse ouvrir la notification reçue
      et décider de faire une offre. Sans cette règle, tout
      thérapeute notifié d'une nouvelle demande recevait un 403.
    - Un admin peut tout voir.
    """
    if current_user.role == "ADMIN":
        return True
    if current_user.role == "CLIENT":
        return booking.client_id == current_user.id
    if current_user.role == "THERAPIST":
        if booking.therapist_id == current_user.id:
            return True
        if booking.therapist_id is None and booking.status == "pending":
            return True
        return False
    return False


@router.post("/", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_data: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Créer une nouvelle réservation"""
    if current_user.role != "CLIENT":
        raise HTTPException(status_code=403, detail="Only clients can create bookings")

    massage_type = db.query(MassageType).filter(MassageType.id == booking_data.massage_type_id).first()
    if not massage_type:
        raise HTTPException(status_code=404, detail="Massage type not found")

    if booking_data.client_price_proposed < float(massage_type.min_price):
        raise HTTPException(
            status_code=400,
            detail=f"Price must be at least {massage_type.min_price} Ar"
        )

    if booking_data.scheduled_date < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Scheduled date must be in the future")

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

    for therapist in nearby_therapists:
        send_notification(
            therapist.id,
            "Nouvelle demande de massage",
            f"{current_user.fullname} cherche un massage {massage_type.name} à {booking_data.client_price_proposed} Ar",
            "new_booking",
            {"booking_id": new_booking.id}
        )

    return new_booking


@router.get("/available", response_model=list[BookingResponse])
async def get_available_bookings(
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db),
    limit: int = 50
):
    """
    ✅ Demandes "pending" non encore attribuées, dans le rayon de
    service du thérapeute connecté.

    Sert de filet de sécurité pour retrouver les demandes reçues par
    notification (au cas où la notification push a été manquée), et
    permet au thérapeute de parcourir manuellement les demandes
    disponibles autour de lui, comme dans le flux InDrive-style.
    """
    now = datetime.utcnow()

    base_query = db.query(Booking).filter(
        Booking.status == "pending",
        Booking.therapist_id.is_(None),
        or_(Booking.expires_at.is_(None), Booking.expires_at >= now),
    )

    # ✅ Filtre géographique (best-effort, cohérent avec le pattern
    # déjà utilisé dans create_booking / therapists.py). Si les
    # coordonnées du thérapeute manquent ou si le filtre spatial
    # échoue, on retombe simplement sur la liste non filtrée plutôt
    # que de faire planter l'endpoint.
    if current_user.latitude is not None and current_user.longitude is not None:
        try:
            base_query = base_query.filter(
                func.ST_DWithin(
                    Booking.client_location,
                    func.ST_SetSRID(
                        func.ST_MakePoint(current_user.longitude, current_user.latitude), 4326
                    ),
                    (current_user.service_radius or 10) * 1000
                )
            )
        except Exception:
            pass

    bookings = base_query.order_by(Booking.created_at.desc()).limit(limit).all()
    return bookings


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
        pass

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

    booking = _maybe_expire(booking, db)

    if not _can_view_booking(booking, current_user):
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

    if booking.status != "confirmed":
        raise HTTPException(
            status_code=400,
            detail=f"La réservation doit être 'confirmed' pour démarrer (statut actuel: {booking.status})"
        )

    booking.status = "in_progress"
    booking.actual_start_time = datetime.utcnow()
    db.commit()

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

    if booking.status != "in_progress":
        raise HTTPException(
            status_code=400,
            detail=f"La réservation doit être 'in_progress' pour être terminée (statut actuel: {booking.status})"
        )

    booking.status = "completed"
    booking.actual_end_time = datetime.utcnow()
    db.commit()

    send_notification(
        booking.client_id,
        "Massage terminé",
        f"Merci de noter votre séance avec {current_user.fullname}",
        "booking_completed",
        {"booking_id": booking.id}
    )

    from ..services.rating_service import update_therapist_rating
    update_therapist_rating(current_user.id, db)

    return {"message": "Booking completed", "end_time": booking.actual_end_time}