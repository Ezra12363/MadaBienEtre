# app/api/users.py
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
    Query,
    Request,
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
from ..services.upload_service import (
    upload_image,
    upload_identity_document,
    delete_image,
    to_relative_upload_path,
)
from ..services.account_notifications import (
    notify_account_activated,
    notify_account_created_by_admin,
    notify_account_deactivated,
    notify_account_updated,
    notify_password_reset,
)
from ..services.user_purge import purge_user, remove_certificate_files
from ..core.security import get_password_hash, verify_password, generate_secure_token
from ..core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Users"])

# Champs dont la modification par un admin est signalée par email à l'utilisateur
ADMIN_EDIT_LABELS = {
    "fullname": "Nom",
    "email": "Email",
    "phone": "Téléphone",
    "address": "Adresse",
    "bio": "Biographie",
    "cin_number": "Numéro CIN",
    "experience_years": "Années d'expérience",
    "base_price": "Tarif de base",
    "service_radius": "Rayon d'intervention (km)",
}

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

        # ✉️ Email au propriétaire du compte : toutes les informations + mot de passe
        notify_account_created_by_admin(new_user, user_data.password, admin=current_user)

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

        # ✉️ Modification faite PAR UN ADMIN sur le compte d'un autre : on garde
        # l'ancien état pour prévenir l'utilisateur de ce qui a changé.
        edited_by_admin = current_user.id != user_id and current_user.role == "ADMIN"
        previous_email = user.email
        changes = []
        if edited_by_admin:
            for key, label in ADMIN_EDIT_LABELS.items():
                if key in update_data and str(getattr(user, key, None) or "") != str(update_data[key] or ""):
                    changes.append((label, getattr(user, key, None), update_data[key]))

        # ✅ Traiter tous les champs, y compris cin_number
        for key, value in update_data.items():
            setattr(user, key, value)

        user.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(user)

        if edited_by_admin and changes:
            notify_account_updated(
                user, admin=current_user, changes=changes, previous_email=previous_email
            )

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

            # Nettoyage générique de TOUTES les données liées (réservations, paiements,
            # notifications, jetons push, avis, SOS, disponibilités, gains, certificats...)
            # puis suppression de l'utilisateur — voir services/user_purge.py
            certificate_files_to_delete = purge_user(db, user)
            db.commit()

            # Fichiers PDF des certificats : supprimés après le commit réussi
            remove_certificate_files(certificate_files_to_delete, BASE_DIR)

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
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
        if file.content_type not in allowed_types:
            raise HTTPException(400, "Format non supporté")

        # ✅ FIXÉ : on construit l'URL du fichier avec l'hôte RÉEL de
        # la requête reçue (ex: "http://10.78.77.30:8000"), et non
        # plus avec settings.BASE_URL figé dans le .env. C'est
        # forcément la bonne IP actuelle puisque c'est exactement
        # celle que le téléphone vient d'utiliser pour nous contacter.
        base_url = str(request.base_url).rstrip("/")

        image_url = upload_image(file, "profiles", base_url=base_url)

        # ✅ FIX « photo disparaît » : en base on garde le CHEMIN RELATIF
        # (/uploads/profiles/xxx.jpg) et NON l'URL avec l'IP du moment.
        # Cloudinary (https://res.cloudinary.com/...) reste inchangé.
        stored_url = to_relative_upload_path(image_url)

        # supprime l'ancienne photo locale (évite d'accumuler des fichiers)
        old_image = current_user.profile_image
        current_user.profile_image = stored_url
        current_user.updated_at = datetime.utcnow()
        db.commit()
        if old_image and old_image != stored_url:
            try:
                delete_image(old_image)
            except Exception:
                pass
        return {"profile_image": stored_url}
    except Exception as e:
        logger.error(f"Upload error: {e}")
        db.rollback()
        raise HTTPException(500, f"Erreur lors de l'upload: {str(e)}")


# ============================================================
# 9. ✅ UPLOAD CIN (NOUVEAU)
# ============================================================
@router.post("/users/upload-cin")
async def upload_cin_document(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    ✅ Uploader la photo du CIN (recto/verso)
    """
    try:
        # ✅ Le type (jpg / png / webp / pdf) est vérifié sur le contenu réel
        # du fichier dans upload_identity_document (pas sur le Content-Type,
        # qui est faux/vide selon Android ou navigateur).

        # ✅ Même correctif que upload-profile-photo : hôte réel de la
        # requête, pas settings.BASE_URL figé.
        base_url = str(request.base_url).rstrip("/")

        image_url = upload_identity_document(file, "cin", base_url=base_url)
        current_user.identity_document_url = image_url
        current_user.updated_at = datetime.utcnow()
        db.commit()

        logger.info(f"✅ CIN uploadé pour l'utilisateur {current_user.id}")

        return {"identity_document_url": image_url}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        logger.error(f"Erreur upload_cin_document: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")


# ============================================================
# 9bis. ✅ UPLOAD CERTIFICAT PROFESSIONNEL (NOUVEAU)
# ============================================================
@router.post("/users/upload-certificate-professionnel")
async def upload_certificate_professionnel(
    request: Request,
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
        # ✅ Type vérifié sur le contenu réel (voir upload_identity_document).

        # ✅ FIXÉ : même correctif que upload-profile-photo et upload-cin —
        # on utilise désormais l'hôte RÉEL de la requête reçue
        # (request.base_url), et non plus settings.BASE_URL figé dans
        # le .env. C'est forcément la bonne IP/domaine actuel, puisque
        # c'est exactement celle que le client vient d'utiliser pour
        # nous contacter — les 3 endpoints d'upload (profile-photo,
        # cin, certificate-professionnel) sont maintenant cohérents.
        #
        # ⚠️ Note : certificate_service.py (génération du certificat
        # officiel admin + QR code de vérification) continue lui
        # d'utiliser settings.BASE_URL — c'est un contexte différent
        # (tâche générée côté serveur, sans requête HTTP entrante à
        # laquelle se raccrocher), donc pas concerné par ce correctif.
        base_url = str(request.base_url).rstrip("/")

        file_url = upload_identity_document(file, "certificates_pro", base_url=base_url)
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

        was_active = bool(user.is_active)
        user.is_active = request.is_active
        user.updated_at = datetime.utcnow()

        if not request.is_active:
            user.deleted_at = datetime.utcnow()
        else:
            user.deleted_at = None

        db.commit()

        # Activation d'un compte jusque-là désactivé : email + notification à l'utilisateur
        if request.is_active and not was_active:
            notify_account_activated(user, admin=current_user)
        # Désactivation d'un compte actif : email + notification (avec motif)
        elif not request.is_active and was_active:
            notify_account_deactivated(user, admin=current_user, reason=request.reason)

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

        # Mot de passe choisi par l'admin, sinon généré automatiquement
        new_password = (request.new_password or "").strip() or generate_secure_token(8)
        if len(new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le mot de passe doit contenir au moins 8 caractères",
            )

        user.password = get_password_hash(new_password)
        user.updated_at = datetime.utcnow()
        db.commit()

        # ✉️ Le nouveau mot de passe est envoyé par email à l'utilisateur
        if request.send_email:
            notify_password_reset(user, new_password, admin=current_user)

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
        files_to_remove = []

        activated_users = []
        deactivated_users = []

        for user in users:
            if request.action == "delete":
                files_to_remove += purge_user(db, user)
                processed += 1
                continue
            if request.action == "activate":
                if not user.is_active:
                    activated_users.append(user)
                user.is_active = True
                user.deleted_at = None
            elif request.action == "deactivate":
                if user.is_active:
                    deactivated_users.append(user)
                user.is_active = False
                user.deleted_at = datetime.utcnow()
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Action '{request.action}' non supportée",
                )

            user.updated_at = datetime.utcnow()
            processed += 1

        db.commit()
        remove_certificate_files(files_to_remove, BASE_DIR)

        # ✉️ Email + notification à chaque utilisateur dont le statut a changé
        for u in activated_users:
            notify_account_activated(u, admin=current_user)
        for u in deactivated_users:
            notify_account_deactivated(u, admin=current_user, reason=request.reason)

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