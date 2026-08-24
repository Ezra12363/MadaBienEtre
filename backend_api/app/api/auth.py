# app/api/auth.py - Partie login simplifiée
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional

from ..core.database import get_db
from ..core.security import (
    hash_password, 
    verify_password, 
    create_access_token, 
    create_refresh_token,
    generate_otp,
    validate_password_strength,
    decode_token,
    oauth2_scheme
)
from ..core.dependencies import get_current_user, get_current_active_user
from ..models.user import User
from ..schemas.auth import (
    RegisterRequest, 
    LoginRequest, 
    OTPRequest, 
    ForgotPasswordRequest, 
    ResetPasswordRequest, 
    ChangePasswordRequest,
    Token,
    TokenData,
    LogoutResponse,
    RefreshTokenRequest
)
from ..services.email_service import send_otp_email
from ..core.config import settings
from fastapi.security import OAuth2PasswordRequestForm

router = APIRouter(tags=["Authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_data: RegisterRequest, db: Session = Depends(get_db)):
    """
    Inscription d'un nouvel utilisateur
    """
    # Valider la force du mot de passe
    is_valid, message = validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # Vérifier si email existe déjà
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Vérifier si téléphone existe déjà
    existing_phone = db.query(User).filter(User.phone == user_data.phone).first()
    if existing_phone:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    # Hasher le mot de passe
    hashed_password = hash_password(user_data.password)
    
    # Générer OTP
    otp_code = generate_otp()
    otp_expiry = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
    
    # Créer l'utilisateur
    new_user = User(
        fullname=user_data.fullname,
        email=user_data.email,
        phone=user_data.phone,
        password=hashed_password,
        role=user_data.role,
        is_active=False,
        otp_code=otp_code,
        otp_expires_at=otp_expiry
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Envoyer OTP par email
    send_otp_email(user_data.email, otp_code, user_data.fullname)
    
    return {
        "message": "Registration successful. OTP sent to your email.",
        "user_id": new_user.id,
        "email": new_user.email
    }

@router.post("/verify-otp")
async def verify_otp(otp_data: OTPRequest, db: Session = Depends(get_db)):
    """Vérification du code OTP pour activer le compte"""
    user = db.query(User).filter(User.email == otp_data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.otp_code != otp_data.otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP code")
    
    if user.otp_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP code has expired")
    
    user.is_active = True
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()
    
    return {"message": "Account verified successfully"}


# Esory ny LoginRequest ao amin'ny /login
@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Connexion utilisateur (OAuth2)
    """
    # form_data.username = email (ny OAuth2 dia mitaky username)
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user:
        raise HTTPException(
            status_code=401, 
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=401, 
            detail="Account not verified",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=401, 
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token(data={"sub": str(user.id), "role": user.role})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }
    
    
@router.post("/refresh-token", response_model=Token)
async def refresh_token(refresh_data: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Rafraîchir le token d'accès à l'aide du refresh token
    """
    try:
        payload = decode_token(refresh_data.refresh_token)
        user_id = payload.get("sub")
        token_type = payload.get("type")
        
        if not user_id or not isinstance(user_id, str):
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
        if token_type != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
        user = db.query(User).filter(
            User.id == int(user_id),
            User.is_active == True,
            User.deleted_at.is_(None)
        ).first()
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found or inactive")
        
        new_access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
        new_refresh_token = create_refresh_token(data={"sub": str(user.id), "role": user.role})
        
        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer"
        }
        
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid refresh token: {str(e)}")


@router.post("/logout", response_model=LogoutResponse)
async def logout(current_user: User = Depends(get_current_user)):
    """Déconnexion utilisateur"""
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_active_user)):
    """Obtenir les informations de l'utilisateur connecté"""
    return {
       "id": current_user.id,
        "fullname": current_user.fullname,
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "profile_image": current_user.profile_image,
        "rating": float(current_user.rating) if current_user.rating else 0,
        "total_reviews": current_user.total_reviews,
        "verification_status": current_user.verification_status,
        "created_at": current_user.created_at,
        "is_online": current_user.is_online,
        "is_available": current_user.is_available,
        "bio": current_user.bio,
        "experience_years": current_user.experience_years or 0,
        "base_price": float(current_user.base_price) if current_user.base_price else 0,
        "latitude": float(current_user.latitude) if current_user.latitude else None,
        "longitude": float(current_user.longitude) if current_user.longitude else None,
        "address": current_user.address, 
        "service_radius": current_user.service_radius,
        "commission_rate": float(current_user.commission_rate) if current_user.commission_rate else 10.0,
        "identity_document_url": current_user.identity_document_url,
        "certificate_url": current_user.certificate_url,
        "cin_number": current_user.cin_number,
    }


@router.put("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Changer le mot de passe de l'utilisateur connecté"""
    is_valid, message = validate_password_strength(data.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    if not verify_password(data.old_password, current_user.password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    current_user.password = hash_password(data.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Demande de réinitialisation de mot de passe"""
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    otp_code = generate_otp()
    user.otp_code = otp_code
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
    db.commit()
    
    send_otp_email(data.email, otp_code, user.fullname, reset=True)
    
    return {"message": "OTP sent to your email for password reset"}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Réinitialiser le mot de passe avec OTP"""
    is_valid, message = validate_password_strength(data.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.otp_code != data.otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP code")
    
    if user.otp_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP code has expired")
    
    user.password = hash_password(data.new_password)
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()
    
    return {"message": "Password reset successfully"}


@router.post("/resend-otp")
async def resend_otp(email: str, db: Session = Depends(get_db)):
    """Renvoyer un nouveau code OTP"""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    otp_code = generate_otp()
    user.otp_code = otp_code
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
    db.commit()
    
    send_otp_email(email, otp_code, user.fullname)
    
    return {"message": "New OTP sent to your email"}


@router.post("/deactivate")
async def deactivate_account(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Désactiver le compte de l'utilisateur connecté"""
    current_user.is_active = False
    db.commit()
    
    return {"message": "Account deactivated successfully"}


@router.post("/reactivate")
async def reactivate_account(
    email: str,
    otp_code: str,
    db: Session = Depends(get_db)
):
    """Réactiver un compte désactivé avec OTP"""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_active:
        raise HTTPException(status_code=400, detail="Account is already active")
    
    if user.otp_code != otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP code")
    
    if user.otp_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP code has expired")
    
    user.is_active = True
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()
    
    return {"message": "Account reactivated successfully"}


@router.get("/check-email")
async def check_email(email: str, db: Session = Depends(get_db)):
    """Vérifier si un email est déjà utilisé"""
    user = db.query(User).filter(User.email == email).first()
    return {"exists": user is not None}


@router.get("/check-phone")
async def check_phone(phone: str, db: Session = Depends(get_db)):
    """Vérifier si un numéro de téléphone est déjà utilisé"""
    user = db.query(User).filter(User.phone == phone).first()
    return {"exists": user is not None}