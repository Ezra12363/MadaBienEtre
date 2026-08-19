# app/core/security.py
from fastapi.security import OAuth2PasswordBearer, HTTPAuthorizationCredentials, HTTPBearer
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import jwt, JWTError
import bcrypt
import random
import string
import secrets
from .config import settings

# ✅ Token URL tsotra
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
    auto_error=True
)

# ✅ Security Bearer ho an'ny JWT
security = HTTPBearer()


class SecurityService:
    """Service de sécurité"""

    # ============================================================
    # HACHAGE DE MOT DE PASSE
    # ============================================================
    @staticmethod
    def hash_password(password: str) -> str:
        """Hacher un mot de passe avec bcrypt"""
        password_bytes = password.encode("utf-8")
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        
        salt = bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)
        hashed = bcrypt.hashpw(password_bytes, salt)
        return hashed.decode("utf-8")

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Vérifier un mot de passe par rapport à son hash"""
        try:
            password_bytes = plain_password.encode("utf-8")
            if len(password_bytes) > 72:
                password_bytes = password_bytes[:72]
            
            return bcrypt.checkpw(
                password_bytes,
                hashed_password.encode("utf-8")
            )
        except (ValueError, TypeError):
            return False

    # ============================================================
    # JWT
    # ============================================================
    @staticmethod
    def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Créer un token JWT d'accès"""
        to_encode = data.copy()

        if "sub" in to_encode and not isinstance(to_encode["sub"], str):
            to_encode["sub"] = str(to_encode["sub"])

        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "iss": settings.APP_NAME,
            "type": "access"
        })

        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    @staticmethod
    def create_refresh_token(data: Dict[str, Any]) -> str:
        """Créer un token JWT de rafraîchissement"""
        to_encode = data.copy()

        if "sub" in to_encode and not isinstance(to_encode["sub"], str):
            to_encode["sub"] = str(to_encode["sub"])

        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "iss": settings.APP_NAME,
            "type": "refresh"
        })

        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    @staticmethod
    def decode_token(token: str) -> Dict[str, Any]:
        """Décoder un token JWT"""
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
                options={"verify_exp": True}
            )
            return payload
        except JWTError as e:
            raise ValueError(f"Invalid token: {str(e)}")

    @staticmethod
    def verify_token(token: str) -> Optional[Dict[str, Any]]:
        """Vérifier et décoder un token JWT"""
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
                options={"verify_exp": True}
            )
            return payload
        except JWTError:
            return None

    # ============================================================
    # OTP ET TOKENS
    # ============================================================
    @staticmethod
    def generate_otp(length: int = 6) -> str:
        """Générer un code OTP"""
        return ''.join(random.choices(string.digits, k=length))

    @staticmethod
    def generate_secure_token(length: int = 32) -> str:
        """Générer un token sécurisé"""
        return secrets.token_urlsafe(length)

    @staticmethod
    def generate_api_key() -> str:
        """Générer une clé API"""
        return f"mada_{secrets.token_hex(16)}"

    @staticmethod
    def validate_password_strength(password: str) -> tuple:
        """Valider la force du mot de passe"""
        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            return False, "Le mot de passe ne doit pas dépasser 72 caractères"

        if len(password) < 8:
            return False, "Le mot de passe doit contenir au moins 8 caractères"

        if not any(c.isupper() for c in password):
            return False, "Le mot de passe doit contenir au moins une majuscule"

        if not any(c.islower() for c in password):
            return False, "Le mot de passe doit contenir au moins une minuscule"

        if not any(c.isdigit() for c in password):
            return False, "Le mot de passe doit contenir au moins un chiffre"

        if not any(c in "!@#$%^&*(),.?\":{}|<>" for c in password):
            return False, "Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*(),.?\":{}|<>)"

        return True, "Mot de passe valide"


# ============================================================
# FONCTIONS D'EXPORT (Compatibilité)
# ============================================================

# ✅ Fonctions pour le hachage - IREO NO TENA ILIAINA!
def get_password_hash(password: str) -> str:
    """Hacher un mot de passe (alias pour hash_password)"""
    return SecurityService.hash_password(password)

def hash_password(password: str) -> str:
    """Hacher un mot de passe"""
    return SecurityService.hash_password(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifier un mot de passe"""
    return SecurityService.verify_password(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Créer un token d'accès"""
    return SecurityService.create_access_token(data, expires_delta)

def create_refresh_token(data: dict) -> str:
    """Créer un token de rafraîchissement"""
    return SecurityService.create_refresh_token(data)

def decode_token(token: str) -> dict:
    """Décoder un token"""
    return SecurityService.decode_token(token)

def verify_token(token: str) -> Optional[dict]:
    """Vérifier un token"""
    return SecurityService.verify_token(token)

def generate_otp(length: int = 6) -> str:
    """Générer un code OTP"""
    return SecurityService.generate_otp(length)

def generate_secure_token(length: int = 32) -> str:
    """Générer un token sécurisé"""
    return SecurityService.generate_secure_token(length)

def generate_api_key() -> str:
    """Générer une clé API"""
    return SecurityService.generate_api_key()

def validate_password_strength(password: str) -> tuple:
    """Valider la force du mot de passe"""
    return SecurityService.validate_password_strength(password)


# ============================================================
# SECURITY HEADERS
# ============================================================

class SecurityHeaders:
    """En-têtes de sécurité"""

    @staticmethod
    def get_headers() -> Dict[str, str]:
        return {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "geolocation=(self), camera=(), microphone=(), payment=()"
        }