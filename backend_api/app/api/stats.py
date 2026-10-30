# app/api/stats.py
"""
Statistiques des tableaux de bord (Client / Thérapeute / Admin).

Toutes les valeurs sont calculées à partir de la base de données :
aucune donnée fictive. Les séries mensuelles sont regroupées côté Python
(compatible PostgreSQL / MySQL / SQLite) et exprimées en heure de Madagascar.

    GET /stats/client      -> tableau de bord CLIENT
    GET /stats/therapist   -> tableau de bord THÉRAPEUTE
    GET /stats/admin       -> tableau de bord ADMIN + écran Analyses
"""
import logging
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_admin, get_current_client, get_current_therapist
from ..models.booking import Booking
from ..models.massage import MassageType
from ..models.payment import Payment
from ..models.review import Review
from ..models.sos import SOSAlert
from ..models.user import User
from ..services.mg_time import DB_OFFSET_HOURS, MG_OFFSET_HOURS, iso_utc, mg_now, to_mg

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stats", tags=["Stats"])

CANCELLED = ["cancelled_by_client", "cancelled_by_therapist"]
OPEN_STATUSES = ["pending", "negotiating"]
MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]


# ============================================================
# Helpers
# ============================================================
def _f(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _day_start_db() -> datetime:
    """Minuit (heure de Madagascar) exprimé dans le fuseau de la base."""
    mg = mg_now().replace(hour=0, minute=0, second=0, microsecond=0)
    return mg - timedelta(hours=MG_OFFSET_HOURS - DB_OFFSET_HOURS)


def _month_start_db() -> datetime:
    mg = mg_now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return mg - timedelta(hours=MG_OFFSET_HOURS - DB_OFFSET_HOURS)


def _month_keys(n: int) -> List[str]:
    """Les n derniers mois (le plus ancien d'abord) : ['2026-05', ..., '2026-10']."""
    now = mg_now()
    y, m = now.year, now.month
    keys = []
    for _ in range(n):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    return list(reversed(keys))


def _window_start_db(n_months: int) -> datetime:
    first = _month_keys(n_months)[0]
    y, m = int(first[:4]), int(first[5:7])
    mg = datetime(y, m, 1)
    return mg - timedelta(hours=MG_OFFSET_HOURS - DB_OFFSET_HOURS)


def _mkey(value: Optional[datetime]) -> Optional[str]:
    v = to_mg(value)
    return v.strftime("%Y-%m") if v else None


def _month_label(key: str) -> str:
    return f"{MONTHS_FR[int(key[5:7]) - 1]} {key[2:4]}"


def _amount_net(p: Payment) -> float:
    meta = p.payment_metadata or {}
    if isinstance(meta, dict) and meta.get("net_amount") is not None:
        return _f(meta.get("net_amount"))
    return _f(p.amount)


def _pct(part: int, whole: int) -> float:
    return round(part / whole * 100, 1) if whole else 0.0


def _by_massage_type(db: Session, filters: list, limit: int = 5) -> List[dict]:
    rows = (
        db.query(MassageType.name, func.count(Booking.id))
        .join(Booking, Booking.massage_type_id == MassageType.id)
        .filter(*filters)
        .group_by(MassageType.name)
        .order_by(func.count(Booking.id).desc())
        .limit(limit)
        .all()
    )
    return [{"label": r[0], "count": int(r[1])} for r in rows]


def _empty_months(keys: List[str], fields: Dict[str, float]) -> Dict[str, dict]:
    return {k: {"month": k, "label": _month_label(k), **fields} for k in keys}


# ============================================================
# CLIENT
# ============================================================
@router.get("/client")
async def client_stats(
    months: int = Query(6, ge=1, le=12),
    current_user: User = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    uid = current_user.id
    base = db.query(Booking).filter(Booking.client_id == uid)
    now = datetime.utcnow() + timedelta(hours=DB_OFFSET_HOURS)

    total = base.count()
    completed = base.filter(Booking.status == "completed").count()
    cancelled = base.filter(Booking.status.in_(CANCELLED)).count()
    pending = base.filter(Booking.status.in_(OPEN_STATUSES)).count()
    upcoming = base.filter(
        Booking.status.in_(["confirmed", "in_progress"]),
    ).count()

    paid = (
        db.query(Payment)
        .filter(Payment.user_id == uid, Payment.status == "completed")
        .filter(Payment.created_at >= _window_start_db(months))
        .all()
    )
    total_spent = _f(
        db.query(func.sum(Payment.amount))
        .filter(Payment.user_id == uid, Payment.status == "completed")
        .scalar()
    )
    paid_count = (
        db.query(Payment).filter(Payment.user_id == uid, Payment.status == "completed").count()
    )
    month_spent = _f(
        db.query(func.sum(Payment.amount))
        .filter(
            Payment.user_id == uid,
            Payment.status == "completed",
            func.coalesce(Payment.completed_at, Payment.created_at) >= _month_start_db(),
        )
        .scalar()
    )

    keys = _month_keys(months)
    series = _empty_months(keys, {"bookings": 0, "spent": 0.0})
    for (created,) in base.filter(Booking.created_at >= _window_start_db(months)).with_entities(Booking.created_at):
        k = _mkey(created)
        if k in series:
            series[k]["bookings"] += 1
    for p in paid:
        k = _mkey(p.completed_at or p.created_at)
        if k in series:
            series[k]["spent"] += _f(p.amount)

    reviews_given = db.query(Review).filter(Review.reviewer_id == uid).count()

    nxt = (
        base.filter(
            Booking.status.in_(["confirmed", "in_progress"]),
            Booking.scheduled_date >= now - timedelta(hours=2),
        )
        .order_by(Booking.scheduled_date.asc())
        .first()
    )
    next_booking = None
    if nxt:
        th_name = (
            db.query(User.fullname).filter(User.id == nxt.therapist_id).scalar()
            if nxt.therapist_id else None
        )
        mt_name = (
            db.query(MassageType.name).filter(MassageType.id == nxt.massage_type_id).scalar()
            if nxt.massage_type_id else None
        )
        next_booking = {
            "id": nxt.id,
            "status": nxt.status,
            "scheduled_date": iso_utc(nxt.scheduled_date),
            "therapist_name": th_name,
            "massage_type": mt_name,
            "price": _f(nxt.final_price or nxt.client_price_proposed),
        }

    return {
        "bookings": {
            "total": total,
            "completed": completed,
            "upcoming": upcoming,
            "pending": pending,
            "cancelled": cancelled,
        },
        "spending": {
            "total": total_spent,
            "month": month_spent,
            "average": round(total_spent / paid_count) if paid_count else 0,
        },
        "reviews_given": reviews_given,
        "monthly": [series[k] for k in keys],
        "by_massage_type": _by_massage_type(
            db, [Booking.client_id == uid, Booking.status.notin_(CANCELLED)]
        ),
        "next_booking": next_booking,
    }


# ============================================================
# THÉRAPEUTE
# ============================================================
@router.get("/therapist")
async def therapist_stats(
    months: int = Query(6, ge=1, le=12),
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db),
):
    tid = current_user.id
    base = db.query(Booking).filter(Booking.therapist_id == tid)
    day_start = _day_start_db()

    total = base.filter(Booking.status.notin_(OPEN_STATUSES + ["expired"])).count()
    completed = base.filter(Booking.status == "completed").count()
    cancelled = base.filter(Booking.status.in_(CANCELLED)).count()
    upcoming = base.filter(Booking.status.in_(["confirmed", "in_progress"])).count()
    today_bookings = base.filter(
        Booking.status.in_(["confirmed", "in_progress", "completed"]),
        Booking.scheduled_date >= day_start,
        Booking.scheduled_date < day_start + timedelta(days=1),
    ).count()
    pending_requests = base.filter(Booking.status.in_(OPEN_STATUSES)).count()

    pay_q = (
        db.query(Payment)
        .join(Booking, Booking.id == Payment.booking_id)
        .filter(Booking.therapist_id == tid)
    )
    done = pay_q.filter(Payment.status == "completed").all()
    waiting = pay_q.filter(Payment.status.in_(["pending", "processing"])).all()

    month_start = _month_start_db()

    def when(p: Payment) -> Optional[datetime]:
        return p.completed_at or p.created_at

    total_net = sum(_amount_net(p) for p in done)
    total_gross = sum(_f(p.amount) for p in done)
    today_net = sum(_amount_net(p) for p in done if when(p) and when(p) >= day_start)
    month_net = sum(_amount_net(p) for p in done if when(p) and when(p) >= month_start)
    rate = _f(current_user.commission_rate) / 100.0
    pending_net = sum(
        _f((p.payment_metadata or {}).get("net_amount")) or _f(p.amount) * (1 - rate) for p in waiting
    )

    available = None
    try:
        from ..services import wallet_service

        available = wallet_service.wallet_summary(db, tid).get("available")
    except Exception as e:  # le wallet est optionnel pour ce tableau de bord
        logger.warning(f"stats/therapist wallet indisponible: {e}")

    keys = _month_keys(months)
    series = _empty_months(keys, {"bookings": 0, "earnings": 0.0})
    for (when_,) in base.filter(
        Booking.status == "completed", Booking.scheduled_date >= _window_start_db(months)
    ).with_entities(Booking.scheduled_date):
        k = _mkey(when_)
        if k in series:
            series[k]["bookings"] += 1
    for p in done:
        k = _mkey(when(p))
        if k in series:
            series[k]["earnings"] += _amount_net(p)

    # 7 derniers jours (gains nets par jour, heure de Madagascar)
    days_fr = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
    today_mg = mg_now().replace(hour=0, minute=0, second=0, microsecond=0)
    week = {}
    for i in range(6, -1, -1):
        d = today_mg - timedelta(days=i)
        week[d.strftime("%Y-%m-%d")] = {
            "date": d.strftime("%Y-%m-%d"),
            "label": days_fr[d.weekday()],
            "earnings": 0.0,
        }
    for p in done:
        ts = to_mg(when(p))
        if ts and ts.strftime("%Y-%m-%d") in week:
            week[ts.strftime("%Y-%m-%d")]["earnings"] += _amount_net(p)

    avg_rating = _f(
        db.query(func.avg(Review.rating))
        .filter(Review.therapist_id == tid, Review.is_hidden == False)  # noqa: E712
        .scalar()
    )
    reviews_count = (
        db.query(Review).filter(Review.therapist_id == tid, Review.is_hidden == False).count()  # noqa: E712
    )

    # ----- activités récentes (réelles) -----
    activities: List[Tuple[datetime, dict]] = []
    for b, name in (
        db.query(Booking, User.fullname)
        .join(User, User.id == Booking.client_id)
        .filter(Booking.therapist_id == tid)
        .order_by(Booking.created_at.desc())
        .limit(4)
        .all()
    ):
        if b.created_at:
            activities.append((b.created_at, {
                "id": f"booking-{b.id}", "type": "booking",
                "message": f"Nouvelle réservation de {name}",
            }))
    for p, name in (
        db.query(Payment, User.fullname)
        .join(Booking, Booking.id == Payment.booking_id)
        .join(User, User.id == Payment.user_id)
        .filter(Booking.therapist_id == tid, Payment.status == "completed")
        .order_by(Payment.created_at.desc())
        .limit(4)
        .all()
    ):
        ts = when(p)
        if ts:
            amount = f"{round(_f(p.amount)):,}".replace(",", " ")
            activities.append((ts, {
                "id": f"payment-{p.id}", "type": "payment",
                "message": f"Paiement reçu de {name} - {amount} Ar",
            }))
    for r, name in (
        db.query(Review, User.fullname)
        .join(User, User.id == Review.reviewer_id)
        .filter(Review.therapist_id == tid, Review.is_hidden == False)  # noqa: E712
        .order_by(Review.created_at.desc())
        .limit(3)
        .all()
    ):
        if r.created_at:
            activities.append((r.created_at, {
                "id": f"review-{r.id}", "type": "review",
                "message": f"Nouvel avis {r.rating} étoile{'s' if r.rating > 1 else ''} de {name}",
            }))
    activities.sort(key=lambda x: x[0], reverse=True)

    return {
        "bookings": {
            "total": total,
            "completed": completed,
            "cancelled": cancelled,
            "upcoming": upcoming,
            "today": today_bookings,
            "pending_requests": pending_requests,
            "completion_rate": _pct(completed, completed + cancelled),
        },
        "earnings": {
            "total_net": total_net,
            "total_gross": total_gross,
            "today": today_net,
            "month": month_net,
            "pending": pending_net,
            "available": available,
        },
        "rating": {"average": round(avg_rating, 2), "total_reviews": reviews_count},
        "weekly": list(week.values()),
        "monthly": [series[k] for k in keys],
        "by_massage_type": _by_massage_type(
            db, [Booking.therapist_id == tid, Booking.status == "completed"]
        ),
        "recent_activities": [
            {**a, "time": iso_utc(ts)} for ts, a in activities[:6]
        ],
    }


# ============================================================
# ADMIN
# ============================================================
@router.get("/admin")
async def admin_stats(
    months: int = Query(6, ge=1, le=12),
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    alive = User.deleted_at.is_(None)
    month_start = _month_start_db()
    day_start = _day_start_db()
    end_ts = func.coalesce(Booking.actual_end_time, Booking.updated_at)

    total_users = db.query(User).filter(alive).count()
    clients = db.query(User).filter(alive, User.role == "CLIENT").count()
    therapists = db.query(User).filter(alive, User.role == "THERAPIST").count()
    online = db.query(User).filter(
        User.role == "THERAPIST", User.is_online == True, User.is_active == True, alive  # noqa: E712
    ).count()
    pending_therapists = db.query(User).filter(
        User.role == "THERAPIST", User.verification_status == "pending", alive
    ).count()

    b_total = db.query(Booking).count()
    b_completed = db.query(Booking).filter(Booking.status == "completed").count()
    b_pending = db.query(Booking).filter(Booking.status.in_(OPEN_STATUSES)).count()
    b_cancelled = db.query(Booking).filter(Booking.status.in_(CANCELLED)).count()

    status_rows = db.query(Booking.status, func.count(Booking.id)).group_by(Booking.status).all()
    by_status = {str(s): int(c) for s, c in status_rows}

    rev_total = _f(db.query(func.sum(Booking.final_price)).filter(Booking.status == "completed").scalar())
    rev_today = _f(
        db.query(func.sum(Booking.final_price))
        .filter(Booking.status == "completed", end_ts >= day_start).scalar()
    )
    rev_month = _f(
        db.query(func.sum(Booking.final_price))
        .filter(Booking.status == "completed", end_ts >= month_start).scalar()
    )

    keys = _month_keys(months)
    win = _window_start_db(months)
    series = _empty_months(keys, {"revenue": 0.0, "bookings": 0, "new_users": 0})
    for price, ts in (
        db.query(Booking.final_price, end_ts)
        .filter(Booking.status == "completed", end_ts >= win)
        .all()
    ):
        k = _mkey(ts)
        if k in series:
            series[k]["revenue"] += _f(price)
            series[k]["bookings"] += 1
    for (created,) in db.query(User.created_at).filter(alive, User.created_at >= win).all():
        k = _mkey(created)
        if k in series:
            series[k]["new_users"] += 1

    methods = (
        db.query(Payment.method, func.count(Payment.id), func.sum(Payment.amount))
        .filter(Payment.status == "completed")
        .group_by(Payment.method)
        .all()
    )
    pay_total = sum(_f(r[2]) for r in methods)

    top = (
        db.query(User.id, User.fullname, func.count(Booking.id), func.sum(Booking.final_price))
        .join(Booking, Booking.therapist_id == User.id)
        .filter(Booking.status == "completed")
        .group_by(User.id, User.fullname)
        .order_by(func.sum(Booking.final_price).desc())
        .limit(5)
        .all()
    )

    visible = [Review.is_hidden == False]  # noqa: E712
    avg_rating = _f(db.query(func.avg(Review.rating)).filter(*visible).scalar())
    reviews_total = db.query(Review).filter(*visible).count()
    dist = {
        int(r): int(c)
        for r, c in db.query(Review.rating, func.count(Review.id)).filter(*visible).group_by(Review.rating).all()
    }

    return {
        "users": {
            "total": total_users,
            "clients": clients,
            "therapists": therapists,
            "active_therapists": online,
            "pending_therapists": pending_therapists,
            "new_this_month": db.query(User).filter(alive, User.created_at >= month_start).count(),
        },
        "bookings": {
            "total": b_total,
            "completed": b_completed,
            "pending": b_pending,
            "cancelled": b_cancelled,
            "completion_rate": _pct(b_completed, b_total),
            "new_this_month": db.query(Booking).filter(Booking.created_at >= month_start).count(),
            "by_status": by_status,
        },
        "revenue": {"total": rev_total, "today": rev_today, "month": rev_month},
        "monthly": [series[k] for k in keys],
        "by_payment_method": [
            {"method": str(r[0]), "count": int(r[1]), "total": _f(r[2])} for r in methods
        ],
        "payments_total": pay_total,
        "top_therapists": [
            {"id": r[0], "name": r[1], "bookings": int(r[2]), "earnings": _f(r[3])} for r in top
        ],
        "reviews": {
            "average_rating": round(avg_rating, 2),
            "total": reviews_total,
            "distribution": {str(i): dist.get(i, 0) for i in range(1, 6)},
        },
        "sos": {"active": db.query(SOSAlert).filter(SOSAlert.status == "active").count()},
    }
