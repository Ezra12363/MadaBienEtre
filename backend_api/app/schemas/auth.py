# app/schemas/auth.py
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
import re

class LoginRequest(BaseModel):
    """Schéma pour la connexion - accepte email"""
    email: EmailStr = Field(..., description="Email de l'utilisateur")
    password: str = Field(..., min_length=8, description="Mot de passe")
    
    @field_validator('password')
    def validate_password(cls, v):
        """Valider la force du mot de passe"""
        password_bytes = v.encode('utf-8')
        if len(password_bytes) > 72:
            raise ValueError('Le mot de passe ne doit pas dépasser 72 caractères')
        if len(v) < 8:
            raise ValueError('Le mot de passe doit contenir au moins 8 caractères')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Le mot de passe doit contenir au moins une majuscule')
        if not re.search(r'[a-z]', v):
            raise ValueError('Le mot de passe doit contenir au moins une minuscule')
        if not re.search(r'[0-9]', v):
            raise ValueError('Le mot de passe doit contenir au moins un chiffre')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*(),.?":{}|<>)')
        return v


class RegisterRequest(BaseModel):
    fullname: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., pattern=r'^(\+261|0)[0-9]{9}$')
    password: str = Field(..., min_length=8)
    role: str = Field("CLIENT", pattern="^(CLIENT|THERAPIST)$")
    
    @field_validator('password')
    def validate_password(cls, v):
        password_bytes = v.encode('utf-8')
        if len(password_bytes) > 72:
            raise ValueError('Le mot de passe ne doit pas dépasser 72 caractères')
        if len(v) < 8:
            raise ValueError('Le mot de passe doit contenir au moins 8 caractères')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Le mot de passe doit contenir au moins une majuscule')
        if not re.search(r'[a-z]', v):
            raise ValueError('Le mot de passe doit contenir au moins une minuscule')
        if not re.search(r'[0-9]', v):
            raise ValueError('Le mot de passe doit contenir au moins un chiffre')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*(),.?":{}|<>)')
        return v


class OTPRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(..., pattern=r'^[0-9]{6}$')


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(..., pattern=r'^[0-9]{6}$')
    new_password: str = Field(..., min_length=8)
    
    @field_validator('new_password')
    def validate_password(cls, v):
        password_bytes = v.encode('utf-8')
        if len(password_bytes) > 72:
            raise ValueError('Le mot de passe ne doit pas dépasser 72 caractères')
        if len(v) < 8:
            raise ValueError('Le mot de passe doit contenir au moins 8 caractères')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Le mot de passe doit contenir au moins une majuscule')
        if not re.search(r'[a-z]', v):
            raise ValueError('Le mot de passe doit contenir au moins une minuscule')
        if not re.search(r'[0-9]', v):
            raise ValueError('Le mot de passe doit contenir au moins un chiffre')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*(),.?":{}|<>)')
        return v


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=8)
    new_password: str = Field(..., min_length=8)
    
    @field_validator('new_password')
    def validate_password(cls, v):
        password_bytes = v.encode('utf-8')
        if len(password_bytes) > 72:
            raise ValueError('Le mot de passe ne doit pas dépasser 72 caractères')
        if len(v) < 8:
            raise ValueError('Le mot de passe doit contenir au moins 8 caractères')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Le mot de passe doit contenir au moins une majuscule')
        if not re.search(r'[a-z]', v):
            raise ValueError('Le mot de passe doit contenir au moins une minuscule')
        if not re.search(r'[0-9]', v):
            raise ValueError('Le mot de passe doit contenir au moins un chiffre')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*(),.?":{}|<>)')
        return v


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None


class TokenData(BaseModel):
    user_id: int
    role: Optional[str] = None


class LogoutResponse(BaseModel):
    message: str = "Logged out successfully"


class RefreshTokenRequest(BaseModel):
    refresh_token: str