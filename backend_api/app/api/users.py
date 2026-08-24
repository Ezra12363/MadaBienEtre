# app/api/users.py
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
    Query,
    status,
)
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import datetime, timedelta
from typing import Optional, List
import logging

import os
from pathlib import Path

from ..core.database import get_db
from ..core.dependencies import get_current_user, get_current_admin, get_current_therapist
from ..models.user import User
from ..models.booking import Booking
from ..models.therapist_certificate import TherapistCertificate
from ..models.therapist import (
    TherapistSpecialty,
    TherapistRating,
    TherapistEarnings,
    Withdrawal,
)
from ..schemas.user import (
    UserResponse,
    UserUpdate,
    UserCreate,
    UserProfileUpdate,
    ChangePasswordRequest,
    UserStatsResponse,
    UserListResponse,
    TherapistProfileResponse,
    TherapistApplicationRequest,
    TherapistApplicationResponse,
    UserLocationUpdate,
    UserSearchParams,
    TherapistFilters,
    UserActivateRequest,
    UserBulkActionRequest,
    UserPasswordResetRequest,
)
from ..services.upload_service import upload_image
from ..core.security import get_password_hash, verify_password, generate_secure_token

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Users"])

# ✅ Racine du projet (même convention que certificate_service.py) —
# utilisée pour résoudre les chemins relatifs des fichiers certificats
# (ex: "uploads/certificates/xxx.pdf") lors de la suppression d'un
# utilisateur.
BASE_DIR = Path(__file__).resolve().parents[2]


# ============================================================
# 1. ✅ PROFIL DE L'UTILISATEUR CONNECTÉ
# ============================================================
@router.get("/users/me", response_model=UserResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    """Obtenir le profil de l'utilisateur connecté"""
    return current_user


# ============================================================
# 2. ✅ LISTE DES THÉRAPEUTES
# ============================================================
@router.get(
    "/users/therapists",
    response_model=List[UserResponse],
    summary="Liste des thérapeutes",
)
async def get_therapists(
    online_only: bool = Query(False, description="Uniquement les thérapeutes en ligne"),
    verified_only: bool = Query(False, description="Uniquement les thérapeutes vérifiés"),
    available_only: bool = Query(False, description="Uniquement les thérapeutes disponibles"),
    min_rating: Optional[float] = Query(None, ge=0, le=5, description="Note minimale"),
    limit: int = Query(20, ge=1, le=100, description="Nombre maximum de résultats"),
    skip: int = Query(0, ge=0, description="Nombre d'éléments à sauter"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Liste des thérapeutes avec filtres"""
    try:
        query = db.query(User).filter(
            User.role == "THERAPIST",
            User.deleted_at.is_(None),
            User.is_active == True,
        )

        if online_only:
            query = query.filter(User.is_online == True)

        if verified_only:
            query = query.filter(User.verification_status == "approved")

        if available_only:
            query = query.filter(User.is_available == True)

        if min_rating is not None:
            query = query.filter(User.rating >= min_rating)

        query = query.order_by(User.rating.desc(), User.total_reviews.desc())

        therapists = query.offset(skip).limit(limit).all()

        return therapists
    except Exception as e:
        logger.error(f"Erreur get_therapists: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")


# ============================================================
# 3. ✅ LISTE DES UTILISATEURS (Admin)
# ============================================================
@router.get(
    "/users",
    response_model=List[UserResponse],
    summary="Liste des utilisateurs",
)
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    role: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    show_deleted: bool = Query(False, description="Afficher les utilisateurs supprimés"),
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Liste des utilisateurs (Admin uniquement)"""
    try:
        if show_deleted:
            query = db.query(User).filter(User.deleted_at.is_not(None))
        else:
            query = db.query(User).filter(User.deleted_at.is_(None))

        if role:
            query = query.filter(User.role == role.upper())

        if is_active is not None:
            query = query.filter(User.is_active == is_active)

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    User.fullname.ilike(search_term),
                    User.email.ilike(search_term),
                    User.phone.ilike(search_term),
                )
            )

        query = query.order_by(User.created_at.desc())
        users = query.offset(skip).limit(limit).all()

        return users
    except Exception as e:
        logger.error(f"Erreur get_users: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")


# ============================================================
# 4. ✅ CRÉER UN UTILISATEUR (Admin)
# ============================================================
@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un utilisateur",
)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Créer un nouvel utilisateur (Admin uniquement)"""
    try:
        existing_email = db.query(User).filter(
            User.email == user_data.email,
            User.deleted_at.is_(None),
        ).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cet email est déjà utilisé",
            )

        existing_phone = db.query(User).filter(
            User.phone == user_data.phone,
            User.deleted_at.is_(None),
        ).first()
        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce numéro de téléphone est déjà utilisé",
            )

        hashed_password = get_password_hash(user_data.password)

        new_user = User(
            fullname=user_data.fullname,
            email=user_data.email,
            phone=user_data.phone,
            password=hashed_password,
            role=user_data.role or "CLIENT",
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        logger.info(
            f"Utilisateur créé par l'admin {current_user.fullname}: "
            f"{new_user.email} ({new_user.role})"
        )

        return new_user

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur create_user: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")


# ============================================================
# 5. ✅ DÉTAILS D'UN UTILISATEUR
# ============================================================
@router.get(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="Détails d'un utilisateur",
)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Obtenir les détails d'un utilisateur"""
    try:
        user = db.query(User).filter(
            User.id == user_id,
            User.deleted_at.is_(None),
        ).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur non trouvé",
            )

        if current_user.id != user_id and current_user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Non autorisé",
            )

        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur get_user: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")


# ============================================================
# 6. ✅ METTRE À JOUR UN UTILISATEUR (AVEC CIN)
# ============================================================
@router.put(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="Mettre à jour un utilisateur",
)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    ✅ Mettre à jour un utilisateur (inclut cin_number)
    """
    try:
        if current_user.id != user_id and current_user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Non autorisé",
            )

        user = db.query(User).filter(
            User.id == user_id,
            User.deleted_at.is_(None),
        ).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur non trouvé",
            )

        update_data = user_data.dict(exclude_unset=True)

        # ✅ Traiter tous les champs, y compris cin_number
        for key, value in update_data.items():
            setattr(user, key, value)

        user.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(user)

        logger.info(f"✅ Utilisateur {user_id} mis à jour avec succès")
        logger.info(f"   - cin_number: {user.cin_number}")
        logger.info(f"   - address: {user.address}")
        logger.info(f"   - certificate_professionnel: {user.certificate_professionnel}")

        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur update_user: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")

# ============================================================
# 7. ✅ SUPPRIMER UN UTILISATEUR
# ============================================================
@router.delete(
    "/users/{user_id}",
    summary="Supprimer un utilisateur",
)
async def delete_user(
    user_id: int,
    permanent: bool = Query(
        False,
        description="true = suppression définitive, false = suppression logique",
    ),
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Supprimer un utilisateur.

    - permanent=false :
        Suppression logique :
        is_active = False
        deleted_at = date actuelle

    - permanent=true :
        Suppression définitive :
        l'utilisateur est supprimé de la base de données.
    """

    try:
        # --------------------------------------------------------
        # 1. Vérifier que l'utilisateur existe
        # --------------------------------------------------------
        user = db.query(User).filter(
            User.id == user_id
        ).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur non trouvé",
            )

        # --------------------------------------------------------
        # 2. Empêcher l'admin de supprimer son propre compte
        # --------------------------------------------------------
        if user.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vous ne pouvez pas supprimer votre propre compte",
            )

        # --------------------------------------------------------
        # 3. SUPPRESSION DÉFINITIVE
        # --------------------------------------------------------
        if permanent:
            logger.warning(
                f"⚠️ Suppression définitive de l'utilisateur "
                f"{user.id} ({user.email}) par "
                f"{current_user.fullname}"
            )

            # ----------------------------------------------------
            # 3.1 Nettoyer les données liées au thérapeute AVANT de
            # supprimer l'utilisateur. Ces tables ont une colonne
            # therapist_id NOT NULL sans cascade ORM configurée :
            # SQLAlchemy tenterait sinon de mettre therapist_id=NULL
            # au lieu de supprimer les lignes, ce qui provoque une
            # erreur NotNullViolation (voir traceback certificats).
            # ----------------------------------------------------

            # Certificats professionnels : on supprime aussi les
            # fichiers PDF associés sur le disque.
            certificates = (
                db.query(TherapistCertificate)
                .filter(TherapistCertificate.therapist_id == user.id)
                .all()
            )
            certificate_files_to_delete = [
                cert.certificate_path for cert in certificates if cert.certificate_path
            ]
            for cert in certificates:
                db.delete(cert)

            # Spécialités du thérapeute
            db.query(TherapistSpecialty).filter(
                TherapistSpecialty.therapist_id == user.id
            ).delete(synchronize_session=False)

            # Évaluation agrégée du thérapeute
            db.query(TherapistRating).filter(
                TherapistRating.therapist_id == user.id
            ).delete(synchronize_session=False)

            # Retraits (withdrawals) AVANT earnings, car ils
            # référencent aussi therapist_id directement.
            db.query(Withdrawal).filter(
                Withdrawal.therapist_id == user.id
            ).delete(synchronize_session=False)

            # Gains du thérapeute
            db.query(TherapistEarnings).filter(
                TherapistEarnings.therapist_id == user.id
            ).delete(synchronize_session=False)

            # ----------------------------------------------------
            # 3.2 Supprimer l'utilisateur lui-même
            # ----------------------------------------------------
            db.delete(user)
            db.commit()

            # ----------------------------------------------------
            # 3.3 Supprimer les fichiers PDF des certificats sur le
            # disque, une fois la transaction DB validée avec succès.
            # ----------------------------------------------------
            for relative_path in certificate_files_to_delete:
                try:
                    file_path = BASE_DIR / relative_path
                    if file_path.is_file():
                        os.remove(file_path)
                        logger.info(f"🗑️ Fichier certificat supprimé : {file_path}")
                except Exception as file_error:
                    logger.warning(
                        f"⚠️ Impossible de supprimer le fichier certificat "
                        f"'{relative_path}' : {file_error}"
                    )

            logger.info(
                f"✅ Utilisateur {user_id} supprimé définitivement "
                f"({len(certificate_files_to_delete)} certificat(s) supprimé(s))"
            )

            return {
                "status": "success",
                "status_code": 200,
                "message": "Utilisateur supprimé définitivement avec succès",
                "user_id": user_id,
                "permanent": True,
            }

        # --------------------------------------------------------
        # 4. SUPPRESSION LOGIQUE
        # --------------------------------------------------------
        user.is_active = False
        user.deleted_at = datetime.utcnow()
        user.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(user)

        logger.info(
            f"🗑️ Utilisateur {user_id} désactivé "
            f"(suppression logique) par {current_user.fullname}"
        )

        return {
            "status": "success",
            "status_code": 200,
            "message": "Utilisateur supprimé avec succès",
            "user_id": user_id,
            "permanent": False,
            "deleted_at": user.deleted_at,
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(
            f"❌ Erreur delete_user ({user_id}): {e}",
            exc_info=True,
        )

        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la suppression: {str(e)}",
        )
# ============================================================
# 7. ✅ METTRE À JOUR LE PROFIL DE L'UTILISATEUR CONNECTÉ
# ============================================================
@router.put(
    "/users/profile/me",
    response_model=UserResponse,
    summary="Mettre à jour mon profil",
)
async def update_my_profile(
    user_data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    ✅ Mettre à jour le profil de l'utilisateur connecté (inclut cin_number)
    """
    try:
        update_data = user_data.dict(exclude_unset=True)

        if "email" in update_data:
            existing = db.query(User).filter(
                User.email == update_data["email"],
                User.id != current_user.id,
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cet email est déjà utilisé",
                )

        if "phone" in update_data:
            existing = db.query(User).filter(
                User.phone == update_data["phone"],
                User.id != current_user.id,
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ce numéro est déjà utilisé",
                )

        # ✅ Traiter tous les champs, y compris cin_number
        for key, value in update_data.items():
            setattr(current_user, key, value)

        current_user.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(current_user)

        logger.info(f"✅ Profil mis à jour pour l'utilisateur {current_user.id}")
        logger.info(f"   - cin_number: {current_user.cin_number}")
        logger.info(f"   - address: {current_user.address}")
        logger.info(f"   - certificate_professionnel: {current_user.certificate_professionnel}")

        return current_user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur update_my_profile: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")


# ============================================================
# 8. ✅ UPLOAD PHOTO DE PROFIL
# ============================================================
@router.post("/users/upload-profile-photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
        if file.content_type not in allowed_types:
            raise HTTPException(400, "Format non supporté")
        image_url = upload_image(file, "profiles")
        current_user.profile_image = image_url
        current_user.updated_at = datetime.utcnow()
        db.commit()
        return {"profile_image": image_url}
    except Exception as e:
        logger.error(f"Upload error: {e}")
        db.rollback()
        raise HTTPException(500, f"Erreur lors de l'upload: {str(e)}")


# ============================================================
# 9. ✅ UPLOAD CIN (NOUVEAU)
# ============================================================
@router.post("/users/upload-cin")
async def upload_cin_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    ✅ Uploader la photo du CIN (recto/verso)
    """
    try:
        allowed_types = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Format non supporté (jpg, png, webp, pdf)",
            )

        image_url = upload_image(file, "cin")
        current_user.identity_document_url = image_url
        current_user.updated_at = datetime.utcnow()
        db.commit()

        logger.info(f"✅ CIN uploadé pour l'utilisateur {current_user.id}")

        return {"identity_document_url": image_url}
    except Exception as e:
        logger.error(f"Erreur upload_cin_document: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")


# ============================================================
# 9bis. ✅ UPLOAD CERTIFICAT PROFESSIONNEL (NOUVEAU)
# ============================================================
@router.post("/users/upload-certificate-professionnel")
async def upload_certificate_professionnel(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    ✅ Uploader le certificat professionnel du thérapeute
    (diplôme / attestation / certification personnelle).

    Ce document est distinct du certificat officiel généré
    automatiquement par la plateforme après validation admin.
    """
    try:
        allowed_types = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Format non supporté (jpg, png, webp, pdf)",
            )

        file_url = upload_image(file, "certificates_pro")
        current_user.certificate_professionnel = file_url
        current_user.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(current_user)

        logger.info(
            f"✅ Certificat professionnel uploadé pour l'utilisateur {current_user.id}"
        )

        return {"certificate_professionnel": file_url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur upload_certificate_professionnel: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")


# ============================================================
# 10. ✅ STATISTIQUES DES UTILISATEURS (Admin)
# ============================================================
@router.get(
    "/users/stats/overview",
    response_model=UserStatsResponse,
    summary="Statistiques des utilisateurs",
)
async def get_user_stats(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Statistiques des utilisateurs (Admin uniquement)"""
    try:
        total = db.query(User).filter(User.deleted_at.is_(None)).count()

        clients = db.query(User).filter(
            User.role == "CLIENT",
            User.deleted_at.is_(None),
        ).count()

        therapists = db.query(User).filter(
            User.role == "THERAPIST",
            User.deleted_at.is_(None),
        ).count()

        admins = db.query(User).filter(
            User.role == "ADMIN",
            User.deleted_at.is_(None),
        ).count()

        active = db.query(User).filter(
            User.is_active == True,
            User.deleted_at.is_(None),
        ).count()

        inactive = total - active

        week_ago = datetime.utcnow() - timedelta(days=7)
        new_users = db.query(User).filter(
            User.created_at >= week_ago,
            User.deleted_at.is_(None),
        ).count()

        verified_therapists = db.query(User).filter(
            User.role == "THERAPIST",
            User.verification_status == "approved",
            User.deleted_at.is_(None),
        ).count()

        online_therapists = db.query(User).filter(
            User.role == "THERAPIST",
            User.is_online == True,
            User.is_active == True,
            User.deleted_at.is_(None),
        ).count()

        return UserStatsResponse(
            total=total,
            clients=clients,
            therapists=therapists,
            admins=admins,
            active=active,
            inactive=inactive,
            new_users_last_week=new_users,
            verified_therapists=verified_therapists,
            online_therapists=online_therapists,
        )
    except Exception as e:
        logger.error(f"Erreur get_user_stats: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")


# ============================================================
# 11. ✅ CHANGER LE MOT DE PASSE
# ============================================================
@router.post(
    "/users/change-password",
    summary="Changer le mot de passe",
)
async def change_password(
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Changer le mot de passe de l'utilisateur connecté"""
    try:
        if not verify_password(password_data.old_password, current_user.password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ancien mot de passe incorrect",
            )

        if password_data.old_password == password_data.new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le nouveau mot de passe doit être différent",
            )

        if len(password_data.new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le nouveau mot de passe doit contenir au moins 6 caractères",
            )

        current_user.password = get_password_hash(password_data.new_password)
        current_user.updated_at = datetime.utcnow()
        db.commit()

        return {"message": "Mot de passe changé avec succès"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur change_password: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")


# ============================================================
# 12. ✅ ACTIVER / DÉSACTIVER UN UTILISATEUR (Admin)
# ============================================================
@router.put(
    "/users/{user_id}/toggle-status",
    summary="Activer ou désactiver un utilisateur",
)
async def toggle_user_status(
    user_id: int,
    request: UserActivateRequest,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Activer ou désactiver un utilisateur (Admin uniquement)"""
    try:
        user = db.query(User).filter(User.id == user_id).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur non trouvé",
            )

        if user.id == current_user.id and not request.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vous ne pouvez pas désactiver votre propre compte",
            )

        user.is_active = request.is_active
        user.updated_at = datetime.utcnow()

        if not request.is_active:
            user.deleted_at = datetime.utcnow()
        else:
            user.deleted_at = None

        db.commit()

        status_text = "activé" if request.is_active else "désactivé"
        logger.info(f"Utilisateur {user_id} {status_text} par {current_user.fullname}")

        return {
            "message": f"Utilisateur {status_text} avec succès",
            "user_id": user_id,
            "is_active": request.is_active,
            "deleted_at": user.deleted_at,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur toggle_user_status: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")


# ============================================================
# 13. ✅ RÉINITIALISER LE MOT DE PASSE (Admin)
# ============================================================
@router.post(
    "/users/{user_id}/reset-password",
    summary="Réinitialiser le mot de passe d'un utilisateur",
)
async def reset_user_password(
    user_id: int,
    request: UserPasswordResetRequest,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Réinitialiser le mot de passe d'un utilisateur (Admin uniquement)"""
    try:
        user = db.query(User).filter(User.id == user_id).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur non trouvé",
            )

        new_password = generate_secure_token(8)

        user.password = get_password_hash(new_password)
        user.updated_at = datetime.utcnow()
        db.commit()

        logger.info(
            f"Mot de passe réinitialisé pour l'utilisateur {user_id} "
            f"par {current_user.fullname}"
        )

        return {
            "message": "Mot de passe réinitialisé avec succès",
            "user_id": user_id,
            "new_password": new_password,
            "email": user.email,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur reset_user_password: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")


# ============================================================
# 14. ✅ ACTIONS EN MASSE (Admin)
# ============================================================
@router.post(
    "/users/bulk-action",
    summary="Actions en masse sur les utilisateurs",
)
async def bulk_user_action(
    request: UserBulkActionRequest,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Effectuer des actions en masse sur plusieurs utilisateurs (Admin uniquement)"""
    try:
        if not request.user_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Liste d'utilisateurs vide",
            )

        users = db.query(User).filter(User.id.in_(request.user_ids)).all()

        if len(users) != len(request.user_ids):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Un ou plusieurs utilisateurs non trouvés",
            )

        if current_user.id in request.user_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vous ne pouvez pas effectuer d'action sur votre propre compte",
            )

        processed = 0

        for user in users:
            if request.action == "activate":
                user.is_active = True
                user.deleted_at = None
            elif request.action == "deactivate":
                user.is_active = False
                user.deleted_at = datetime.utcnow()
            elif request.action == "delete":
                db.delete(user)
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Action '{request.action}' non supportée",
                )

            user.updated_at = datetime.utcnow()
            processed += 1

        db.commit()

        return {
            "message": f"Action '{request.action}' effectuée sur {processed} utilisateur(s)",
            "processed": processed,
            "action": request.action,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur bulk_user_action: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")