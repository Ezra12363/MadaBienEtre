# app/core/dependencies.py
from fastapi import Depends, HTTPException, status, Security, Request, WebSocket
from fastapi.security import OAuth2PasswordBearer, APIKeyHeader, HTTPBearer
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from datetime import datetime
import re
import logging

from .config import settings
from .database import get_db
from .security import decode_token, oauth2_scheme
from ..models.user import User
from ..schemas.auth import TokenData

logger = logging.getLogger(__name__)

# ============================================
# SCHÉMAS DE SÉCURITÉ
# ============================================

# ✅ Utiliser oauth2_scheme de security.py
# oauth2_scheme est déjà défini dans security.py avec le bon tokenUrl

api_key_header = APIKeyHeader(
    name="X-API-Key",
    auto_error=False
)

http_bearer = HTTPBearer(auto_error=False)

# ============================================
# LIMITATION DE TAUX
# ============================================

class RateLimiter:
    """Limiteur de taux pour les API"""
    
    def __init__(self):
        self.requests = {}
        self.window = 60  # secondes
        self.max_requests = 100
    
    async def check_rate_limit(self, client_id: str) -> bool:
        """Vérifier si le client a dépassé la limite"""
        now = datetime.utcnow().timestamp()
        
        if client_id not in self.requests:
            self.requests[client_id] = []
        
        # Nettoyer les requêtes anciennes
        self.requests[client_id] = [
            req_time for req_time in self.requests[client_id]
            if now - req_time < self.window
        ]
        
        if len(self.requests[client_id]) >= self.max_requests:
            return False
        
        self.requests[client_id].append(now)
        return True

rate_limiter = RateLimiter()

# ============================================
# AUTHENTIFICATION PRINCIPALE
# ============================================

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Obtenir l'utilisateur actuel à partir du token JWT.
    
    Args:
        token: Token JWT d'accès
        db: Session de base de données
    
    Returns:
        User: L'utilisateur authentifié
    
    Raises:
        HTTPException 401: Si le token est invalide ou l'utilisateur non trouvé
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Décoder le token
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        # Vérifier que c'est un token d'accès
        if token_type != "access":
            logger.warning(f"Invalid token type: {token_type}, expected: access")
            raise credentials_exception
        
        # Vérifier que user_id est une chaîne
        if user_id is None or not isinstance(user_id, str):
            logger.warning("User ID is missing or not a string")
            raise credentials_exception
        
        # Récupérer l'utilisateur
        user = db.query(User).filter(
            User.id == int(user_id),
            User.is_active == True,
            User.deleted_at.is_(None)
        ).first()
        
        if user is None:
            logger.warning(f"User not found: {user_id}")
            raise credentials_exception
        
        logger.debug(f"User authenticated: {user.email} (ID: {user.id})")
        return user
        
    except ValueError as e:
        logger.error(f"ValueError in get_current_user: {e}")
        raise credentials_exception
    except Exception as e:
        logger.error(f"Unexpected error in get_current_user: {e}")
        raise credentials_exception


async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Obtenir l'utilisateur actuel si authentifié, sinon None.
    
    Args:
        token: Token JWT d'accès (optionnel)
        db: Session de base de données
    
    Returns:
        Optional[User]: L'utilisateur authentifié ou None
    """
    if token is None:
        return None
    
    try:
        return await get_current_user(token, db)
    except HTTPException:
        return None


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Vérifier que l'utilisateur est actif.
    
    Args:
        current_user: L'utilisateur authentifié
    
    Returns:
        User: L'utilisateur actif
    
    Raises:
        HTTPException 400: Si l'utilisateur est inactif
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user

# ============================================
# AUTHENTIFICATION PAR RÔLE
# ============================================

async def get_current_therapist(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Vérifier que l'utilisateur est un thérapeute.
    
    Args:
        current_user: L'utilisateur authentifié
    
    Returns:
        User: L'utilisateur thérapeute
    
    Raises:
        HTTPException 403: Si l'utilisateur n'est pas un thérapeute
    """
    if current_user.role != "THERAPIST":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint requires therapist privileges"
        )
    
    if current_user.verification_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Therapist account not verified"
        )
    
    return current_user


async def get_current_admin(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Vérifier que l'utilisateur est un administrateur.
    
    Args:
        current_user: L'utilisateur authentifié
    
    Returns:
        User: L'utilisateur administrateur
    
    Raises:
        HTTPException 403: Si l'utilisateur n'est pas un administrateur
    """
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint requires admin privileges"
        )
    return current_user


async def get_current_client(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Vérifier que l'utilisateur est un client.
    
    Args:
        current_user: L'utilisateur authentifié
    
    Returns:
        User: L'utilisateur client
    
    Raises:
        HTTPException 403: Si l'utilisateur n'est pas un client
    """
    if current_user.role != "CLIENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint requires client privileges"
        )
    return current_user

# ============================================
# WEBSOCKET AUTHENTIFICATION
# ============================================

async def get_current_user_ws(token: str) -> Optional[User]:
    """
    Obtenir l'utilisateur actuel depuis un token JWT pour WebSocket.
    
    Args:
        token: Token JWT d'accès
    
    Returns:
        Optional[User]: L'utilisateur authentifié ou None
    """
    try:
        # Décoder le token
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        # Vérifier que c'est un token d'accès
        if token_type != "access":
            return None
        
        # Vérifier que user_id est une chaîne
        if user_id is None or not isinstance(user_id, str):
            return None
        
        # Récupérer l'utilisateur
        from ..core.database import SessionLocal
        db = SessionLocal()
        try:
            user = db.query(User).filter(
                User.id == int(user_id),
                User.is_active == True,
                User.deleted_at.is_(None)
            ).first()
            return user
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"WebSocket authentication error: {e}")
        return None


async def get_user_from_websocket(websocket: WebSocket) -> Optional[User]:
    """
    Obtenir l'utilisateur depuis une connexion WebSocket.
    
    Args:
        websocket: La connexion WebSocket
    
    Returns:
        Optional[User]: L'utilisateur authentifié ou None
    """
    # Récupérer le token depuis les paramètres de la requête
    token = websocket.query_params.get("token")
    if not token:
        return None
    
    return await get_current_user_ws(token)

# ============================================
# API KEY AUTHENTIFICATION
# ============================================

async def get_api_key(
    api_key: str = Security(api_key_header)
) -> str:
    """
    Vérifier la clé API.
    
    Args:
        api_key: La clé API
    
    Returns:
        str: La clé API validée
    
    Raises:
        HTTPException 401: Si la clé API est manquante
    """
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required"
        )
    # TODO: Vérifier la clé API dans la base de données
    return api_key

# ============================================
# LIMITATION DE TAUX
# ============================================

async def check_rate_limit(
    request: Optional[Request] = None,
    client_id: str = None
) -> bool:
    """
    Vérifier les limites de taux.
    
    Args:
        request: La requête HTTP
        client_id: L'ID du client
    
    Returns:
        bool: True si la limite n'est pas dépassée
    
    Raises:
        HTTPException 429: Si la limite est dépassée
    """
    if not settings.RATE_LIMIT_ENABLED:
        return True
    
    if client_id is None and request is not None:
        client_id = request.client.host if request.client else "unknown"
    
    if not await rate_limiter.check_rate_limit(client_id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later."
        )
    
    return True

# ============================================
# PERMISSIONS
# ============================================

class PermissionChecker:
    """Vérificateur de permissions"""
    
    def __init__(self, required_permissions: List[str]):
        self.required_permissions = required_permissions
    
    async def __call__(self, current_user: User = Depends(get_current_user)):
        """
        Vérifier si l'utilisateur a les permissions requises.
        
        Args:
            current_user: L'utilisateur authentifié
        
        Returns:
            User: L'utilisateur authentifié
        
        Raises:
            HTTPException 403: Si l'utilisateur n'a pas les permissions
        """
        user_permissions = self._get_user_permissions(current_user)
        
        for permission in self.required_permissions:
            if permission not in user_permissions:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Missing permission: {permission}"
                )
        return current_user
    
    def _get_user_permissions(self, user: User) -> List[str]:
        """Obtenir les permissions d'un utilisateur selon son rôle"""
        if user.role == "ADMIN":
            return ["*"]
        elif user.role == "THERAPIST":
            return [
                "view_bookings",
                "manage_bookings",
                "view_earnings",
                "manage_availability"
            ]
        elif user.role == "CLIENT":
            return [
                "create_bookings",
                "view_bookings",
                "manage_bookings"
            ]
        return []


# Vérificateurs de permissions spécifiques
has_admin_access = PermissionChecker(["*"])
has_therapist_access = PermissionChecker([
    "view_bookings",
    "manage_bookings",
    "view_earnings"
])
has_client_access = PermissionChecker([
    "create_bookings",
    "view_bookings",
    "manage_bookings"
])

# ============================================
# VÉRIFICATEURS DE RÔLES
# ============================================

class RoleChecker:
    """Vérificateur de rôles"""
    
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles
    
    def __call__(self, user: User = Depends(get_current_user)) -> User:
        """
        Vérifier si l'utilisateur a un rôle autorisé.
        
        Args:
            user: L'utilisateur authentifié
        
        Returns:
            User: L'utilisateur authentifié
        
        Raises:
            HTTPException 403: Si le rôle n'est pas autorisé
        """
        if user.role not in self.allowed_roles and user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role {user.role} not allowed for this endpoint"
            )
        return user


# Rôles autorisés prédéfinis
ALLOW_CLIENT = RoleChecker(["CLIENT"])
ALLOW_THERAPIST = RoleChecker(["THERAPIST"])
ALLOW_ADMIN = RoleChecker(["ADMIN"])
ALLOW_CLIENT_THERAPIST = RoleChecker(["CLIENT", "THERAPIST"])
ALLOW_ALL = RoleChecker(["CLIENT", "THERAPIST", "ADMIN"])

# ============================================
# VÉRIFICATIONS PAR RESSOURCE
# ============================================

def check_booking_access(db: Session, user: User, booking_id: int) -> bool:
    """
    Vérifier l'accès à une réservation.
    
    Args:
        db: Session de base de données
        user: L'utilisateur authentifié
        booking_id: ID de la réservation
    
    Returns:
        bool: True si l'accès est autorisé
    
    Raises:
        HTTPException 404: Si la réservation n'existe pas
        HTTPException 403: Si l'accès est refusé
    """
    from ..models.booking import Booking
    
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if user.role == "ADMIN":
        return True
    
    if user.id not in [booking.client_id, booking.therapist_id]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this booking"
        )
    
    return True


def check_therapist_access(db: Session, user: User, therapist_id: int) -> bool:
    """
    Vérifier l'accès à un compte thérapeute.
    
    Args:
        db: Session de base de données
        user: L'utilisateur authentifié
        therapist_id: ID du thérapeute
    
    Returns:
        bool: True si l'accès est autorisé
    
    Raises:
        HTTPException 403: Si l'accès est refusé
    """
    if user.role == "ADMIN":
        return True
    
    if user.id != therapist_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this therapist account"
        )
    
    return True


def check_user_access(user: User, target_user_id: int) -> bool:
    """
    Vérifier l'accès à un compte utilisateur.
    
    Args:
        user: L'utilisateur authentifié
        target_user_id: ID de l'utilisateur cible
    
    Returns:
        bool: True si l'accès est autorisé
    
    Raises:
        HTTPException 403: Si l'accès est refusé
    """
    if user.role == "ADMIN":
        return True
    
    if user.id != target_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this user"
        )
    
    return True

# ============================================
# FONCTIONS UTILITAIRES
# ============================================

def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Obtenir un utilisateur par son ID."""
    return db.query(User).filter(
        User.id == user_id,
        User.deleted_at.is_(None)
    ).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Obtenir un utilisateur par son email."""
    return db.query(User).filter(
        User.email == email,
        User.deleted_at.is_(None)
    ).first()


def get_user_by_phone(db: Session, phone: str) -> Optional[User]:
    """Obtenir un utilisateur par son téléphone."""
    return db.query(User).filter(
        User.phone == phone,
        User.deleted_at.is_(None)
    ).first()


def is_valid_password(password: str) -> bool:
    """Vérifier la force du mot de passe."""
    if len(password) < 8:
        return False
    if not re.search(r'[A-Z]', password):
        return False
    if not re.search(r'[a-z]', password):
        return False
    if not re.search(r'[0-9]', password):
        return False
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False
    return True


def is_valid_phone(phone: str) -> bool:
    """Vérifier le format du numéro de téléphone malgache."""
    pattern = r'^(\+261|0)[0-9]{9}$'
    return bool(re.match(pattern, phone))


def is_valid_email(email: str) -> bool:
    """Vérifier le format de l'email."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


# ============================================
# EXPORTS
# ============================================

__all__ = [
    # Auth principales
    'get_current_user',
    'get_current_user_optional',
    'get_current_active_user',
    'get_current_therapist',
    'get_current_admin',
    'get_current_client',
    
    # WebSocket
    'get_current_user_ws',
    'get_user_from_websocket',
    
    # API Key
    'get_api_key',
    
    # Rate Limiting
    'check_rate_limit',
    'rate_limiter',
    
    # Permissions
    'PermissionChecker',
    'has_admin_access',
    'has_therapist_access',
    'has_client_access',
    
    # Rôles
    'RoleChecker',
    'ALLOW_CLIENT',
    'ALLOW_THERAPIST',
    'ALLOW_ADMIN',
    'ALLOW_CLIENT_THERAPIST',
    'ALLOW_ALL',
    
    # Vérifications par ressource
    'check_booking_access',
    'check_therapist_access',
    'check_user_access',
    
    # Utilitaires
    'get_user_by_id',
    'get_user_by_email',
    'get_user_by_phone',
    'is_valid_password',
    'is_valid_phone',
    'is_valid_email',
]