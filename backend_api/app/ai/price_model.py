"""Prix conseillé — Gradient Boosting (Mémoire §6.2.2, Tableaux 35 et 40).

GradientBoostingRegressor (400 arbres, learning_rate 0,05, profondeur 3,
graine 42) entraîné sur dataset_reservations_simule.csv.
Module pur : aucune dépendance à FastAPI / SQLAlchemy.
"""

from __future__ import annotations

import logging
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

SEED = 42
MODEL_NAME = "price_gradient_boosting"
MODEL_VERSION = "v1"
MODEL_FILENAME = f"{MODEL_NAME}_{MODEL_VERSION}.joblib"
PRICE_STEP = 500

CATEGORICAL = ["type"]
NUMERIC = ["duration", "distance", "hour", "day", "experience", "demand"]
FEATURES = CATEGORICAL + NUMERIC

DEFAULT_HYPERPARAMS = {"n_estimators": 400, "learning_rate": 0.05, "max_depth": 3}
PARAM_GRID = {  # 3 x 3 x 3 = 27 combinaisons, validation croisée 3 plis
    "model__n_estimators": [200, 400, 600],
    "model__learning_rate": [0.03, 0.05, 0.1],
    "model__max_depth": [2, 3, 4],
}

# demand_level (API) -> demande normalisée du dataset (0..1)
DEMAND_LEVELS = {"low": 0.2, "medium": 0.5, "high": 0.8}


def round_to_step(value: float, step: int = PRICE_STEP) -> float:
    """Arrondi à 500 Ar."""
    return float(round(float(value) / step) * step)


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFD", (text or "").lower().strip())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def build_pipeline(hyperparams: Optional[Dict[str, Any]] = None):
    from sklearn.compose import ColumnTransformer
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder

    params = {**DEFAULT_HYPERPARAMS, **(hyperparams or {})}
    pre = ColumnTransformer(
        [
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL),
            ("num", "passthrough", NUMERIC),
        ]
    )
    model = GradientBoostingRegressor(random_state=SEED, **params)
    return Pipeline([("pre", pre), ("model", model)])


def train(
    csv_path: str | Path,
    out_path: str | Path,
    grid_search: bool = True,
    use_best: bool = False,
) -> Dict[str, Any]:
    """Entraîne, évalue (split 80/20, graine 42) et sérialise le modèle.

    * GridSearchCV (27 combinaisons, CV 3 plis) : toujours exécutée si
      `grid_search` ; ses résultats sont consignés dans le bundle.
    * Le modèle DÉPLOYÉ utilise par défaut les hyperparamètres du mémoire
      (400 arbres, lr 0,05, profondeur 3). `use_best=True` déploie plutôt
      la meilleure combinaison trouvée par la grille.
    """
    import joblib
    import pandas as pd
    from sklearn.metrics import mean_absolute_error, r2_score
    from sklearn.model_selection import GridSearchCV, train_test_split

    df = pd.read_csv(csv_path)
    X, y = df[FEATURES], df["price"]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=SEED)

    grid_info: Dict[str, Any] = {}
    final_params = dict(DEFAULT_HYPERPARAMS)
    if grid_search:
        gs = GridSearchCV(
            build_pipeline(), PARAM_GRID, cv=3, scoring="neg_mean_absolute_error",
            n_jobs=-1, refit=False,
        )
        gs.fit(X_tr, y_tr)
        best = {k.replace("model__", ""): v for k, v in gs.best_params_.items()}
        grid_info = {
            "combinations": len(gs.cv_results_["params"]),
            "cv_folds": 3,
            "best_params": best,
            "best_cv_mae": float(-gs.best_score_),
        }
        if use_best:
            final_params = best

    pipe = build_pipeline(final_params).fit(X_tr, y_tr)
    pred = pipe.predict(X_te)
    metrics = {
        "mae": float(mean_absolute_error(y_te, pred)),
        "r2": float(r2_score(y_te, pred)),
        "n_train": int(len(X_tr)),
        "n_test": int(len(X_te)),
    }
    bundle = {
        "pipeline": pipe,
        "name": MODEL_NAME,
        "version": MODEL_VERSION,
        "features": FEATURES,
        "known_types": sorted(df["type"].unique().tolist()),
        "best_params": final_params,
        "grid_search": grid_info,
        "metrics": metrics,
        "trained_at": datetime.utcnow().isoformat(timespec="seconds"),
        "dataset_rows": int(len(df)),
    }
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, out_path)
    return bundle


@dataclass
class PriceModel:
    bundle: Dict[str, Any]

    @property
    def version(self) -> str:
        return f"{self.bundle.get('name', MODEL_NAME)}_{self.bundle.get('version', MODEL_VERSION)}"

    @property
    def metrics(self) -> Dict[str, float]:
        return self.bundle.get("metrics", {})

    def resolve_type(self, name: Optional[str]) -> str:
        """Fait correspondre un nom de type de massage au vocabulaire d'entraînement."""
        known = self.bundle.get("known_types", [])
        wanted = _norm(name or "")
        for k in known:
            if _norm(k) == wanted:
                return k
        for k in known:  # correspondance partielle (« relaxant » -> « Massage Relaxant »)
            nk = _norm(k)
            if wanted and (wanted in nk or nk in wanted):
                return k
        return name or ""

    def predict(
        self,
        type_name: str,
        duration: float,
        distance: float,
        hour: int,
        day: int,
        experience: float,
        demand: float,
    ) -> float:
        import pandas as pd

        row = pd.DataFrame(
            [
                {
                    "type": self.resolve_type(type_name),
                    "duration": float(duration),
                    "distance": float(distance),
                    "hour": int(hour),
                    "day": int(day),
                    "experience": float(experience),
                    "demand": float(demand),
                }
            ]
        )[FEATURES]
        return round_to_step(float(self.bundle["pipeline"].predict(row)[0]))


_cached: Optional[PriceModel] = None
_cached_path: Optional[str] = None


def load_model(path: str | Path) -> Optional[PriceModel]:
    """Charge le .joblib ; renvoie None s'il est absent ou illisible (repli métier)."""
    global _cached, _cached_path
    path = str(path)
    if _cached is not None and _cached_path == path:
        return _cached
    try:
        import joblib

        if not Path(path).is_file():
            logger.warning("Modèle de prix absent (%s) : repli sur la règle métier.", path)
            return None
        _cached = PriceModel(joblib.load(path))
        _cached_path = path
        logger.info("Modèle de prix chargé : %s", _cached.version)
        return _cached
    except Exception:  # noqa: BLE001
        logger.exception("Chargement du modèle de prix impossible : repli sur la règle métier.")
        return None


def reset_cache() -> None:
    global _cached, _cached_path
    _cached, _cached_path = None, None
