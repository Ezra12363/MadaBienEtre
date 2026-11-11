"""Probabilité d'acceptation d'un prix — régression logistique (Mémoire §6.2.3).

Pipeline : StandardScaler (variables numériques) + one-hot (type) +
LogisticRegression, sur le ratio prix proposé / prix de référence, la
distance, l'heure, la durée, la demande et le type de massage.

Convention du ratio (« ratio de concession ») :
  * proposition du CLIENT      : ratio = prix proposé / prix de référence
  * contre-proposition THÉRAPEUTE : ratio = prix de référence / prix proposé
Dans les deux cas, plus le ratio est élevé, plus la proposition est
avantageuse pour la partie qui doit accepter.

Le CSV ne contient pas de colonne « accepté » : les libellés d'entraînement
sont donc SIMULÉS à partir du CSV (graine 42) par `make_training_frame`.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

SEED = 42
MODEL_NAME = "acceptance_logistic_regression"
MODEL_VERSION = "v1"
MODEL_FILENAME = f"{MODEL_NAME}_{MODEL_VERSION}.joblib"

CATEGORICAL = ["type"]
NUMERIC = ["price_ratio", "distance", "hour", "duration", "demand"]
FEATURES = NUMERIC + CATEGORICAL

TARGET_PROBABILITY = 0.75  # seuil pour le prix recommandé


def concession_ratio(proposed: float, reference: float, proposer_role: str = "CLIENT") -> float:
    proposed, reference = float(proposed), float(reference)
    if proposed <= 0 or reference <= 0:
        return 1.0
    if str(proposer_role).upper() == "THERAPIST":
        return reference / proposed
    return proposed / reference


def make_training_frame(df, seed: int = SEED):
    """Construit un jeu d'entraînement (features + `accepted`) à partir du CSV."""
    import numpy as np
    import pandas as pd

    rng = np.random.default_rng(seed)
    n = len(df)
    ratio = np.clip(rng.normal(0.95, 0.2, n), 0.5, 1.5)

    types = sorted(df["type"].unique())
    type_offset = {t: rng.normal(0, 0.25) for t in types}

    z = (
        7.0 * (ratio - 0.95)
        - 0.10 * (df["distance"].to_numpy() - 4.4)
        + 1.2 * (df["demand"].to_numpy() - 0.5)
        + 0.004 * (df["duration"].to_numpy() - 80)
        + 0.05 * (df["hour"].to_numpy() - 16)
        + df["type"].map(type_offset).to_numpy()
    )
    proba = 1.0 / (1.0 + np.exp(-z))
    accepted = (rng.random(n) < proba).astype(int)

    return pd.DataFrame(
        {
            "price_ratio": ratio,
            "distance": df["distance"].to_numpy(),
            "hour": df["hour"].to_numpy(),
            "duration": df["duration"].to_numpy(),
            "demand": df["demand"].to_numpy(),
            "type": df["type"].to_numpy(),
            "accepted": accepted,
        }
    )


def build_pipeline():
    from sklearn.compose import ColumnTransformer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder, StandardScaler

    pre = ColumnTransformer(
        [
            ("num", StandardScaler(), NUMERIC),
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL),
        ]
    )
    return Pipeline(
        [("pre", pre), ("model", LogisticRegression(max_iter=1000, random_state=SEED))]
    )


def train(csv_path: str | Path, out_path: str | Path) -> Dict[str, Any]:
    import joblib
    import pandas as pd
    from sklearn.metrics import accuracy_score, roc_auc_score
    from sklearn.model_selection import train_test_split

    df = pd.read_csv(csv_path)
    frame = make_training_frame(df)
    X, y = frame[FEATURES], frame["accepted"]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=SEED, stratify=y)

    pipe = build_pipeline().fit(X_tr, y_tr)
    proba = pipe.predict_proba(X_te)[:, 1]
    metrics = {
        "accuracy": float(accuracy_score(y_te, proba >= 0.5)),
        "auc": float(roc_auc_score(y_te, proba)),
        "n_train": int(len(X_tr)),
        "n_test": int(len(X_te)),
        "positive_rate": float(y.mean()),
    }
    bundle = {
        "pipeline": pipe,
        "name": MODEL_NAME,
        "version": MODEL_VERSION,
        "features": FEATURES,
        "known_types": sorted(df["type"].unique().tolist()),
        "metrics": metrics,
        "trained_at": datetime.utcnow().isoformat(timespec="seconds"),
        "labels": "simulated",
    }
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, out_path)
    return bundle


@dataclass
class AcceptanceModel:
    bundle: Dict[str, Any]

    @property
    def version(self) -> str:
        return f"{self.bundle.get('name', MODEL_NAME)}_{self.bundle.get('version', MODEL_VERSION)}"

    @property
    def metrics(self) -> Dict[str, float]:
        return self.bundle.get("metrics", {})

    def probability(
        self,
        price_ratio: float,
        distance: float,
        hour: int,
        duration: float,
        demand: float,
        type_name: str = "",
    ) -> float:
        import pandas as pd

        row = pd.DataFrame(
            [
                {
                    "price_ratio": float(price_ratio),
                    "distance": float(distance),
                    "hour": int(hour),
                    "duration": float(duration),
                    "demand": float(demand),
                    "type": type_name or "",
                }
            ]
        )[FEATURES]
        return float(self.bundle["pipeline"].predict_proba(row)[0, 1])

    def recommend_ratio(self, **ctx) -> Tuple[float, float]:
        """Plus petit ratio de concession dont la probabilité atteint TARGET_PROBABILITY.

        Renvoie (ratio, probabilité). Si le seuil n'est jamais atteint, 1.0.
        """
        r = 0.60
        while r <= 1.40:
            p = self.probability(price_ratio=r, **ctx)
            if p >= TARGET_PROBABILITY:
                return round(r, 2), p
            r += 0.01
        return 1.0, self.probability(price_ratio=1.0, **ctx)


_cached: Optional[AcceptanceModel] = None
_cached_path: Optional[str] = None


def load_model(path: str | Path) -> Optional[AcceptanceModel]:
    global _cached, _cached_path
    path = str(path)
    if _cached is not None and _cached_path == path:
        return _cached
    try:
        import joblib

        if not Path(path).is_file():
            logger.warning("Modèle d'acceptation absent (%s) : repli sur l'heuristique.", path)
            return None
        _cached = AcceptanceModel(joblib.load(path))
        _cached_path = path
        logger.info("Modèle d'acceptation chargé : %s", _cached.version)
        return _cached
    except Exception:  # noqa: BLE001
        logger.exception("Chargement du modèle d'acceptation impossible : repli heuristique.")
        return None


def reset_cache() -> None:
    global _cached, _cached_path
    _cached, _cached_path = None, None
