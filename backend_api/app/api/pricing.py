
# app/api/pricing.py
# MADA BIEN-ÊTRE — DYNAMIC PRICING
# Permissions : CLIENT / THERAPIST / ADMIN

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import (
    get_current_user,
    get_current_therapist,
)
from ..models.massage import MassageType
from ..models.booking import Booking
from ..models.user import User
from ..services.ai.pricing_service import calculate_dynamic_price


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/pricing",
    tags=["Dynamic Pricing"],
)


# ============================================================
# HELPERS
# ============================================================

def _get_role(user: User) -> str:
    """Normalise les rôles chaîne ou Enum."""

    role = getattr(user, "role", "")

    if hasattr(role, "value"):
        role = role.value

    return str(role).strip().upper().split(".")[-1]


def _same_id(first_id, second_id) -> bool:
    """Compare les identifiants en tolérant int et str."""

    if first_id is None or second_id is None:
        return False

    try:
        return int(first_id) == int(second_id)
    except (TypeError, ValueError):
        return str(first_id).strip() == str(second_id).strip()


def _get_valid_price(booking: Booking):
    """Récupère un prix valide de réservation."""

    final_price = getattr(booking, "final_price", None)

    if final_price is not None:
        try:
            final_price = float(final_price)
            if final_price > 0:
                return final_price
        except (TypeError, ValueError):
            pass

    proposed_price = getattr(
        booking,
        "client_price_proposed",
        None,
    )

    if proposed_price is not None:
        try:
            proposed_price = float(proposed_price)
            if proposed_price > 0:
                return proposed_price
        except (TypeError, ValueError):
            pass

    return None


def _get_massage_type(
    db: Session,
    massage_type_id: int,
) -> MassageType:
    """Récupère un type de massage ou retourne 404."""

    massage_type = (
        db.query(MassageType)
        .filter(MassageType.id == massage_type_id)
        .first()
    )

    if massage_type is None:
        raise HTTPException(
            status_code=404,
            detail="Type de massage introuvable.",
        )

    return massage_type


# ============================================================
# 1. SUGGESTION DE PRIX
# CLIENT / THERAPIST / ADMIN
# ============================================================

@router.post("/suggest")
async def suggest_price(
    massage_type_id: int = Query(..., gt=0),
    duration: int = Query(..., gt=0, le=480),
    distance: float = Query(..., ge=0, le=500),
    user_id: int | None = Query(
        None,
        gt=0,
        description=(
            "Identifiant facultatif. "
            "Un utilisateur non-admin ne peut demander "
            "que son propre historique."
        ),
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Suggère un prix dynamique.

    CLIENT :
      - peut utiliser son propre historique uniquement.

    THERAPIST :
      - peut obtenir une suggestion de prix ;
      - ne peut pas consulter l'historique privé d'un client.

    ADMIN :
      - peut demander une suggestion avec un user_id explicite.
    """

    role = _get_role(current_user)

    if (
        user_id is not None
        and not _same_id(user_id, current_user.id)
        and role != "ADMIN"
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Vous ne pouvez pas consulter l'historique "
                "d'un autre utilisateur."
            ),
        )

    massage_type = _get_massage_type(
        db=db,
        massage_type_id=massage_type_id,
    )

    # Seul l'historique du client lui-même est utilisé.
    history_user_id = None

    if role == "CLIENT":
        history_user_id = current_user.id

    elif role == "ADMIN" and user_id is not None:
        history_user_id = user_id

    user_history = []

    if history_user_id is not None:
        bookings = (
            db.query(Booking)
            .filter(
                Booking.client_id == history_user_id,
                Booking.status == "completed",
            )
            .order_by(Booking.created_at.desc())
            .limit(10)
            .all()
        )

        user_history = [
            price
            for booking in bookings
            if (price := _get_valid_price(booking)) is not None
        ]

    base_price = float(massage_type.min_price or 30000)

    try:
        result = calculate_dynamic_price(
            base_price=base_price,
            duration=duration,
            distance=distance,
            user_history=user_history,
            demand_factor=1.0,
        )
    except Exception as exc:
        logger.exception("Erreur lors de la suggestion de prix.")

        raise HTTPException(
            status_code=500,
            detail="Impossible de calculer une suggestion de prix.",
        ) from exc

    return {
        "status": "success",
        "massage_type_id": massage_type.id,
        "massage_type": getattr(massage_type, "name", None),
        "duration": duration,
        "distance": distance,
        "suggested_price": float(result["price"]),
        "min_price": float(result["min_price"]),
        "max_price": float(result["max_price"]),
        "confidence": float(result["confidence"]),
        "factors": result.get("factors", {}),
    }


# ============================================================
# 2. CALCUL DU PRIX
# CLIENT / THERAPIST / ADMIN
# ============================================================

@router.post("/calculate")
async def calculate_price(
    massage_type: str = Query(..., min_length=1, max_length=100),
    duration: int = Query(..., gt=0, le=480),
    distance: float = Query(..., ge=0, le=500),
    demand_level: str = Query("medium"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Calcule le prix selon la durée, la distance et la demande.

    Les ajustements sont calculés successivement afin que
    le détail du calcul corresponde au prix final.
    """

    demand_level = demand_level.strip().lower()

    demand_factors = {
        "low": 0.9,
        "medium": 1.0,
        "high": 1.2,
    }

    if demand_level not in demand_factors:
        raise HTTPException(
            status_code=400,
            detail="demand_level doit être low, medium ou high.",
        )

    massage_name = massage_type.strip()

    massage = (
        db.query(MassageType)
        .filter(MassageType.name.ilike(massage_name))
        .first()
    )

    if massage is None:
        raise HTTPException(
            status_code=404,
            detail="Type de massage introuvable.",
        )

    base_price = float(massage.min_price or 30000)

    # Limite la réduction excessive pour les durées courtes.
    duration_factor = max(
        0.5,
        1.0 + (duration - 60) * 0.005,
    )

    distance_factor = 1.0 + (distance / 10.0) * 0.1
    demand_factor = demand_factors[demand_level]

    # Calcul séquentiel : chaque ajustement s'applique au
    # montant obtenu à l'étape précédente.
    duration_price = base_price * duration_factor
    duration_adjustment = duration_price - base_price

    distance_price = duration_price * distance_factor
    distance_adjustment = distance_price - duration_price

    final_unrounded = distance_price * demand_factor
    demand_adjustment = final_unrounded - distance_price

    final_price = round(final_unrounded)

    return {
        "status": "success",
        "massage_type": massage.name,
        "duration": duration,
        "distance": distance,
        "demand_level": demand_level,
        "base_price": round(base_price, 2),
        "final_price": final_price,
        "currency": "MGA",
        "duration_factor": round(duration_factor, 4),
        "distance_factor": round(distance_factor, 4),
        "demand_factor": round(demand_factor, 4),
        "breakdown": {
            "base": round(base_price, 2),
            "duration_adjustment": round(duration_adjustment, 2),
            "distance_adjustment": round(distance_adjustment, 2),
            "demand_adjustment": round(demand_adjustment, 2),
            "total_before_rounding": round(final_unrounded, 2),
        },
    }


# ============================================================
# 3. ANALYSE DU MARCHE
# THERAPIST / ADMIN UNIQUEMENT
# ============================================================

@router.get("/market-analysis")
async def get_market_analysis(
    massage_type_id: int | None = Query(None, gt=0),
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db),
):
    """
    Analyse agrégée des prix des réservations terminées.

    Accessible aux thérapeutes et administrateurs.
    Les données individuelles des clients ne sont pas retournées.
    """

    query = db.query(Booking).filter(
        Booking.status == "completed"
    )

    if massage_type_id is not None:
        # Vérifier que le type de massage existe.
        _get_massage_type(db, massage_type_id)

        query = query.filter(
            Booking.massage_type_id == massage_type_id
        )

    bookings = query.all()

    prices = [
        price
        for booking in bookings
        if (price := _get_valid_price(booking)) is not None
    ]

    if not prices:
        return {
            "status": "success",
            "massage_type_id": massage_type_id,
            "average_price": 0,
            "min_price": 0,
            "max_price": 0,
            "total_bookings": 0,
            "price_distribution": [],
            "currency": "MGA",
        }

    minimum = min(prices)
    maximum = max(prices)

    # Cinq tranches de prix, sans perdre le prix maximum.
    if maximum == minimum:
        distribution = [
            {
                "range": f"{int(minimum)} - {int(maximum)}",
                "count": len(prices),
            }
        ]
    else:
        step = (maximum - minimum) / 5
        distribution = []

        for index in range(5):
            low = minimum + index * step

            high = (
                maximum
                if index == 4
                else minimum + (index + 1) * step
            )

            if index == 4:
                count = sum(
                    1 for price in prices
                    if low <= price <= high
                )
            else:
                count = sum(
                    1 for price in prices
                    if low <= price < high
                )

            distribution.append(
                {
                    "range": f"{int(low)} - {int(high)}",
                    "count": count,
                }
            )

    return {
        "status": "success",
        "massage_type_id": massage_type_id,
        "average_price": round(sum(prices) / len(prices), 2),
        "min_price": minimum,
        "max_price": maximum,
        "total_bookings": len(prices),
        "price_distribution": distribution,
        "currency": "MGA",
    }
