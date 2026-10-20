
# app/api/ai.py
# MADA BIEN-ÊTRE — AI API
# Sécurité des accès : CLIENT / THERAPIST / ADMIN

import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_user, get_current_admin
from ..models.user import User
from ..models.booking import Booking

from ..schemas.ai import (
    AIRecommendationRequest,
    AIRecommendationResponse,
    AIPricingRequest,
    AIPricingResponse,
    ChatbotRequest,
    ChatbotResponse,
    AIFraudDetectionRequest,
)

from ..services.ai.recommendation_service import recommend_therapists
from ..services.ai.pricing_service import predict_price
from ..services.ai.fraud_detection import detect_fraud
from ..services.ai.prediction import (
    predict_acceptance_probability,
    predict_revenue,
)
from ..services.ai.chatbot_service import get_chatbot_response


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])


# ============================================================
# 1. HELPERS DE SECURITE
# ============================================================

def _get_role(user: User) -> str:
    """
    Normalise les rôles.
    Fonctionne avec une chaîne ou un Enum Python.
    Exemples : ADMIN, CLIENT, THERAPIST, Role.ADMIN.
    """
    role = getattr(user, "role", "")

    if hasattr(role, "value"):
        role = role.value

    return str(role).strip().upper().split(".")[-1]


def _is_admin(user: User) -> bool:
    """Vérifie le rôle administrateur."""
    role = _get_role(user)
    return role == "ADMIN" or role.endswith("_ADMIN")


def _same_id(first_id, second_id) -> bool:
    """Compare les identifiants int/string sans accepter None."""
    if first_id is None or second_id is None:
        return False

    try:
        return int(first_id) == int(second_id)
    except (TypeError, ValueError):
        return str(first_id).strip() == str(second_id).strip()


def _require_booking_access(
    user: User,
    booking: Booking,
    db: Optional[Session] = None,
) -> None:
    """
    Autorise :
    - le client propriétaire ;
    - le thérapeute assigné ;
    - un thérapeute qui NÉGOCIE : il a déjà une offre sur cette réservation,
      ou la réservation est encore ouverte (pending / negotiating, sans
      thérapeute assigné) ;
    - l'administrateur.

    ✅ FIX 403 « vous ne participez pas à cette réservation » : pendant la
    négociation, le thérapeute n'est pas encore `booking.therapist_id`, donc
    l'estimation de probabilité d'acceptation (/ai/predict-acceptance) lui
    était refusée.
    """
    if _is_admin(user):
        return

    is_client = _same_id(user.id, booking.client_id)

    is_therapist = _same_id(
        user.id,
        getattr(booking, "therapist_id", None),
    )

    if is_client or is_therapist:
        return

    if _get_role(user) == "THERAPIST":
        status = str(getattr(booking, "status", "") or "").lower()
        unassigned = getattr(booking, "therapist_id", None) is None

        if unassigned and status in ("pending", "negotiating"):
            return

        if db is not None:
            try:
                from ..models.offer import Offer

                has_offer = (
                    db.query(Offer.id)
                    .filter(
                        Offer.booking_id == booking.id,
                        Offer.therapist_id == user.id,
                    )
                    .first()
                    is not None
                )
                if has_offer:
                    return
            except Exception:
                logger.exception("Vérification de l'offre du thérapeute impossible")

    logger.warning(
        "Accès réservation refusé : user_id=%s, role=%s, "
        "booking_id=%s, client_id=%s, therapist_id=%s",
        getattr(user, "id", None),
        _get_role(user),
        getattr(booking, "id", None),
        getattr(booking, "client_id", None),
        getattr(booking, "therapist_id", None),
    )

    raise HTTPException(
        status_code=403,
        detail="Accès refusé : vous ne participez pas à cette réservation.",
    )


# ============================================================
# 2. RECOMMANDATION DE THERAPEUTES
# Accessible au propriétaire des données ou à l'admin
# ============================================================

@router.post(
    "/recommend-therapist",
    response_model=List[AIRecommendationResponse],
)
async def recommend_therapist(
    request: AIRecommendationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Recommande des thérapeutes adaptés au besoin du client."""

    if (
        not _same_id(current_user.id, request.user_id)
        and not _is_admin(current_user)
    ):
        raise HTTPException(
            status_code=403,
            detail="Vous ne pouvez pas demander des recommandations "
                   "pour un autre utilisateur.",
        )

    recommendations = await recommend_therapists(
        user_id=request.user_id,
        massage_type=request.massage_type,
        budget_max=request.budget_max,
        distance_max=request.distance_max,
        preferred_gender=request.preferred_gender,
        symptoms=request.symptoms,
        db=db,
    )

    # L'échec de l'historique ne doit pas bloquer la recommandation.
    if recommendations:
        try:
            from ..models.ai_prediction import AIPrediction

            first = recommendations[0]

            db.add(
                AIPrediction(
                    booking_id=None,
                    user_id=request.user_id,
                    prediction_type="therapist_recommendation",
                    predicted_price=first.get("price_suggested"),
                    recommended_therapist_id=first.get("therapist_id"),
                    confidence_score=85.0,
                    model_version="1.0",
                    model_used="rule_based",
                    factors={
                        "massage_type": request.massage_type,
                        "budget_max": request.budget_max,
                        "symptoms": request.symptoms,
                    },
                )
            )
            db.commit()

        except Exception:
            db.rollback()
            logger.exception(
                "Impossible d'enregistrer la prédiction de recommandation."
            )

    return recommendations


# ============================================================
# 3. PREDICTION DU PRIX
# Accessible à tout utilisateur authentifié
# ============================================================

@router.post(
    "/predict-price",
    response_model=AIPricingResponse,
)
async def predict_price_endpoint(
    request: AIPricingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Calcule une estimation de prix par IA."""

    return await predict_price(
        massage_type=request.massage_type,
        duration=request.duration,
        distance=request.distance,
        demand_level=request.demand_level,
        db=db,
    )


# ============================================================
# 4. PREDICTION DE PROBABILITE D'ACCEPTATION
# Accessible aux participants de la réservation ou à l'admin
# ============================================================

@router.post("/predict-acceptance")
async def predict_acceptance(
    booking_id: int = Query(..., gt=0),
    price: float = Query(..., gt=0),
    reference_price: Optional[float] = Query(
        None,
        gt=0,
        description=(
            "Offre actuelle de l'autre partie (celle qui doit accepter). "
            "Par défaut : prix initial proposé par le client."
        ),
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Estime la probabilité d'acceptation d'un prix proposé.
    L'utilisateur doit participer à la réservation.
    """

    booking = (
        db.query(Booking)
        .filter(Booking.id == booking_id)
        .first()
    )

    if booking is None:
        raise HTTPException(
            status_code=404,
            detail="Réservation introuvable.",
        )

    _require_booking_access(current_user, booking, db)

    try:
        probability = await predict_acceptance_probability(
            booking=booking,
            proposed_price=price,
            db=db,
            reference_price=reference_price,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "Erreur de prédiction d'acceptation pour booking_id=%s",
            booking_id,
        )
        raise HTTPException(
            status_code=500,
            detail="La prédiction d'acceptation a échoué.",
        ) from exc

    return {
        "status": "success",
        "booking_id": booking_id,
        "price": price,
        "reference_price": reference_price,
        "probability": probability,
    }


# ============================================================
# 5. CHATBOT IA
# Accessible à tout utilisateur authentifié
# ============================================================

@router.post("/chat", response_model=ChatbotResponse)
async def ai_chat(
    request: ChatbotRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Chatbot IA pour les clients, thérapeutes et administrateurs."""

    # L'identité vient du token et non du user_id fourni par le client.
    return await get_chatbot_response(
        message=request.message,
        user_id=current_user.id,
        conversation_id=request.conversation_id,
        db=db,
    )


# ============================================================
# 6. DETECTION DE FRAUDE
# ADMIN UNIQUEMENT
# ============================================================

@router.post("/fraud-detection")
async def fraud_detection(
    request: AIFraudDetectionRequest,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Détection de fraude réservée à l'administration."""

    booking = (
        db.query(Booking)
        .filter(Booking.id == request.booking_id)
        .first()
    )

    if booking is None:
        raise HTTPException(
            status_code=404,
            detail="Réservation introuvable.",
        )

    return await detect_fraud(
        booking=booking,
        db=db,
    )


# ============================================================
# 7. SERVICES POPULAIRES
# Accessible à tout utilisateur authentifié
# ============================================================

@router.get("/popular-services")
async def get_popular_services(
    period: str = Query("month"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retourne les services les plus populaires."""

    periods = {
        "day": 1,
        "week": 7,
        "month": 30,
    }

    if period not in periods:
        raise HTTPException(
            status_code=400,
            detail="Période invalide. Utilisez day, week ou month.",
        )

    start_date = datetime.utcnow() - timedelta(
        days=periods[period]
    )

    results = (
        db.query(
            Booking.massage_type_id,
            func.count(Booking.id).label("count"),
        )
        .filter(
            Booking.created_at >= start_date,
            Booking.status == "completed",
        )
        .group_by(Booking.massage_type_id)
        .order_by(func.count(Booking.id).desc())
        .limit(5)
        .all()
    )

    return [
        {
            "massage_type_id": row[0],
            "bookings_count": row[1],
        }
        for row in results
    ]


# ============================================================
# 8. MEILLEURS THERAPEUTES
# Accessible à tout utilisateur authentifié
# ============================================================

@router.get("/best-therapists")
async def get_best_therapists(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retourne les thérapeutes approuvés les mieux notés."""

    therapists = (
        db.query(User)
        .filter(
            User.role == "THERAPIST",
            User.verification_status == "approved",
            User.is_active.is_(True),
            User.total_reviews > 0,
        )
        .order_by(User.rating.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": therapist.id,
            "fullname": therapist.fullname,
            "rating": float(therapist.rating or 0),
            "total_reviews": therapist.total_reviews,
            "experience_years": therapist.experience_years,
            "base_price": (
                float(therapist.base_price)
                if therapist.base_price
                else 0
            ),
            "profile_image": therapist.profile_image,
        }
        for therapist in therapists
    ]


# ============================================================
# 9. PREDICTION DES REVENUS
# ADMIN UNIQUEMENT
# ============================================================

@router.get("/revenue-prediction")
async def revenue_prediction(
    therapist_id: Optional[int] = Query(None, gt=0),
    days_ahead: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Prédiction financière réservée à l'administration."""

    if therapist_id is not None:
        return await predict_revenue(
            therapist_id=therapist_id,
            days_ahead=days_ahead,
            db=db,
        )

    six_months_ago = datetime.utcnow() - timedelta(days=180)

    monthly_revenue = (
        db.query(
            func.date_trunc(
                "month",
                Booking.actual_end_time,
            ).label("month"),
            func.sum(Booking.final_price).label("revenue"),
        )
        .filter(
            Booking.status == "completed",
            Booking.actual_end_time >= six_months_ago,
        )
        .group_by("month")
        .order_by("month")
        .all()
    )

    revenues = [
        float(row[1] or 0)
        for row in monthly_revenue
    ]

    if len(revenues) >= 3:
        average_growth = sum(
            revenues[index] - revenues[index - 1]
            for index in range(1, len(revenues))
        ) / (len(revenues) - 1)

        next_month = max(0.0, revenues[-1] + average_growth)
    else:
        next_month = revenues[-1] if revenues else 0.0

    return {
        "monthly_data": [
            {
                "month": str(row[0]),
                "revenue": float(row[1] or 0),
            }
            for row in monthly_revenue
        ],
        "predicted_next_month": next_month,
        "total_6_months": sum(revenues),
        "average_monthly": (
            sum(revenues) / len(revenues)
            if revenues
            else 0.0
        ),
    }


# ============================================================
# 10. INSIGHTS IA
# ADMIN UNIQUEMENT
# ============================================================

@router.get("/insights")
async def get_ai_insights(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Statistiques globales réservées à l'administration."""

    since = datetime.utcnow() - timedelta(days=30)

    recent_bookings = (
        db.query(Booking)
        .filter(Booking.created_at >= since)
        .count()
    )

    completed = (
        db.query(Booking)
        .filter(
            Booking.status == "completed",
            Booking.created_at >= since,
        )
        .count()
    )

    completion_rate = (
        completed / recent_bookings * 100
        if recent_bookings
        else 0
    )

    revenue = (
        db.query(func.sum(Booking.final_price))
        .filter(
            Booking.status == "completed",
            Booking.created_at >= since,
        )
        .scalar()
        or 0
    )

    revenue = float(revenue)

    return {
        "period": "30_days",
        "total_bookings": recent_bookings,
        "completion_rate": round(completion_rate, 2),
        "total_revenue": revenue,
        "average_booking_value": (
            revenue / recent_bookings
            if recent_bookings
            else 0
        ),
    }
