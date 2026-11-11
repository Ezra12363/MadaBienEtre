"""Journalisation des prédictions dans ai_predictions (audit + réentraînement)."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _frac(value: Optional[float]) -> Optional[float]:
    return None if value is None else round(float(value), 2)


def log_prediction(
    db: Optional[Session],
    prediction_type: str,
    *,
    user_id: Optional[int] = None,
    booking_id: Optional[int] = None,
    predicted_price: Optional[float] = None,
    recommended_price: Optional[float] = None,
    acceptance_probability: Optional[float] = None,
    confidence_score: Optional[float] = None,
    recommended_therapist_id: Optional[int] = None,
    recommended_massage_type_id: Optional[int] = None,
    factors: Optional[Dict[str, Any]] = None,
    features: Optional[Dict[str, Any]] = None,
    model_version: Optional[str] = None,
    model_used: Optional[str] = None,
) -> Optional[int]:
    """Enregistre une prédiction. Ne lève JAMAIS : l'échec du journal ne doit pas
    bloquer la réponse de l'API. Renvoie l'id créé (ou None)."""
    if db is None:
        return None
    try:
        from ...models.ai_prediction import AIPrediction

        row = AIPrediction(
            booking_id=booking_id,
            user_id=user_id,
            prediction_type=prediction_type[:50],
            predicted_price=predicted_price,
            recommended_price=recommended_price,
            acceptance_probability=_frac(acceptance_probability),
            confidence_score=_frac(confidence_score),
            recommended_therapist_id=recommended_therapist_id,
            recommended_massage_type_id=recommended_massage_type_id,
            factors=factors,
            features=features,
            model_version=(model_version or None) and str(model_version)[:50],
            model_used=(model_used or None) and str(model_used)[:50],
        )
        db.add(row)
        db.commit()
        return row.id
    except Exception:  # noqa: BLE001
        db.rollback()
        logger.exception("Journalisation ai_predictions impossible (%s)", prediction_type)
        return None
