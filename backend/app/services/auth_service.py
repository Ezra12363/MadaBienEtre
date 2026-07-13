# app/services/auth_service.py
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import random
import string
from typing import Optional, Tuple, Dict, Any
from ..models.user import User
from ..core.security import (
    hash_password, 
    verify_password, 
    create_access_token, 
    create_refresh_token,
    generate_otp
)
from ..core.config import settings
from ..services.email_service import send_otp_email

class AuthService:
    """Service d'authentification"""
    
    @staticmethod
    def register_user(db: Session, user_data: Dict[str, Any]) -> Tuple[Optional[User], Optional[str]]:
        """Inscription d'un nouvel utilisateur"""
        # Vérifier si l'email existe déjà
        existing_user = db.query(User).filter(User.email == user_data["email"]).first()
        if existing_user:
            return None, "Email already registered"
        
        # Vérifier si le téléphone existe déjà
        existing_phone = db.query(User).filter(User.phone == user_data["phone"]).first()
        if existing_phone:
            return None, "Phone number already registered"
        
        # Hasher le mot de passe
        hashed_password = hash_password(user_data["password"])
        
        # Générer OTP
        otp_code = generate_otp()
        otp_expiry = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
        
        # Créer l'utilisateur
        new_user = User(
            fullname=user_data["fullname"],
            email=user_data["email"],
            phone=user_data["phone"],
            password=hashed_password,
            role=user_data.get("role", "CLIENT"),
            is_active=False,
            otp_code=otp_code,
            otp_expires_at=otp_expiry
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Envoyer OTP
        send_otp_email(user_data["email"], otp_code, user_data["fullname"])
        
        return new_user, None
    
    @staticmethod
    def verify_otp(db: Session, email: str, otp_code: str) -> Tuple[Optional[User], Optional[str]]:
        """Vérifier le code OTP"""
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return None, "User not found"
        
        if user.otp_code != otp_code:
            return None, "Invalid OTP code"
        
        if user.otp_expires_at < datetime.utcnow():
            return None, "OTP code has expired"
        
        user.is_active = True
        user.otp_code = None
        user.otp_expires_at = None
        db.commit()
        db.refresh(user)
        
        return user, None
    
    @staticmethod
    def login(db: Session, email: str, password: str) -> Tuple[Optional[Dict], Optional[str]]:
        """Connexion utilisateur"""
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return None, "Invalid credentials"
        
        if not user.is_active:
            return None, "Account not verified"
        
        if not verify_password(password, user.password):
            return None, "Invalid credentials"
        
        # Créer les tokens
        access_token = create_access_token(data={"sub": user.id, "role": user.role})
        refresh_token = create_refresh_token(data={"sub": user.id, "role": user.role})
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user_id": user.id,
            "role": user.role
        }, None
    
    @staticmethod
    def refresh_token(db: Session, refresh_token: str) -> Tuple[Optional[Dict], Optional[str]]:
        """Rafraîchir le token"""
        try:
            from ..core.security import decode_token
            payload = decode_token(refresh_token)
            user_id = payload.get("sub")
            
            if not user_id:
                return None, "Invalid token"
            
            user = db.query(User).filter(User.id == int(user_id)).first()
            if not user or not user.is_active:
                return None, "User not found or inactive"
            
            new_access_token = create_access_token(data={"sub": user.id, "role": user.role})
            
            return {
                "access_token": new_access_token,
                "token_type": "bearer"
            }, None
        except Exception as e:
            return None, f"Invalid refresh token: {str(e)}"
    
    @staticmethod
    def forgot_password(db: Session, email: str) -> Tuple[Optional[Dict], Optional[str]]:
        """Demande de réinitialisation de mot de passe"""
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return None, "User not found"
        
        otp_code = generate_otp()
        user.otp_code = otp_code
        user.otp_expires_at = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
        db.commit()
        
        send_otp_email(email, otp_code, user.fullname, reset=True)
        
        return {"message": "OTP sent to your email"}, None
    
    @staticmethod
    def reset_password(db: Session, email: str, otp_code: str, new_password: str) -> Tuple[Optional[Dict], Optional[str]]:
        """Réinitialiser le mot de passe"""
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return None, "User not found"
        
        if user.otp_code != otp_code:
            return None, "Invalid OTP code"
        
        if user.otp_expires_at < datetime.utcnow():
            return None, "OTP code has expired"
        
        user.password = hash_password(new_password)
        user.otp_code = None
        user.otp_expires_at = None
        db.commit()
        
        return {"message": "Password reset successfully"}, None
    
    @staticmethod
    def change_password(db: Session, user_id: int, old_password: str, new_password: str) -> Tuple[Optional[Dict], Optional[str]]:
        """Changer le mot de passe"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return None, "User not found"
        
        if not verify_password(old_password, user.password):
            return None, "Incorrect current password"
        
        user.password = hash_password(new_password)
        db.commit()
        
        return {"message": "Password changed successfully"}, None