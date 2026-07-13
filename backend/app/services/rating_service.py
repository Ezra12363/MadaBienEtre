from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models.review import Review
from ..models.user import User
from typing import Optional

def update_therapist_rating(therapist_id: int, db: Session) -> None:
    """Mettre à jour la note moyenne d'un thérapeute"""
    # Calculer la moyenne des notes
    stats = db.query(
        func.avg(Review.rating).label('avg_rating'),
        func.count(Review.id).label('total_reviews')
    ).filter(
        Review.therapist_id == therapist_id
    ).first()
    
    # Mettre à jour l'utilisateur
    therapist = db.query(User).filter(User.id == therapist_id).first()
    if therapist:
        therapist.rating = stats.avg_rating or 0.0
        therapist.total_reviews = stats.total_reviews or 0
        db.commit()

def get_therapist_rating_stats(therapist_id: int, db: Session) -> dict:
    """Obtenir les statistiques de notation d'un thérapeute"""
    # Note moyenne
    avg_rating = db.query(func.avg(Review.rating)).filter(
        Review.therapist_id == therapist_id
    ).scalar() or 0
    
    # Nombre total d'avis
    total_reviews = db.query(func.count(Review.id)).filter(
        Review.therapist_id == therapist_id
    ).scalar() or 0
    
    # Distribution des notes
    distribution = {}
    for i in range(1, 6):
        count = db.query(func.count(Review.id)).filter(
            Review.therapist_id == therapist_id,
            Review.rating == i
        ).scalar() or 0
        distribution[i] = count
    
    # Pourcentage par note
    percentages = {}
    if total_reviews > 0:
        for i in range(1, 6):
            percentages[i] = round((distribution[i] / total_reviews) * 100, 1)
    
    return {
        "average_rating": float(avg_rating),
        "total_reviews": total_reviews,
        "distribution": distribution,
        "percentages": percentages,
        "rating_stars": "⭐" * round(avg_rating)
    }

def update_therapist_rating_after_review(
    therapist_id: int,
    db: Session,
    old_rating: Optional[int] = None,
    new_rating: Optional[int] = None
) -> None:
    """Mettre à jour la note après ajout/modification d'un avis"""
    # Recalculer la moyenne
    avg_rating = db.query(func.avg(Review.rating)).filter(
        Review.therapist_id == therapist_id
    ).scalar() or 0
    
    # Mettre à jour le thérapeute
    therapist = db.query(User).filter(User.id == therapist_id).first()
    if therapist:
        therapist.rating = avg_rating
        therapist.total_reviews = db.query(func.count(Review.id)).filter(
            Review.therapist_id == therapist_id
        ).scalar() or 0
        db.commit()

def get_rating_summary(therapist_id: int, db: Session) -> dict:
    """Obtenir un résumé des notes d'un thérapeute"""
    stats = get_therapist_rating_stats(therapist_id, db)
    
    # Avis récents
    recent_reviews = db.query(Review).filter(
        Review.therapist_id == therapist_id
    ).order_by(Review.created_at.desc()).limit(5).all()
    
    return {
        "summary": stats,
        "recent_reviews": [
            {
                "id": r.id,
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at,
                "reviewer_name": r.reviewer.fullname if not r.is_anonymous else "Anonyme"
            }
            for r in recent_reviews
        ]
    }