from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.booking import Booking
from ..models.negotiation import Negotiation
from ..models.user import User
from ..schemas.negotiation import NegotiationCreate, NegotiationResponse
from ..services.notification_service import send_notification
from datetime import datetime, timedelta

router = APIRouter(prefix="/offers", tags=["Offers"])


def _is_booking_expired(booking: Booking) -> bool:
    return bool(booking.expires_at and booking.expires_at < datetime.utcnow())


def _is_party_to_booking(booking: Booking, current_user: User, db: Session) -> bool:
    """
    ✅ Un utilisateur est "concerné" par une réservation si :
    - il en est le client,
    - il en est le thérapeute assigné,
    - OU (cas clé) c'est un thérapeute qui a déjà fait au moins une
      offre dessus, même si elle n'est pas (encore) le thérapeute
      assigné (ex: sa première offre a été refusée / une autre offre
      a expiré entre temps).
    Le simple fait d'être notifié d'une demande "pending" non
    assignée ne rend PAS automatiquement "partie" à la réservation
    tant qu'aucune offre n'a été faite — voir create_offer pour
    l'autorisation de faire une première offre.
    """
    if current_user.id in (booking.client_id, booking.therapist_id):
        return True
    if current_user.role == "THERAPIST":
        has_offer = db.query(Negotiation).filter(
            Negotiation.booking_id == booking.id,
            Negotiation.user_id == current_user.id
        ).first()
        if has_offer:
            return True
    return False


@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_offer(
    offer_data: NegotiationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Créer une offre ou une contre-offre"""
    booking = db.query(Booking).filter(Booking.id == offer_data.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # ✅ CORRECTIF : un thérapeute doit pouvoir répondre à une demande
    # qui n'a pas encore de thérapeute assigné (booking.therapist_id
    # is None). L'ancienne condition rejetait systématiquement ce cas
    # avec un 403, ce qui empêchait tout thérapeute notifié de faire
    # une offre sur une nouvelle demande — cassant le flux principal
    # client → thérapeute.
    is_unassigned_and_therapist = (
        current_user.role == "THERAPIST" and booking.therapist_id is None
    )
    if (
        current_user.id != booking.client_id
        and current_user.id != booking.therapist_id
        and not is_unassigned_and_therapist
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    if booking.status in ("cancelled_by_client", "cancelled_by_therapist", "completed", "expired"):
        raise HTTPException(
            status_code=400,
            detail=f"Impossible de faire une offre sur une demande au statut '{booking.status}'"
        )

    if _is_booking_expired(booking):
        booking.status = "expired"
        db.commit()
        raise HTTPException(status_code=410, detail="Cette demande a expiré")

    user_type = "client" if current_user.id == booking.client_id else "therapist"

    # Si c'est le client qui fait une offre et qu'aucun thérapeute n'est assigné
    if user_type == "client" and not booking.therapist_id:
        booking.status = "pending"
        db.commit()
    elif user_type == "therapist" and not booking.therapist_id:
        # ✅ Attribution atomique : on utilise un UPDATE conditionné
        # par "therapist_id IS NULL" pour empêcher deux thérapeutes
        # de "gagner" la même demande en cas de requêtes simultanées
        # (race condition). Si 0 ligne est mise à jour, un autre
        # thérapeute a déjà pris la demande entre temps.
        claimed_rows = (
            db.query(Booking)
            .filter(Booking.id == booking.id, Booking.therapist_id.is_(None))
            .update(
                {"therapist_id": current_user.id, "status": "negotiating"},
                synchronize_session=False,
            )
        )
        db.commit()
        db.refresh(booking)

        if claimed_rows == 0:
            raise HTTPException(
                status_code=409,
                detail="Cette demande a déjà été prise en charge par un autre thérapeute"
            )

    # Créer l'offre
    offer = Negotiation(
        booking_id=offer_data.booking_id,
        user_id=current_user.id,
        user_type=user_type,
        price_offered=offer_data.price_offered,
        message=offer_data.message,
        status="sent",
        expires_at=datetime.utcnow() + timedelta(minutes=15)
    )

    db.add(offer)
    db.commit()
    db.refresh(offer)

    # Mettre à jour le prix proposé par le thérapeute dans la réservation
    if user_type == "therapist":
        booking.therapist_initial_price = offer_data.price_offered
        db.commit()

    # Notifier l'autre partie
    recipient_id = booking.client_id if user_type == "therapist" else booking.therapist_id
    if recipient_id:
        send_notification(
            recipient_id,
            "Nouvelle offre de prix",
            f"{current_user.fullname} propose {offer_data.price_offered} Ar",
            "new_offer",
            {"booking_id": booking.id, "offer_id": offer.id}
        )

    return offer


@router.get("/booking/{booking_id}", response_model=list[NegotiationResponse])
async def get_offers_by_booking(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtenir toutes les offres pour une réservation"""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if not _is_party_to_booking(booking, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized")

    offers = db.query(Negotiation).filter(
        Negotiation.booking_id == booking_id
    ).order_by(Negotiation.created_at.desc()).all()

    return offers


@router.post("/{offer_id}/accept")
async def accept_offer(
    offer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accepter une offre"""
    offer = db.query(Negotiation).filter(Negotiation.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    booking = db.query(Booking).filter(Booking.id == offer.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Vérifier que l'utilisateur est le destinataire de l'offre
    if current_user.id not in (booking.client_id, booking.therapist_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    if current_user.id == offer.user_id:
        raise HTTPException(status_code=400, detail="You cannot accept your own offer")

    if offer.status != "sent":
        raise HTTPException(status_code=400, detail=f"Cette offre n'est plus active (statut: {offer.status})")

    if offer.expires_at and offer.expires_at < datetime.utcnow():
        offer.status = "expired"
        db.commit()
        raise HTTPException(status_code=410, detail="Cette offre a expiré")

    # Mettre à jour l'offre
    offer.status = "accepted"
    booking.final_price = offer.price_offered
    booking.status = "confirmed"
    db.commit()

    # Notifier l'offrant
    send_notification(
        offer.user_id,
        "Offre acceptée",
        f"Votre offre de {offer.price_offered} Ar a été acceptée",
        "offer_accepted",
        {"booking_id": booking.id, "final_price": float(offer.price_offered)}
    )

    return {
        "message": "Offer accepted",
        "final_price": float(offer.price_offered),
        "booking_id": booking.id
    }


@router.post("/{offer_id}/reject")
async def reject_offer(
    offer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Rejeter une offre"""
    offer = db.query(Negotiation).filter(Negotiation.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    booking = db.query(Booking).filter(Booking.id == offer.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if current_user.id not in (booking.client_id, booking.therapist_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    if current_user.id == offer.user_id:
        raise HTTPException(status_code=400, detail="You cannot reject your own offer")

    offer.status = "rejected"
    db.commit()

    return {"message": "Offer rejected"}


@router.post("/{offer_id}/counter")
async def counter_offer(
    offer_id: int,
    counter_price: float,
    message: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Faire une contre-offre"""
    original_offer = db.query(Negotiation).filter(Negotiation.id == offer_id).first()
    if not original_offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    booking = db.query(Booking).filter(Booking.id == original_offer.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if current_user.id not in (booking.client_id, booking.therapist_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    if current_user.id == original_offer.user_id:
        raise HTTPException(status_code=400, detail="You cannot counter your own offer")

    if _is_booking_expired(booking):
        booking.status = "expired"
        db.commit()
        raise HTTPException(status_code=410, detail="Cette demande a expiré")

    # Créer une nouvelle contre-offre
    new_offer = Negotiation(
        booking_id=booking.id,
        user_id=current_user.id,
        user_type="client" if current_user.id == booking.client_id else "therapist",
        price_offered=counter_price,
        message=message or f"Contre-offre à {counter_price} Ar",
        status="sent",
        expires_at=datetime.utcnow() + timedelta(minutes=15)
    )

    db.add(new_offer)
    db.commit()
    db.refresh(new_offer)

    # Mettre à jour le statut de la réservation
    booking.status = "negotiating"
    db.commit()

    # Notifier l'autre partie
    send_notification(
        original_offer.user_id,
        "Contre-offre reçue",
        f"{current_user.fullname} propose {counter_price} Ar",
        "counter_offer",
        {"booking_id": booking.id, "offer_id": new_offer.id}
    )

    return new_offer