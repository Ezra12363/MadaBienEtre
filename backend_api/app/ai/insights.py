"""Calculs purs des indicateurs du tableau de bord IA (sans base ni FastAPI).

  * périodes chargées : répartition des demandes par heure et par jour ;
  * revenus prévisionnels : moyenne journalière corrigée de la tendance linéaire.
"""

from __future__ import annotations

from collections import Counter
from datetime import date, timedelta
from typing import Dict, Iterable, List, Sequence, Tuple

PERIOD_DAYS = {"day": 1, "week": 7, "month": 30, "quarter": 90, "year": 365}
WEEKDAY_LABELS = {1: "Lundi", 2: "Mardi", 3: "Mercredi", 4: "Jeudi", 5: "Vendredi", 6: "Samedi", 7: "Dimanche"}


def busy_periods(local_datetimes: Iterable, top: int = 3) -> Dict[str, object]:
    """Répartition par heure (0-23) et par jour (1=lundi … 7=dimanche).

    `local_datetimes` : dates/heures de prestation à l'heure de Madagascar.
    """
    hours: Counter = Counter()
    days: Counter = Counter()
    for dt in local_datetimes:
        if dt is None:
            continue
        hours[int(dt.hour)] += 1
        days[int(dt.isoweekday())] += 1

    by_hour = [{"hour": h, "count": hours.get(h, 0)} for h in range(24)]
    by_weekday = [{"day": d, "label": WEEKDAY_LABELS[d], "count": days.get(d, 0)} for d in range(1, 8)]
    peak_hours = [h for h, c in hours.most_common(top) if c > 0]
    peak_days = [WEEKDAY_LABELS[d] for d, c in days.most_common(top) if c > 0]
    return {
        "by_hour": by_hour,
        "by_weekday": by_weekday,
        "peak_hours": sorted(peak_hours),
        "peak_days": peak_days,
    }


def _linear_fit(values: Sequence[float]) -> Tuple[float, float]:
    """Moindres carrés y = a + b·t (t = 0..n-1)."""
    n = len(values)
    if n < 2:
        return (values[0] if values else 0.0), 0.0
    mean_t = (n - 1) / 2.0
    mean_y = sum(values) / n
    var = sum((t - mean_t) ** 2 for t in range(n))
    cov = sum((t - mean_t) * (y - mean_y) for t, y in enumerate(values))
    slope = cov / var if var else 0.0
    return mean_y - slope * mean_t, slope


def forecast_revenue(
    daily_revenue: Dict[date, float],
    since: date,
    until: date,
    horizon_days: int,
) -> Dict[str, object]:
    """Revenu prévisionnel sur `horizon_days` jours.

    Série journalière continue entre `since` et `until` (jours sans vente = 0),
    moyenne journalière, puis correction par la tendance (limitée à ±30 % de la
    moyenne par rapport au milieu de la fenêtre pour rester prudent).
    """
    n_days = max((until - since).days + 1, 1)
    series = [float(daily_revenue.get(since + timedelta(days=i), 0.0)) for i in range(n_days)]
    total = sum(series)
    sales_days = sum(1 for v in series if v > 0)
    avg = total / n_days
    if total <= 0:
        return {
            "horizon_days": horizon_days, "predicted_revenue": 0.0, "daily_average": 0.0,
            "trend": "stable", "confidence": "low", "method": "moyenne journalière + tendance linéaire",
        }

    intercept, slope = _linear_fit(series)
    # Niveau attendu au début de la période à venir (extrapolation limitée)
    level = intercept + slope * n_days
    level = min(max(level, 0.7 * avg), 1.3 * avg)
    predicted = level * horizon_days

    rel = slope * n_days / avg if avg else 0.0
    trend = "up" if rel > 0.15 else "down" if rel < -0.15 else "stable"
    confidence = "high" if sales_days >= 20 else "medium" if sales_days >= 7 else "low"
    return {
        "horizon_days": horizon_days,
        "predicted_revenue": round(predicted, 0),
        "daily_average": round(avg, 0),
        "trend": trend,
        "confidence": confidence,
        "method": "moyenne journalière + tendance linéaire",
    }


def completion_rate(total: int, completed: int) -> float:
    return round(completed / total * 100, 2) if total else 0.0
