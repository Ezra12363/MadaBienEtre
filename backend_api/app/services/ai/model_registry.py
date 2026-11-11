"""Registre des modèles IA : chargement au démarrage + enregistrement dans ai_models.

Les modèles sérialisés (joblib) sont chargés UNE fois au démarrage du serveur
(mémoire §6.4). S'ils sont absents ou illisibles, les services retombent sur la
règle métier / l'heuristique : l'API ne tombe jamais en panne à cause d'eux.
"""

from __future__ import annotations

import logging
import os
import threading
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from ...ai import ml_models as ml

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_price_model: Optional[ml.PriceModel] = None
_acceptance_model: Optional[ml.AcceptanceModel] = None
_loaded = False


def load_models(force: bool = False) -> Dict[str, bool]:
    """Charge les modèles depuis backend/models/. Idempotent."""
    global _price_model, _acceptance_model, _loaded
    with _lock:
        if _loaded and not force:
            return status()
        _price_model = ml.load_price_model()
        _acceptance_model = ml.load_acceptance_model()

        # Fichier présent mais illisible (autre version de scikit-learn) : on
        # réentraîne une fois, rapidement, plutôt que de rester sur la règle de repli.
        unreadable = (
            _price_model is None and ml.artifact_exists(ml.PRICE_MODEL_FILE)
        ) or (
            _acceptance_model is None and ml.artifact_exists(ml.ACCEPTANCE_MODEL_FILE)
        )
        if unreadable and os.getenv("AI_AUTO_RETRAIN", "1") != "0" and ml.DATASET_PATH.exists():
            try:
                logger.warning("Modèles IA illisibles : réentraînement rapide au démarrage")
                ml.retrain_fast()
                _price_model = ml.load_price_model()
                _acceptance_model = ml.load_acceptance_model()
            except Exception:  # noqa: BLE001
                logger.exception("Réentraînement automatique impossible")
        _loaded = True
    logger.info(
        "Modèles IA : prix=%s, acceptation=%s",
        _price_model.version if _price_model else "ABSENT (règle métier)",
        _acceptance_model.version if _acceptance_model else "ABSENT (heuristique)",
    )
    return status()


def status() -> Dict[str, bool]:
    return {"price_model": _price_model is not None, "acceptance_model": _acceptance_model is not None}


def get_price_model() -> Optional[ml.PriceModel]:
    if not _loaded:
        load_models()
    return _price_model


def get_acceptance_model() -> Optional[ml.AcceptanceModel]:
    if not _loaded:
        load_models()
    return _acceptance_model


def _parse_dt(value: Any) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def _upsert(db: Session, model: ml._LoadedModel, name: str, is_classifier: bool) -> None:
    from ...models.ai_prediction import AIModel

    meta = model.meta
    metrics = meta.get("metrics", {})
    row = db.query(AIModel).filter(AIModel.name == name).first()
    created = row is None
    if created:
        row = AIModel(name=name, version=str(meta.get("version")), model_type=str(meta.get("model_type")),
                      model_path=str(model.path.name))
        db.add(row)
    row.version = str(meta.get("version"))
    row.model_type = str(meta.get("model_type"))
    row.model_path = f"models/{model.path.name}"
    row.config = {
        "algorithm": meta.get("algorithm"),
        "params": meta.get("params"),
        "features": meta.get("features"),
        "metrics": metrics,
        "dataset_stats": meta.get("dataset_stats"),
        "sklearn_version": meta.get("sklearn_version"),
        "seed": meta.get("seed"),
    }
    if is_classifier:
        row.accuracy = metrics.get("accuracy")
        row.precision = metrics.get("precision")
        row.recall = metrics.get("recall")
        row.f1_score = metrics.get("f1")
    row.is_active = True
    row.is_production = True
    row.trained_at = _parse_dt(meta.get("trained_at"))
    if created or row.deployed_at is None:
        row.deployed_at = datetime.utcnow()


def register_models(db: Session) -> None:
    """Enregistre/actualise les modèles chargés dans la table ai_models."""
    try:
        if _price_model is not None:
            _upsert(db, _price_model, ml.PRICE_MODEL_NAME, is_classifier=False)
        if _acceptance_model is not None:
            _upsert(db, _acceptance_model, ml.ACCEPTANCE_MODEL_NAME, is_classifier=True)
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
        logger.exception("Enregistrement des modèles dans ai_models impossible")


def init_ai_module() -> None:
    """À appeler au démarrage (lifespan) : charge les modèles puis les enregistre."""
    load_models()
    try:
        from ...core.database import SessionLocal

        db = SessionLocal()
        try:
            register_models(db)
        finally:
            db.close()
    except Exception:  # noqa: BLE001
        logger.exception("Initialisation ai_models ignorée")
