# app/services/certificate_settings.py
"""Paramètres du certificat thérapeute, modifiables par l'admin.

Stockage : table ``platform_settings`` (clé ``certificate_config``, JSON).
Images (logo, signature / cachet) : fichiers PNG dans ``uploads/certificate_assets/``.
Si aucune image n'est téléversée, on utilise les images par défaut du modèle
officiel Mada Bien-être (``assets/certificate/default_*.png``).

Priorité : valeur enregistrée par l'admin  >  défaut du modèle.
"""
import io
import logging
import re
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from PIL import Image

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[2]
ASSETS_DIR = BASE_DIR / "uploads" / "certificate_assets"
DEFAULTS_DIR = BASE_DIR / "assets" / "certificate"

ASSETS_DIR.mkdir(parents=True, exist_ok=True)

# Les images par défaut sont recopiées dans le dossier servi publiquement (/uploads)
# pour que l'écran admin puisse les afficher (aperçu) avant tout téléversement.
for _name in ("default_logo.png", "default_signature.png"):
    try:
        _src, _dst = DEFAULTS_DIR / _name, ASSETS_DIR / _name
        if _src.is_file() and not _dst.is_file():
            _dst.write_bytes(_src.read_bytes())
    except Exception:  # noqa: BLE001
        logger.warning("Copie de %s impossible", _name)

KEY = "certificate_config"

# type d'image -> (clé de config, fichier par défaut)
IMAGE_KINDS = {
    "logo": ("logo_file", DEFAULTS_DIR / "default_logo.png"),
    "signature": ("signature_file", DEFAULTS_DIR / "default_signature.png"),
}

MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_IMAGE_SIDE = 1600  # px — au-delà on réduit (PDF léger)

_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")

_CACHE: Dict[str, Any] = {"at": 0.0, "data": None}
_TTL = 10  # secondes

# Champs texte : (clé, longueur max)
TEXT_FIELDS = {
    "platform_name": 60,
    "platform_tagline": 120,
    "title": 90,
    "intro_text": 600,
    "legal_text": 500,
    "badge_text": 40,
    "therapist_signature_label": 40,
    "admin_signature_label": 40,
}

COLOR_FIELDS = ("color_primary", "color_accent", "color_background")


def defaults() -> Dict[str, Any]:
    """Valeurs EXACTES du modèle certificat_style9 fourni."""
    return {
        "platform_name": "Mada Bien-Être",
        "platform_tagline": "Plateforme de réservation de massages à domicile",
        "title": "Certificat professionnel de thérapeute",
        "intro_text": (
            "Le présent certificat atteste que la personne désignée ci-dessous est "
            "enregistrée comme thérapeute / masseur sur la plateforme Mada Bien-être, "
            "sous réserve de la vérification et de la validation de ses informations "
            "et documents par l'administrateur."
        ),
        "legal_text": (
            "Ce document est destiné à l'identification et à la validation du profil "
            "professionnel dans le cadre du service Mada Bien-être.\n"
            "Il ne constitue pas, à lui seul, une licence d'exercice délivrée par une "
            "autorité publique."
        ),
        "badge_text": "THÉRAPEUTE VÉRIFIÉ",
        "therapist_signature_label": "SIGNATURE DU THÉRAPEUTE",
        "admin_signature_label": "VALIDATION ADMINISTRATEUR",
        "color_primary": "#1F6B45",
        "color_accent": "#B8924A",
        "color_background": "#FBF8F1",
        "logo_file": "",
        "signature_file": "",
    }


# ------------------------------------------------------------
# LECTURE
# ------------------------------------------------------------

def get_config(use_cache: bool = True) -> Dict[str, Any]:
    now = time.time()
    if use_cache and _CACHE["data"] is not None and now - _CACHE["at"] < _TTL:
        return dict(_CACHE["data"])

    cfg = defaults()
    try:
        from ..core.database import SessionLocal
        from ..models.finance import PlatformSetting

        db = SessionLocal()
        try:
            row = db.query(PlatformSetting).filter(PlatformSetting.key == KEY).first()
            if row and isinstance(row.value, dict):
                for k, v in row.value.items():
                    if k in cfg and isinstance(v, str):
                        cfg[k] = v
        finally:
            db.close()
    except Exception:  # noqa: BLE001
        logger.exception("Lecture des paramètres du certificat impossible (défauts utilisés)")

    _CACHE.update({"at": now, "data": dict(cfg)})
    return cfg


def invalidate_cache() -> None:
    _CACHE["data"] = None


def image_path(kind: str, cfg: Optional[Dict[str, Any]] = None) -> Optional[Path]:
    """Chemin du fichier image à utiliser (téléversé, sinon défaut). None si absent."""
    if kind not in IMAGE_KINDS:
        return None
    key, default_file = IMAGE_KINDS[kind]
    cfg = cfg or get_config()
    name = (cfg.get(key) or "").strip()
    if name:
        candidate = ASSETS_DIR / Path(name).name  # Path().name : empêche toute traversée de dossier
        if candidate.is_file():
            return candidate
    return default_file if default_file.is_file() else None


def image_url(kind: str, cfg: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """URL relative (servie par le montage /uploads) de l'image utilisée
    (téléversée, sinon image par défaut du modèle)."""
    key, default_file = IMAGE_KINDS[kind]
    cfg = cfg or get_config()
    name = (cfg.get(key) or "").strip()
    if name and (ASSETS_DIR / Path(name).name).is_file():
        return f"/uploads/certificate_assets/{Path(name).name}"
    if (ASSETS_DIR / default_file.name).is_file():
        return f"/uploads/certificate_assets/{default_file.name}"
    return None


def is_custom_image(kind: str, cfg: Optional[Dict[str, Any]] = None) -> bool:
    key, _ = IMAGE_KINDS[kind]
    cfg = cfg or get_config()
    name = (cfg.get(key) or "").strip()
    return bool(name and (ASSETS_DIR / Path(name).name).is_file())


# ------------------------------------------------------------
# ÉCRITURE
# ------------------------------------------------------------

def _store(db, cfg: Dict[str, Any], admin_id: int) -> None:
    from ..models.finance import PlatformSetting

    row = db.query(PlatformSetting).filter(PlatformSetting.key == KEY).first()
    if row is None:
        db.add(PlatformSetting(key=KEY, value=cfg, updated_by=admin_id))
    else:
        row.value = cfg
        row.updated_by = admin_id
    db.commit()
    invalidate_cache()


def save_config(db, values: Dict[str, Any], admin_id: int) -> Dict[str, Any]:
    """Met à jour les textes / couleurs. Les clés d'image ne passent pas par ici."""
    current = get_config(use_cache=False)

    for k, maxlen in TEXT_FIELDS.items():
        if k in values and values[k] is not None:
            text = str(values[k]).replace("\r\n", "\n").strip()
            if not text:
                # champ vidé => retour à la valeur par défaut du modèle
                text = defaults()[k]
            current[k] = text[:maxlen]

    for k in COLOR_FIELDS:
        if k in values and values[k] is not None:
            color = str(values[k]).strip()
            if not color:
                color = defaults()[k]
            if not color.startswith("#"):
                color = "#" + color
            if not _HEX.match(color):
                raise ValueError(f"Couleur invalide pour « {k} » : utilisez le format #RRGGBB.")
            current[k] = color.upper()

    _store(db, current, admin_id)
    return get_config(use_cache=False)


def reset_config(db, admin_id: int) -> Dict[str, Any]:
    """Retour complet au modèle d'origine (textes, couleurs, images)."""
    current = get_config(use_cache=False)
    for kind in IMAGE_KINDS:
        _delete_file(current.get(IMAGE_KINDS[kind][0]))
    _store(db, defaults(), admin_id)
    return get_config(use_cache=False)


def _delete_file(name: Optional[str]) -> None:
    if not name:
        return
    try:
        p = ASSETS_DIR / Path(name).name
        if p.is_file():
            p.unlink()
    except Exception:  # noqa: BLE001
        logger.warning("Suppression de %s impossible", name)


def save_image(db, kind: str, contents: bytes, admin_id: int) -> Dict[str, Any]:
    """Valide l'image, la convertit en PNG (transparence conservée) et l'enregistre."""
    if kind not in IMAGE_KINDS:
        raise ValueError("Type d'image inconnu (logo ou signature).")
    if not contents:
        raise ValueError("Le fichier est vide.")
    if len(contents) > MAX_IMAGE_BYTES:
        raise ValueError("Image trop volumineuse (8 Mo maximum).")

    try:
        img = Image.open(io.BytesIO(contents))
        img.load()
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Fichier image invalide (formats : PNG, JPG, WEBP).") from exc

    img = img.convert("RGBA")
    if max(img.size) > MAX_IMAGE_SIDE:
        img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE), Image.LANCZOS)

    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{kind}_{uuid.uuid4().hex[:12]}.png"
    img.save(ASSETS_DIR / filename, format="PNG", optimize=True)

    key = IMAGE_KINDS[kind][0]
    current = get_config(use_cache=False)
    old = current.get(key)
    current[key] = filename
    _store(db, current, admin_id)
    _delete_file(old)
    return get_config(use_cache=False)


def remove_image(db, kind: str, admin_id: int) -> Dict[str, Any]:
    """Supprime l'image téléversée => retour à l'image par défaut du modèle."""
    if kind not in IMAGE_KINDS:
        raise ValueError("Type d'image inconnu (logo ou signature).")
    key = IMAGE_KINDS[kind][0]
    current = get_config(use_cache=False)
    old = current.get(key)
    current[key] = ""
    _store(db, current, admin_id)
    _delete_file(old)
    return get_config(use_cache=False)


def public_view(cfg: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Représentation envoyée au frontend (sans noms de fichiers internes)."""
    cfg = cfg or get_config()
    out = {k: cfg[k] for k in list(TEXT_FIELDS) + list(COLOR_FIELDS)}
    out["logo_url"] = image_url("logo", cfg)
    out["signature_url"] = image_url("signature", cfg)
    out["logo_is_custom"] = is_custom_image("logo", cfg)
    out["signature_is_custom"] = is_custom_image("signature", cfg)
    out["defaults"] = {k: v for k, v in defaults().items() if k in out}
    return out
