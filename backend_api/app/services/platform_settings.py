# app/services/platform_settings.py
"""Paramètres de paiement modifiables par l'admin (table platform_settings).

Priorité : valeur enregistrée par l'admin  >  variable .env  >  défaut.
Les CLÉS API (Stripe / Vanila Pay) ne passent JAMAIS par ici : elles restent
dans le fichier .env du backend.
"""
import logging
import time
from typing import Any, Dict

from ..core.config import settings

logger = logging.getLogger(__name__)

_CACHE: Dict[str, Any] = {"at": 0.0, "data": None}
_TTL = 15  # secondes

KEY = "payment_config"


def defaults() -> Dict[str, Any]:
    return {
        "platform_commission_rate": float(settings.PLATFORM_COMMISSION_RATE),
        "min_withdrawal": float(settings.MIN_WITHDRAWAL_AMOUNT),
        "withdrawal_fee_percent": 0.0,
        "cash_enabled": bool(settings.PAYMENT_CASH_ENABLED),
        "mobile_money_enabled": True,
        "card_enabled": True,
        "mvola_enabled": True,
        "orange_money_enabled": True,
        "airtel_money_enabled": True,
        "withdraw_mobile_money_enabled": True,
        "withdraw_bank_enabled": True,
        "withdraw_cash_enabled": True,
        "company_name": "Mada Bien-Être",
        "company_phone": "",
        "company_email": "",
        "company_address": "",
        "receipt_footer": "Merci de votre confiance.",
    }


def get_config() -> Dict[str, Any]:
    now = time.time()
    if _CACHE["data"] is not None and now - _CACHE["at"] < _TTL:
        return dict(_CACHE["data"])
    cfg = defaults()
    try:
        from ..core.database import SessionLocal
        from ..models.finance import PlatformSetting

        db = SessionLocal()
        try:
            row = db.query(PlatformSetting).filter(PlatformSetting.key == KEY).first()
            if row and isinstance(row.value, dict):
                cfg.update({k: v for k, v in row.value.items() if k in cfg})
        finally:
            db.close()
    except Exception:  # noqa: BLE001
        logger.exception("Lecture des paramètres de paiement impossible (défauts utilisés)")
    _CACHE.update({"at": now, "data": dict(cfg)})
    return cfg


def save_config(db, values: Dict[str, Any], admin_id: int) -> Dict[str, Any]:
    from ..models.finance import PlatformSetting

    base = defaults()
    current = get_config()
    for k, v in values.items():
        if k not in base or v is None:
            continue
        if isinstance(base[k], bool):
            current[k] = bool(v)
        elif isinstance(base[k], float):
            current[k] = float(v)
        else:
            current[k] = str(v)[:250]
    if not 0 <= current["platform_commission_rate"] <= 100:
        raise ValueError("La commission doit être comprise entre 0 et 100 %.")
    if not 0 <= current["withdrawal_fee_percent"] <= 50:
        raise ValueError("Les frais de retrait doivent être compris entre 0 et 50 %.")
    if current["min_withdrawal"] < 0:
        raise ValueError("Le retrait minimum ne peut pas être négatif.")

    row = db.query(PlatformSetting).filter(PlatformSetting.key == KEY).first()
    if row is None:
        row = PlatformSetting(key=KEY, value=current, updated_by=admin_id)
        db.add(row)
    else:
        row.value = current
        row.updated_by = admin_id
    db.commit()
    _CACHE["data"] = None
    return get_config()
