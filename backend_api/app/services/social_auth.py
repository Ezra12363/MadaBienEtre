# app/services/social_auth.py
"""
Vérification des jetons d'identité (id_token) Google et Apple.

Aucune dépendance supplémentaire : on utilise python-jose (déjà dans
requirements.txt) + requests pour télécharger les clés publiques (JWKS).
Le jeton est vérifié : signature RS256, expiration, émetteur (iss) et
audience (aud = l'un de vos Client IDs déclarés dans .env).
"""
import logging
import threading
import time
from typing import Any, Dict, List, Optional

import requests
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTError

from ..core.config import settings

logger = logging.getLogger(__name__)

GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("https://accounts.google.com", "accounts.google.com")

APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
APPLE_ISSUER = "https://appleid.apple.com"

_JWKS_TTL = 3600  # secondes
_cache: Dict[str, Dict[str, Any]] = {}
_lock = threading.Lock()


class SocialAuthError(Exception):
    """Jeton social invalide / non configuré."""


def _split_ids(raw: Optional[str]) -> List[str]:
    return [x.strip() for x in (raw or "").split(",") if x.strip()]


def _get_jwks(url: str, force: bool = False) -> List[dict]:
    now = time.time()
    with _lock:
        entry = _cache.get(url)
        if entry and not force and now - entry["at"] < _JWKS_TTL:
            return entry["keys"]
    try:
        resp = requests.get(url, timeout=8)
        resp.raise_for_status()
        keys = resp.json().get("keys", [])
    except Exception as exc:  # réseau coupé, DNS, etc.
        logger.error("JWKS download failed (%s): %s", url, exc)
        if entry:  # on réutilise l'ancien cache plutôt que de bloquer
            return entry["keys"]
        raise SocialAuthError("Service d'authentification indisponible") from exc
    with _lock:
        _cache[url] = {"keys": keys, "at": now}
    return keys


def _verify(token: str, jwks_url: str, issuers, audiences: List[str]) -> Dict[str, Any]:
    if not audiences:
        raise SocialAuthError("Connexion sociale non configurée sur le serveur")
    try:
        kid = jwt.get_unverified_header(token).get("kid")
    except JWTError as exc:
        raise SocialAuthError("Jeton invalide") from exc

    def find(keys):
        return next((k for k in keys if k.get("kid") == kid), None)

    key = find(_get_jwks(jwks_url))
    if key is None:  # rotation de clés : on retélécharge une fois
        key = find(_get_jwks(jwks_url, force=True))
    if key is None:
        raise SocialAuthError("Clé de signature inconnue")

    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            options={"verify_aud": False, "verify_iss": False, "verify_at_hash": False},
        )
    except ExpiredSignatureError as exc:
        raise SocialAuthError("Jeton expiré, réessayez") from exc
    except JWTError as exc:
        raise SocialAuthError("Jeton invalide") from exc

    if claims.get("iss") not in issuers:
        raise SocialAuthError("Émetteur du jeton invalide")

    aud = claims.get("aud")
    aud_list = aud if isinstance(aud, list) else [aud]
    if not any(a in audiences for a in aud_list):
        raise SocialAuthError("Audience du jeton invalide")
    return claims


def _truthy(value) -> bool:
    return value is True or str(value).lower() == "true"


def verify_google_id_token(id_token: str) -> Dict[str, Any]:
    claims = _verify(
        id_token, GOOGLE_JWKS_URL, GOOGLE_ISSUERS, _split_ids(settings.GOOGLE_CLIENT_IDS)
    )
    return {
        "provider": "google",
        "sub": claims.get("sub"),
        "email": (claims.get("email") or "").lower() or None,
        "email_verified": _truthy(claims.get("email_verified")),
        "name": claims.get("name"),
        "picture": claims.get("picture"),
    }


def verify_apple_identity_token(identity_token: str) -> Dict[str, Any]:
    claims = _verify(
        identity_token, APPLE_JWKS_URL, (APPLE_ISSUER,), _split_ids(settings.APPLE_CLIENT_IDS)
    )
    return {
        "provider": "apple",
        "sub": claims.get("sub"),
        "email": (claims.get("email") or "").lower() or None,
        "email_verified": _truthy(claims.get("email_verified")),
        "name": None,  # Apple ne renvoie le nom que côté client, à la 1re connexion
        "picture": None,
    }
