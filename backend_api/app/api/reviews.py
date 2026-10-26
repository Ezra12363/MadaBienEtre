# app/api/reviews.py
# ============================================================
# AVIS ET ÉVALUATIONS — Mada Bien-Être
#
# CLIENT
#   POST   /reviews                      donner une note + commentaire (après séance terminée)
#   GET    /reviews/pending              séances terminées pas encore évaluées
#   GET    /reviews/mine                 historique de mes avis
#   GET    /reviews/booking/{id}         avis d'une réservation (+ can_review)
#   PUT    /reviews/{id}                 modifier mon avis (fenêtre de 7 jours)
#   DELETE /reviews/{id}                 supprimer mon avis
# THÉRAPEUTE
#   GET    /reviews/received             avis reçus (mes avis)
#   PUT    /reviews/{id}/respond         répondre à un commentaire
#   DELETE /reviews/{id}/respond         retirer ma réponse
# PUBLIC / TOUS
#   GET    /reviews                      liste + tri + filtres (note, texte)
#   GET    /reviews/therapist/{id}/stats note moyenne, répartition, critères
#   GET    /reviews/{id}                 détail
#   POST   /reviews/{id}/report          signaler un avis
# ADMIN
#   GET    /reviews/admin/summary        suivi des notes par thérapeute
#   GET    /reviews/admin/reports        avis signalés
#   PUT    /reviews/admin/reports/{id}   traiter un signalement
#   PUT    /reviews/{id}/moderate        masquer / rétablir (avec motif)
# ============================================================
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, aliased

from ..core.database import get_db
from ..core.dependencies import (
    _get_role,
    _is_admin_role,
    get_current_admin,
    get_current_user,
    get_current_user_optional,
)
from ..models.booking import Booking
from ..models.review import Review, ReviewHelpful, ReviewReport
from ..models.user import User
from ..schemas.review import (
    ReportResolveRequest,
    ReviewCreate,
    ReviewModerationRequest,
    ReviewReportRequest,
    ReviewResponseRequest,
    ReviewUpdate,
)
from ..services.mg_time import iso_utc
from ..services.notification_service import send_admin_notification, send_notification
from ..services.rating_service import (
    get_therapist_rating_stats,
    update_therapist_rating,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reviews", tags=["Reviews"])

# Un client peut modifier son avis pendant ce délai après l'avoir publié.
REVIEW_EDIT_WINDOW_DAYS = 7

REPORT_REASON_LABELS = {
    "inappropriate": "Contenu inapproprié",
    "fake": "Faux avis",
    "offensive": "Propos offensants",
    "spam": "Spam",
    "other": "Autre motif",
}


# ============================================================
# HELPERS
# ============================================================

def _is_admin(user: Optional[User]) -> bool:
    return bool(user) and _is_admin_role(user)


def _is_client(user: Optional[User]) -> bool:
    return bool(user) and _get_role(user) == "CLIENT"


def _public_name(fullname: Optional[str]) -> str:
    """« Jean Rakoto » -> « Jean R. » (confidentialité côté public)."""
    parts = (fullname or "").strip().split()
    if not parts:
        return "Client"
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0].upper()}."


def _clean_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _clean_tags(tags: Optional[List[str]]) -> Optional[str]:
    if not tags:
        return None
    cleaned = []
    for tag in tags[:10]:
        t = str(tag).strip()[:40]
        if t and t not in cleaned:
            cleaned.append(t)
    return json.dumps(cleaned, ensure_ascii=False) if cleaned else None


def _read_tags(review: Review) -> List[str]:
    try:
        value = json.loads(review.tags) if review.tags else []
        return value if isinstance(value, list) else []
    except (TypeError, ValueError):
        return []


def _dump(model, **kwargs) -> Dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump(**kwargs)
    return model.dict(**kwargs)


def _notify(user_id: Optional[int], title: str, body: str, ntype: str, data: dict) -> None:
    """Notification qui ne fait JAMAIS échouer l'action principale."""
    if not user_id:
        return
    try:
        send_notification(user_id, title, body, ntype, data)
    except Exception:  # noqa: BLE001
        logger.exception("Notification avis impossible (type=%s)", ntype)


def _notify_admins(title: str, body: str, ntype: str, data: dict) -> None:
    try:
        send_admin_notification(title, body, ntype, data)
    except Exception:  # noqa: BLE001
        logger.exception("Notification admin avis impossible (type=%s)", ntype)


def _within_edit_window(review: Review) -> bool:
    if not review.created_at:
        return True
    return datetime.utcnow() - review.created_at <= timedelta(days=REVIEW_EDIT_WINDOW_DAYS)


def _report_maps(db: Session, reviews: List[Review], viewer: Optional[User]):
    """Pré-calcule (nb signalements en attente, signalés par moi) pour une liste."""
    ids = [r.id for r in reviews]
    pending: Dict[int, int] = {}
    mine: set = set()
    if not ids:
        return pending, mine

    if _is_admin(viewer):
        rows = (
            db.query(ReviewReport.review_id, func.count(ReviewReport.id))
            .filter(ReviewReport.review_id.in_(ids), ReviewReport.status == "pending")
            .group_by(ReviewReport.review_id)
            .all()
        )
        pending = {rid: int(c) for rid, c in rows}

    if viewer:
        rows = (
            db.query(ReviewReport.review_id)
            .filter(ReviewReport.review_id.in_(ids), ReviewReport.reporter_id == viewer.id)
            .all()
        )
        mine = {rid for (rid,) in rows}
    return pending, mine


def _serialize_many(db: Session, reviews: List[Review], viewer: Optional[User]) -> List[Dict[str, Any]]:
    pending, mine = _report_maps(db, reviews, viewer)
    return [_serialize(r, viewer, pending.get(r.id, 0), r.id in mine) for r in reviews]


def _serialize(
    review: Review,
    viewer: Optional[User],
    pending_reports: int = 0,
    already_reported: bool = False,
) -> Dict[str, Any]:
    is_admin = _is_admin(viewer)
    is_owner = bool(viewer) and viewer.id == review.reviewer_id
    is_target = bool(viewer) and viewer.id == review.therapist_id

    reviewer = review.reviewer
    therapist = review.therapist
    booking = review.booking
    massage = getattr(booking, "massage_type", None) if booking else None

    # --- Identité de l'auteur ---------------------------------
    if is_admin:
        reviewer_name = (reviewer.fullname if reviewer else "Client") + (
            " (anonyme)" if review.is_anonymous else ""
        )
        reviewer_photo = getattr(reviewer, "profile_image", None) if reviewer else None
        reviewer_id = review.reviewer_id
    elif review.is_anonymous and not is_owner:
        reviewer_name = "Client anonyme"
        reviewer_photo = None
        reviewer_id = None
    elif is_owner:
        reviewer_name = (reviewer.fullname if reviewer else "Moi") + (
            " (anonyme)" if review.is_anonymous else ""
        )
        reviewer_photo = getattr(reviewer, "profile_image", None) if reviewer else None
        reviewer_id = review.reviewer_id
    else:
        reviewer_name = _public_name(reviewer.fullname if reviewer else None)
        reviewer_photo = getattr(reviewer, "profile_image", None) if reviewer else None
        reviewer_id = review.reviewer_id

    hidden = bool(review.is_hidden)
    has_response = bool((review.response_from_therapist or "").strip())

    data = {
        "id": review.id,
        "booking_id": review.booking_id,
        "reviewer_id": reviewer_id,
        "therapist_id": review.therapist_id,
        "rating": review.rating,
        "comment": review.comment,
        "is_anonymous": bool(review.is_anonymous),
        "professionalism": review.professionalism,
        "quality": review.quality,
        "punctuality": review.punctuality,
        "cleanliness": review.cleanliness,
        "tags": _read_tags(review),
        "response_from_therapist": review.response_from_therapist if has_response else None,
        "therapist_responded_at": iso_utc(review.therapist_responded_at),
        "created_at": iso_utc(review.created_at),
        "updated_at": iso_utc(review.updated_at),
        "edited_at": iso_utc(review.edited_at),
        "is_verified": bool(review.is_verified),
        "is_flagged": bool(review.is_flagged),
        "is_hidden": hidden,
        "reviewer_name": reviewer_name,
        "reviewer_photo": reviewer_photo,
        "therapist_name": therapist.fullname if therapist else None,
        "therapist_photo": getattr(therapist, "profile_image", None) if therapist else None,
        "massage_type_name": massage.name if massage else None,
        "booking_date": iso_utc(booking.scheduled_date) if booking else None,
        # Permissions calculées côté serveur : l'app n'a qu'à afficher les boutons
        "is_mine": is_owner,
        "can_edit": is_owner and not hidden and _within_edit_window(review),
        "can_delete": (is_owner and not hidden) or is_admin,
        "can_respond": is_target and not hidden,
        "can_report": bool(viewer) and not is_owner and not is_admin and not already_reported,
        "already_reported": already_reported,
        "edit_window_days": REVIEW_EDIT_WINDOW_DAYS,
    }

    # Infos de modération : visibles seulement par l'admin et l'auteur
    if is_admin or is_owner:
        data["hidden_reason"] = review.hidden_reason
        data["hidden_at"] = iso_utc(review.hidden_at)
    if is_admin:
        data["flag_reason"] = review.flag_reason
        data["pending_reports"] = pending_reports
    return data


def _get_review_or_404(db: Session, review_id: int) -> Review:
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Avis introuvable.")
    return review


def _delete_review_rows(db: Session, review: Review) -> None:
    """Supprime l'avis ET ses dépendances (signalements, votes) — évite l'erreur de clé étrangère."""
    db.query(ReviewReport).filter(ReviewReport.review_id == review.id).delete(synchronize_session=False)
    db.query(ReviewHelpful).filter(ReviewHelpful.review_id == review.id).delete(synchronize_session=False)
    db.delete(review)


def _resolve_pending_reports(db: Session, review_id: int, new_status: str, notes: Optional[str], admin: User) -> None:
    reports = (
        db.query(ReviewReport)
        .filter(ReviewReport.review_id == review_id, ReviewReport.status == "pending")
        .all()
    )
    for rep in reports:
        rep.status = new_status
        rep.reviewed_at = datetime.utcnow()
        if notes:
            rep.admin_notes = notes


def _apply_hide(db: Session, review: Review, admin: User, reason: str) -> None:
    review.is_hidden = True
    review.hidden_reason = reason
    review.hidden_at = datetime.utcnow()
    review.moderated_by = admin.id
    review.is_flagged = False
    _resolve_pending_reports(db, review.id, "action_taken", reason, admin)


# ============================================================
# 1) CRÉER UN AVIS (client, après séance terminée)
# ============================================================

@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_review(
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Créer un avis (réservé au client d'une séance TERMINÉE)."""
    if not _is_client(current_user):
        raise HTTPException(status_code=403, detail="Seuls les clients peuvent laisser un avis.")

    booking = db.query(Booking).filter(Booking.id == review_data.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Réservation introuvable.")
    if booking.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cette réservation ne vous appartient pas.")
    if booking.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="Vous pourrez donner votre avis une fois la séance terminée.",
        )
    if not booking.therapist_id:
        raise HTTPException(status_code=400, detail="Aucun thérapeute associé à cette réservation.")

    existing = db.query(Review).filter(Review.booking_id == booking.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Vous avez déjà donné votre avis pour cette séance.")

    review = Review(
        booking_id=booking.id,
        reviewer_id=current_user.id,
        therapist_id=booking.therapist_id,
        rating=review_data.rating,
        comment=_clean_text(review_data.comment),
        is_anonymous=review_data.is_anonymous,
        professionalism=review_data.professionalism,
        quality=review_data.quality,
        punctuality=review_data.punctuality,
        cleanliness=review_data.cleanliness,
        tags=_clean_tags(review_data.tags),
        is_verified=True,  # avis lié à une séance réellement terminée
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    update_therapist_rating(booking.therapist_id, db)

    author = "Un client anonyme" if review.is_anonymous else current_user.fullname
    _notify(
        booking.therapist_id,
        "Nouvel avis reçu",
        f"Vous avez reçu une note de {review.rating}/5.",
        "new_review",
        {"review_id": review.id, "booking_id": booking.id, "rating": review.rating},
    )
    _notify_admins(
        "Nouvel avis client",
        f"{author} a laissé une note de {review.rating}/5 (réservation #{booking.id}).",
        "new_review",
        {"review_id": review.id, "booking_id": booking.id, "rating": review.rating},
    )

    return _serialize(review, current_user)


# ============================================================
# 2) LISTES : publique / mes avis / reçus / à évaluer
# ============================================================

@router.get("")
@router.get("/", include_in_schema=False)
def list_reviews(
    therapist_id: Optional[int] = None,
    client_id: Optional[int] = None,
    rating: Optional[int] = Query(None, ge=1, le=5),
    sort: str = Query("recent", pattern="^(recent|old|best|worst)$"),
    q: Optional[str] = Query(None, max_length=100),
    with_comment: bool = False,
    flagged: Optional[bool] = None,
    visibility: str = Query("visible", pattern="^(visible|hidden|all)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Liste des avis avec tri et filtres.

    - Public : uniquement les avis visibles (non masqués).
    - Thérapeute sans filtre : ses propres avis uniquement.
    - Admin : tous les avis (visibility=hidden|all, flagged, recherche par client).
    """
    is_admin = _is_admin(current_user)

    # Un thérapeute ne parcourt pas les avis des autres : on cible les siens.
    if (
        current_user
        and _get_role(current_user) == "THERAPIST"
        and therapist_id is None
        and client_id is None
    ):
        therapist_id = current_user.id

    if client_id is not None and not is_admin and (not current_user or current_user.id != client_id):
        raise HTTPException(status_code=403, detail="Accès refusé.")

    Reviewer = aliased(User)
    Therapist = aliased(User)
    query = (
        db.query(Review)
        .join(Reviewer, Review.reviewer_id == Reviewer.id)
        .join(Therapist, Review.therapist_id == Therapist.id)
    )

    if therapist_id is not None:
        query = query.filter(Review.therapist_id == therapist_id)
    if client_id is not None:
        query = query.filter(Review.reviewer_id == client_id)
    if rating is not None:
        query = query.filter(Review.rating == rating)
    if with_comment:
        query = query.filter(Review.comment.isnot(None), func.length(func.trim(Review.comment)) > 0)

    if is_admin:
        if visibility == "visible":
            query = query.filter(Review.is_hidden == False)  # noqa: E712
        elif visibility == "hidden":
            query = query.filter(Review.is_hidden == True)  # noqa: E712
        if flagged is not None:
            query = query.filter(Review.is_flagged == flagged)
    else:
        query = query.filter(Review.is_hidden == False)  # noqa: E712

    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        conditions = [
            func.lower(func.coalesce(Review.comment, "")).like(like),
            func.lower(Therapist.fullname).like(like),
        ]
        if is_admin:
            conditions.append(func.lower(Reviewer.fullname).like(like))
        query = query.filter(or_(*conditions))

    if sort == "old":
        query = query.order_by(Review.created_at.asc(), Review.id.asc())
    elif sort == "best":
        query = query.order_by(Review.rating.desc(), Review.created_at.desc())
    elif sort == "worst":
        query = query.order_by(Review.rating.asc(), Review.created_at.desc())
    else:
        query = query.order_by(Review.created_at.desc(), Review.id.desc())

    reviews = query.offset(offset).limit(limit).all()
    return _serialize_many(db, reviews, current_user)


@router.get("/mine")
def my_reviews(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Historique de MES avis (client) avec la date de publication."""
    reviews = (
        db.query(Review)
        .filter(Review.reviewer_id == current_user.id)
        .order_by(Review.created_at.desc(), Review.id.desc())
        .all()
    )
    return _serialize_many(db, reviews, current_user)


@router.get("/received")
def received_reviews(
    rating: Optional[int] = Query(None, ge=1, le=5),
    sort: str = Query("recent", pattern="^(recent|old|best|worst)$"),
    unanswered: bool = False,
    limit: int = Query(100, ge=1, le=300),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Avis reçus par le thérapeute connecté (non masqués)."""
    query = db.query(Review).filter(
        Review.therapist_id == current_user.id,
        Review.is_hidden == False,  # noqa: E712
    )
    if rating is not None:
        query = query.filter(Review.rating == rating)
    if unanswered:
        query = query.filter(
            Review.comment.isnot(None),
            func.length(func.trim(Review.comment)) > 0,
            or_(
                Review.response_from_therapist.is_(None),
                func.length(func.trim(Review.response_from_therapist)) == 0,
            ),
        )

    if sort == "old":
        query = query.order_by(Review.created_at.asc())
    elif sort == "best":
        query = query.order_by(Review.rating.desc(), Review.created_at.desc())
    elif sort == "worst":
        query = query.order_by(Review.rating.asc(), Review.created_at.desc())
    else:
        query = query.order_by(Review.created_at.desc())

    return _serialize_many(db, query.limit(limit).all(), current_user)


@router.get("/pending")
def pending_reviews(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Séances TERMINÉES du client qui n'ont pas encore reçu d'avis."""
    rows = (
        db.query(Booking)
        .outerjoin(Review, Review.booking_id == Booking.id)
        .filter(
            Booking.client_id == current_user.id,
            Booking.status == "completed",
            Booking.therapist_id.isnot(None),
            Review.id.is_(None),
        )
        .order_by(Booking.scheduled_date.desc())
        .limit(50)
        .all()
    )
    result = []
    for b in rows:
        therapist = b.therapist
        massage = getattr(b, "massage_type", None)
        result.append({
            "booking_id": b.id,
            "therapist_id": b.therapist_id,
            "therapist_name": therapist.fullname if therapist else None,
            "therapist_photo": getattr(therapist, "profile_image", None) if therapist else None,
            "massage_type_name": massage.name if massage else None,
            "scheduled_date": iso_utc(b.scheduled_date),
            "completed_at": iso_utc(getattr(b, "actual_end_time", None)),
        })
    return result


@router.get("/booking/{booking_id}")
def review_of_booking(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Avis d'une réservation + indication « peut-on encore évaluer ? »."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Réservation introuvable.")

    allowed = (
        _is_admin(current_user)
        or current_user.id == booking.client_id
        or current_user.id == booking.therapist_id
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="Accès refusé.")

    review = db.query(Review).filter(Review.booking_id == booking_id).first()
    can_review = (
        review is None
        and current_user.id == booking.client_id
        and booking.status == "completed"
        and bool(booking.therapist_id)
    )
    # Le thérapeute ne voit pas un avis masqué par l'admin
    if review and review.is_hidden and current_user.id == booking.therapist_id:
        review = None

    return {
        "booking_id": booking_id,
        "review": _serialize_many(db, [review], current_user)[0] if review else None,
        "can_review": can_review,
        "booking_status": booking.status,
    }


# ============================================================
# 3) STATISTIQUES D'UN THÉRAPEUTE (note moyenne, répartition...)
# ============================================================

@router.get("/therapist/{therapist_id}/stats")
def therapist_stats(therapist_id: int, db: Session = Depends(get_db)):
    """Statistiques publiques des avis d'un thérapeute."""
    therapist = db.query(User).filter(User.id == therapist_id).first()
    if not therapist:
        raise HTTPException(status_code=404, detail="Thérapeute introuvable.")

    stats = get_therapist_rating_stats(therapist_id, db)
    stats["therapist_name"] = therapist.fullname
    stats["therapist_photo"] = getattr(therapist, "profile_image", None)
    return stats


# ============================================================
# 4) ADMIN : suivi + signalements
# ============================================================

@router.get("/admin/summary")
def admin_summary(
    q: Optional[str] = Query(None, max_length=100),
    sort: str = Query("rating", pattern="^(rating|reviews|flagged|name)$"),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Vue d'ensemble : totaux + note et nombre d'avis de chaque thérapeute."""
    rows = db.query(
        Review.therapist_id,
        Review.rating,
        Review.is_hidden,
        Review.is_flagged,
        Review.created_at,
    ).all()

    since = datetime.utcnow() - timedelta(days=30)
    per: Dict[int, Dict[str, Any]] = {}
    distribution = {i: 0 for i in range(1, 6)}
    visible_total = 0
    visible_sum = 0
    hidden_total = 0
    flagged_total = 0

    for therapist_id, rating, is_hidden, is_flagged, created_at in rows:
        t = per.setdefault(
            therapist_id,
            {"sum": 0, "count": 0, "hidden": 0, "flagged": 0, "last_month": 0},
        )
        if is_hidden:
            t["hidden"] += 1
            hidden_total += 1
            continue
        t["sum"] += rating or 0
        t["count"] += 1
        if is_flagged:
            t["flagged"] += 1
            flagged_total += 1
        if created_at and created_at >= since:
            t["last_month"] += 1
        visible_total += 1
        visible_sum += rating or 0
        if rating in distribution:
            distribution[int(rating)] += 1

    pending_reports = (
        db.query(func.count(ReviewReport.id)).filter(ReviewReport.status == "pending").scalar() or 0
    )

    therapists_query = db.query(User).filter(User.role == "THERAPIST", User.deleted_at.is_(None))
    if q and q.strip():
        therapists_query = therapists_query.filter(
            func.lower(User.fullname).like(f"%{q.strip().lower()}%")
        )

    items = []
    for th in therapists_query.all():
        t = per.get(th.id, {"sum": 0, "count": 0, "hidden": 0, "flagged": 0, "last_month": 0})
        items.append({
            "therapist_id": th.id,
            "name": th.fullname,
            "photo": getattr(th, "profile_image", None),
            "average_rating": round(t["sum"] / t["count"], 2) if t["count"] else 0.0,
            "total_reviews": t["count"],
            "last_month_reviews": t["last_month"],
            "flagged": t["flagged"],
            "hidden": t["hidden"],
        })

    if sort == "reviews":
        items.sort(key=lambda x: (-x["total_reviews"], x["name"] or ""))
    elif sort == "flagged":
        items.sort(key=lambda x: (-x["flagged"], -x["hidden"], x["name"] or ""))
    elif sort == "name":
        items.sort(key=lambda x: (x["name"] or "").lower())
    else:
        items.sort(key=lambda x: (-x["average_rating"], -x["total_reviews"]))

    return {
        "totals": {
            "reviews": visible_total,
            "hidden": hidden_total,
            "flagged": flagged_total,
            "pending_reports": int(pending_reports),
            "average_rating": round(visible_sum / visible_total, 2) if visible_total else 0.0,
            "distribution": distribution,
        },
        "therapists": items,
    }


@router.get("/admin/reports")
def admin_reports(
    report_status: str = Query("pending", alias="status", pattern="^(pending|reviewed|dismissed|action_taken|all)$"),
    limit: int = Query(100, ge=1, le=300),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Avis signalés (par défaut : en attente de traitement)."""
    query = db.query(ReviewReport)
    if report_status != "all":
        query = query.filter(ReviewReport.status == report_status)
    reports = query.order_by(ReviewReport.created_at.desc()).limit(limit).all()

    review_ids = {r.review_id for r in reports}
    reviews = db.query(Review).filter(Review.id.in_(review_ids)).all() if review_ids else []
    serialized = {r["id"]: r for r in _serialize_many(db, reviews, admin)}

    result = []
    for rep in reports:
        reporter = rep.reporter
        result.append({
            "id": rep.id,
            "review_id": rep.review_id,
            "reason": rep.reason,
            "reason_label": REPORT_REASON_LABELS.get(rep.reason, rep.reason),
            "description": rep.description,
            "status": rep.status,
            "created_at": iso_utc(rep.created_at),
            "reviewed_at": iso_utc(rep.reviewed_at),
            "admin_notes": rep.admin_notes,
            "reporter_id": rep.reporter_id,
            "reporter_name": reporter.fullname if reporter else None,
            "reporter_role": _get_role(reporter) if reporter else None,
            "review": serialized.get(rep.review_id),
        })
    return result


@router.put("/admin/reports/{report_id}")
def resolve_report(
    report_id: int,
    body: ReportResolveRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Traiter un signalement : ignorer / masquer l'avis / supprimer l'avis."""
    report = db.query(ReviewReport).filter(ReviewReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Signalement introuvable.")

    review = db.query(Review).filter(Review.id == report.review_id).first()
    notes = _clean_text(body.admin_notes)

    if body.action == "dismiss":
        report.status = "dismissed"
        report.reviewed_at = datetime.utcnow()
        report.admin_notes = notes
        if review:
            still_pending = (
                db.query(ReviewReport)
                .filter(
                    ReviewReport.review_id == review.id,
                    ReviewReport.status == "pending",
                    ReviewReport.id != report.id,
                )
                .count()
            )
            if not still_pending:
                review.is_flagged = False
        db.commit()
        return {"message": "Signalement ignoré.", "action": "dismiss"}

    # hide / delete exigent un motif (consigné + transmis au client)
    if not notes or len(notes) < 3:
        raise HTTPException(status_code=400, detail="Un motif est obligatoire pour cette action.")
    if not review:
        raise HTTPException(status_code=404, detail="Avis introuvable.")

    therapist_id = review.therapist_id
    reviewer_id = review.reviewer_id
    review_id = review.id

    if body.action == "hide":
        _apply_hide(db, review, admin, notes)
        db.commit()
        update_therapist_rating(therapist_id, db)
        _notify(
            reviewer_id,
            "Avis masqué par la modération",
            f"Votre avis ne respecte pas nos règles. Motif : {notes}",
            "review_moderated",
            {"review_id": review_id, "action": "hide"},
        )
        return {"message": "Avis masqué.", "action": "hide"}

    # delete
    _delete_review_rows(db, review)
    db.commit()
    update_therapist_rating(therapist_id, db)
    _notify(
        reviewer_id,
        "Avis supprimé par la modération",
        f"Votre avis a été supprimé. Motif : {notes}",
        "review_moderated",
        {"review_id": review_id, "action": "delete"},
    )
    return {"message": "Avis supprimé.", "action": "delete"}


# ============================================================
# 5) DÉTAIL / MODIFIER / SUPPRIMER
# ============================================================

@router.get("/{review_id}")
def get_review(
    review_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    review = _get_review_or_404(db, review_id)
    if review.is_hidden and not (
        _is_admin(current_user) or (current_user and current_user.id == review.reviewer_id)
    ):
        raise HTTPException(status_code=404, detail="Avis introuvable.")
    return _serialize_many(db, [review], current_user)[0]


@router.put("/{review_id}")
def update_review(
    review_id: int,
    data: ReviewUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Modifier son avis (seulement l'auteur, pendant le délai autorisé)."""
    review = _get_review_or_404(db, review_id)

    if review.reviewer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez modifier que vos propres avis.")
    if review.is_hidden:
        raise HTTPException(status_code=403, detail="Cet avis a été masqué par la modération.")
    if not _within_edit_window(review):
        raise HTTPException(
            status_code=403,
            detail=f"Le délai de modification ({REVIEW_EDIT_WINDOW_DAYS} jours) est dépassé.",
        )

    changes = _dump(data, exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Aucune modification fournie.")

    if "rating" in changes and changes["rating"] is not None:
        review.rating = changes["rating"]
    if "comment" in changes:
        review.comment = _clean_text(changes["comment"])
    if "is_anonymous" in changes and changes["is_anonymous"] is not None:
        review.is_anonymous = changes["is_anonymous"]
    for field in ("professionalism", "quality", "punctuality", "cleanliness"):
        if field in changes:
            setattr(review, field, changes[field])
    if "tags" in changes:
        review.tags = _clean_tags(changes["tags"])

    review.edited_at = datetime.utcnow()
    db.commit()
    db.refresh(review)

    update_therapist_rating(review.therapist_id, db)
    _notify(
        review.therapist_id,
        "Avis modifié",
        f"Un client a modifié son avis ({review.rating}/5).",
        "review_updated",
        {"review_id": review.id, "booking_id": review.booking_id},
    )
    return _serialize_many(db, [review], current_user)[0]


@router.delete("/{review_id}")
def delete_review(
    review_id: int,
    reason: Optional[str] = Query(None, max_length=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Supprimer un avis : son auteur, ou l'admin (avec un motif transmis au client)."""
    review = _get_review_or_404(db, review_id)
    is_admin = _is_admin(current_user)

    if review.reviewer_id != current_user.id and not is_admin:
        raise HTTPException(status_code=403, detail="Vous ne pouvez supprimer que vos propres avis.")
    if not is_admin and review.is_hidden:
        raise HTTPException(
            status_code=403,
            detail="Cet avis a été masqué par la modération et ne peut pas être supprimé.",
        )

    therapist_id = review.therapist_id
    reviewer_id = review.reviewer_id
    rid = review.id
    reason_clean = _clean_text(reason)

    _delete_review_rows(db, review)
    db.commit()

    update_therapist_rating(therapist_id, db)

    if is_admin and reviewer_id != current_user.id:
        body = "Votre avis a été supprimé par la modération."
        if reason_clean:
            body += f" Motif : {reason_clean}"
        _notify(reviewer_id, "Avis supprimé", body, "review_moderated", {"review_id": rid, "action": "delete"})

    return {"message": "Avis supprimé.", "id": rid}


# ============================================================
# 6) RÉPONSE DU THÉRAPEUTE
# ============================================================

@router.put("/{review_id}/respond")
def respond_to_review(
    review_id: int,
    response: Optional[str] = Query(None, max_length=1000),
    body: Optional[ReviewResponseRequest] = Body(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Le thérapeute répond (ou modifie sa réponse) à un avis le concernant."""
    review = _get_review_or_404(db, review_id)

    if current_user.id != review.therapist_id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez répondre qu'aux avis qui vous concernent.")
    if review.is_hidden:
        raise HTTPException(status_code=403, detail="Cet avis a été masqué par la modération.")

    text = _clean_text(body.response if body else response)
    if not text or len(text) < 2:
        raise HTTPException(status_code=400, detail="La réponse est vide.")
    if len(text) > 1000:
        raise HTTPException(status_code=400, detail="La réponse est trop longue (1000 caractères max).")

    first_time = not (review.response_from_therapist or "").strip()
    review.response_from_therapist = text
    review.therapist_responded_at = datetime.utcnow()
    db.commit()
    db.refresh(review)

    if first_time:
        _notify(
            review.reviewer_id,
            "Réponse à votre avis",
            f"{current_user.fullname} a répondu à votre avis.",
            "review_response",
            {"review_id": review.id, "booking_id": review.booking_id},
        )
    return _serialize_many(db, [review], current_user)[0]


@router.delete("/{review_id}/respond")
def delete_response(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = _get_review_or_404(db, review_id)
    if current_user.id != review.therapist_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    review.response_from_therapist = None
    review.therapist_responded_at = None
    db.commit()
    return {"message": "Réponse supprimée."}


# ============================================================
# 7) SIGNALER UN AVIS
# ============================================================

@router.post("/{review_id}/report", status_code=status.HTTP_201_CREATED)
def report_review(
    review_id: int,
    body: ReviewReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Signaler un avis mensonger, faux ou contraire aux règles."""
    review = _get_review_or_404(db, review_id)

    if _is_admin(current_user):
        raise HTTPException(status_code=400, detail="Les administrateurs modèrent directement les avis.")
    if review.reviewer_id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas signaler votre propre avis.")
    if review.is_hidden:
        raise HTTPException(status_code=400, detail="Cet avis est déjà masqué.")

    already = (
        db.query(ReviewReport)
        .filter(ReviewReport.review_id == review.id, ReviewReport.reporter_id == current_user.id)
        .first()
    )
    if already:
        raise HTTPException(status_code=400, detail="Vous avez déjà signalé cet avis.")

    report = ReviewReport(
        review_id=review.id,
        reporter_id=current_user.id,
        reason=body.reason,
        description=_clean_text(body.description),
        status="pending",
    )
    db.add(report)
    review.is_flagged = True
    review.flag_reason = REPORT_REASON_LABELS.get(body.reason, body.reason)
    db.commit()

    _notify_admins(
        "Avis signalé",
        f"{current_user.fullname} a signalé un avis ({REPORT_REASON_LABELS.get(body.reason, body.reason)}).",
        "review_reported",
        {"review_id": review.id, "report_id": report.id},
    )
    return {"message": "Merci, votre signalement a été transmis à l'équipe de modération."}


# ============================================================
# 8) MODÉRATION ADMIN : masquer / rétablir
# ============================================================

@router.put("/{review_id}/moderate")
def moderate_review(
    review_id: int,
    body: ReviewModerationRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    review = _get_review_or_404(db, review_id)
    reason = _clean_text(body.reason)

    if body.action == "hide":
        if not reason or len(reason) < 3:
            raise HTTPException(status_code=400, detail="Un motif est obligatoire pour masquer un avis.")
        _apply_hide(db, review, admin, reason)
        db.commit()
        update_therapist_rating(review.therapist_id, db)
        _notify(
            review.reviewer_id,
            "Avis masqué par la modération",
            f"Votre avis ne respecte pas nos règles. Motif : {reason}",
            "review_moderated",
            {"review_id": review.id, "action": "hide"},
        )
    else:  # restore
        review.is_hidden = False
        review.hidden_reason = None
        review.hidden_at = None
        review.moderated_by = admin.id
        review.is_flagged = False
        db.commit()
        update_therapist_rating(review.therapist_id, db)
        _notify(
            review.reviewer_id,
            "Avis rétabli",
            "Votre avis est de nouveau visible.",
            "review_moderated",
            {"review_id": review.id, "action": "restore"},
        )

    db.refresh(review)
    return _serialize_many(db, [review], admin)[0]
