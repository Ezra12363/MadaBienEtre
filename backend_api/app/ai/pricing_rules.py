"""Règles tarifaires pures (sans FastAPI ni base de données).

Ce module sert :
  * de prix de repli (« règle métier ») lorsque le modèle Gradient Boosting
    n'est pas disponible (mémoire §6.3.2) ;
  * de référence de comparaison dans l'évaluation (Tableau 54) ;
  * à l'estimation de l'indice de demande à partir de l'heure et du jour ;
  * au calcul de la commission de la plateforme.

Tout est testable avec pytest sans base de données.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Optional, Tuple

PRICE_STEP = 500  # Ar : pas d'arrondi du prix conseillé
PEAK_HOURS = range(17, 21)  # 17h–20h : heures de pointe (soirée)
DEFAULT_EXPERIENCE_YEARS = 5
DEFAULT_DEMAND = 0.5


def round_to_step(value: float, step: int = PRICE_STEP) -> int:
    """Arrondit au multiple de `step` le plus proche (500 Ar par défaut)."""
    return int(round(float(value) / step)) * step


def round_up_to_step(value: float, step: int = PRICE_STEP) -> int:
    """Arrondit au multiple de `step` supérieur (utile pour un plancher)."""
    value = float(value)
    return int(-(-value // step)) * step


def is_peak_hour(hour: Optional[int]) -> bool:
    return hour is not None and int(hour) in PEAK_HOURS


def duration_factor(duration_minutes: float) -> float:
    """Coefficient de durée sous-linéaire : 90 min ≈ x1,41 ; 120 min ≈ x1,80."""
    return (max(float(duration_minutes), 15.0) / 60.0) ** 0.85


def distance_factor(distance_km: float) -> float:
    """Supplément de distance non linéaire (croissant, plafonné)."""
    d = min(max(float(distance_km or 0.0), 0.0), 30.0)
    return 1.0 + 0.004 * d + 0.0005 * d * d


def estimate_demand(hour: Optional[int], day: Optional[int]) -> float:
    """Indice de demande (0,05–1,00) qui culmine en soirée et en fin de semaine.

    `day` : 1 (lundi) à 7 (dimanche), comme dans le jeu de données.
    Profil ajusté sur dataset_reservations_simule.csv.
    """
    if hour is None or day is None:
        return DEFAULT_DEMAND
    demand = 0.25
    if int(hour) in PEAK_HOURS:
        demand += 0.35
    if int(day) >= 5:  # vendredi, samedi, dimanche
        demand += 0.20
    return min(1.0, max(0.05, demand))


def rule_based_price(
    base_price: float,
    duration: float = 60,
    distance: float = 0.0,
    hour: Optional[int] = None,
    demand: float = DEFAULT_DEMAND,
) -> int:
    """Prix conseillé par la règle métier à coefficients fixés à la main.

    prix = base x durée x distance x pointe x demande, arrondi à 500 Ar.
    """
    price = float(base_price) * duration_factor(duration) * distance_factor(distance)
    if is_peak_hour(hour):
        price *= 1.08
    price *= 1.0 + 0.2 * (float(demand) - DEFAULT_DEMAND)
    return round_to_step(price)


def commission_split(amount: float, rate_percent: float) -> Tuple[int, int]:
    """Commission de la plateforme et net du masseur (arrondi à l'Ariary).

    50 000 Ar à 10 %  -> (5 000, 45 000).
    Même formule que wallet_service.compute_split.
    """
    gross = Decimal(str(amount)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    commission = (gross * Decimal(str(rate_percent)) / Decimal("100")).quantize(
        Decimal("1"), rounding=ROUND_HALF_UP
    )
    return int(commission), int(gross - commission)
