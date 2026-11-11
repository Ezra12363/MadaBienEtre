"""Moteur de recommandation de masseurs par score pondéré multicritère.

Module Python PUR : aucune dépendance à FastAPI, SQLAlchemy ou numpy, afin
d'être testable et réutilisable (mémoire §6.3.1, Tableau 41, §8.5.1).

Score total = somme pondérée de six sous-scores normalisés entre 0 et 1 :

    Distance      25 %   s = 1 - d / dmax
    Prix          20 %   s = 1 - p / b   (b = budget, ou prix max des candidats)
    Disponibilité 20 %   s = 1 - t / 240 (t = délai en minutes, horizon 4 h)
    Note          20 %   note lissée (5 avis fictifs à 4,0), ramenée sur 1
    Expérience    10 %   s = min(années, 10) / 10
    Type massage   5 %   1 si le masseur propose le type demandé, sinon 0

Avant le calcul, les candidats hors budget ou hors rayon sont écartés.
En cas d'égalité, le masseur le plus proche passe en premier.
Si aucun candidat ne reste, le moteur propose d'élargir le rayon ou le budget.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence

WEIGHTS: Dict[str, float] = {
    "distance": 0.25,
    "price": 0.20,
    "availability": 0.20,
    "rating": 0.20,
    "experience": 0.10,
    "massage_type": 0.05,
}

AVAILABILITY_HORIZON_MIN = 240  # minutes (4 heures)
PRIOR_REVIEWS = 5  # avis fictifs du lissage bayésien
PRIOR_RATING = 4.0  # note des avis fictifs
MAX_EXPERIENCE_YEARS = 10
DEFAULT_MAX_DISTANCE_KM = 10.0
DEFAULT_TOP_K = 10
UNKNOWN_TYPE_SCORE = 0.5  # spécialités non renseignées : score neutre
EARTH_RADIUS_KM = 6371.0088


# ---------------------------------------------------------------------------
# Géométrie
# ---------------------------------------------------------------------------

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance orthodromique (formule de Haversine) en kilomètres."""
    lat1, lon1, lat2, lon2 = (float(v) for v in (lat1, lon1, lat2, lon2))
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(a)))


# ---------------------------------------------------------------------------
# Structures
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Candidate:
    """Masseur candidat, tel que construit par la couche d'accès aux données.

    available_in_min : 0 = disponible immédiatement ; N = disponible dans N
    minutes ; None = indisponible ou délai inconnu (sous-score nul).
    offers_massage_type : True / False, ou None si les spécialités ne sont pas
    renseignées (score neutre de 0,5).
    """

    therapist_id: int
    distance_km: float
    price: float
    rating: float = 0.0
    review_count: int = 0
    experience_years: int = 0
    available_in_min: Optional[float] = None
    offers_massage_type: Optional[bool] = None
    extra: Dict[str, object] = field(default_factory=dict, compare=False, hash=False)


@dataclass(frozen=True)
class ScoredCandidate:
    candidate: Candidate
    score: float  # entre 0 et 1
    sub_scores: Dict[str, float]
    rank: int = 0


@dataclass(frozen=True)
class EmptyResultSuggestion:
    """Proposition faite au client lorsqu'aucun masseur ne satisfait la demande."""

    message: str
    suggested_max_distance_km: Optional[float]
    suggested_budget: Optional[float]


# ---------------------------------------------------------------------------
# Sous-scores (chacun renvoie une valeur dans [0, 1])
# ---------------------------------------------------------------------------

def _clip01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def distance_score(distance_km: float, max_distance_km: float) -> float:
    if max_distance_km <= 0:
        return 1.0 if distance_km <= 0 else 0.0
    return _clip01(1.0 - float(distance_km) / float(max_distance_km))


def price_score(price: float, reference: float) -> float:
    """reference = budget du client, ou prix maximal des candidats."""
    if reference is None or reference <= 0:
        return 0.5
    return _clip01(1.0 - float(price) / float(reference))


def availability_score(available_in_min: Optional[float]) -> float:
    if available_in_min is None:
        return 0.0
    return _clip01(1.0 - max(float(available_in_min), 0.0) / AVAILABILITY_HORIZON_MIN)


def smoothed_rating(rating: float, review_count: int) -> float:
    """Note lissée : (n·r + 5·4,0) / (n + 5). Évite qu'un seul avis de 5 étoiles
    ne devance un masseur très bien noté sur cent avis."""
    n = max(int(review_count or 0), 0)
    r = max(float(rating or 0.0), 0.0) if n > 0 else 0.0
    return (n * r + PRIOR_REVIEWS * PRIOR_RATING) / (n + PRIOR_REVIEWS)


def rating_score(rating: float, review_count: int) -> float:
    return _clip01(smoothed_rating(rating, review_count) / 5.0)


def experience_score(years: Optional[int]) -> float:
    return _clip01(min(max(int(years or 0), 0), MAX_EXPERIENCE_YEARS) / MAX_EXPERIENCE_YEARS)


def type_score(offers_type: Optional[bool], type_requested: bool) -> float:
    if not type_requested:
        return 1.0  # aucun type demandé : critère neutre pour tous
    if offers_type is None:
        return UNKNOWN_TYPE_SCORE
    return 1.0 if offers_type else 0.0


# ---------------------------------------------------------------------------
# Classement
# ---------------------------------------------------------------------------

def filter_candidates(
    candidates: Sequence[Candidate],
    budget: Optional[float] = None,
    max_distance_km: Optional[float] = None,
) -> List[Candidate]:
    """Écarte les candidats hors budget ou hors rayon (avant tout calcul)."""
    kept: List[Candidate] = []
    for c in candidates:
        if budget is not None and budget > 0 and c.price > budget:
            continue
        if max_distance_km is not None and c.distance_km > max_distance_km:
            continue
        kept.append(c)
    return kept


def score_candidate(
    c: Candidate,
    max_distance_km: float,
    price_reference: float,
    type_requested: bool = False,
) -> ScoredCandidate:
    sub = {
        "distance": distance_score(c.distance_km, max_distance_km),
        "price": price_score(c.price, price_reference) if c.price > 0 else 0.5,
        "availability": availability_score(c.available_in_min),
        "rating": rating_score(c.rating, c.review_count),
        "experience": experience_score(c.experience_years),
        "massage_type": type_score(c.offers_massage_type, type_requested),
    }
    total = sum(WEIGHTS[k] * sub[k] for k in WEIGHTS)
    return ScoredCandidate(candidate=c, score=_clip01(total), sub_scores=sub)


def rank_candidates(
    candidates: Sequence[Candidate],
    budget: Optional[float] = None,
    max_distance_km: Optional[float] = None,
    type_requested: bool = False,
    top_k: int = DEFAULT_TOP_K,
) -> List[ScoredCandidate]:
    """Filtre, note puis classe les candidats ; renvoie au plus `top_k` éléments.

    Tri : score décroissant, puis distance croissante, puis identifiant.
    """
    dmax = float(max_distance_km) if max_distance_km else DEFAULT_MAX_DISTANCE_KM
    kept = filter_candidates(candidates, budget=budget, max_distance_km=dmax)
    if not kept:
        return []

    if budget is not None and budget > 0:
        reference = float(budget)
    else:
        reference = max([c.price for c in kept if c.price > 0] or [0.0])

    scored = [score_candidate(c, dmax, reference, type_requested) for c in kept]
    # Arrondi à 6 décimales : évite qu'un bruit flottant masque une égalité réelle.
    scored.sort(
        key=lambda s: (
            -round(s.score, 6),
            s.candidate.distance_km,
            s.candidate.therapist_id,
        )
    )
    if top_k and top_k > 0:
        scored = scored[:top_k]
    return [
        ScoredCandidate(s.candidate, s.score, s.sub_scores, rank=i + 1)
        for i, s in enumerate(scored)
    ]


def suggest_when_empty(
    candidates: Sequence[Candidate],
    budget: Optional[float] = None,
    max_distance_km: Optional[float] = None,
) -> EmptyResultSuggestion:
    """Aucun masseur ne satisfait la demande : propose d'élargir rayon et/ou budget.

    Les valeurs proposées sont les plus petites qui feraient apparaître au moins
    un candidat (rayon seul, budget seul, ou les deux).
    """
    dmax = float(max_distance_km) if max_distance_km else DEFAULT_MAX_DISTANCE_KM
    if not candidates:
        return EmptyResultSuggestion(
            "Aucun masseur n'est disponible pour le moment. Réessayez plus tard.",
            None,
            None,
        )

    within_budget = [c for c in candidates if not budget or c.price <= budget]
    within_radius = [c for c in candidates if c.distance_km <= dmax]

    new_radius: Optional[float] = None
    new_budget: Optional[float] = None
    if within_budget:
        new_radius = math.ceil(min(c.distance_km for c in within_budget))
        new_radius = float(max(new_radius, dmax + 1))
    if within_radius and budget:
        new_budget = float(math.ceil(min(c.price for c in within_radius) / 500) * 500)

    if new_radius and new_budget:
        message = (
            f"Aucun masseur ne correspond. Essayez d'élargir le rayon à "
            f"{new_radius:.0f} km ou d'augmenter le budget à {new_budget:,.0f} Ar."
        ).replace(",", " ")
    elif new_radius:
        message = f"Aucun masseur ne correspond. Essayez d'élargir le rayon à {new_radius:.0f} km."
    elif new_budget:
        message = (
            f"Aucun masseur ne correspond. Essayez d'augmenter le budget à {new_budget:,.0f} Ar."
        ).replace(",", " ")
    else:
        new_radius = float(max(math.ceil(min(c.distance_km for c in candidates)), dmax + 1))
        if budget:
            new_budget = float(math.ceil(min(c.price for c in candidates) / 500) * 500)
        message = "Aucun masseur ne correspond. Essayez d'élargir le rayon et le budget."
    return EmptyResultSuggestion(message, new_radius, new_budget)
