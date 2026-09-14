# app/api/bookings.py

from datetime import datetime, timezone
from typing import Optional
import logging
import math

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import (
    get_current_user,
    get_current_therapist,
)

from ..models.user import User
from ..models.booking import Booking
from ..models.massage import MassageType
from ..models.negotiation import Negotiation

from ..schemas.booking import (
    BookingCreate,
    BookingResponse,
    BookingDetailResponse,
    BookingUpdate,
)

from ..services.notification_service import (
    send_notification,
)


logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/bookings",
    tags=["Bookings"],
)


# ============================================================
# DATETIME
# ============================================================

def utc_now() -> datetime:
    """
    Retourne l'heure UTC sans timezone.

    Le projet utilise des TIMESTAMP PostgreSQL sans timezone.
    """
    return datetime.utcnow()


def to_naive_utc(
    value: Optional[datetime],
) -> Optional[datetime]:

    if value is None:
        return None

    if value.tzinfo is not None:
        return value.astimezone(
            timezone.utc
        ).replace(
            tzinfo=None
        )

    return value


# ============================================================
# HAVERSINE
# ============================================================

def haversine_km(
    lat1,
    lon1,
    lat2,
    lon2,
) -> Optional[float]:

    if (
        lat1 is None
        or lon1 is None
        or lat2 is None
        or lon2 is None
    ):
        return None

    try:
        lat1 = float(lat1)
        lon1 = float(lon1)

        lat2 = float(lat2)
        lon2 = float(lon2)

    except (
        TypeError,
        ValueError,
    ):
        return None

    radius = 6371.0

    p1 = math.radians(lat1)
    p2 = math.radians(lat2)

    dp = math.radians(
        lat2 - lat1
    )

    dl = math.radians(
        lon2 - lon1
    )

    a = (
        math.sin(dp / 2) ** 2
        +
        math.cos(p1)
        *
        math.cos(p2)
        *
        math.sin(dl / 2) ** 2
    )

    a = min(
        1.0,
        max(0.0, a)
    )

    return (
        2
        * radius
        * math.asin(
            math.sqrt(a)
        )
    )


# ============================================================
# EXPIRATION
# ============================================================

def expire_booking_if_needed(
    booking: Booking,
    db: Session,
) -> bool:

    now = utc_now()

    if (
        booking.status
        in (
            "pending",
            "negotiating",
        )
        and booking.expires_at is not None
        and booking.expires_at < now
    ):

        booking.status = "expired"

        # Les offres encore ouvertes deviennent expirées.
        db.query(Negotiation).filter(
            Negotiation.booking_id
            == booking.id,
            Negotiation.status
            == "sent",
        ).update(
            {
                "status": "expired"
            },
            synchronize_session=False,
        )

        db.commit()

        db.refresh(
            booking
        )

        logger.info(
            "BOOKING EXPIRED id=%s",
            booking.id,
        )

        return True

    return False


# ============================================================
# BOOKING SERIALIZER
# ============================================================

def booking_response_dict(
    booking: Booking,
    *,
    client_override: Optional[User] = None,
    massage_override: Optional[MassageType] = None,
    distance_km: Optional[float] = None,
) -> dict:

    client = (
        client_override
        if client_override is not None
        else getattr(
            booking,
            "client",
            None,
        )
    )

    therapist = getattr(
        booking,
        "therapist",
        None,
    )

    massage = (
        massage_override
        if massage_override is not None
        else getattr(
            booking,
            "massage_type",
            None,
        )
    )

    distance_rounded = (
        round(distance_km, 2)
        if distance_km is not None
        else None
    )

    return {
        "id": booking.id,

        "client_id": booking.client_id,

        "therapist_id": booking.therapist_id,

        "massage_type_id": booking.massage_type_id,

        "status": booking.status,

        "client_price_proposed": (
            float(
                booking.client_price_proposed
            )
            if booking.client_price_proposed
            is not None
            else 0.0
        ),

        "therapist_initial_price": (
            float(
                booking.therapist_initial_price
            )
            if booking.therapist_initial_price
            is not None
            else None
        ),

        "final_price": (
            float(
                booking.final_price
            )
            if booking.final_price
            is not None
            else None
        ),

        "address": booking.address,

        "client_location": getattr(
            booking,
            "client_location",
            None,
        ),

        "client_latitude": (
            float(
                booking.client_latitude
            )
            if booking.client_latitude
            is not None
            else None
        ),

        "client_longitude": (
            float(
                booking.client_longitude
            )
            if booking.client_longitude
            is not None
            else None
        ),

        "scheduled_date": (
            booking.scheduled_date
        ),

        "scheduled_duration_minutes": (
            booking.scheduled_duration_minutes
            or 60
        ),

        # ------------------------------------------------
        # DATES AUTOMATIQUES DU CYCLE DE VIE DE LA RESERVATION
        #
        # therapist_assigned_at -> posé automatiquement quand
        #   l'offre est acceptée (voir app/api/offers.py,
        #   accept_offer()).
        # actual_start_time -> posé automatiquement quand le
        #   thérapeute démarre le massage (PUT /bookings/start/{id}).
        # actual_end_time -> posé automatiquement quand le
        #   thérapeute termine le massage (PUT /bookings/complete/{id}).
        # ------------------------------------------------

        "therapist_assigned_at": getattr(
            booking, "therapist_assigned_at", None
        ),

        "actual_start_time": getattr(
            booking, "actual_start_time", None
        ),

        "actual_end_time": getattr(
            booking, "actual_end_time", None
        ),

        "preferred_gender": (
            booking.preferred_gender
        ),

        "special_instructions": (
            booking.special_instructions
        ),

        "cancellation_reason": (
            booking.cancellation_reason
        ),

        "created_at": booking.created_at,

        "updated_at": booking.updated_at,

        "expires_at": booking.expires_at,

        "client_name": (
            client.fullname
            if client
            else None
        ),

        "client_phone": (
            getattr(client, "phone", None)
            if client
            else None
        ),

        "client_email": (
            getattr(client, "email", None)
            if client
            else None
        ),

        "client_photo": (
            getattr(client, "profile_image", None)
            if client
            else None
        ),

        "therapist_name": (
            therapist.fullname
            if therapist
            else None
        ),

        # ----------------------------------------------------
        # ⚠️ AJOUT : ces 4 champs étaient absents du dict alors
        # que HistoryScreen.js (getTherapistPhoto/Email/Phone/
        # OnlineStatus) les attend précisément sous ces noms.
        # Résultat avant ce fix : jamais de vraie photo/email/
        # téléphone affichés côté client, uniquement le nom.
        # ----------------------------------------------------

        "therapist_email": (
            getattr(therapist, "email", None)
            if therapist
            else None
        ),

        "therapist_phone": (
            getattr(therapist, "phone", None)
            if therapist
            else None
        ),

        "therapist_photo_url": (
            getattr(therapist, "profile_image", None)
            if therapist
            else None
        ),

        "therapist_is_online": (
            bool(getattr(therapist, "is_online", False))
            if therapist
            else False
        ),

        "massage_type_name": (
            massage.name
            if massage
            else None
        ),

        # ----------------------------------------------------
        # DISTANCE
        #
        # Tsy voatery misy (None) raha tsy nampidirina
        # (ohatra: rehefa tsy therapiste ny mpampiasa, na
        # tsy nisy karazana kajy natao ho an'io endpoint io).
        # ----------------------------------------------------

        "distance_km": distance_rounded,

        "distanceKm": distance_rounded,
    }


# ============================================================
# AUTHORIZATION
# ============================================================

def can_view_booking(
    booking: Booking,
    user: User,
    db: Session,
) -> bool:

    # ADMIN
    if user.role == "ADMIN":
        return True

    # CLIENT
    if user.role == "CLIENT":

        return (
            booking.client_id
            == user.id
        )

    # THERAPIST
    if user.role == "THERAPIST":

        # Booking déjà confirmé avec ce thérapeute
        if (
            booking.therapist_id
            == user.id
        ):
            return True

        # Demande encore ouverte
        if (
            booking.therapist_id is None
            and booking.status
            in (
                "pending",
                "negotiating",
            )
        ):
            return True

        # Thérapeute ayant déjà fait une offre
        exists = db.query(
            Negotiation
        ).filter(
            Negotiation.booking_id
            == booking.id,

            Negotiation.user_id
            == user.id,
        ).first()

        return exists is not None

    return False


# ============================================================
# CREATE BOOKING
# ============================================================

@router.post(
    "/",
    response_model=BookingDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_booking(
    booking_data: BookingCreate,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):

    # --------------------------------------------------------
    # CLIENT ONLY
    # --------------------------------------------------------

    if current_user.role != "CLIENT":

        raise HTTPException(
            status_code=403,
            detail=(
                "Only clients can create bookings"
            ),
        )

    # --------------------------------------------------------
    # MASSAGE
    # --------------------------------------------------------

    massage_type = db.query(
        MassageType
    ).filter(
        MassageType.id
        == booking_data.massage_type_id
    ).first()

    if not massage_type:

        raise HTTPException(
            status_code=404,
            detail="Massage type not found",
        )

    # Vérification massage actif si le champ existe
    if (
        hasattr(
            massage_type,
            "is_active",
        )
        and massage_type.is_active is False
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Ce type de massage est "
                "indisponible"
            ),
        )

    # --------------------------------------------------------
    # PRIX MINIMUM
    # --------------------------------------------------------

    if (
        booking_data.client_price_proposed
        < float(
            massage_type.min_price
        )
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                f"Price must be at least "
                f"{massage_type.min_price} Ar"
            ),
        )

    # --------------------------------------------------------
    # DATE
    # --------------------------------------------------------

    scheduled_date = to_naive_utc(
        booking_data.scheduled_date
    )

    if scheduled_date is None:

        raise HTTPException(
            status_code=400,
            detail=(
                "scheduled_date est obligatoire"
            ),
        )

    if scheduled_date <= utc_now():

        raise HTTPException(
            status_code=400,
            detail=(
                "Scheduled date must be "
                "in the future"
            ),
        )

    # ========================================================
    # IMPORTANT FIX
    #
    # AVANT :
    #
    # expires_at = now + 30 minutes
    #
    # MAINTENANT :
    #
    # expires_at = scheduled_date
    #
    # Le booking reste donc disponible jusqu'au
    # début du massage.
    # ========================================================

    expires_at = scheduled_date

    # --------------------------------------------------------
    # CREATE
    # --------------------------------------------------------

    new_booking = Booking(

        client_id=current_user.id,

        therapist_id=None,

        massage_type_id=(
            booking_data.massage_type_id
        ),

        client_price_proposed=(
            booking_data.client_price_proposed
        ),

        therapist_initial_price=None,

        final_price=None,

        client_latitude=(
            booking_data.latitude
        ),

        client_longitude=(
            booking_data.longitude
        ),

        address=(
            booking_data.address
        ),

        scheduled_date=(
            scheduled_date
        ),

        scheduled_duration_minutes=(
            booking_data.duration_minutes
        ),

        preferred_gender=(
            booking_data.preferred_gender
        ),

        special_instructions=(
            booking_data.special_instructions
        ),

        status="pending",

        expires_at=expires_at,
    )

    db.add(
        new_booking
    )

    db.commit()

    db.refresh(
        new_booking
    )

    logger.info(
        "BOOKING CREATED "
        "id=%s client=%s "
        "status=%s expires=%s",
        new_booking.id,
        new_booking.client_id,
        new_booking.status,
        new_booking.expires_at,
    )

    # ========================================================
    # NOTIFICATION THERAPEUTES
    #
    # ⚠️ Tout ce bloc est entouré d'un try/except global : la
    # réservation est DEJA créée et commit() plus haut. Quoi
    # qu'il arrive dans la logique de notification (bug futur,
    # colonne manquante, service de notification en panne...),
    # ça ne doit JAMAIS transformer une création de réservation
    # réussie en erreur 500 pour le client.
    # ========================================================

    notified = 0

    try:

        therapists = db.query(
            User
        ).filter(

            User.role == "THERAPIST",

            User.is_active == True,

            User.deleted_at.is_(None),

            User.verification_status
            == "approved",

            User.is_online == True,

            User.is_available == True,
        ).all()

        # ----------------------------------------------------
        # DIAGNOSTIC : si personne n'est notifié, on veut savoir
        # IMMEDIATEMENT pourquoi en lisant les logs, plutôt que
        # de deviner. On compte donc chaque filtre séparément.
        # ----------------------------------------------------

        total_therapists = db.query(User).filter(
            User.role == "THERAPIST",
            User.deleted_at.is_(None),
        ).count()

        logger.info(
            "BOOKING %s -> %s thérapeute(s) au total, "
            "%s correspondent aux filtres "
            "(actif+vérifié+en ligne+disponible)",
            new_booking.id,
            total_therapists,
            len(therapists),
        )

        if not therapists:
            logger.warning(
                "BOOKING %s -> AUCUN thérapeute ne correspond aux "
                "filtres (is_active/verification_status=approved/"
                "is_online/is_available). Aucune notification ne "
                "peut donc être envoyée pour cette demande.",
                new_booking.id,
            )

        for therapist in therapists:

            # ------------------------------------------------
            # ⚠️ FIX IMPORTANT
            #
            # AVANT : haversine_km() était appelé hors de tout
            # try/except. Si un SEUL thérapeute avait une
            # latitude ou une longitude manquante (None), le
            # calcul plantait avec une exception non rattrapée
            # qui arrêtait TOUTE la boucle instantanément : plus
            # aucun thérapeute suivant n'était notifié, et la
            # requête entière remontait en erreur 500 (alors que
            # la réservation, elle, était déjà enregistrée en
            # base par le commit() plus haut). C'est ce qui
            # expliquait "la réservation est créée mais jamais
            # aucune notification".
            #
            # MAINTENANT : une erreur sur UN thérapeute (GPS
            # manquant, valeur invalide, etc.) est loguée et
            # ignorée, sans jamais interrompre les autres.
            # ------------------------------------------------

            try:

                distance = haversine_km(

                    new_booking.client_latitude,
                    new_booking.client_longitude,

                    therapist.latitude,
                    therapist.longitude,
                )

            except Exception:

                logger.exception(
                    "Erreur calcul distance (GPS manquant/invalide) "
                    "therapist=%s booking=%s -> notification envoyée "
                    "quand même, sans filtre de distance.",
                    therapist.id,
                    new_booking.id,
                )

                distance = None

            radius = float(
                therapist.service_radius
                or 10
            )

            # Si les deux GPS existent
            # on respecte le rayon.
            if (
                distance is not None
                and distance > radius
            ):
                continue

            try:

                send_notification(

                    therapist.id,

                    "Nouvelle demande de massage",

                    (
                        f"{current_user.fullname} "
                        f"demande "
                        f"{massage_type.name} "
                        f"pour "
                        f"{float(new_booking.client_price_proposed):,.0f} Ar"
                    ),

                    "new_booking",

                    {
                        "booking_id":
                        new_booking.id
                    },
                )

                notified += 1

            except Exception:

                logger.exception(
                    "Notification failed "
                    "therapist=%s booking=%s",
                    therapist.id,
                    new_booking.id,
                )

        logger.info(
            "BOOKING %s -> %s therapists notified",
            new_booking.id,
            notified,
        )

    except Exception:

        logger.exception(
            "BOOKING %s -> échec complet du bloc de "
            "notification (la réservation reste créée "
            "normalement, seule la notification a échoué).",
            new_booking.id,
        )

    return booking_response_dict(
        new_booking
    )


# ============================================================
# AVAILABLE BOOKINGS
# ============================================================

@router.get(
    "/available"
)
async def get_available_bookings(

    current_user: User = Depends(
        get_current_therapist
    ),

    db: Session = Depends(
        get_db
    ),

    limit: int = Query(
        50,
        ge=1,
        le=100,
    ),

    radius_km: Optional[float] = Query(
        None,
        ge=0,
        le=500,
        description=(
            "Rayon personnalisé. "
            "Si absent, service_radius "
            "du thérapeute est utilisé."
        ),
    ),

    ignore_distance: bool = Query(
        False,
        description=(
            "true = afficher toutes "
            "les demandes ouvertes "
            "sans filtrage GPS."
        ),
    ),
):

    if current_user.role != "THERAPIST":

        raise HTTPException(
            status_code=403,
            detail="Therapist access required",
        )

    now = utc_now()

    service_radius = (

        float(radius_km)

        if radius_km is not None

        else float(
            current_user.service_radius
            or 10
        )
    )

    logger.info(
        "===================================================="
    )

    logger.info(
        "AVAILABLE BOOKINGS "
        "therapist=%s radius=%s "
        "ignore_distance=%s",

        current_user.id,

        service_radius,

        ignore_distance,
    )

    logger.info(
        "THERAPIST GPS "
        "lat=%s lon=%s",

        current_user.latitude,

        current_user.longitude,
    )

    # ========================================================
    # IMPORTANT
    #
    # therapist_id doit être NULL
    #
    # status :
    # pending OU negotiating
    #
    # Une offre ne bloque PAS les autres thérapeutes.
    # ========================================================

    bookings = db.query(
        Booking
    ).filter(

        Booking.therapist_id.is_(None),

        Booking.status.in_(
            [
                "pending",
                "negotiating",
            ]
        ),

        or_(
            Booking.expires_at.is_(None),

            Booking.expires_at >= now,
        ),

    ).order_by(

        Booking.created_at.desc()

    ).all()

    logger.info(
        "BOOKINGS OPEN FOUND = %s",
        len(bookings),
    )

    # ========================================================
    # AUTO-EXPAND RADIUS (FIX)
    #
    # Rehefa misy demande ao amin'ny base de données saingy
    # tsy misy tafiditra ao anatin'ny service_radius voafaritry
    # ny thérapeute (ohatra : GPS tsy marina, na demandes avy
    # any amin'ny faritra hafa), dia aza avela ho "Aucune
    # demande" foana ny résultat.
    #
    # Miezaka mihalava ny rayon fikarohana hatramin'ny mahita
    # demande na dia iray aza, alohan'ny hiverina lisitra tsy
    # feno, na dia ignore_distance=false aza io.
    # ========================================================

    effective_radius = service_radius

    if not ignore_distance:

        distances_preview = [
            haversine_km(
                current_user.latitude,
                current_user.longitude,
                b.client_latitude,
                b.client_longitude,
            )
            for b in bookings
        ]

        has_within_radius = any(
            d is not None and d <= service_radius
            for d in distances_preview
        )

        if not has_within_radius and bookings:

            for expanded in (
                service_radius * 3,
                service_radius * 8,
                500.0,
            ):

                if any(
                    d is not None and d <= expanded
                    for d in distances_preview
                ):

                    effective_radius = expanded

                    logger.info(
                        "AUTO-EXPAND radius %.1f -> %.1f km "
                        "(aucune demande dans le rayon initial)",
                        service_radius,
                        expanded,
                    )

                    break

    result = []

    for booking in bookings:

        # ----------------------------------------------------
        # EXPIRATION
        # ----------------------------------------------------

        if (
            booking.expires_at
            is not None
            and booking.expires_at < now
        ):
            continue

        # ----------------------------------------------------
        # CLIENT
        # ----------------------------------------------------

        client = getattr(
            booking,
            "client",
            None,
        )

        if (
            client is None
            and booking.client_id
        ):

            client = db.query(
                User
            ).filter(
                User.id
                == booking.client_id
            ).first()

        # ----------------------------------------------------
        # MASSAGE
        # ----------------------------------------------------

        massage = getattr(
            booking,
            "massage_type",
            None,
        )

        if (
            massage is None
            and booking.massage_type_id
        ):

            massage = db.query(
                MassageType
            ).filter(
                MassageType.id
                == booking.massage_type_id
            ).first()

        # ----------------------------------------------------
        # DISTANCE
        # ----------------------------------------------------

        distance = haversine_km(

            current_user.latitude,

            current_user.longitude,

            booking.client_latitude,

            booking.client_longitude,
        )

        # ----------------------------------------------------
        # GPS FILTER
        # ----------------------------------------------------

        if (
            not ignore_distance
            and distance is not None
            and distance > effective_radius
        ):

            logger.info(
                "BOOKING %s skipped "
                "distance %.2f > %.2f",

                booking.id,

                distance,

                effective_radius,
            )

            continue

        # ----------------------------------------------------
        # ETA
        # ----------------------------------------------------

        eta_minutes = None

        if distance is not None:

            eta_minutes = max(

                1,

                round(
                    (
                        distance
                        / 25.0
                    ) * 60
                ),
            )

        # ----------------------------------------------------
        # REMAINING TIME
        # ----------------------------------------------------

        remaining_seconds = None

        if booking.expires_at:

            remaining_seconds = max(

                0,

                int(
                    (
                        booking.expires_at
                        - now
                    ).total_seconds()
                ),
            )

        # ----------------------------------------------------
        # PRICE
        # ----------------------------------------------------

        price = (

            float(
                booking.client_price_proposed
            )

            if booking.client_price_proposed
            is not None

            else 0.0
        )

        # ----------------------------------------------------
        # DURATION
        # ----------------------------------------------------

        duration = (
            booking.scheduled_duration_minutes
            or 60
        )

        # ----------------------------------------------------
        # NAMES
        # ----------------------------------------------------

        client_name = (

            client.fullname

            if client

            else "Client"
        )

        massage_name = (

            massage.name

            if massage

            else "Massage"
        )

        massage_category = (

            getattr(
                massage,
                "category",
                None,
            )

            if massage

            else None
        )

        # ----------------------------------------------------
        # OFFERS
        # ----------------------------------------------------

        offers_count = db.query(
            Negotiation
        ).filter(

            Negotiation.booking_id
            == booking.id,

            Negotiation.status
            == "sent",

        ).count()

        my_offer = db.query(
            Negotiation
        ).filter(

            Negotiation.booking_id
            == booking.id,

            Negotiation.user_id
            == current_user.id,

            Negotiation.status
            == "sent",

        ).first()

        # ----------------------------------------------------
        # RESULT
        # ----------------------------------------------------

        result.append({

            "id": booking.id,

            "booking_id": booking.id,

            "client_id":
                booking.client_id,

            "therapist_id":
                booking.therapist_id,

            "status":
                booking.status,

            "client": {

                "id":
                    client.id
                    if client
                    else booking.client_id,

                "fullname":
                    client.fullname
                    if client
                    else "Client",

                "name":
                    client.fullname
                    if client
                    else "Client",

                "phone":
                    client.phone
                    if client
                    else None,

                "email":
                    client.email
                    if client
                    else None,

                "is_online":
                    bool(client.is_online)
                    if client
                    else False,
            },

            "client_is_online":
                bool(client.is_online)
                if client
                else False,

            "client_name":
                client_name,

            "client_fullname":
                client_name,

            "massage_type": {

                "id":
                    booking.massage_type_id,

                "name":
                    massage_name,

                "category":
                    massage_category,
            },

            "massage_type_id":
                booking.massage_type_id,

            "massage_type_name":
                massage_name,

            "client_price_proposed":
                price,

            "price":
                price,

            "proposed_price":
                price,

            "final_price":
                (
                    float(booking.final_price)
                    if booking.final_price
                    is not None
                    else None
                ),

            "scheduled_duration_minutes":
                duration,

            "duration_minutes":
                duration,

            "address":
                booking.address,

            "client_location":
                getattr(
                    booking,
                    "client_location",
                    None,
                ),

            "client_latitude":
                (
                    float(
                        booking.client_latitude
                    )
                    if booking.client_latitude
                    is not None
                    else None
                ),

            "client_longitude":
                (
                    float(
                        booking.client_longitude
                    )
                    if booking.client_longitude
                    is not None
                    else None
                ),

            "distance_km":
                (
                    round(distance, 2)
                    if distance is not None
                    else None
                ),

            "distanceKm":
                (
                    round(distance, 2)
                    if distance is not None
                    else None
                ),

            "eta_minutes":
                eta_minutes,

            "etaMinutes":
                eta_minutes,

            "scheduled_date":
                booking.scheduled_date,

            "scheduledDate":
                booking.scheduled_date,

            "preferred_gender":
                booking.preferred_gender,

            "special_instructions":
                booking.special_instructions,

            "created_at":
                booking.created_at,

            "expires_at":
                booking.expires_at,

            "time_remaining_seconds":
                remaining_seconds,

            "offers_count":
                offers_count,

            "has_my_offer":
                my_offer is not None,

            "my_offer": (

                {
                    "id":
                        my_offer.id,

                    "price_offered":
                        float(
                            my_offer.price_offered
                        ),

                    "message":
                        my_offer.message,

                    "status":
                        my_offer.status,

                    "expires_at":
                        my_offer.expires_at,
                }

                if my_offer

                else None
            ),
        })

    # --------------------------------------------------------
    # TRI
    # --------------------------------------------------------

    result.sort(

        key=lambda item:

        (
            item["distance_km"]

            if item["distance_km"]
            is not None

            else 999999
        )
    )

    result = result[:limit]

    logger.info(
        "AVAILABLE RESULT "
        "therapist=%s count=%s",

        current_user.id,

        len(result),
    )

    for item in result:

        logger.info(

            "booking=%s | "
            "status=%s | "
            "client=%s | "
            "massage=%s | "
            "price=%s | "
            "distance=%s | "
            "offers=%s",

            item["id"],

            item["status"],

            item["client_name"],

            item["massage_type_name"],

            item["client_price_proposed"],

            item["distance_km"],

            item["offers_count"],
        )

    return result


# ============================================================
# SEARCH THERAPISTS
# ============================================================

@router.get(
    "/therapists/search"
)
async def search_therapists(

    specialty_id: Optional[int] = Query(
        None
    ),

    latitude: Optional[float] = Query(
        None
    ),

    longitude: Optional[float] = Query(
        None
    ),

    radius_km: float = Query(
        10,
        gt=0,
        le=500,
    ),

    limit: int = Query(
        50,
        ge=1,
        le=200,
    ),

    db: Session = Depends(
        get_db
    ),
):

    try:

        from ..models.therapist import (
            TherapistSpecialty
        )

        query = db.query(
            User
        ).filter(

            User.role
            == "THERAPIST",

            User.is_active
            == True,

            User.verification_status
            == "approved",

            User.deleted_at.is_(None),
        )

        if specialty_id:

            query = (

                query

                .join(
                    TherapistSpecialty,

                    TherapistSpecialty.therapist_id
                    == User.id,
                )

                .filter(

                    TherapistSpecialty
                    .massage_type_id
                    == specialty_id
                )
            )

        therapists = (

            query

            .distinct()

            .order_by(
                User.rating.desc()
            )

            .limit(200)

            .all()
        )

        result = []

        for therapist in therapists:

            distance = None

            if (
                latitude is not None
                and longitude is not None
            ):

                distance = haversine_km(

                    latitude,
                    longitude,

                    therapist.latitude,
                    therapist.longitude,
                )

                if (
                    distance is not None
                    and distance > radius_km
                ):
                    continue

            result.append({

                "id":
                    therapist.id,

                "fullname":
                    therapist.fullname,

                "name":
                    therapist.fullname,

                "email":
                    therapist.email,

                "phone":
                    therapist.phone,

                "profile_image":
                    therapist.profile_image,

                "rating":
                    float(
                        therapist.rating
                        or 0
                    ),

                "total_reviews":
                    therapist.total_reviews
                    or 0,

                "base_price":
                    (
                        float(
                            therapist.base_price
                        )
                        if therapist.base_price
                        is not None
                        else None
                    ),

                "is_online":
                    bool(
                        therapist.is_online
                    ),

                "is_available":
                    bool(
                        therapist.is_available
                    ),

                "experience_years":
                    therapist.experience_years
                    or 0,

                "latitude":
                    therapist.latitude,

                "longitude":
                    therapist.longitude,

                "distance_km":
                    (
                        round(
                            distance,
                            2
                        )
                        if distance
                        is not None
                        else None
                    ),
            })

        result.sort(

            key=lambda item:

            (
                item["distance_km"]

                if item["distance_km"]
                is not None

                else 999999
            )
        )

        return result[:limit]

    except Exception:

        logger.exception(
            "Error search therapists"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Erreur lors de la "
                "recherche des thérapeutes"
            ),
        )


# ============================================================
# GET BOOKINGS
# ============================================================

@router.get(
    "/",
    # ========================================================
    # ⚠️ AZA ASIANA response_model=list[BookingResponse] ETO !
    #
    # Toy ny nitranga tao amin'ny "/therapists" (jereo
    # TherapistCardResponse ao therapists.py), ny response_model
    # dia manala ("filtre") avy hatrany ny field REHETRA tsy
    # voafaritra ao amin'ilay schema Pydantic — na dia efa
    # napetraka tsara ao anaty dict aza izy (distance_km,
    # distanceKm, client_phone, client_email, ...). Raha toa
    # ka schemas/booking.py::BookingResponse dia tsy manana
    # ireo field vaovao ireo, dia ho "—" indray no ho hitan'ny
    # app na dia efa kajiana sy nampidirina tao amin'ny
    # booking_response_dict() aza izy. Aleo avela ho dict/JSON
    # mivantana ny valiny (tahaka ny "/bookings/available")
    # mba tsy hisy filtrage tsy nahy intsony.
    # ========================================================
)
async def get_bookings(

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),

    status_filter: Optional[str] = Query(
        None,
        alias="status",
    ),

    limit: int = Query(
        50,
        ge=1,
        le=200,
    ),
):

    query = db.query(
        Booking
    )

    if current_user.role == "CLIENT":

        query = query.filter(
            Booking.client_id
            == current_user.id
        )

    elif current_user.role == "THERAPIST":

        query = query.filter(
            Booking.therapist_id
            == current_user.id
        )

    elif current_user.role == "ADMIN":

        pass

    else:

        raise HTTPException(
            status_code=403,
            detail="Role not authorized",
        )

    if status_filter:

        query = query.filter(
            Booking.status
            == status_filter
        )

    bookings = (

        query

        .order_by(
            Booking.created_at.desc()
        )

        .limit(limit)

        .all()
    )

    for booking in bookings:

        expire_booking_if_needed(
            booking,
            db,
        )

    # ========================================================
    # DONNÉES COMPLÈTES (client, massage, distance)
    #
    # FIX: Ny endpoint "/bookings" (ampiasain'ny liste
    # "Demandes" ho an'ny réservations negotiating/confirmed/
    # in_progress/completed/...) dia tsy nanisy distance_km
    # sy tsy niantoka fa feno hatrany ny client (téléphone,
    # email, photo). Amin'izao dia:
    #
    #   1. Alaina manokana ny client raha tsy voafeno tsara
    #      ny relation "client" (tahaka ny amin'ny endpoint
    #      "/bookings/available").
    #
    #   2. Kajiana ny distance_km eo anelanelan'ny thérapeute
    #      (GPS ankehitriny) sy ny client (client_latitude /
    #      client_longitude), mba tsy hisy "—" foana amin'ny
    #      demandes efa confirmed/negotiating.
    # ========================================================

    is_therapist = (
        current_user.role == "THERAPIST"
    )

    result = []

    for booking in bookings:

        client = getattr(
            booking,
            "client",
            None,
        )

        if (
            client is None
            and booking.client_id
        ):

            client = db.query(
                User
            ).filter(
                User.id
                == booking.client_id
            ).first()

        massage = getattr(
            booking,
            "massage_type",
            None,
        )

        if (
            massage is None
            and booking.massage_type_id
        ):

            massage = db.query(
                MassageType
            ).filter(
                MassageType.id
                == booking.massage_type_id
            ).first()

        distance = None

        if is_therapist:

            distance = haversine_km(
                current_user.latitude,
                current_user.longitude,
                booking.client_latitude,
                booking.client_longitude,
            )

        result.append(
            booking_response_dict(
                booking,
                client_override=client,
                massage_override=massage,
                distance_km=distance,
            )
        )

    return result


# ============================================================
# GET ONE BOOKING
# ============================================================

@router.get(
    "/{booking_id}",
    response_model=BookingDetailResponse,
)
async def get_booking(

    booking_id: int,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):

    booking = db.query(
        Booking
    ).filter(
        Booking.id
        == booking_id
    ).first()

    if not booking:

        raise HTTPException(
            status_code=404,
            detail="Booking not found",
        )

    expire_booking_if_needed(
        booking,
        db,
    )

    if not can_view_booking(
        booking,
        current_user,
        db,
    ):

        raise HTTPException(
            status_code=403,
            detail="Not authorized",
        )

    return booking_response_dict(
        booking
    )


# ============================================================
# UPDATE BOOKING
# ============================================================

@router.put(
    "/{booking_id}",
    response_model=BookingDetailResponse,
)
async def update_booking(

    booking_id: int,

    booking_data: BookingUpdate,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):

    booking = db.query(
        Booking
    ).filter(
        Booking.id
        == booking_id
    ).first()

    if not booking:

        raise HTTPException(
            status_code=404,
            detail="Booking not found",
        )

    if (
        booking.client_id
        != current_user.id
    ):

        raise HTTPException(
            status_code=403,
            detail="Not authorized",
        )

    if booking.status not in (
        "pending",
        "negotiating",
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Cette réservation "
                "ne peut plus être modifiée."
            ),
        )

    values = (

        booking_data.model_dump(
            exclude_unset=True
        )

        if hasattr(
            booking_data,
            "model_dump",
        )

        else booking_data.dict(
            exclude_unset=True
        )
    )

    # Champs contrôlés par le serveur
    values.pop(
        "therapist_id",
        None,
    )

    values.pop(
        "final_price",
        None,
    )

    values.pop(
        "status",
        None,
    )

    if "scheduled_date" in values:

        values["scheduled_date"] = (
            to_naive_utc(
                values["scheduled_date"]
            )
        )

        if (
            values["scheduled_date"]
            <= utc_now()
        ):

            raise HTTPException(
                status_code=400,
                detail=(
                    "Scheduled date must "
                    "be in the future"
                ),
            )

        # IMPORTANT :
        # garder expires_at aligné avec
        # la nouvelle date.
        booking.expires_at = (
            values["scheduled_date"]
        )

    for key, value in values.items():

        if hasattr(
            booking,
            key,
        ):

            setattr(
                booking,
                key,
                value,
            )

    booking.updated_at = utc_now()

    db.commit()

    db.refresh(
        booking
    )

    return booking_response_dict(
        booking
    )


# ============================================================
# CANCEL BOOKING
# ============================================================

@router.put(
    "/cancel/{booking_id}"
)
async def cancel_booking(

    booking_id: int,

    reason: Optional[str] = Query(
        None,
        max_length=500,
    ),

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):

    booking = db.query(
        Booking
    ).filter(
        Booking.id
        == booking_id
    ).first()

    if not booking:

        raise HTTPException(
            status_code=404,
            detail="Booking not found",
        )

    if (
        current_user.id
        == booking.client_id
    ):

        booking.status = (
            "cancelled_by_client"
        )

        booking.cancellation_reason = (
            reason
            or "Client cancelled"
        )

    elif (
        current_user.id
        == booking.therapist_id
    ):

        booking.status = (
            "cancelled_by_therapist"
        )

        booking.cancellation_reason = (
            reason
            or "Therapist cancelled"
        )

    else:

        raise HTTPException(
            status_code=403,
            detail="Not authorized",
        )

    db.query(
        Negotiation
    ).filter(

        Negotiation.booking_id
        == booking.id,

        Negotiation.status
        == "sent",

    ).update(

        {
            "status": "rejected"
        },

        synchronize_session=False,
    )

    db.commit()

    other_user_id = (

        booking.therapist_id

        if current_user.id
        == booking.client_id

        else booking.client_id
    )

    if other_user_id:

        try:

            send_notification(

                other_user_id,

                "Réservation annulée",

                (
                    f"La réservation "
                    f"#{booking.id} "
                    f"a été annulée."
                ),

                "booking_cancelled",

                {
                    "booking_id":
                        booking.id
                },
            )

        except Exception:

            logger.exception(
                "Cancel notification failed"
            )

    return {

        "message":
            "Booking cancelled",

        "booking_id":
            booking.id,

        "status":
            booking.status,

        "reason":
            booking.cancellation_reason,
    }


# ============================================================
# START BOOKING
# ============================================================

@router.put(
    "/start/{booking_id}"
)
async def start_booking(

    booking_id: int,

    current_user: User = Depends(
        get_current_therapist
    ),

    db: Session = Depends(
        get_db
    ),
):

    booking = db.query(
        Booking
    ).filter(
        Booking.id
        == booking_id
    ).first()

    if not booking:

        raise HTTPException(
            status_code=404,
            detail="Booking not found",
        )

    if (
        booking.therapist_id
        != current_user.id
    ):

        raise HTTPException(
            status_code=403,
            detail="Not your booking",
        )

    if booking.status != "confirmed":

        raise HTTPException(
            status_code=400,
            detail=(
                "La réservation doit être "
                "'confirmed' pour démarrer."
            ),
        )

    booking.status = "in_progress"

    booking.actual_start_time = (
        utc_now()
    )

    db.commit()

    db.refresh(
        booking
    )

    try:

        send_notification(

            booking.client_id,

            "Massage en cours",

            (
                f"{current_user.fullname} "
                f"a commencé votre massage."
            ),

            "booking_started",

            {
                "booking_id":
                    booking.id
            },
        )

    except Exception:

        logger.exception(
            "Start notification failed"
        )

    return {

        "message":
            "Booking started",

        "booking_id":
            booking.id,

        "status":
            booking.status,

        "start_time":
            booking.actual_start_time,
    }


# ============================================================
# COMPLETE BOOKING
# ============================================================

@router.put(
    "/complete/{booking_id}"
)
async def complete_booking(

    booking_id: int,

    current_user: User = Depends(
        get_current_therapist
    ),

    db: Session = Depends(
        get_db
    ),
):

    booking = db.query(
        Booking
    ).filter(
        Booking.id
        == booking_id
    ).first()

    if not booking:

        raise HTTPException(
            status_code=404,
            detail="Booking not found",
        )

    if (
        booking.therapist_id is not None
        and booking.therapist_id
        != current_user.id
    ):

        raise HTTPException(
            status_code=403,
            detail="Not your booking",
        )

    # --------------------------------------------------------
    # NOTE:
    # Ce endpoint sert maintenant à la fois à :
    #   - terminer un massage en cours ("in_progress"),
    #   - ET à valider/accepter directement une demande
    #     de réservation depuis OffersScreen / NegotiationScreen
    #     ("pending" / "negotiating" / "confirmed").
    # --------------------------------------------------------

    allowed_statuses = (
        "in_progress",
        "pending",
        "negotiating",
        "confirmed",
    )

    if booking.status not in allowed_statuses:

        raise HTTPException(
            status_code=400,
            detail=(
                "Impossible de terminer une réservation "
                f"au statut '{booking.status}'."
            ),
        )

    if not booking.therapist_id:
        booking.therapist_id = current_user.id

    if not booking.actual_start_time:
        booking.actual_start_time = utc_now()

    booking.status = "completed"

    booking.actual_end_time = (
        utc_now()
    )

    db.commit()

    db.refresh(
        booking
    )

    try:

        send_notification(

            booking.client_id,

            "Massage terminé",

            (
                f"Votre massage avec "
                f"{current_user.fullname} "
                f"est terminé."
            ),

            "booking_completed",

            {
                "booking_id":
                    booking.id
            },
        )

    except Exception:

        logger.exception(
            "Complete notification failed"
        )

    # Mise à jour rating si service disponible
    try:

        from ..services.rating_service import (
            update_therapist_rating
        )

        update_therapist_rating(
            current_user.id,
            db,
        )

    except Exception:

        logger.exception(
            "Rating update failed"
        )

    return {

        "message":
            "Booking completed",

        "booking_id":
            booking.id,

        "status":
            booking.status,

        "end_time":
            booking.actual_end_time,
    }