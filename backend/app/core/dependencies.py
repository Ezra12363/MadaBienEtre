# app/core/dependencies.py
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional

from .database import get_db
from .security import verify_token, decode_token
from ..models.user import User

# ✅ Security Bearer ho an'ny JWT
security = HTTPBearer()


# ============================================================
# 1. GET CURRENT USER (Principal)
# ============================================================
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Récupérer l'utilisateur actuel à partir du token JWT
    """
    token = credentials.credentials
    payload = verify_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide: ID utilisateur manquant",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        user_id = int(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide: ID utilisateur incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(User).filter(
        User.id == user_id,
        User.deleted_at.is_(None)
    ).first()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur non trouvé",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte utilisateur désactivé"
        )
    
    return user


# ============================================================
# ✅ NOUVEAU : GET CURRENT USER OPTIONAL (ne lève pas d'erreur)
# ============================================================
async def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Récupère l'utilisateur si un token valide est fourni,
    sinon retourne None (ne lève pas d'exception).
    Utile pour les endpoints qui peuvent être appelés avec ou sans auth.
    """
    try:
        # Essayer de récupérer le token depuis le header Authorization
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return None
        
        # Extraire le token (Bearer <token>)
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None
        
        token = parts[1]
        
        # Vérifier le token
        payload = verify_token(token)
        if payload is None:
            return None
        
        user_id = payload.get("sub")
        if user_id is None:
            return None
        
        try:
            user_id = int(user_id)
        except ValueError:
            return None
        
        user = db.query(User).filter(
            User.id == user_id,
            User.deleted_at.is_(None)
        ).first()
        
        if user is None or not user.is_active:
            return None
        
        return user
        
    except Exception:
        return None


# ============================================================
# 2. GET CURRENT ADMIN
# ============================================================
async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Récupérer l'utilisateur admin actuel à partir du token JWT
    """
    user = await get_current_user(credentials, db)
    
    if user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé: droits administrateur requis"
        )
    
    return user


# ============================================================
# 3. GET CURRENT THERAPIST
# ============================================================
async def get_current_therapist(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Récupérer l'utilisateur thérapeute actuel à partir du token JWT
    """
    user = await get_current_user(credentials, db)
    
    if user.role != "THERAPIST" and user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé: droits thérapeute requis"
        )
    
    return user


# ============================================================
# 4. GET CURRENT CLIENT
# ============================================================
async def get_current_client(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Récupérer l'utilisateur client actuel à partir du token JWT
    """
    user = await get_current_user(credentials, db)
    
    if user.role != "CLIENT" and user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé: droits client requis"
        )
    
    return user


# ============================================================
# 5. GET CURRENT ACTIVE USER
# ============================================================
async def get_current_active_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Récupérer l'utilisateur actif actuel
    """
    user = await get_current_user(credentials, db)
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte utilisateur inactif"
        )
    
    return user


# ============================================================
# 6. GET USER FROM WEBSOCKET (pour WebSocket)
# ============================================================
def get_user_from_websocket(token: str, db: Session) -> Optional[User]:
    """
    Récupérer l'utilisateur à partir d'un token JWT pour WebSocket
    """
    payload = verify_token(token)
    if payload is None:
        return None
    
    user_id = payload.get("sub")
    if user_id is None:
        return None
    
    try:
        user_id = int(user_id)
    except ValueError:
        return None
    
    user = db.query(User).filter(
        User.id == user_id,
        User.deleted_at.is_(None)
    ).first()
    
    if user is None or not user.is_active:
        return None
    
    return user


# ============================================================
# 7. GET CURRENT USER WS (alias pour WebSocket)
# ============================================================
async def get_current_user_ws(token: str, db: Session) -> Optional[User]:
    """
    Récupérer l'utilisateur à partir d'un token JWT pour WebSocket (async)
    """
    payload = verify_token(token)
    if payload is None:
        return None
    
    user_id = payload.get("sub")
    if user_id is None:
        return None
    
    try:
        user_id = int(user_id)
    except ValueError:
        return None
    
    user = db.query(User).filter(
        User.id == user_id,
        User.deleted_at.is_(None)
    ).first()
    
    if user is None or not user.is_active:
        return None
    
    return user