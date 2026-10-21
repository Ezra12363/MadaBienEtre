# app/services/receipt_links.py
"""Liens temporaires signés (HMAC) pour ouvrir / télécharger un reçu ou un QR.

Format du jeton : base64url("kind:obj_id:user_id:exp:view:sig")
"""
import base64
import hashlib
import hmac
import time
from typing import Optional, Tuple

from ..core.config import settings


def _mac(payload: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()[:32]


def sign(kind: str, obj_id: int, user_id: int, ttl: int = 600, view: str = "auto") -> str:
    exp = int(time.time()) + ttl
    payload = f"{kind}:{obj_id}:{user_id}:{exp}:{view}"
    return base64.urlsafe_b64encode(f"{payload}:{_mac(payload)}".encode()).decode()


def check(token: str, kind: str, obj_id: int) -> Optional[Tuple[int, str]]:
    """Retourne (user_id, view) si le jeton est valide, sinon None."""
    try:
        k, oid, uid, exp, view, sig = base64.urlsafe_b64decode(token.encode()).decode().split(":")
        if k != kind or int(oid) != obj_id or int(exp) < time.time():
            return None
        if not hmac.compare_digest(_mac(f"{k}:{oid}:{uid}:{exp}:{view}"), sig):
            return None
        return int(uid), view
    except Exception:  # noqa: BLE001
        return None


def base_from_request(request) -> str:
    """URL publique telle que vue par l'application (évite le piège « localhost »
    quand BASE_URL n'est pas réglé) ; respecte un éventuel reverse-proxy."""
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
    return f"{proto}://{host}"


def url(path: str, token: str, base: Optional[str] = None, **extra) -> str:
    qs = "&".join([f"token={token}"] + [f"{k}={v}" for k, v in extra.items()])
    return f"{(base or settings.BASE_URL).rstrip('/')}{path}?{qs}"
