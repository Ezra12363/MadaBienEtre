from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse  # ✅ Ajouté
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional, List
from datetime import datetime, timedelta
import logging
import os  # ✅ Ajouté
# import 
from ..models.massage import MassageType
from ..schemas.massage import MassageTypeCreate, MassageTypeUpdate, MassageTypeResponse
from ..core.database import get_db
from ..core.dependencies import get_current_admin
from ..models.user import User
from ..models.booking import Booking
from ..models.payment import Payment
from ..models.review import Review
from ..models.sos import SOSAlert
from ..models.therapist_certificate import TherapistCertificate  # ✅ Ajouté
from ..schemas.user import UserResponse
from ..services.notification_service import send_notification
from pydantic import BaseModel

# ✅ IMPORT DES SERVICES DE CERTIFICATS
from ..services.certificate_service import (
    generate_certificate_for_therapist,
    revoke_certificate,
)

# ============================================================
# SCHEMA — mise à jour adresse/position par l'admin
# ============================================================
class AdminAddressUpdate(BaseModel):
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

logger = logging.getLogger(__name__)

# ✅ ROUTER SANS PREFIX
router = APIRouter(tags=["Admin"])


def _safe_notify(user_id: int, title: str, body: str, notif_type: str, data: Optional[dict] = None):
    try:
        send_notification(user_id, title, body, notif_type, data)
    except Exception as exc:
        logger.error(
            "⚠️ Échec de l'envoi de notification (type=%s, user_id=%s) — "
            "l'action principale a néanmoins été appliquée : %s",
            notif_type, user_id, exc,
        )


# ============================================================
# 1. THÉRAPEUTES EN ATTENTE (AVEC CIN)
# ============================================================
@router.get("/admin/pending-therapists")
async def get_pending_therapists(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Thérapeutes en attente de validation - avec toutes les informations"""
    therapists = db.query(User).filter(
        User.role == "THERAPIST",
        User.verification_status == "pending",
        User.is_active == True
    ).all()

    return [
        {
            "id": t.id,
            "fullname": t.fullname,
            "email": t.email,
            "phone": t.phone,
            "bio": t.bio,
            "address": t.address,
            "profile_image": t.profile_image,
            "cin_number": t.cin_number,
            "identity_document_url": t.identity_document_url,
            "certificate_url": t.certificate_url,
            "experience_years": t.experience_years,
            "base_price": float(t.base_price) if t.base_price else 0,
            "created_at": t.created_at,
        }
        for t in therapists
    ]


# ============================================================
# 2. APPROUVER UN THÉRAPEUTE (AVEC GÉNÉRATION CERTIFICAT)
# ============================================================
@router.put("/admin/approve-therapist/{therapist_id}")
async def approve_therapist(
    therapist_id: int,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    ✅ Approuver un thérapeute + générer automatiquement son certificat
    avec logo Zebutech, QR code, et le nom de l'admin qui a validé.
    """
    therapist = db.query(User).filter(
        User.id == therapist_id,
        User.role == "THERAPIST"
    ).first()

    if not therapist:
        raise HTTPException(status_code=404, detail="Therapist not found")

    therapist.verification_status = "approved"
    therapist.is_active = True
    db.commit()
    db.refresh(therapist)

    certificate = None
    try:
        certificate = generate_certificate_for_therapist(
            therapist=therapist,
            admin_id=current_user.id,
            admin_fullname=current_user.fullname,
            db=db,
        )
        logger.info(
            "✅ Certificat généré pour therapist_id=%s, certificate_number=%s",
            therapist.id, certificate.certificate_number if certificate else "N/A"
        )
    except Exception as exc:
        logger.exception(
            "❌ Erreur lors de la génération du certificat pour therapist_id=%s : %s",
            therapist.id, exc
        )

    _safe_notify(
        therapist.id,
        "Compte approuvé",
        f"Votre compte thérapeute a été approuvé. "
        f"{'Certificat disponible dans votre profil.' if certificate else ''}",
        "therapist_approved",
        {
            "therapist_id": therapist.id,
            "certificate_number": certificate.certificate_number if certificate else None
        }
    )

    return {
        "message": "Therapist approved successfully",
        "certificate_number": certificate.certificate_number if certificate else None,
    }


# ============================================================
# 3. REJETER UN THÉRAPEUTE (AVEC RÉVOCATION)
# ============================================================
@router.put("/admin/reject-therapist/{therapist_id}")
async def reject_therapist(
    therapist_id: int,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Rejeter un thérapeute + révoquer le certificat si existant"""
    therapist = db.query(User).filter(
        User.id == therapist_id,
        User.role == "THERAPIST"
    ).first()

    if not therapist:
        raise HTTPException(status_code=404, detail="Therapist not found")

    therapist.verification_status = "rejected"
    db.commit()

    try:
        revoke_certificate(therapist.id, db)
        logger.info("✅ Certificat révoqué pour therapist_id=%s", therapist.id)
    except Exception as exc:
        logger.exception("❌ Erreur lors de la révocation du certificat: %s", exc)

    _safe_notify(
        therapist.id,
        "Compte rejeté",
        f"Votre compte thérapeute a été rejeté. Raison: {reason or 'Non spécifiée'}",
        "therapist_rejected",
        {"therapist_id": therapist.id}
    )

    return {"message": "Therapist rejected"}


# ============================================================
# 4. ACTIVER UN UTILISATEUR
# ============================================================
@router.put("/admin/activate-user/{user_id}")
async def activate_user(
    user_id: int,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Activer un utilisateur"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = True
    db.commit()
    return {"message": "User activated"}


# ============================================================
# 5. DÉSACTIVER UN UTILISATEUR
# ============================================================
@router.put("/admin/deactivate-user/{user_id}")
async def deactivate_user(
    user_id: int,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Désactiver un utilisateur"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    db.commit()
    return {"message": "User deactivated"}


# ============================================================
# 6. DASHBOARD
# ============================================================
@router.get("/admin/dashboard")
async def admin_dashboard(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Dashboard administrateur"""
    total_users = db.query(User).filter(User.deleted_at.is_(None)).count()
    total_therapists = db.query(User).filter(
        User.role == "THERAPIST",
        User.deleted_at.is_(None)
    ).count()
    pending_therapists = db.query(User).filter(
        User.role == "THERAPIST",
        User.verification_status == "pending"
    ).count()

    total_bookings = db.query(Booking).count()
    completed_bookings = db.query(Booking).filter(Booking.status == "completed").count()

    total_revenue = db.query(func.sum(Booking.final_price)).filter(
        Booking.status == "completed"
    ).scalar() or 0

    active_sos = db.query(SOSAlert).filter(SOSAlert.status == "active").count()

    return {
        "users": {
            "total": total_users,
            "therapists": total_therapists,
            "pending_therapists": pending_therapists
        },
        "bookings": {
            "total": total_bookings,
            "completed": completed_bookings,
            "completion_rate": round((completed_bookings / total_bookings * 100) if total_bookings > 0 else 0, 2)
        },
        "revenue": {
            "total": float(total_revenue)
        },
        "sos": {
            "active": active_sos
        }
    }


# ============================================================
# 7. STATISTIQUES ADMIN
# ============================================================
@router.get("/admin/statistics")
async def admin_statistics(
    period: str = "month",
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Statistiques détaillées"""
    now = datetime.utcnow()

    if period == "day":
        start = now - timedelta(days=1)
    elif period == "week":
        start = now - timedelta(days=7)
    elif period == "month":
        start = now - timedelta(days=30)
    elif period == "year":
        start = now - timedelta(days=365)
    else:
        start = now - timedelta(days=30)

    new_users = db.query(User).filter(
        User.created_at >= start,
        User.deleted_at.is_(None)
    ).count()

    new_bookings = db.query(Booking).filter(Booking.created_at >= start).count()

    revenue = db.query(func.sum(Booking.final_price)).filter(
        Booking.status == "completed",
        Booking.actual_end_time >= start
    ).scalar() or 0

    reviews = db.query(Review).filter(Review.created_at >= start).count()
    avg_rating = db.query(func.avg(Review.rating)).filter(
        Review.created_at >= start
    ).scalar() or 0

    return {
        "period": period,
        "new_users": new_users,
        "new_bookings": new_bookings,
        "revenue": float(revenue),
        "reviews": reviews,
        "average_rating": float(avg_rating),
        "start_date": start,
        "end_date": now
    }


# ============================================================
# 8. REVENUS
# ============================================================
@router.get("/admin/revenues")
async def admin_revenues(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Revenus détaillés"""
    payment_methods = db.query(
        Payment.method,
        func.count(Payment.id).label('count'),
        func.sum(Payment.amount).label('total')
    ).filter(
        Payment.status == "completed"
    ).group_by(Payment.method).all()

    monthly_revenue = db.query(
        func.date_trunc('month', Booking.actual_end_time).label('month'),
        func.sum(Booking.final_price).label('revenue')
    ).filter(
        Booking.status == "completed"
    ).group_by('month').order_by(desc('month')).limit(12).all()

    return {
        "by_payment_method": [
            {
                "method": r[0],
                "count": r[1],
                "total": float(r[2] or 0)
            }
            for r in payment_methods
        ],
        "monthly": [
            {
                "month": str(r[0]),
                "revenue": float(r[1] or 0)
            }
            for r in monthly_revenue
        ]
    }


# ============================================================
# 9. NOMBRE D'UTILISATEURS
# ============================================================
@router.get("/admin/users-count")
async def get_users_count(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Nombre d'utilisateurs"""
    return {
        "total": db.query(User).filter(User.deleted_at.is_(None)).count(),
        "clients": db.query(User).filter(User.role == "CLIENT", User.deleted_at.is_(None)).count(),
        "therapists": db.query(User).filter(User.role == "THERAPIST", User.deleted_at.is_(None)).count(),
        "admins": db.query(User).filter(User.role == "ADMIN", User.deleted_at.is_(None)).count()
    }


# ============================================================
# 10. NOMBRE DE RÉSERVATIONS
# ============================================================
@router.get("/admin/bookings-count")
async def get_bookings_count(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Nombre de réservations par statut"""
    statuses = ['pending', 'negotiating', 'confirmed', 'in_progress', 'completed', 'cancelled_by_client', 'cancelled_by_therapist', 'expired']

    result = {}
    for status_value in statuses:
        count = db.query(Booking).filter(Booking.status == status_value).count()
        result[status_value] = count

    return result


# ============================================================
# 11. OBTENIR L'ADRESSE/POSITION D'UN UTILISATEUR
# ============================================================
@router.get("/admin/users/{user_id}/address")
async def get_user_address(
    user_id: int,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.id == user_id,
        User.deleted_at.is_(None)
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": user.id,
        "fullname": user.fullname,
        "role": user.role,
        "address": user.address,
        "latitude": float(user.latitude) if user.latitude is not None else None,
        "longitude": float(user.longitude) if user.longitude is not None else None,
    }


# ============================================================
# 12. METTRE À JOUR L'ADRESSE/POSITION D'UN UTILISATEUR
# ============================================================
@router.put("/admin/users/{user_id}/address")
async def update_user_address(
    user_id: int,
    payload: AdminAddressUpdate,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.id == user_id,
        User.deleted_at.is_(None)
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.address is not None:
        user.address = payload.address
    if payload.latitude is not None:
        user.latitude = payload.latitude
    if payload.longitude is not None:
        user.longitude = payload.longitude

    db.commit()
    db.refresh(user)

    _safe_notify(
        user.id,
        "Adresse mise à jour",
        "Votre adresse et votre position ont été mises à jour par l'administrateur.",
        "profile_updated",
        {"user_id": user.id}
    )

    return {
        "message": "Adresse mise à jour avec succès",
        "id": user.id,
        "address": user.address,
        "latitude": float(user.latitude) if user.latitude is not None else None,
        "longitude": float(user.longitude) if user.longitude is not None else None,
    }


# ============================================================
# ✅ NOUVEAU : OBTENIR LES INFOS CERTIFICAT D'UN THÉRAPEUTE (Admin)
# ============================================================
@router.get("/admin/therapist-certificate/{therapist_id}")
async def get_therapist_certificate_info(
    therapist_id: int,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    ✅ Récupère les informations du certificat d'un thérapeute pour l'admin.
    Retourne le numéro, la date, le statut, le nom du validateur,
    et les URLs de téléchargement du CIN et du certificat.
    """
    # Vérifier que le thérapeute existe
    therapist = db.query(User).filter(
        User.id == therapist_id,
        User.role == "THERAPIST",
        User.deleted_at.is_(None)
    ).first()
    
    if not therapist:
        raise HTTPException(status_code=404, detail="Thérapeute non trouvé")
    
    # Récupérer le certificat valide
    certificate = db.query(TherapistCertificate).filter(
        TherapistCertificate.therapist_id == therapist_id,
        TherapistCertificate.status == "valid"
    ).order_by(TherapistCertificate.issued_at.desc()).first()
    
    certificate_info = None
    if certificate:
        # Récupérer le nom de l'admin qui a validé
        verifier_name = None
        if certificate.verifier:
            verifier_name = certificate.verifier.fullname
        
        certificate_info = {
            "certificate_number": certificate.certificate_number,
            "issued_at": certificate.issued_at.isoformat(),
            "status": certificate.status,
            "verified_by": verifier_name,
            "download_url": f"/admin/therapist-certificate/{therapist_id}/download"
        }
    
    # URLs pour le CIN (URL relative, utilisée par le frontend)
    cin_url = therapist.identity_document_url if therapist.identity_document_url else None
    
    return {
        "therapist_id": therapist_id,
        "therapist_name": therapist.fullname,
        "certificate": certificate_info,
        "cin_url": cin_url
    }


# ============================================================
# ✅ NOUVEAU : TÉLÉCHARGER LE CERTIFICAT D'UN THÉRAPEUTE (Admin)
# ============================================================
@router.get("/admin/therapist-certificate/{therapist_id}/download")
async def download_therapist_certificate(
    therapist_id: int,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    ✅ Permet à l'admin de télécharger le certificat PDF d'un thérapeute.
    """
    # Vérifier que le thérapeute existe
    therapist = db.query(User).filter(
        User.id == therapist_id,
        User.role == "THERAPIST"
    ).first()
    
    if not therapist:
        raise HTTPException(status_code=404, detail="Thérapeute non trouvé")
    
    # Récupérer le certificat valide
    certificate = db.query(TherapistCertificate).filter(
        TherapistCertificate.therapist_id == therapist_id,
        TherapistCertificate.status == "valid"
    ).order_by(TherapistCertificate.issued_at.desc()).first()
    
    if not certificate:
        raise HTTPException(status_code=404, detail="Aucun certificat valide trouvé pour ce thérapeute")
    
    pdf_path = certificate.certificate_path
    if not pdf_path or not os.path.isfile(pdf_path):
        raise HTTPException(status_code=404, detail="Fichier PDF introuvable")
    
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"{certificate.certificate_number}.pdf",
        headers={
            "Content-Disposition": f"attachment; filename=\"{certificate.certificate_number}.pdf\""
        }
    )
# ============================================================
# 13. GESTION DES TYPES DE MASSAGE (Admin)
# ============================================================

# Imports à ajouter en tête si nécessaire (ils sont déjà dans admin.py)
# from ..models.massage import MassageType
# from ..schemas.massage import MassageTypeCreate, MassageTypeUpdate, MassageTypeResponse
# from datetime import datetime

@router.get("/admin/massage-types", response_model=List[MassageTypeResponse])
async def get_massage_types(
    is_active: Optional[bool] = Query(None, description="Filtrer par statut actif"),
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    ✅ Récupère la liste de tous les types de massage.
    """
    query = db.query(MassageType)
    if is_active is not None:
        query = query.filter(MassageType.is_active == is_active)
    types = query.order_by(MassageType.display_order, MassageType.name).all()
    return types


@router.post("/admin/massage-types", status_code=status.HTTP_201_CREATED, response_model=MassageTypeResponse)
async def create_massage_type(
    payload: MassageTypeCreate,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    ✅ Créer un nouveau type de massage.
    """
    # Vérifier si le nom existe déjà
    existing = db.query(MassageType).filter(MassageType.name == payload.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Un type de massage '{payload.name}' existe déjà"
        )
    
    new_type = MassageType(
        name=payload.name,
        description=payload.description,
        duration_min=payload.duration_min,
        duration_max=payload.duration_max,
        min_price=payload.min_price,
        recommended_price=payload.recommended_price,
        category=payload.category,
        icon_url=payload.icon_url,
        image_url=payload.image_url,
        is_active=payload.is_active,
        display_order=payload.display_order,
    )
    
    db.add(new_type)
    db.commit()
    db.refresh(new_type)
    
    logger.info(f"✅ Type de massage créé par {current_user.fullname}: {new_type.name}")
    return new_type


@router.put("/admin/massage-types/{type_id}", response_model=MassageTypeResponse)
async def update_massage_type(
    type_id: int,
    payload: MassageTypeUpdate,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    ✅ Mettre à jour un type de massage existant.
    """
    type_obj = db.query(MassageType).filter(MassageType.id == type_id).first()
    if not type_obj:
        raise HTTPException(status_code=404, detail="Type de massage non trouvé")
    
    update_data = payload.dict(exclude_unset=True)
    
    # Si le nom change, vérifier qu'il n'existe pas déjà
    if "name" in update_data and update_data["name"] != type_obj.name:
        existing = db.query(MassageType).filter(MassageType.name == update_data["name"]).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Un type de massage '{update_data['name']}' existe déjà"
            )
    
    for key, value in update_data.items():
        setattr(type_obj, key, value)
    
    type_obj.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(type_obj)
    
    logger.info(f"✅ Type de massage {type_id} mis à jour par {current_user.fullname}")
    return type_obj


@router.delete("/admin/massage-types/{type_id}")
async def delete_massage_type(
    type_id: int,
    permanent: bool = Query(False, description="Suppression définitive"),
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    ✅ Supprimer (soft delete ou définitif) un type de massage.
    """
    type_obj = db.query(MassageType).filter(MassageType.id == type_id).first()
    if not type_obj:
        raise HTTPException(status_code=404, detail="Type de massage non trouvé")
    
    if permanent:
        db.delete(type_obj)
        message = "Type de massage supprimé définitivement"
    else:
        type_obj.is_active = False
        type_obj.updated_at = datetime.utcnow()
        message = "Type de massage désactivé"
    
    db.commit()
    logger.info(f"✅ Type de massage {type_id} {message} par {current_user.fullname}")
    return {"message": message}