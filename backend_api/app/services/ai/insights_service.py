"""Tableau de bord IA de l'administrateur : GET /ai/insights?period=.

Services populaires, périodes chargées et revenus prévisionnels, sur la période
demandée (day, week, month, quarter, year).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from ...ai.insights import PERIOD_DAYS, busy_periods, completion_rate, forecast_revenue
from ...models.booking import Booking
from ..mg_time import to_mg


def _price(row: Any) -> float:
    for value in (row.final_price, row.client_price_proposed):
        try:
            if value is not None and float(value) > 0:
                return float(value)
        except (TypeError, ValueError):
            continue
    return 0.0


def build_insights(db: Session, period: str = "month") -> Dict[str, Any]:
    days = PERIOD_DAYS[period]
    now = datetime.utcnow()
    since = now - timedelta(days=days)

    rows = (
        db.query(
            Booking.id,
            Booking.massage_type_id,
            Booking.status,
            Booking.final_price,
            Booking.client_price_proposed,
            Booking.scheduled_date,
            Booking.actual_end_time,
            Booking.created_at,
        )
        .filter(Booking.created_at >= since)
        .all()
    )

    names: Dict[int, str] = {}
    try:
        from ...models.massage import MassageType

        names = {mid: name for mid, name in db.query(MassageType.id, MassageType.name).all()}
    except Exception:  # noqa: BLE001
        pass

    total = len(rows)
    completed_rows = [r for r in rows if str(getattr(r.status, "value", r.status)) == "completed"]
    revenue = sum(_price(r) for r in completed_rows)

    # Services populaires
    stats: Dict[Any, Dict[str, Any]] = {}
    for r in rows:
        s = stats.setdefault(r.massage_type_id, {"bookings_count": 0, "completed_count": 0, "revenue": 0.0})
        s["bookings_count"] += 1
    for r in completed_rows:
        s = stats[r.massage_type_id]
        s["completed_count"] += 1
        s["revenue"] += _price(r)
    popular: List[Dict[str, Any]] = sorted(
        (
            {
                "massage_type_id": mid,
                "name": names.get(mid, f"Massage #{mid}" if mid else "Non précisé"),
                "bookings_count": s["bookings_count"],
                "completed_count": s["completed_count"],
                "revenue": round(s["revenue"], 0),
            }
            for mid, s in stats.items()
        ),
        key=lambda x: (-x["bookings_count"], -x["revenue"]),
    )[:5]

    # Périodes chargées (heure locale de Madagascar)
    busy = busy_periods(to_mg(r.scheduled_date) for r in rows)

    # Revenus prévisionnels : série journalière des prestations terminées
    daily: Dict[Any, float] = {}
    for r in completed_rows:
        local = to_mg(r.actual_end_time or r.scheduled_date)
        if local is not None:
            daily[local.date()] = daily.get(local.date(), 0.0) + _price(r)
    local_since = to_mg(since).date()
    local_now = to_mg(now).date()
    horizon = max(days, 7) if period != "day" else 7
    forecast = forecast_revenue(daily, local_since, local_now, horizon)

    return {
        "period": period,
        "days": days,
        "since": since.replace(microsecond=0).isoformat() + "Z",
        "total_bookings": total,
        "completed_bookings": len(completed_rows),
        "completion_rate": completion_rate(total, len(completed_rows)),
        "total_revenue": float(revenue),
        "average_booking_value": float(revenue / total) if total else 0.0,
        "popular_services": popular,
        "busy_periods": busy,
        "forecast": forecast,
    }
