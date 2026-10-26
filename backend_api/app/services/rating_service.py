# app/services/rating_service.py
"""
Calcul des notes des thérapeutes (note moyenne, nombre d'avis, répartition).

RÈGLE IMPORTANTE : les avis MASQUÉS par l'admin (is_hidden = True) ne sont
jamais comptés dans la note moyenne ni dans le nombre d'avis.
"""
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.review import Review
from ..models.user import User
from ..models.therapist import TherapistRating


def _visible(query):
    """Filtre : uniquement les avis non masqués."""
    return query.filter(Review.is_hidden == False)  # noqa: E712


def get_therapist_rating_stats(therapist_id: int, db: Session) -> dict:
    """Statistiques complètes de notation d'un thérapeute (avis visibles)."""
    base = _visible(db.query(Review).filter(Review.therapist_id == therapist_id))

    total_reviews = base.count()
    avg_rating = (
        _visible(
            db.query(func.avg(Review.rating)).filter(Review.therapist_id == therapist_id)
        ).scalar()
        or 0
    )

    # Répartition 1..5
    distribution = {i: 0 for i in range(1, 6)}
    rows = (
        _visible(
            db.query(Review.rating, func.count(Review.id)).filter(
                Review.therapist_id == therapist_id
            )
        )
        .group_by(Review.rating)
        .all()
    )
    for rating, count in rows:
        if rating in distribution:
            distribution[int(rating)] = int(count)

    percentages = {
        i: (round((distribution[i] / total_reviews) * 100, 1) if total_reviews else 0)
        for i in range(1, 6)
    }

    # Moyennes par critère (professionnalisme, qualité, ponctualité, propreté)
    categories = {}
    for field in ("professionalism", "quality", "punctuality", "cleanliness"):
        col = getattr(Review, field)
        value = (
            _visible(
                db.query(func.avg(col)).filter(
                    Review.therapist_id == therapist_id, col.isnot(None)
                )
            ).scalar()
        )
        categories[field] = round(float(value), 2) if value is not None else None

    # 30 derniers jours
    since = datetime.utcnow() - timedelta(days=30)
    last = (
        _visible(
            db.query(func.avg(Review.rating), func.count(Review.id)).filter(
                Review.therapist_id == therapist_id, Review.created_at >= since
            )
        ).first()
    )
    last_month_rating = round(float(last[0]), 2) if last and last[0] is not None else 0.0
    last_month_reviews = int(last[1] or 0) if last else 0

    with_comment = base.filter(
        Review.comment.isnot(None), func.length(func.trim(Review.comment)) > 0
    ).count()
    unanswered = base.filter(
        Review.comment.isnot(None),
        func.length(func.trim(Review.comment)) > 0,
        (Review.response_from_therapist.is_(None))
        | (func.length(func.trim(Review.response_from_therapist)) == 0),
    ).count()

    avg = round(float(avg_rating), 2)
    return {
        "therapist_id": therapist_id,
        "average_rating": avg,
        "total_reviews": total_reviews,
        "distribution": distribution,
        "percentages": percentages,
        "categories": categories,
        "last_month_rating": last_month_rating,
        "last_month_reviews": last_month_reviews,
        "with_comment": with_comment,
        "unanswered": unanswered,
        "rating_stars": "⭐" * int(round(avg)),
    }


def update_therapist_rating(therapist_id: int, db: Session) -> None:
    """
    Recalcule et enregistre la note moyenne d'un thérapeute :
    - users.rating / users.total_reviews (utilisés partout dans l'application)
    - therapist_ratings (agrégat détaillé pour l'admin)
    """
    if not therapist_id:
        return

    stats = get_therapist_rating_stats(therapist_id, db)

    therapist = db.query(User).filter(User.id == therapist_id).first()
    if therapist:
        therapist.rating = round(stats["average_rating"], 2)
        therapist.total_reviews = stats["total_reviews"]

    agg = (
        db.query(TherapistRating)
        .filter(TherapistRating.therapist_id == therapist_id)
        .first()
    )
    if agg is None:
        agg = TherapistRating(therapist_id=therapist_id)
        db.add(agg)

    agg.average_rating = round(stats["average_rating"], 2)
    agg.total_reviews = stats["total_reviews"]
    agg.rating_1_count = stats["distribution"][1]
    agg.rating_2_count = stats["distribution"][2]
    agg.rating_3_count = stats["distribution"][3]
    agg.rating_4_count = stats["distribution"][4]
    agg.rating_5_count = stats["distribution"][5]
    agg.last_month_rating = stats["last_month_rating"]
    agg.last_month_reviews = stats["last_month_reviews"]

    db.commit()


def update_therapist_rating_after_review(
    therapist_id: int,
    db: Session,
    old_rating: Optional[int] = None,
    new_rating: Optional[int] = None,
) -> None:
    """Alias conservé pour compatibilité : recalcul complet."""
    update_therapist_rating(therapist_id, db)


def get_rating_summary(therapist_id: int, db: Session) -> dict:
    """Résumé : statistiques + 5 derniers avis visibles."""
    stats = get_therapist_rating_stats(therapist_id, db)

    recent_reviews = (
        _visible(db.query(Review).filter(Review.therapist_id == therapist_id))
        .order_by(Review.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "summary": stats,
        "recent_reviews": [
            {
                "id": r.id,
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at,
                "reviewer_name": (
                    "Client anonyme"
                    if r.is_anonymous
                    else (r.reviewer.fullname if r.reviewer else "Client")
                ),
            }
            for r in recent_reviews
        ],
    }
