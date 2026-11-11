"""Modèles d'apprentissage du module IA : prix conseillé et acceptation.

  * Prix conseillé  : GradientBoostingRegressor (400 arbres, taux 0,05,
    profondeur 3), grille de recherche à validation croisée 3 plis, découpage
    80/20, graine 42 (mémoire §6.3.2, §8.4).
  * Acceptation     : StandardScaler + LogisticRegression sur le rapport
    prix proposé / prix de référence, la distance, l'heure, la durée, la
    demande et le type (mémoire §6.3.3).

Ce module ne dépend ni de FastAPI ni de la base : il sait entraîner, sérialiser
(joblib), charger et prédire. L'enregistrement dans ai_models / ai_predictions
est fait par app/services/ai/.

Entraînement :   python scripts/train_models.py
"""

from __future__ import annotations

import json
import logging
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = BACKEND_ROOT / "models"
DATASET_PATH = BACKEND_ROOT / "data" / "dataset_reservations_simule.csv"

PRICE_MODEL_NAME = "price_gradient_boosting"
PRICE_MODEL_VERSION = "gb-v1"
PRICE_MODEL_FILE = "price_gradient_boosting_v1.joblib"

ACCEPTANCE_MODEL_NAME = "acceptance_logistic_regression"
ACCEPTANCE_MODEL_VERSION = "logreg-v1"
ACCEPTANCE_MODEL_FILE = "acceptance_logistic_v1.joblib"

RANDOM_SEED = 42
TEST_SIZE = 0.20
CV_FOLDS = 3
GB_PARAMS = {"n_estimators": 400, "learning_rate": 0.05, "max_depth": 3}
GB_GRID = {
    "model__n_estimators": [200, 400, 600],
    "model__learning_rate": [0.03, 0.05, 0.1],
    "model__max_depth": [2, 3, 4],
}

PRICE_NUMERIC = ["duration", "distance", "hour", "day", "experience", "demand"]
PRICE_FEATURES = ["type"] + PRICE_NUMERIC
ACCEPT_NUMERIC = ["price_ratio", "distance", "hour", "duration", "demand"]
ACCEPT_FEATURES = ACCEPT_NUMERIC + ["type"]

# Catégorie de la table massage_types -> type représentatif du jeu de données
CATEGORY_TO_TYPE = {
    "relaxant": "Massage Relaxant",
    "therapeutique": "Massage Thérapeutique",
    "sportif": "Massage Sportif",
    "reflexologie": "Réflexologie Plantaire",
    "prenatal": "Massage Prénatal",
    "personnalise": "Massage Relaxant",
}


def _strip(text: Any) -> str:
    text = unicodedata.normalize("NFD", str(text or "").lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn").strip()


def resolve_type(
    name: Optional[str],
    category: Optional[str] = None,
    known_types: Optional[List[str]] = None,
) -> Optional[str]:
    """Fait correspondre un nom de massage de la base à un type du jeu d'entraînement.

    1) égalité sans accent/casse ; 2) inclusion ; 3) catégorie ; sinon None.
    """
    known = known_types or list(set(CATEGORY_TO_TYPE.values()))
    if name:
        wanted = _strip(name)
        for k in known:
            if _strip(k) == wanted:
                return k
        for k in known:
            ks = _strip(k)
            if wanted and (wanted in ks or ks in wanted):
                return k
    if category:
        target = CATEGORY_TO_TYPE.get(_strip(category))
        if target and (target in known or known_types is None):
            return target
    return None


# ---------------------------------------------------------------------------
# Pipelines
# ---------------------------------------------------------------------------

def _price_pipeline(random_state: int = RANDOM_SEED, **gb_params):
    from sklearn.compose import ColumnTransformer
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder

    pre = ColumnTransformer(
        [("type", OneHotEncoder(handle_unknown="ignore"), ["type"])],
        remainder="passthrough",
    )
    model = GradientBoostingRegressor(random_state=random_state, **gb_params)
    return Pipeline([("pre", pre), ("model", model)])


def _acceptance_pipeline():
    from sklearn.compose import ColumnTransformer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder, StandardScaler

    pre = ColumnTransformer(
        [
            ("num", StandardScaler(), ACCEPT_NUMERIC),
            ("type", OneHotEncoder(handle_unknown="ignore"), ["type"]),
        ]
    )
    return Pipeline(
        [("pre", pre), ("model", LogisticRegression(max_iter=1000, random_state=RANDOM_SEED))]
    )


# ---------------------------------------------------------------------------
# Données
# ---------------------------------------------------------------------------

def load_dataset(path: Path = DATASET_PATH):
    import pandas as pd

    df = pd.read_csv(path)
    missing = set(PRICE_FEATURES + ["price"]) - set(df.columns)
    if missing:
        raise ValueError(f"Colonnes manquantes dans {path}: {sorted(missing)}")
    return df


def simulate_acceptance(df, seed: int = RANDOM_SEED):
    """Construit le jeu d'acceptation (mémoire §8.4.2).

    Le jeu ne contient pas de colonne « accepté » : les libellés sont simulés
    (graine 42). Pour chaque réservation, un ratio de concession (prix proposé /
    prix de référence) est tiré d'une loi normale N(0,95 ; 0,2) bornée à [0,5 ; 1,5] ;
    l'acceptation est ensuite tirée (Bernoulli) selon une probabilité logistique qui
    dépend du ratio, de la distance, de la demande, de la durée, de l'heure et du type
    de massage. Taux d'acceptation obtenu : ~47,7 % (classes équilibrées).
    À remplacer par les offres réellement négociées dès que l'historique le permet.
    """
    import numpy as np

    rng = np.random.default_rng(seed)
    n = len(df)
    types = sorted(df["type"].unique())
    type_effect = dict(zip(types, rng.normal(0.0, 0.15, len(types))))
    out = df.copy()
    ratio = np.clip(rng.normal(0.95, 0.2, n), 0.5, 1.5)
    logit = (
        7.0 * (ratio - 0.95)
        - 1.0 * (out["demand"].to_numpy() - 0.5)
        - 0.05 * (out["distance"].to_numpy() - 4.5)
        + 0.004 * (out["duration"].to_numpy() - 75)
        - 0.005 * (out["hour"].to_numpy() - 14)
        + out["type"].map(type_effect).to_numpy()
    )
    out["price_ratio"] = ratio
    out["accepted"] = (rng.random(n) < 1.0 / (1.0 + np.exp(-logit))).astype(int)
    return out


# ---------------------------------------------------------------------------
# Entraînement
# ---------------------------------------------------------------------------

def _price_metrics(y_true, y_pred) -> Dict[str, float]:
    import numpy as np
    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)),
        "mape": float(np.mean(np.abs((y_true - y_pred) / y_true)) * 100),
    }


def train_price_model(
    df=None,
    run_grid: bool = True,
    n_jobs: int = -1,
    full_report: bool = True,
) -> Dict[str, Any]:
    """Entraîne le Gradient Boosting et renvoie {pipeline, meta, report}."""
    import numpy as np
    import sklearn
    from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
    from sklearn.linear_model import LinearRegression
    from sklearn.model_selection import GridSearchCV, cross_val_score, train_test_split

    from .pricing_rules import rule_based_price

    df = load_dataset() if df is None else df
    X = df[PRICE_FEATURES]
    y = df["price"].astype(float)
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED
    )

    report: Dict[str, Any] = {"n_rows": int(len(df)), "n_train": int(len(X_tr)), "n_test": int(len(X_te))}

    if run_grid:
        search = GridSearchCV(
            _price_pipeline(),
            GB_GRID,
            cv=CV_FOLDS,
            scoring="neg_mean_absolute_error",
            n_jobs=n_jobs,
        )
        search.fit(X_tr, y_tr)
        res = search.cv_results_
        order = np.argsort(res["rank_test_score"])
        report["grid_top5"] = [
            {
                "n_estimators": int(res["param_model__n_estimators"][i]),
                "learning_rate": float(res["param_model__learning_rate"][i]),
                "max_depth": int(res["param_model__max_depth"][i]),
                "cv_mae": float(-res["mean_test_score"][i]),
            }
            for i in order[:5]
        ]
        best = search.best_params_
        report["grid_best"] = {k.replace("model__", ""): v for k, v in best.items()}
        report["grid_combinations"] = int(len(res["params"]))

    # Configuration retenue (cahier des charges / mémoire §8.4.2)
    pipeline = _price_pipeline(**GB_PARAMS)
    pipeline.fit(X_tr, y_tr)
    pred = pipeline.predict(X_te)
    metrics = _price_metrics(y_te, pred)
    metrics["cv_mae_retained"] = float(
        -cross_val_score(
            _price_pipeline(**GB_PARAMS), X_tr, y_tr, cv=CV_FOLDS,
            scoring="neg_mean_absolute_error", n_jobs=n_jobs,
        ).mean()
    )
    report["retained_params"] = dict(GB_PARAMS)
    report["metrics_test"] = metrics

    if full_report:
        # Tableau 54 : comparaison des modèles sur le jeu de test
        train_rows = df.loc[X_tr.index]
        base_by_type = (
            train_rows[train_rows["duration"] == 60].groupby("type")["price"].median().to_dict()
        )
        fallback_base = float(np.median(list(base_by_type.values())))
        rule_pred = [
            rule_based_price(
                base_by_type.get(r.type, fallback_base), r.duration, r.distance, r.hour, r.demand
            )
            for r in X_te.itertuples()
        ]
        models: Dict[str, Any] = {"Règle métier (référence)": _price_metrics(y_te, rule_pred)}
        for label, est in (
            ("Régression linéaire", LinearRegression()),
            ("Forêt aléatoire", RandomForestRegressor(n_estimators=200, random_state=RANDOM_SEED, n_jobs=n_jobs)),
            ("Gradient Boosting (paramètres par défaut)", GradientBoostingRegressor(random_state=RANDOM_SEED)),
        ):
            from sklearn.compose import ColumnTransformer
            from sklearn.pipeline import Pipeline
            from sklearn.preprocessing import OneHotEncoder

            p = Pipeline([
                ("pre", ColumnTransformer([("type", OneHotEncoder(handle_unknown="ignore"), ["type"])], remainder="passthrough")),
                ("model", est),
            ])
            p.fit(X_tr, y_tr)
            models[label] = _price_metrics(y_te, p.predict(X_te))
        models["Gradient Boosting (optimisé)"] = metrics
        report["comparison_test"] = models

        cv5 = cross_val_score(_price_pipeline(**GB_PARAMS), X, y, cv=5, scoring="r2", n_jobs=n_jobs)
        report["cv5_r2_mean"] = float(cv5.mean())
        report["cv5_r2_std"] = float(cv5.std())

        # Importance des variables (type = somme des indicatrices)
        names = pipeline.named_steps["pre"].get_feature_names_out()
        imp = pipeline.named_steps["model"].feature_importances_
        agg: Dict[str, float] = {}
        for nme, v in zip(names, imp):
            key = "type" if nme.startswith("type__") else nme.split("__", 1)[-1]
            agg[key] = agg.get(key, 0.0) + float(v)
        report["feature_importance"] = dict(sorted(agg.items(), key=lambda kv: -kv[1]))

        # Courbe d'apprentissage (MAE selon le nombre d'arbres)
        gb = pipeline.named_steps["model"]
        Xt_tr = pipeline.named_steps["pre"].transform(X_tr)
        Xt_te = pipeline.named_steps["pre"].transform(X_te)
        report["learning_curve"] = {
            "train_mae": [float(np.mean(np.abs(y_tr - p))) for p in gb.staged_predict(Xt_tr)][9::10],
            "test_mae": [float(np.mean(np.abs(y_te - p))) for p in gb.staged_predict(Xt_te)][9::10],
            "step": 10,
        }

    stats = {
        "types": sorted(df["type"].unique().tolist()),
        "price_mean": float(df["price"].mean()),
        "price_std": float(df["price"].std()),
        "price_min": float(df["price"].min()),
        "price_max": float(df["price"].max()),
        "median_experience": float(df["experience"].median()),
    }
    meta = {
        "name": PRICE_MODEL_NAME,
        "version": PRICE_MODEL_VERSION,
        "model_type": "regression",
        "algorithm": "GradientBoostingRegressor",
        "params": dict(GB_PARAMS),
        "features": PRICE_FEATURES,
        "metrics": metrics,
        "dataset_stats": stats,
        "trained_at": datetime.utcnow().isoformat(timespec="seconds"),
        "sklearn_version": sklearn.__version__,
        "seed": RANDOM_SEED,
    }
    return {"pipeline": pipeline, "meta": meta, "report": report}


def train_acceptance_model(df=None, full_report: bool = True, n_jobs: int = -1) -> Dict[str, Any]:
    """Entraîne la régression logistique d'acceptation."""
    import sklearn
    from sklearn.compose import ColumnTransformer
    from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
    from sklearn.metrics import (
        accuracy_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score,
    )
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder, StandardScaler

    df = load_dataset() if df is None else df
    data = simulate_acceptance(df)
    X, y = data[ACCEPT_FEATURES], data["accepted"]
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED, stratify=y
    )

    def _eval(pipe) -> Dict[str, float]:
        pipe.fit(X_tr, y_tr)
        proba = pipe.predict_proba(X_te)[:, 1]
        pred = (proba >= 0.5).astype(int)
        return {
            "accuracy": float(accuracy_score(y_te, pred)),
            "precision": float(precision_score(y_te, pred)),
            "recall": float(recall_score(y_te, pred)),
            "f1": float(f1_score(y_te, pred)),
            "auc": float(roc_auc_score(y_te, proba)),
        }

    pipeline = _acceptance_pipeline()
    metrics = _eval(pipeline)
    proba = pipeline.predict_proba(X_te)[:, 1]
    tn, fp, fn, tp = confusion_matrix(y_te, (proba >= 0.5).astype(int)).ravel()

    report: Dict[str, Any] = {
        "n_test": int(len(X_te)),
        "acceptance_rate": float(y.mean()),
        "metrics_test": metrics,
        "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }
    if full_report:
        def _tree_pipe(est):
            return Pipeline([
                ("pre", ColumnTransformer(
                    [("type", OneHotEncoder(handle_unknown="ignore"), ["type"])], remainder="passthrough")),
                ("model", est),
            ])
        report["comparison_test"] = {
            "Régression logistique": metrics,
            "Forêt aléatoire": _eval(_tree_pipe(RandomForestClassifier(n_estimators=200, random_state=RANDOM_SEED, n_jobs=n_jobs))),
            "Gradient Boosting": _eval(_tree_pipe(GradientBoostingClassifier(random_state=RANDOM_SEED))),
        }
        # _eval a ré-entraîné d'autres pipelines : on ré-entraîne le modèle retenu
        pipeline.fit(X_tr, y_tr)

    meta = {
        "name": ACCEPTANCE_MODEL_NAME,
        "version": ACCEPTANCE_MODEL_VERSION,
        "model_type": "classification",
        "algorithm": "StandardScaler + LogisticRegression",
        "features": ACCEPT_FEATURES,
        "metrics": metrics,
        "acceptance_rate": float(y.mean()),
        "types": sorted(df["type"].unique().tolist()),
        "trained_at": datetime.utcnow().isoformat(timespec="seconds"),
        "sklearn_version": sklearn.__version__,
        "seed": RANDOM_SEED,
    }
    return {"pipeline": pipeline, "meta": meta, "report": report}


# ---------------------------------------------------------------------------
# Sérialisation / chargement
# ---------------------------------------------------------------------------

def save_artifact(result: Dict[str, Any], filename: str, models_dir: Path = MODELS_DIR) -> Path:
    import joblib

    models_dir.mkdir(parents=True, exist_ok=True)
    path = models_dir / filename
    joblib.dump({"pipeline": result["pipeline"], "meta": result["meta"]}, path, compress=3)
    return path


def save_report(report: Dict[str, Any], filename: str, models_dir: Path = MODELS_DIR) -> Path:
    models_dir.mkdir(parents=True, exist_ok=True)
    path = models_dir / filename
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


class _LoadedModel:
    def __init__(self, pipeline, meta: Dict[str, Any], path: Path):
        self.pipeline = pipeline
        self.meta = meta
        self.path = path

    @property
    def version(self) -> str:
        return str(self.meta.get("version", "unknown"))

    @property
    def known_types(self) -> List[str]:
        return list(self.meta.get("dataset_stats", {}).get("types") or self.meta.get("types") or [])


class PriceModel(_LoadedModel):
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
            [{
                "type": type_name,
                "duration": float(duration),
                "distance": float(distance),
                "hour": int(hour),
                "day": int(day),
                "experience": float(experience),
                "demand": float(demand),
            }]
        )[PRICE_FEATURES]
        return float(self.pipeline.predict(row)[0])


class AcceptanceModel(_LoadedModel):
    def predict_proba(
        self,
        type_name: str,
        price_ratio: float,
        distance: float,
        hour: int,
        duration: float,
        demand: float,
    ) -> float:
        import pandas as pd

        row = pd.DataFrame(
            [{
                "price_ratio": float(price_ratio),
                "distance": float(distance),
                "hour": int(hour),
                "duration": float(duration),
                "demand": float(demand),
                "type": type_name,
            }]
        )[ACCEPT_FEATURES]
        return float(self.pipeline.predict_proba(row)[0, 1])


def _load(filename: str, cls, models_dir: Path):
    path = models_dir / filename
    if not path.exists():
        logger.warning("Modèle absent : %s (repli sur la règle métier)", path)
        return None
    try:
        import joblib

        blob = joblib.load(path)
        return cls(blob["pipeline"], blob["meta"], path)
    except Exception:  # noqa: BLE001 — version scikit-learn différente, fichier corrompu…
        logger.exception(
            "Impossible de charger %s (réentraînez : python scripts/train_models.py)", path
        )
        return None


def load_price_model(models_dir: Path = MODELS_DIR) -> Optional[PriceModel]:
    return _load(PRICE_MODEL_FILE, PriceModel, models_dir)


def load_acceptance_model(models_dir: Path = MODELS_DIR) -> Optional[AcceptanceModel]:
    return _load(ACCEPTANCE_MODEL_FILE, AcceptanceModel, models_dir)


def artifact_exists(filename: str, models_dir: Path = MODELS_DIR) -> bool:
    return (models_dir / filename).exists()


def retrain_fast(models_dir: Path = MODELS_DIR) -> None:
    """Réentraîne rapidement (sans grille ni comparaisons) et réécrit les .joblib.

    Utilisé au démarrage lorsqu'un fichier existe mais n'est pas lisible
    (version de scikit-learn différente). Les mêmes hyperparamètres retenus et la
    même graine sont appliqués, donc les performances sont identiques.
    """
    df = load_dataset()
    save_artifact(train_price_model(df, run_grid=False, full_report=False), PRICE_MODEL_FILE, models_dir)
    save_artifact(train_acceptance_model(df, full_report=False), ACCEPTANCE_MODEL_FILE, models_dir)
