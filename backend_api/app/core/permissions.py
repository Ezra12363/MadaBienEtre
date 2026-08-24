from typing import List, Optional, Callable, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from .config import settings
from ..models.user import User
from ..models.booking import Booking
from ..models.review import Review

class PermissionRegistry:
    """Registre des permissions de l'application"""
    
    # Permissions disponibles
    PERMISSIONS = {
        # Utilisateurs
        "users:view": "Voir les utilisateurs",
        "users:create": "Créer des utilisateurs",
        "users:update": "Modifier les utilisateurs",
        "users:delete": "Supprimer les utilisateurs",
        "users:activate": "Activer/désactiver les utilisateurs",
        
        # Thérapeutes
        "therapists:view": "Voir les thérapeutes",
        "therapists:approve": "Approuver les thérapeutes",
        "therapists:reject": "Rejeter les thérapeutes",
        "therapists:manage": "Gérer les thérapeutes",
        
        # Réservations
        "bookings:view": "Voir les réservations",
        "bookings:create": "Créer des réservations",
        "bookings:update": "Modifier les réservations",
        "bookings:delete": "Supprimer les réservations",
        "bookings:confirm": "Confirmer les réservations",
        "bookings:cancel": "Annuler les réservations",
        
        # Paiements
        "payments:view": "Voir les paiements",
        "payments:create": "Créer des paiements",
        "payments:refund": "Rembourser des paiements",
        
        # Avis
        "reviews:view": "Voir les avis",
        "reviews:create": "Créer des avis",
        "reviews:moderate": "Modérer les avis",
        
        # Notifications
        "notifications:send": "Envoyer des notifications",
        "notifications:view": "Voir les notifications",
        
        # SOS
        "sos:view": "Voir les alertes SOS",
        "sos:resolve": "Résoudre les alertes SOS",
        
        # Admin
        "admin:dashboard": "Accéder au dashboard admin",
        "admin:statistics": "Accéder aux statistiques",
        "admin:settings": "Modifier les paramètres",
        
        # AI
        "ai:use": "Utiliser les fonctionnalités IA",
        "ai:train": "Entraîner les modèles IA",
    }
    
    # Rôles et leurs permissions
    ROLE_PERMISSIONS = {
        "CLIENT": [
            "users:view",
            "bookings:view",
            "bookings:create",
            "bookings:update",
            "bookings:cancel",
            "payments:create",
            "payments:view",
            "reviews:create",
            "reviews:view",
            "notifications:view",
            "ai:use",
        ],
        "THERAPIST": [
            "users:view",
            "bookings:view",
            "bookings:update",
            "bookings:confirm",
            "bookings:cancel",
            "payments:view",
            "reviews:view",
            "notifications:view",
            "notifications:send",
            "ai:use",
        ],
        "ADMIN": list(PERMISSIONS.keys()),
        "SUPER_ADMIN": ["*"],  # Toutes les permissions
    }

class PermissionChecker:
    """Vérificateur de permissions"""
    
    def __init__(self, required_permissions: List[str]):
        self.required_permissions = required_permissions
    
    async def __call__(
        self,
        current_user: User,
        db: Session = None,
        **kwargs
    ) -> bool:
        """Vérifier si l'utilisateur a les permissions requises"""
        user_permissions = self.get_user_permissions(current_user)
        
        # Super admin a toutes les permissions
        if "*" in user_permissions:
            return True
        
        # Vérifier chaque permission requise
        for permission in self.required_permissions:
            if permission not in user_permissions:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Missing permission: {permission}"
                )
        
        return True
    
    @staticmethod
    def get_user_permissions(user: User) -> List[str]:
        """Obtenir les permissions d'un utilisateur selon son rôle"""
        return PermissionRegistry.ROLE_PERMISSIONS.get(user.role, [])

# Permissions spécifiques
class ResourcePermissionChecker:
    """Vérificateur de permissions avec ressources"""
    
    def __init__(self, permission: str):
        self.permission = permission
    
    async def __call__(
        self,
        current_user: User,
        resource_id: int = None,
        db: Session = None,
        **kwargs
    ) -> bool:
        """Vérifier si l'utilisateur a accès à une ressource spécifique"""
        # Vérifier la permission de base
        permission_checker = PermissionChecker([self.permission])
        await permission_checker(current_user)
        
        # Vérifier l'accès à la ressource
        if resource_id:
            return await self.check_resource_access(
                current_user, resource_id, db, **kwargs
            )
        
        return True
    
    async def check_resource_access(
        self,
        user: User,
        resource_id: int,
        db: Session,
        **kwargs
    ) -> bool:
        """Vérifier l'accès à une ressource spécifique"""
        resource_type = kwargs.get("resource_type")
        
        if resource_type == "booking":
            booking = db.query(Booking).filter(Booking.id == resource_id).first()
            if booking:
                if user.role == "ADMIN":
                    return True
                if user.id in [booking.client_id, booking.therapist_id]:
                    return True
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have access to this booking"
                )
        
        elif resource_type == "review":
            review = db.query(Review).filter(Review.id == resource_id).first()
            if review:
                if user.role == "ADMIN":
                    return True
                if user.id in [review.reviewer_id, review.therapist_id]:
                    return True
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have access to this review"
                )
        
        elif resource_type == "user":
            if user.role == "ADMIN":
                return True
            if user.id == resource_id:
                return True
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this user"
            )
        
        return True

# Fonctions de vérification rapide
def has_permission(user: User, permission: str) -> bool:
    """Vérifier si l'utilisateur a une permission"""
    user_permissions = PermissionRegistry.ROLE_PERMISSIONS.get(user.role, [])
    return permission in user_permissions or "*" in user_permissions

def require_permission(permission: str):
    """Décorateur pour exiger une permission"""
    async def decorator(func):
        async def wrapper(*args, **kwargs):
            user = kwargs.get("current_user")
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Not authenticated"
                )
            if not has_permission(user, permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Missing permission: {permission}"
                )
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# Dépendances FastAPI pour les permissions
def requires_permission(permissions: List[str]):
    """Dépendance FastAPI pour les permissions"""
    return PermissionChecker(permissions)

def requires_resource_access(permission: str):
    """Dépendance FastAPI pour l'accès aux ressources"""
    return ResourcePermissionChecker(permission)

class RoleChecker:
    """Vérificateur de rôles"""
    
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles
    
    def __call__(self, user: User) -> bool:
        if user.role not in self.allowed_roles and user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role {user.role} not allowed for this endpoint"
            )
        return True

# Rôles autorisés prédéfinis
ALLOW_CLIENT = RoleChecker(["CLIENT"])
ALLOW_THERAPIST = RoleChecker(["THERAPIST"])
ALLOW_ADMIN = RoleChecker(["ADMIN"])
ALLOW_CLIENT_THERAPIST = RoleChecker(["CLIENT", "THERAPIST"])
ALLOW_ALL = RoleChecker(["CLIENT", "THERAPIST", "ADMIN"])

# Vérifications par ressource
def check_booking_access(db: Session, user: User, booking_id: int) -> bool:
    """Vérifier l'accès à une réservation"""
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
    """Vérifier l'accès à un compte thérapeute"""
    if user.role == "ADMIN":
        return True
    
    if user.id != therapist_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this therapist account"
        )
    
    return True

def check_user_access(user: User, target_user_id: int) -> bool:
    """Vérifier l'accès à un compte utilisateur"""
    if user.role == "ADMIN":
        return True
    
    if user.id != target_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this user"
        )
    
    return True