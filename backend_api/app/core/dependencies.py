
# app/core/dependencies.py

from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials,
)
from sqlalchemy.orm import Session

from .database import get_db
from .security import verify_token
from ..models.user import User


# ============================================================
# AUTHENTICATION
# ============================================================

security = HTTPBearer()


def _get_role(user: User) -> str:
    """Normalise les rôles chaîne ou Enum."""

    role = getattr(user, "role", "")

    if hasattr(role, "value"):
        role = role.value

    return str(role).strip().upper().split(".")[-1]


def _is_admin_role(user: User) -> bool:
    role = _get_role(user)
    return role == "ADMIN" or role.endswith("_ADMIN")


def _get_user_from_token(token: str, db: Session) -> User:
    """
    Valide le JWT et récupère un utilisateur actif.
    Utilisée par les dépendances HTTP et WebSocket.
    """

    try:
        payload = verify_token(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide : identifiant utilisateur manquant.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(user_id)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide : identifiant incorrect.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.deleted_at.is_(None),
        )
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur introuvable.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte utilisateur désactivé.",
        )

    return user


# ============================================================
# 1. UTILISATEUR CONNECTE
# ============================================================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Récupère l'utilisateur authentifié via son JWT."""

    return _get_user_from_token(
        token=credentials.credentials,
        db=db,
    )


# ============================================================
# 2. UTILISATEUR OPTIONNEL
# ============================================================

async def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Retourne l'utilisateur si le token fourni est valide.
    Retourne None si aucun token valide n'est fourni.

    À utiliser uniquement pour des endpoints réellement publics.
    Ne pas l'utiliser pour protéger des données privées.
    """

    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return None

    parts = auth_header.strip().split()

    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    try:
        return _get_user_from_token(
            token=parts[1],
            db=db,
        )
    except HTTPException:
        return None


# ============================================================
# 3. ADMINISTRATEUR
# ============================================================

async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Autorise uniquement les administrateurs."""

    if not _is_admin_role(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé : droits administrateur requis.",
        )

    return current_user


# ============================================================
# 4. THERAPEUTE
# ============================================================

async def get_current_therapist(
    current_user: User = Depends(get_current_user),
) -> User:
    """Autorise les thérapeutes et les administrateurs."""

    role = _get_role(current_user)

    if role not in ("THERAPIST", "ADMIN") and not role.endswith("_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé : droits thérapeute requis.",
        )

    return current_user


# ============================================================
# 5. CLIENT
# ============================================================

async def get_current_client(
    current_user: User = Depends(get_current_user),
) -> User:
    """Autorise les clients et les administrateurs."""

    role = _get_role(current_user)

    if role not in ("CLIENT", "ADMIN") and not role.endswith("_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé : droits client requis.",
        )

    return current_user


# ============================================================
# 6. UTILISATEUR ACTIF
# ============================================================

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dépendance pour les endpoints nécessitant un compte actif."""

    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte utilisateur inactif.",
        )

    return current_user


# ============================================================
# 7. UTILISATEUR WEBSOCKET
# ============================================================

def get_user_from_websocket(
    token: str,
    db: Session,
) -> Optional[User]:
    """
    Récupère un utilisateur depuis un token JWT pour WebSocket.
    Retourne None si le token est invalide ou l'utilisateur absent.
    """

    try:
        return _get_user_from_token(token=token, db=db)
    except HTTPException:
        return None


# ============================================================
# 8. ALIAS ASYNCHRONE WEBSOCKET
# ============================================================

async def get_current_user_ws(
    token: str,
    db: Session,
) -> Optional[User]:
    """Alias asynchrone conservé pour compatibilité."""

    return get_user_from_websocket(
        token=token,
        db=db,
    )
