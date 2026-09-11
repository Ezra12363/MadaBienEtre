# ============================================================
# app/api/offers.py
# MADA BIEN-ÊTRE
#
# Gestion complète des offres / négociations
#
# Routes :
# POST /offers/create
# GET  /offers/booking/{booking_id}
# POST /offers/{offer_id}/accept
# POST /offers/{offer_id}/reject
# POST /offers/{offer_id}/counter
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
import logging

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.booking import Booking
from ..models.negotiation import Negotiation
from ..models.user import User
from ..services.notification_service import send_notification


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/offers",
    tags=["Offers"],
)


# ============================================================
# SCHEMAS
# ============================================================

class NegotiationCreate(BaseModel):
    booking_id: int = Field(..., gt=0)
    price_offered: float = Field(..., gt=0)
    message: Optional[str] = Field(
        None,
        max_length=500
    )


class CounterOfferRequest(BaseModel):
    counter_price: float = Field(..., gt=0)
    message: Optional[str] = Field(
        None,
        max_length=500
    )


class NegotiationResponse(BaseModel):
    id: int
    booking_id: int
    user_id: int
    user_type: str
    price_offered: float
    message: Optional[str] = None
    status: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    user_name: Optional[str] = None


# ============================================================
# CONSTANTES
# ============================================================

# Une offre reste active pendant 24 heures.
NEGOTIATION_OFFER_TTL = timedelta(days=1)


# ============================================================
# HELPERS
# ============================================================

def _role(user: User) -> str:
    """
    Normalise le rôle utilisateur.

    Accepte par exemple :
    THERAPIST
    therapist
    Therapist
    """
    return str(
        getattr(user, "role", "") or ""
    ).strip().upper()


def _user_id(user: User) -> Optional[int]:
    try:
        return int(user.id)
    except Exception:
        return None


def _is_therapist(user: User) -> bool:
    return _role(user) == "THERAPIST"


def _is_client(user: User) -> bool:
    return _role(user) == "CLIENT"


def _is_admin(user: User) -> bool:
    return _role(user) == "ADMIN"


# ============================================================
# EXPIRATION BOOKING
# ============================================================

def _expire_booking(
    booking: Booking,
    db: Session
) -> bool:

    if (
        booking.status in (
            "pending",
            "negotiating",
        )
        and booking.expires_at
        and booking.expires_at < datetime.utcnow()
    ):

        booking.status = "expired"

        db.query(Negotiation).filter(
            Negotiation.booking_id == booking.id,
            Negotiation.status == "sent",
        ).update(
            {
                "status": "expired"
            },
            synchronize_session=False,
        )

        db.commit()
        db.refresh(booking)

        return True

    return False


# ============================================================
# SERIALIZATION
# ============================================================

def _serialize(
    offer: Negotiation
):

    return {
        "id": offer.id,
        "booking_id": offer.booking_id,
        "user_id": offer.user_id,
        "user_type": offer.user_type,
        "price_offered": float(
            offer.price_offered
        ),
        "message": offer.message,
        "status": offer.status,
        "created_at": offer.created_at,
        "expires_at": offer.expires_at,
        "user_name": (
            offer.user.fullname
            if getattr(offer, "user", None)
            else None
        ),
    }


# ============================================================
# CHECK THERAPIST PARTICIPATION
# ============================================================

def _therapist_has_participated(
    booking_id: int,
    therapist_id: int,
    db: Session,
) -> bool:

    if not therapist_id:
        return False

    offer = (
        db.query(Negotiation)
        .filter(
            Negotiation.booking_id == booking_id,
            Negotiation.user_id == therapist_id,
            Negotiation.user_type == "therapist",
        )
        .order_by(
            Negotiation.created_at.desc()
        )
        .first()
    )

    return offer is not None


# ============================================================
# GET THERAPIST OFFER
# ============================================================

def _get_therapist_offer(
    booking_id: int,
    therapist_id: int,
    db: Session,
):

    return (
        db.query(Negotiation)
        .filter(
            Negotiation.booking_id == booking_id,
            Negotiation.user_id == therapist_id,
            Negotiation.user_type == "therapist",
        )
        .order_by(
            Negotiation.created_at.desc()
        )
        .first()
    )


# ============================================================
# AUTHORIZATION BOOKING
# ============================================================

def _is_party(
    booking: Booking,
    user: User,
    db: Session,
) -> bool:

    uid = _user_id(user)
    role = _role(user)

    # --------------------------------------------------------
    # ADMIN
    # --------------------------------------------------------

    if role == "ADMIN":
        return True

    # --------------------------------------------------------
    # CLIENT PROPRIETAIRE
    # --------------------------------------------------------

    if uid == booking.client_id:
        return True

    # --------------------------------------------------------
    # THERAPIST ASSIGNÉ
    # --------------------------------------------------------

    if (
        booking.therapist_id is not None
        and uid == booking.therapist_id
    ):
        return True

    # --------------------------------------------------------
    # THERAPIST AYANT PARTICIPÉ À LA NÉGOCIATION
    #
    # IMPORTANT :
    # Même si booking.therapist_id est NULL,
    # un thérapeute ayant déjà envoyé une offre est autorisé.
    # --------------------------------------------------------

    if role == "THERAPIST":

        participated = _therapist_has_participated(
            booking.id,
            uid,
            db,
        )

        if participated:
            return True

        # ----------------------------------------------------
        # FIX 403 "Not authorized"
        #
        # Demande encore OUVERTE (aucun thérapeute assigné,
        # statut pending/negotiating) : NIMBOAHO ny thérapeute
        # rehetra tsy mbola nanao offre mba hahazo:
        #   - mijery ny offre client (GET /offers/booking/{id})
        #   - ary manaiky (accept) na mandà (reject) mivantana
        #     ilay demande, na dia tsy mbola nanao contre-offre
        #     ny thérapeute aza.
        #
        # Tsy manohitra ny sécurité ity satria mitovy amin'ny
        # can_view_booking() ao amin's bookings.py, izay efa
        # manome zo ny thérapeute rehetra hijery demande
        # mbola pending/negotiating sy therapist_id IS NULL.
        # ----------------------------------------------------

        if (
            booking.therapist_id is None
            and str(booking.status or "").strip().lower()
            in ("pending", "negotiating")
        ):
            return True

    return False


# ============================================================
# CREATE OFFER
# ============================================================

@router.post(
    "/create",
    response_model=NegotiationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_offer(
    data: NegotiationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    booking = (
        db.query(Booking)
        .filter(
            Booking.id == data.booking_id
        )
        .first()
    )

    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found",
        )

    # --------------------------------------------------------
    # EXPIRATION
    # --------------------------------------------------------

    if _expire_booking(
        booking,
        db,
    ):
        raise HTTPException(
            status_code=410,
            detail="Cette demande a expiré",
        )

    # --------------------------------------------------------
    # STATUTS INTERDITS
    # --------------------------------------------------------

    if booking.status in (
        "completed",
        "expired",
        "cancelled_by_client",
        "cancelled_by_therapist",
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Impossible de faire une offre "
                f"sur le statut '{booking.status}'"
            ),
        )

    uid = _user_id(current_user)
    role = _role(current_user)

    # --------------------------------------------------------
    # THERAPIST
    # --------------------------------------------------------

    if role == "THERAPIST":

        if not getattr(
            current_user,
            "is_active",
            True,
        ):
            raise HTTPException(
                status_code=403,
                detail="Therapist account inactive",
            )

        verification = str(
            getattr(
                current_user,
                "verification_status",
                ""
            ) or ""
        ).strip().lower()

        if verification != "approved":
            raise HTTPException(
                status_code=403,
                detail=(
                    "Votre compte thérapeute "
                    "n'est pas encore approuvé"
                ),
            )

        # Si déjà attribuée à un autre thérapeute,
        # interdiction.
        if (
            booking.therapist_id is not None
            and booking.therapist_id != uid
        ):
            raise HTTPException(
                status_code=403,
                detail=(
                    "Cette réservation est déjà "
                    "attribuée à un autre thérapeute."
                ),
            )

        user_type = "therapist"

    # --------------------------------------------------------
    # CLIENT
    # --------------------------------------------------------

    elif role == "CLIENT":

        if uid != booking.client_id:
            raise HTTPException(
                status_code=403,
                detail="Not authorized",
            )

        if not booking.therapist_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Le client doit d'abord "
                    "recevoir une offre d'un thérapeute."
                ),
            )

        user_type = "client"

    else:

        raise HTTPException(
            status_code=403,
            detail=(
                "Seuls les clients et thérapeutes "
                "peuvent faire des offres."
            ),
        )

    # --------------------------------------------------------
    # UNE OFFRE ACTIVE PAR UTILISATEUR
    # --------------------------------------------------------

    active_offer = (
        db.query(Negotiation)
        .filter(
            Negotiation.booking_id == booking.id,
            Negotiation.user_id == uid,
            Negotiation.status == "sent",
        )
        .first()
    )

    if active_offer:

        raise HTTPException(
            status_code=409,
            detail=(
                "Vous avez déjà une offre active "
                "sur cette réservation."
            ),
        )

    # --------------------------------------------------------
    # CREATION
    # --------------------------------------------------------

    offer = Negotiation(
        booking_id=booking.id,
        user_id=uid,
        user_type=user_type,
        price_offered=data.price_offered,
        message=data.message,
        status="sent",
        expires_at=(
            datetime.utcnow()
            + NEGOTIATION_OFFER_TTL
        ),
    )

    db.add(offer)

    # --------------------------------------------------------
    # IMPORTANT :
    # Quand un thérapeute fait sa première offre sur une
    # réservation non attribuée, on attribue la réservation
    # à ce thérapeute.
    #
    # Cela garantit ensuite que le client et le thérapeute
    # négocient ensemble.
    # --------------------------------------------------------

    if (
        user_type == "therapist"
        and booking.therapist_id is None
    ):

        booking.therapist_id = uid

    if booking.status == "pending":
        booking.status = "negotiating"

    # Prix initial thérapeute
    if user_type == "therapist":
        booking.therapist_initial_price = (
            data.price_offered
        )

    db.commit()

    db.refresh(offer)
    db.refresh(booking)

    # --------------------------------------------------------
    # NOTIFICATION
    # --------------------------------------------------------

    recipient_id = None

    if user_type == "therapist":
        recipient_id = booking.client_id
    else:
        recipient_id = booking.therapist_id

    if recipient_id:

        try:

            send_notification(
                recipient_id,
                "Nouvelle offre de prix",
                (
                    f"{current_user.fullname} propose "
                    f"{float(data.price_offered):,.0f} Ar"
                ),
                "new_offer",
                {
                    "booking_id": booking.id,
                    "offer_id": offer.id,
                },
            )

        except Exception:
            logger.exception(
                "Offer notification failed"
            )

    return _serialize(offer)


# ============================================================
# GET OFFERS BY BOOKING
# ============================================================

@router.get(
    "/booking/{booking_id}",
    response_model=List[NegotiationResponse],
)
async def get_offers_by_booking(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    booking = (
        db.query(Booking)
        .filter(
            Booking.id == booking_id
        )
        .first()
    )

    if not booking:

        raise HTTPException(
            status_code=404,
            detail="Booking not found",
        )

    # --------------------------------------------------------
    # AUTHORIZATION CORRIGEE
    # --------------------------------------------------------

    if not _is_party(
        booking,
        current_user,
        db,
    ):

        logger.warning(
            "GET OFFERS unauthorized: "
            "user_id=%s role=%s booking_id=%s "
            "client_id=%s therapist_id=%s",
            getattr(current_user, "id", None),
            _role(current_user),
            booking.id,
            booking.client_id,
            booking.therapist_id,
        )

        raise HTTPException(
            status_code=403,
            detail="Not authorized",
        )

    # --------------------------------------------------------
    # EXPIRATION DES OFFRES
    # --------------------------------------------------------

    now = datetime.utcnow()

    db.query(Negotiation).filter(
        Negotiation.booking_id == booking.id,
        Negotiation.status == "sent",
        Negotiation.expires_at.isnot(None),
        Negotiation.expires_at < now,
    ).update(
        {
            "status": "expired"
        },
        synchronize_session=False,
    )

    db.commit()

    # --------------------------------------------------------
    # RESULTAT
    # --------------------------------------------------------

    offers = (
        db.query(Negotiation)
        .filter(
            Negotiation.booking_id == booking_id
        )
        .order_by(
            Negotiation.created_at.desc()
        )
        .all()
    )

    return [
        _serialize(offer)
        for offer in offers
    ]


# ============================================================
# ACCEPT OFFER
# ============================================================

@router.post(
    "/{offer_id}/accept"
)
async def accept_offer(
    offer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    # --------------------------------------------------------
    # RECUPERATION OFFRE
    # --------------------------------------------------------

    offer = (
        db.query(Negotiation)
        .filter(
            Negotiation.id == offer_id
        )
        .first()
    )

    if not offer:

        raise HTTPException(
            status_code=404,
            detail="Offer not found",
        )

    # --------------------------------------------------------
    # RECUPERATION BOOKING
    # --------------------------------------------------------

    booking = (
        db.query(Booking)
        .filter(
            Booking.id == offer.booking_id
        )
        .first()
    )

    if not booking:

        raise HTTPException(
            status_code=404,
            detail="Booking not found",
        )

    uid = _user_id(current_user)
    role = _role(current_user)

    logger.info(
        "ACCEPT OFFER: offer_id=%s "
        "booking_id=%s user_id=%s role=%s "
        "offer_user_id=%s offer_user_type=%s "
        "booking_therapist_id=%s",
        offer.id,
        booking.id,
        uid,
        role,
        offer.user_id,
        offer.user_type,
        booking.therapist_id,
    )

    # --------------------------------------------------------
    # EXPIRATION BOOKING
    # --------------------------------------------------------

    if _expire_booking(
        booking,
        db,
    ):

        raise HTTPException(
            status_code=410,
            detail="Cette demande a expiré",
        )

    # --------------------------------------------------------
    # OFFRE ACTIVE
    # --------------------------------------------------------

    if offer.status != "sent":

        raise HTTPException(
            status_code=400,
            detail=(
                "Cette offre n'est plus active "
                f"(statut: {offer.status})"
            ),
        )

    if (
        offer.expires_at
        and offer.expires_at < datetime.utcnow()
    ):

        offer.status = "expired"

        db.commit()

        raise HTTPException(
            status_code=410,
            detail="Cette offre a expiré",
        )

    # --------------------------------------------------------
    # NE PAS ACCEPTER SA PROPRE OFFRE
    # --------------------------------------------------------

    if uid == offer.user_id:

        raise HTTPException(
            status_code=400,
            detail=(
                "Vous ne pouvez pas accepter "
                "votre propre offre."
            ),
        )

    # ========================================================
    # OFFRE DU THERAPEUTE
    #
    # Client -> Accept
    # ========================================================

    if offer.user_type == "therapist":

        if role != "CLIENT":

            raise HTTPException(
                status_code=403,
                detail=(
                    "Seul le client peut accepter "
                    "l'offre du thérapeute."
                ),
            )

        if uid != booking.client_id:

            raise HTTPException(
                status_code=403,
                detail=(
                    "Vous n'êtes pas le client "
                    "de cette réservation."
                ),
            )

        # Le thérapeute de l'offre devient le thérapeute
        # officiel de la réservation.
        booking.therapist_id = offer.user_id

    # ========================================================
    # OFFRE DU CLIENT
    #
    # Thérapeute -> Accept
    # ========================================================

    elif offer.user_type == "client":

        if role != "THERAPIST":

            raise HTTPException(
                status_code=403,
                detail=(
                    "Seul un thérapeute peut "
                    "accepter l'offre du client."
                ),
            )

        # ----------------------------------------------------
        # VERIFICATION COMPTE THERAPEUTE
        # ----------------------------------------------------

        if not getattr(
            current_user,
            "is_active",
            True,
        ):

            raise HTTPException(
                status_code=403,
                detail=(
                    "Votre compte thérapeute "
                    "est inactif."
                ),
            )

        verification = str(
            getattr(
                current_user,
                "verification_status",
                ""
            ) or ""
        ).strip().lower()

        if verification != "approved":

            raise HTTPException(
                status_code=403,
                detail=(
                    "Votre compte thérapeute "
                    "n'est pas encore approuvé."
                ),
            )

        # ----------------------------------------------------
        # CAS 1 :
        # thérapeute déjà assigné
        # ----------------------------------------------------

        if booking.therapist_id is not None:

            if (
                booking.therapist_id
                != uid
            ):

                raise HTTPException(
                    status_code=403,
                    detail=(
                        "Seul le thérapeute concerné "
                        "peut accepter cette offre."
                    ),
                )

        # ----------------------------------------------------
        # CAS 2 :
        # booking.therapist_id NULL
        #
        # On vérifie que ce thérapeute a déjà participé
        # à la négociation.
        # ----------------------------------------------------

        else:

            participated = (
                _therapist_has_participated(
                    booking.id,
                    uid,
                    db,
                )
            )

            if not participated:

                raise HTTPException(
                    status_code=403,
                    detail=(
                        "Vous n'êtes pas le thérapeute "
                        "concerné par cette négociation."
                    ),
                )

            # Attribution automatique sécurisée
            booking.therapist_id = uid

    # ========================================================
    # TYPE D'OFFRE INCONNU
    # ========================================================

    else:

        raise HTTPException(
            status_code=400,
            detail=(
                "Type d'offre invalide."
            ),
        )

    # ========================================================
    # ACCEPTATION
    # ========================================================

    offer.status = "accepted"

    booking.final_price = offer.price_offered
    booking.status = "confirmed"

    # ========================================================
    # REJETER LES AUTRES OFFRES ACTIVE
    # ========================================================

    db.query(Negotiation).filter(
        Negotiation.booking_id == booking.id,
        Negotiation.id != offer.id,
        Negotiation.status == "sent",
    ).update(
        {
            "status": "rejected"
        },
        synchronize_session=False,
    )

    db.commit()

    db.refresh(booking)
    db.refresh(offer)

    # ========================================================
    # NOTIFICATION
    # ========================================================

    try:

        send_notification(
            offer.user_id,
            "Offre acceptée",
            (
                f"Votre offre de "
                f"{float(offer.price_offered):,.0f} Ar "
                "a été acceptée."
            ),
            "offer_accepted",
            {
                "booking_id": booking.id,
                "offer_id": offer.id,
                "final_price": float(
                    offer.price_offered
                ),
            },
        )

    except Exception:

        logger.exception(
            "Accept notification failed"
        )

    # ========================================================
    # RESPONSE
    # ========================================================

    return {
        "message": "Offer accepted",
        "offer_id": offer.id,
        "booking_id": booking.id,
        "therapist_id": booking.therapist_id,
        "final_price": float(
            offer.price_offered
        ),
        "status": booking.status,
    }


# ============================================================
# REJECT OFFER
# ============================================================

@router.post(
    "/{offer_id}/reject"
)
async def reject_offer(
    offer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    offer = (
        db.query(Negotiation)
        .filter(
            Negotiation.id == offer_id
        )
        .first()
    )

    if not offer:

        raise HTTPException(
            status_code=404,
            detail="Offer not found",
        )

    booking = (
        db.query(Booking)
        .filter(
            Booking.id == offer.booking_id
        )
        .first()
    )

    if not booking:

        raise HTTPException(
            status_code=404,
            detail="Booking not found",
        )

    # Authorization
    if not _is_party(
        booking,
        current_user,
        db,
    ):

        raise HTTPException(
            status_code=403,
            detail="Not authorized",
        )

    if (
        _user_id(current_user)
        == offer.user_id
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Vous ne pouvez pas "
                "rejeter votre propre offre."
            ),
        )

    if offer.status != "sent":

        raise HTTPException(
            status_code=400,
            detail=(
                "Cette offre n'est plus active "
                f"(statut: {offer.status})"
            ),
        )

    if (
        offer.expires_at
        and offer.expires_at < datetime.utcnow()
    ):

        offer.status = "expired"

        db.commit()

        raise HTTPException(
            status_code=410,
            detail="Cette offre a expiré",
        )

    offer.status = "rejected"

    db.commit()
    db.refresh(offer)

    try:

        send_notification(
            offer.user_id,
            "Offre refusée",
            "Votre offre a été refusée.",
            "offer_rejected",
            {
                "booking_id": booking.id,
                "offer_id": offer.id,
            },
        )

    except Exception:

        logger.exception(
            "Reject notification failed"
        )

    return {
        "message": "Offer rejected",
        "offer_id": offer.id,
        "booking_id": booking.id,
        "status": offer.status,
    }


# ============================================================
# COUNTER OFFER
# ============================================================

@router.post(
    "/{offer_id}/counter"
)
async def counter_offer(
    offer_id: int,
    data: CounterOfferRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    original = (
        db.query(Negotiation)
        .filter(
            Negotiation.id == offer_id
        )
        .first()
    )

    if not original:

        raise HTTPException(
            status_code=404,
            detail="Offer not found",
        )

    booking = (
        db.query(Booking)
        .filter(
            Booking.id == original.booking_id
        )
        .first()
    )

    if not booking:

        raise HTTPException(
            status_code=404,
            detail="Booking not found",
        )

    # --------------------------------------------------------
    # AUTHORIZATION
    # --------------------------------------------------------

    if not _is_party(
        booking,
        current_user,
        db,
    ):

        raise HTTPException(
            status_code=403,
            detail="Not authorized",
        )

    uid = _user_id(current_user)

    # --------------------------------------------------------
    # PROPRE OFFRE
    # --------------------------------------------------------

    if uid == original.user_id:

        raise HTTPException(
            status_code=400,
            detail=(
                "Vous ne pouvez pas faire une "
                "contre-offre à votre propre offre."
            ),
        )

    # --------------------------------------------------------
    # OFFRE ACTIVE
    # --------------------------------------------------------

    if original.status != "sent":

        raise HTTPException(
            status_code=400,
            detail=(
                "Cette offre n'est plus active : "
                f"{original.status}"
            ),
        )

    # --------------------------------------------------------
    # EXPIRATION
    # --------------------------------------------------------

    if _expire_booking(
        booking,
        db,
    ):

        raise HTTPException(
            status_code=410,
            detail="Cette demande a expiré",
        )

    if (
        original.expires_at
        and original.expires_at
        < datetime.utcnow()
    ):

        original.status = "expired"

        db.commit()

        raise HTTPException(
            status_code=410,
            detail="Cette offre a expiré",
        )

    # --------------------------------------------------------
    # ROLE
    # --------------------------------------------------------

    role = _role(current_user)

    if role not in (
        "CLIENT",
        "THERAPIST",
    ):

        raise HTTPException(
            status_code=403,
            detail=(
                "Seuls le client et le thérapeute "
                "peuvent faire une contre-offre."
            ),
        )

    # --------------------------------------------------------
    # SI THERAPEUTE
    # --------------------------------------------------------

    if role == "THERAPIST":

        if not getattr(
            current_user,
            "is_active",
            True,
        ):

            raise HTTPException(
                status_code=403,
                detail=(
                    "Votre compte thérapeute "
                    "est inactif."
                ),
            )

        verification = str(
            getattr(
                current_user,
                "verification_status",
                ""
            ) or ""
        ).strip().lower()

        if verification != "approved":

            raise HTTPException(
                status_code=403,
                detail=(
                    "Votre compte thérapeute "
                    "n'est pas encore approuvé."
                ),
            )

        # Si booking déjà assigné
        if (
            booking.therapist_id is not None
            and booking.therapist_id != uid
        ):

            raise HTTPException(
                status_code=403,
                detail=(
                    "Seul le thérapeute concerné "
                    "peut négocier cette réservation."
                ),
            )

        # Si NULL mais thérapeute déjà participant,
        # on l'assigne.
        if booking.therapist_id is None:

            participated = (
                _therapist_has_participated(
                    booking.id,
                    uid,
                    db,
                )
            )

            if participated:
                booking.therapist_id = uid

    # --------------------------------------------------------
    # SI CLIENT
    # --------------------------------------------------------

    if role == "CLIENT":

        if uid != booking.client_id:

            raise HTTPException(
                status_code=403,
                detail=(
                    "Vous n'êtes pas le client "
                    "de cette réservation."
                ),
            )

        if not booking.therapist_id:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Aucun thérapeute n'est encore "
                    "attribué à cette réservation."
                ),
            )

    # --------------------------------------------------------
    # FERMER L'ANCIENNE OFFRE
    # --------------------------------------------------------

    original.status = "rejected"

    # --------------------------------------------------------
    # TYPE NOUVELLE OFFRE
    # --------------------------------------------------------

    user_type = (
        "client"
        if role == "CLIENT"
        else "therapist"
    )

    # --------------------------------------------------------
    # CREATION CONTRE-OFFRE
    # --------------------------------------------------------

    new_offer = Negotiation(
        booking_id=booking.id,
        user_id=uid,
        user_type=user_type,
        price_offered=data.counter_price,
        message=(
            data.message
            or (
                "Contre-offre à "
                f"{float(data.counter_price):,.0f} Ar"
            )
        ),
        status="sent",
        expires_at=(
            datetime.utcnow()
            + NEGOTIATION_OFFER_TTL
        ),
    )

    db.add(new_offer)

    booking.status = "negotiating"

    db.commit()

    db.refresh(new_offer)
    db.refresh(booking)

    # --------------------------------------------------------
    # NOTIFICATION
    # --------------------------------------------------------

    try:

        send_notification(
            original.user_id,
            "Nouvelle contre-offre",
            (
                f"{current_user.fullname} propose "
                f"{float(data.counter_price):,.0f} Ar"
            ),
            "counter_offer",
            {
                "booking_id": booking.id,
                "offer_id": new_offer.id,
                "original_offer_id": original.id,
            },
        )

    except Exception:

        logger.exception(
            "Counter notification failed"
        )

    return _serialize(
        new_offer
    )