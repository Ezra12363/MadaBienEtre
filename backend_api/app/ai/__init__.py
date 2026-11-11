"""Logique IA pure (sans FastAPI) de Mada Bien-être.

Les services branchés sur la base de données et les modèles entraînés se
trouvent dans app/services/ai/.
"""

from .pricing_rules import (  # noqa: F401
    commission_split,
    estimate_demand,
    round_to_step,
    rule_based_price,
)
from .recommender import (  # noqa: F401
    WEIGHTS,
    Candidate,
    ScoredCandidate,
    haversine_km,
    rank_candidates,
    suggest_when_empty,
)
