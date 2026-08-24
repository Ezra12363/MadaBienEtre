from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.review import Review
from ..models.booking import Booking
from ..models.user import User
from ..schemas.review import ReviewCreate, ReviewResponse, ReviewUpdate
from ..services.rating_service import update_therapist_rating
from ..services.notification_service import send_notification

router = APIRouter(prefix="/reviews", tags=["Reviews"])

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_review(
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Créer un avis"""
    if current_user.role != "CLIENT":
        raise HTTPException(status_code=403, detail="Only clients can leave reviews")
    
    booking = db.query(Booking).filter(Booking.id == review_data.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if booking.status != "completed":
        raise HTTPException(status_code=400, detail="Booking not completed yet")
    
    # Vérifier si un avis existe déjà
    existing_review = db.query(Review).filter(Review.booking_id == review_data.booking_id).first()
    if existing_review:
        raise HTTPException(status_code=400, detail="Review already exists for this booking")
    
    # Créer l'avis
    review = Review(
        booking_id=review_data.booking_id,
        reviewer_id=current_user.id,
        therapist_id=booking.therapist_id,
        rating=review_data.rating,
        comment=review_data.comment,
        is_anonymous=review_data.is_anonymous
    )
    
    db.add(review)
    db.commit()
    db.refresh(review)
    
    # Mettre à jour la note du thérapeute
    update_therapist_rating(booking.therapist_id, db)
    
    # Notifier le thérapeute
    if booking.therapist_id:
        send_notification(
            booking.therapist_id,
            "Nouvel avis reçu",
            f"Vous avez reçu une note de {review_data.rating} étoiles",
            "new_review",
            {"review_id": review.id, "booking_id": booking.id}
        )
    
    return review

@router.get("/", response_model=list[ReviewResponse])
async def get_reviews(
    therapist_id: int = None,
    rating: int = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Liste des avis"""
    query = db.query(Review)
    
    if therapist_id:
        query = query.filter(Review.therapist_id == therapist_id)
    if rating:
        query = query.filter(Review.rating == rating)
    
    return query.order_by(Review.created_at.desc()).limit(limit).all()

@router.get("/{review_id}")
async def get_review(
    review_id: int,
    db: Session = Depends(get_db)
):
    """Détails d'un avis"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return review

@router.delete("/{review_id}")
async def delete_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Supprimer un avis"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if current_user.id != review.reviewer_id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(review)
    db.commit()
    
    # Mettre à jour la note du thérapeute
    if review.therapist_id:
        update_therapist_rating(review.therapist_id, db)
    
    return {"message": "Review deleted"}

@router.put("/{review_id}/respond")
async def respond_to_review(
    review_id: int,
    response: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Répondre à un avis (thérapeute)"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if current_user.id != review.therapist_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    review.response_from_therapist = response
    db.commit()
    
    # Notifier le client
    send_notification(
        review.reviewer_id,
        "Réponse à votre avis",
        f"{current_user.fullname} a répondu à votre avis",
        "review_response",
        {"review_id": review.id}
    )
    
    return {"message": "Response added"}

@router.get("/therapist/{therapist_id}/stats")
async def get_therapist_stats(
    therapist_id: int,
    db: Session = Depends(get_db)
):
    """Statistiques des avis d'un thérapeute"""
    stats = db.query(
        func.count(Review.id).label("total"),
        func.avg(Review.rating).label("average"),
        func.count(Review.rating).label("count")
    ).filter(Review.therapist_id == therapist_id).first()
    
    # Distribution des notes
    distribution = {}
    for i in range(1, 6):
        count = db.query(Review).filter(
            Review.therapist_id == therapist_id,
            Review.rating == i
        ).count()
        distribution[i] = count
    
    return {
        "total_reviews": stats.total or 0,
        "average_rating": float(stats.average) if stats.average else 0,
        "distribution": distribution
    }