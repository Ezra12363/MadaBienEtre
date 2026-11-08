# app/services/account_settings.py
"""
Paramètres de modération des comptes (table platform_settings, clé « account_moderation »).

  autoApprove             -> thérapeutes approuvés automatiquement (compte activé + certificat PDF envoyé par email)
  autoActivateTherapists  -> compte thérapeute activé automatiquement (profil encore à valider par l'admin)
  autoActivateClients     -> compte client activé automatiquement

Quand un réglage est actif, le compte est traité dès que l'email est vérifié (OTP) ou à la
première connexion Google/Apple ; l'utilisateur reçoit alors l'email + la notification d'activation
(identiques à une activation manuelle). Sinon, le compte reste en attente d'un administrateur.
"""
import logging
from types import SimpleNamespace
from typing import Any, Dict

logger = logging.getLogger(__name__)

KEY = "account_moderation"

DEFAULTS: Dict[str, Any] = {
    "autoApprove": False,
    "autoActivateTherapists": False,
    "autoActivateClients": False,
    # réglages d'affichage de l'écran Paramètres admin (conservés tels quels)
    "notifications": True,
    "emailNotifications": True,
    "smsNotifications": False,
    "minPrice": 25000,
    "maxDistance": 10,
}
_BOOLS = {k for k, v in DEFAULTS.items() if isinstance(v, bool)}
_NUMS = {"minPrice": (0, 10_000_000), "maxDistance": (0, 200)}


def get_settings(db) -> Dict[str, Any]:
    from ..models.finance import PlatformSetting

    cfg = dict(DEFAULTS)
    try:
        row = db.query(PlatformSetting).filter(PlatformSetting.key == KEY).first()
        if row and isinstance(row.value, dict):
            cfg.update({k: v for k, v in row.value.items() if k in DEFAULTS})
    except Exception:  # noqa: BLE001
        logger.exception("Lecture des paramètres de modération impossible (défauts utilisés)")
    return cfg


def save_settings(db, values: Dict[str, Any], admin_id: int) -> Dict[str, Any]:
    from ..models.finance import PlatformSetting

    current = get_settings(db)
    for k, v in (values or {}).items():
        if k in _BOOLS and v is not None:
            current[k] = bool(v)
        elif k in _NUMS and v is not None:
            lo, hi = _NUMS[k]
            current[k] = min(hi, max(lo, float(v))) if not float(v).is_integer() else int(min(hi, max(lo, float(v))))
    row = db.query(PlatformSetting).filter(PlatformSetting.key == KEY).first()
    if row is None:
        db.add(PlatformSetting(key=KEY, value=current, updated_by=admin_id))
    else:
        row.value = current
        row.updated_by = admin_id
    db.commit()
    return get_settings(db)


def apply_auto_moderation(user, db) -> str:
    """Active / approuve automatiquement un compte qui vient d'être vérifié, selon les réglages.

    Retourne "approved", "activated" ou "none". Ne lève jamais d'exception.
    """
    try:
        if user.is_active:
            return "none"
        cfg = get_settings(db)
        role = str(user.role).upper()
        from .account_notifications import notify_account_activated

        robot = SimpleNamespace(fullname="Activation automatique")

        if role == "CLIENT" and cfg["autoActivateClients"]:
            user.is_active = True
            user.deleted_at = None
            db.commit()
            notify_account_activated(user, admin=robot)
            return "activated"

        if role == "THERAPIST" and cfg["autoApprove"]:
            from ..models.user import User

            user.is_active = True
            user.deleted_at = None
            user.verification_status = "approved"
            db.commit()
            db.refresh(user)

            certificate = None
            admin = (
                db.query(User).filter(User.role == "ADMIN", User.is_active == True)  # noqa: E712
                .order_by(User.id).first()
            )
            if admin is not None:
                try:
                    from ..models.massage import MassageType
                    from ..models.therapist import TherapistSpecialty
                    from .certificate_service import generate_certificate_for_therapist

                    rows = (
                        db.query(MassageType.name)
                        .join(TherapistSpecialty, TherapistSpecialty.massage_type_id == MassageType.id)
                        .filter(TherapistSpecialty.therapist_id == user.id).all()
                    )
                    names = [n for (n,) in rows]
                    certificate = generate_certificate_for_therapist(
                        therapist=user, admin_id=admin.id, admin_fullname=admin.fullname,
                        db=db, specialty=", ".join(names) if names else None,
                    )
                except Exception:  # noqa: BLE001
                    logger.exception("Certificat automatique impossible (therapist_id=%s)", user.id)
            notify_account_activated(
                user, admin=robot,
                certificate_number=certificate.certificate_number if certificate else None,
                notification_type="therapist_approved",
                certificate=certificate, db=db,
            )
            return "approved"

        if role == "THERAPIST" and cfg["autoActivateTherapists"]:
            user.is_active = True
            user.deleted_at = None
            db.commit()
            notify_account_activated(user, admin=robot)
            return "activated"
    except Exception:  # noqa: BLE001
        logger.exception("Activation automatique échouée (user_id=%s)", getattr(user, "id", None))
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            pass
    return "none"
