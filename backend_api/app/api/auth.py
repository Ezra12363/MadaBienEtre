# app/api/auth.py - Partie login simplifiée
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import asyncio
import logging
import secrets
import uuid

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
from ..validators.phone import phone_variants
from ..schemas.auth import (
    RegisterRequest, 
    LoginRequest, 
    OTPRequest, 
    ForgotPasswordRequest, 
    ResetPasswordRequest, 
    ChangePasswordRequest,
    Token,
    SocialLoginRequest,
    SocialToken,
    TokenData,
    LogoutResponse,
    RefreshTokenRequest
)
from ..services.email_service import send_otp_email
from ..services.social_auth import (
    SocialAuthError,
    verify_google_id_token,
    verify_apple_identity_token,
)
from ..notifications.sms_notifications import sms_service
from ..services.account_settings import apply_auto_moderation
from ..services.account_notifications import (
    notify_admins_new_account,
    send_pending_activation_email,
)
from ..services.notification_service import send_admin_notification
from ..core.config import settings
from fastapi.security import OAuth2PasswordRequestForm

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Authentication"])

SOCIAL_PHONE_PREFIX = "SOC"  # téléphone provisoire des comptes créés via Google/Apple


async def _send_otp(user: User, otp_code: str, reset: bool = False) -> None:
    """Envoie l'OTP par email ET par SMS (si SMS_ENABLED=True). Ne lève jamais d'erreur."""
    try:
        # smtplib est bloquant : on l'exécute dans un thread pour ne pas figer l'API
        sent = await asyncio.to_thread(send_otp_email, user.email, otp_code, user.fullname, reset)
        if not sent:
            logger.error("OTP email NOT sent to %s (voir l'erreur SMTP ci-dessus)", user.email)
    except Exception as exc:
        logger.error("OTP email failed for %s: %s", user.email, exc)

    phone = (user.phone or "").strip()
    if phone and not phone.startswith(SOCIAL_PHONE_PREFIX):
        try:
            label = "réinitialisation" if reset else "vérification"
            await sms_service.send_sms(
                phone,
                f"Mada Bien-être: votre code de {label} est {otp_code}. "
                f"Valable {settings.OTP_EXPIRY_MINUTES} minutes.",
            )
        except Exception as exc:
            logger.error("OTP SMS failed for %s: %s", phone, exc)


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
    existing_phone = db.query(User).filter(User.phone.in_(phone_variants(user_data.phone))).first()
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
    
    # Envoyer OTP par email + SMS
    await _send_otp(new_user, otp_code)

    # Le compte est créé DÉSACTIVÉ (is_active=False) : les administrateurs reçoivent
    # immédiatement une notification avec les informations du nouvel inscrit.
    notify_admins_new_account(new_user)
    
    return {
        "message": "Registration successful. OTP sent to your email and phone. "
                   "Your account must then be activated by an administrator.",
        "requires_admin_activation": True,
        "user_id": new_user.id,
        "email": new_user.email
    }

@router.post("/verify-otp")
async def verify_otp(otp_data: OTPRequest, db: Session = Depends(get_db)):
    """
    Vérification du code OTP (email vérifié).

    ⚠️ La vérification de l'email N'ACTIVE PLUS le compte : un administrateur doit
    l'activer. L'utilisateur reçoit un email le lui indiquant.
    """
    user = db.query(User).filter(User.email == otp_data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.otp_code or user.otp_code != otp_data.otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP code")
    
    if user.otp_expires_at is None or user.otp_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP code has expired")
    
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()

    if user.is_active:
        return {"message": "Email verified successfully", "requires_admin_activation": False}

    # Activation / approbation automatique (réglages admin) : email + notification envoyés
    if apply_auto_moderation(user, db) != "none":
        return {
            "message": "Votre email est vérifié et votre compte est activé : vous pouvez vous connecter.",
            "requires_admin_activation": False,
        }

    # Compte encore désactivé : informer l'utilisateur (email en français)
    try:
        send_pending_activation_email(user)
    except Exception:
        logger.exception("Email « en attente d'activation » non envoyé (user_id=%s)", user.id)
    
    return {
        "message": "Votre email est vérifié. Votre compte doit maintenant être activé "
                   "par un administrateur : vous recevrez un email dès l'activation.",
        "requires_admin_activation": True,
    }


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
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=401, 
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Mot de passe correct, mais compte désactivé : on explique pourquoi (en français)
    if not user.is_active:
        if user.otp_code:
            detail = "Votre email n'est pas encore vérifié. Saisissez le code OTP reçu par email."
        elif user.deleted_at is not None:
            detail = "Votre compte a été désactivé. Contactez l'administrateur."
        else:
            detail = (
                "Votre compte est en attente d'activation par un administrateur. "
                "Vous pourrez vous connecter dès qu'il sera activé (vous recevrez un email)."
            )
        # 403 (et non 401) : le mot de passe est correct, c'est le compte qui n'est pas autorisé
        raise HTTPException(status_code=403, detail=detail)
    
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token(data={"sub": str(user.id), "role": user.role})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }
    
    
def _social_login(info: dict, data: SocialLoginRequest, db: Session) -> dict:
    """Connecte (ou inscrit) un utilisateur à partir d'une identité Google/Apple vérifiée."""
    email = info.get("email")
    if not email or not info.get("email_verified"):
        raise HTTPException(
            status_code=400,
            detail="Votre compte ne fournit pas d'email vérifié. Inscrivez-vous avec votre email.",
        )

    user = db.query(User).filter(User.email == email).first()

    if user is None:
        fullname = (data.full_name or info.get("name") or email.split("@")[0]).strip()[:100] or "Utilisateur"
        user = User(
            fullname=fullname,
            email=email,
            # téléphone provisoire unique (colonne NOT NULL + UNIQUE) : à compléter dans le profil
            phone=f"{SOCIAL_PHONE_PREFIX}{uuid.uuid4().hex[:15]}",
            password=hash_password(secrets.token_urlsafe(32)),
            role=data.role,
            is_active=False,  # email déjà vérifié par Google/Apple, mais un admin doit activer
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        notify_admins_new_account(user, source=info["provider"])
        if apply_auto_moderation(user, db) != "none":
            # activé automatiquement : connexion immédiate
            return {
                "access_token": create_access_token(data={"sub": str(user.id), "role": user.role}),
                "refresh_token": create_refresh_token(data={"sub": str(user.id), "role": user.role}),
                "token_type": "bearer",
                "is_new_user": True,
                "needs_phone": True,
            }
        try:
            send_pending_activation_email(user, source=info["provider"])
        except Exception:
            logger.exception("Email « en attente d'activation » non envoyé (user_id=%s)", user.id)
        raise HTTPException(
            status_code=403,
            detail="Votre compte a été créé. Il doit être activé par un administrateur : "
                   "vous recevrez un email dès l'activation.",
        )

    elif not user.is_active:
        # compte en attente d'activation, désactivé ou suspendu : on ne le réactive JAMAIS ici
        raise HTTPException(
            status_code=403,
            detail="Votre compte est en attente d'activation par un administrateur ou a été désactivé.",
        )

    return {
        "access_token": create_access_token(data={"sub": str(user.id), "role": user.role}),
        "refresh_token": create_refresh_token(data={"sub": str(user.id), "role": user.role}),
        "token_type": "bearer",
        "is_new_user": False,
        "needs_phone": str(user.phone or "").startswith(SOCIAL_PHONE_PREFIX),
    }


@router.post("/google", response_model=SocialToken)
async def google_login(data: SocialLoginRequest, db: Session = Depends(get_db)):
    """Connexion / inscription avec Google (id_token)."""
    try:
        info = verify_google_id_token(data.id_token)
    except SocialAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    return _social_login(info, data, db)


@router.post("/apple", response_model=SocialToken)
async def apple_login(data: SocialLoginRequest, db: Session = Depends(get_db)):
    """Connexion / inscription avec Apple (identityToken)."""
    try:
        info = verify_apple_identity_token(data.id_token)
    except SocialAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    return _social_login(info, data, db)


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
    
    await _send_otp(user, otp_code, reset=True)
    
    return {"message": "OTP sent to your email and phone for password reset"}


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
    
    await _send_otp(user, otp_code)
    
    return {"message": "New OTP sent to your email and phone"}


@router.post("/deactivate")
async def deactivate_account(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Désactiver le compte de l'utilisateur connecté"""
    current_user.is_active = False
    current_user.deleted_at = datetime.utcnow()  # distingue « désactivé » de « en attente d'activation »
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

    # Un compte « en attente d'activation » (jamais activé) ne peut PAS s'auto-réactiver :
    # seul un administrateur peut l'activer.
    if user.deleted_at is None:
        raise HTTPException(
            status_code=403,
            detail="Ce compte doit être activé par un administrateur.",
        )
    
    if user.otp_code != otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP code")
    
    if user.otp_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP code has expired")
    
    user.is_active = True
    user.deleted_at = None
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
    user = db.query(User).filter(User.phone.in_(phone_variants(phone))).first()
    return {"exists": user is not None}