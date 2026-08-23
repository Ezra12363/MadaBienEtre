# app/api/therapists.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional, List
import logging

from ..core.database import get_db
from ..core.dependencies import get_current_user, get_current_admin, get_current_therapist
from ..models.user import User
from ..models.booking import Booking
from ..models.review import Review
from ..schemas.user import UserResponse, TherapistProfileResponse
from ..services.upload_service import upload_image
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/therapists", tags=["Therapists"])


# ============================================================
# 1. ✅ LISTE DES THÉRAPEUTES AVEC FILTRES + certificate_professionnel
# ============================================================
@router.get(
    "/",
    response_model=List[UserResponse],
    summary="Liste des thérapeutes avec filtres"
)
async def get_therapists(
    online_only: bool = Query(False, description="Uniquement les thérapeutes en ligne"),
    verified_only: bool = Query(False, description="Uniquement les thérapeutes vérifiés"),
    available_only: bool = Query(False, description="Uniquement les thérapeutes disponibles"),
    min_rating: Optional[float] = Query(None, ge=0, le=5, description="Note minimale"),
    limit: int = Query(20, ge=1, le=200, description="Nombre maximum de résultats"),
    skip: int = Query(0, ge=0, description="Nombre d'éléments à sauter"),
    latitude: Optional[float] = Query(None, ge=-90, le=90, description="Latitude"),
    longitude: Optional[float] = Query(None, ge=-180, le=180, description="Longitude"),
    radius_km: int = Query(10, ge=1, le=100, description="Rayon en kilomètres"),
    search: Optional[str] = Query(None, description="Recherche par nom ou email"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    ✅ Liste des thérapeutes avec filtres complets
    """
    try:
        logger.info(f"📤 get_therapists appelé avec limit={limit}, online_only={online_only}")
        
        query = db.query(User).filter(
            User.role == "THERAPIST",
            User.deleted_at.is_(None),
            User.is_active == True
        )
        
        if online_only:
            query = query.filter(User.is_online == True)
        
        if verified_only:
            query = query.filter(User.verification_status == "approved")
        
        if available_only:
            query = query.filter(User.is_available == True)
        
        if min_rating is not None and min_rating > 0:
            query = query.filter(User.rating >= min_rating)
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    User.fullname.ilike(search_term),
                    User.email.ilike(search_term)
                )
            )
        
        if latitude is not None and longitude is not None:
            try:
                query = query.filter(
                    func.ST_DWithin(
                        User.last_location,
                        func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326),
                        radius_km * 1000
                    )
                )
                query = query.order_by(
                    func.ST_Distance(
                        User.last_location,
                        func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
                    ).asc()
                )
            except Exception as e:
                logger.warning(f"Erreur filtre distance: {e}")
        
        if latitude is None or longitude is None:
            query = query.order_by(User.rating.desc(), User.total_reviews.desc())
        
        therapists = query.offset(skip).limit(limit).all()
        
        logger.info(f"✅ {len(therapists)} thérapeutes trouvés")
        
        # ✅ Convertir les objets User en dictionnaires compatibles avec UserResponse
        result = []
        for therapist in therapists:
            distance = None
            if latitude is not None and longitude is not None:
                try:
                    distance = db.query(
                        func.ST_Distance(
                            User.last_location,
                            func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
                        )
                    ).filter(User.id == therapist.id).scalar()
                    if distance:
                        distance = round(distance, 2)
                except:
                    distance = None
            
            # ✅ Créer un dictionnaire avec tous les champs requis par UserResponse
            result.append({
                "id": therapist.id,
                "fullname": therapist.fullname,
                "email": therapist.email,
                "phone": therapist.phone,
                "role": therapist.role,
                "is_active": therapist.is_active,
                "profile_image": therapist.profile_image,
                "rating": float(therapist.rating) if therapist.rating else 0.0,
                "total_reviews": therapist.total_reviews or 0,
                "verification_status": therapist.verification_status or "pending",
                "created_at": therapist.created_at,
                "updated_at": therapist.updated_at,
                "bio": therapist.bio,
                "experience_years": therapist.experience_years or 0,
                "is_online": therapist.is_online or False,
                "is_available": therapist.is_available or True,
                "service_radius": therapist.service_radius or 10,
                "base_price": float(therapist.base_price) if therapist.base_price else None,
                "identity_document_url": therapist.identity_document_url,
                "certificate_url": therapist.certificate_url,
                "certificate_professionnel": therapist.certificate_professionnel,  # ✅ AJOUTÉ
                "commission_rate": float(therapist.commission_rate) if therapist.commission_rate else 10.0,
                "address": therapist.address,
                "latitude": therapist.latitude,
                "longitude": therapist.longitude,
                "cin_number": therapist.cin_number,
                "distance_meters": distance if distance else 0
            })
        
        return result
    except Exception as e:
        logger.error(f"❌ Erreur get_therapists: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")


# ============================================================
# 2. ✅ PROFIL COMPLET D'UN THÉRAPEUTE + certificate_professionnel
# ============================================================
@router.get(
    "/{therapist_id}",
    response_model=TherapistProfileResponse,
    summary="Profil complet d'un thérapeute"
)
async def get_therapist_profile(
    therapist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Profil complet d'un thérapeute avec statistiques"""
    try:
        therapist = db.query(User).filter(
            User.id == therapist_id,
            User.role == "THERAPIST",
            User.deleted_at.is_(None),
            User.is_active == True
        ).first()
        
        if not therapist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Thérapeute non trouvé"
            )
        
        total_bookings = db.query(Booking).filter(
            Booking.therapist_id == therapist_id,
            Booking.status == "completed"
        ).count()
        
        total_revenue = db.query(func.sum(Booking.final_price)).filter(
            Booking.therapist_id == therapist_id,
            Booking.status == "completed"
        ).first()
        
        return TherapistProfileResponse(
            id=therapist.id,
            fullname=therapist.fullname,
            email=therapist.email,
            phone=therapist.phone,
            profile_image=therapist.profile_image,
            bio=therapist.bio,
            address=therapist.address,
            cin_number=therapist.cin_number,
            latitude=therapist.latitude,
            longitude=therapist.longitude,
            experience_years=therapist.experience_years or 0,
            rating=float(therapist.rating) if therapist.rating else 0.0,
            total_reviews=therapist.total_reviews or 0,
            is_online=therapist.is_online or False,
            is_available=therapist.is_available or True,
            service_radius=therapist.service_radius or 10,
            base_price=float(therapist.base_price) if therapist.base_price else None,
            verification_status=therapist.verification_status or "pending",
            total_bookings=total_bookings,
            total_revenue=float(total_revenue[0]) if total_revenue and total_revenue[0] else 0.0,
            response_rate=95.0,
            identity_document_url=therapist.identity_document_url,
            certificate_url=therapist.certificate_url,
            certificate_professionnel=therapist.certificate_professionnel,  # ✅ AJOUTÉ
            commission_rate=float(therapist.commission_rate) if therapist.commission_rate else 10.0,
            created_at=therapist.created_at,
            average_rating=float(therapist.rating) if therapist.rating else 0.0
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erreur get_therapist_profile: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")


# ============================================================
# 3. ✅ CHANGER LE STATUT EN LIGNE (Thérapeute)
# ============================================================
@router.put(
    "/status",
    summary="Changer le statut en ligne"
)
async def toggle_online_status(
    is_online: bool = Query(..., description="Statut en ligne (true/false)"),
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db)
):
    """Changer le statut en ligne du thérapeute"""
    try:
        current_user.is_online = is_online
        current_user.updated_at = datetime.utcnow()
        db.commit()
        
        status_text = "en ligne" if is_online else "hors ligne"
        logger.info(f"Thérapeute {current_user.id} est maintenant {status_text}")
        
        return {
            "message": f"Statut mis à jour: {status_text}",
            "is_online": is_online
        }
    except Exception as e:
        logger.error(f"❌ Erreur toggle_online_status: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")


# ============================================================
# 4. ✅ CANDIDATURE POUR DEVENIR THÉRAPEUTE
# ============================================================
@router.post("/apply")
async def apply_as_therapist(
    bio: str = Form(...),
    experience_years: int = Form(...),
    base_price: float = Form(...),
    service_radius: int = Form(10),
    cin_file: UploadFile = File(...),
    certificate_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Candidature pour devenir thérapeute"""
    try:
        if current_user.role == "THERAPIST":
            raise HTTPException(status_code=400, detail="Déjà un thérapeute")
        
        cin_url = upload_image(cin_file, "cin")
        cert_url = upload_image(certificate_file, "certificates")
        
        current_user.role = "THERAPIST"
        current_user.bio = bio
        current_user.experience_years = experience_years
        current_user.base_price = base_price
        current_user.service_radius = service_radius
        current_user.verification_status = "pending"
        current_user.identity_document_url = cin_url
        current_user.certificate_url = cert_url
        current_user.updated_at = datetime.utcnow()
        
        db.commit()
        
        logger.info(f"✅ Candidature soumise par {current_user.fullname}")
        
        return {
            "message": "Candidature soumise avec succès",
            "verification_status": "pending"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erreur apply_as_therapist: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")


# ============================================================
# 5. ✅ METTRE À JOUR LES INFORMATIONS DU THÉRAPEUTE
# ============================================================
@router.put("/{therapist_id}")
async def update_therapist(
    therapist_id: int,
    bio: Optional[str] = None,
    base_price: Optional[float] = None,
    service_radius: Optional[int] = None,
    is_available: Optional[bool] = None,
    address: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    cin_number: Optional[str] = None,
    certificate_professionnel: Optional[str] = None,  # ✅ AJOUTÉ
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db)
):
    """
    ✅ Mettre à jour les informations du thérapeute.
    Permet de modifier le numéro CIN et le certificat professionnel.
    """
    try:
        if current_user.id != therapist_id:
            raise HTTPException(status_code=403, detail="Non autorisé")
        
        if bio is not None:
            current_user.bio = bio
        if base_price is not None:
            current_user.base_price = base_price
        if service_radius is not None:
            current_user.service_radius = service_radius
        if is_available is not None:
            current_user.is_available = is_available
        if address is not None:
            current_user.address = address
        if latitude is not None:
            current_user.latitude = latitude
        if longitude is not None:
            current_user.longitude = longitude
        if cin_number is not None:
            current_user.cin_number = cin_number
        if certificate_professionnel is not None:  # ✅ AJOUTÉ
            current_user.certificate_professionnel = certificate_professionnel
        
        current_user.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(current_user)
        
        logger.info(f"✅ Thérapeute {therapist_id} mis à jour avec succès")
        logger.info(f"   - cin_number: {current_user.cin_number}")
        logger.info(f"   - certificate_professionnel: {current_user.certificate_professionnel}")
        
        return {"message": "Thérapeute mis à jour avec succès"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erreur update_therapist: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")


# ============================================================
# 6. ✅ OBTENIR LE STATUT DE VÉRIFICATION
# ============================================================
@router.get("/status")
async def get_verification_status(
    current_user: User = Depends(get_current_therapist)
):
    """Obtenir le statut de vérification du thérapeute connecté"""
    return {
        "verification_status": current_user.verification_status,
        "is_active": current_user.is_active,
        "is_online": current_user.is_online,
        "is_available": current_user.is_available
    }


# ============================================================
# 7. ✅ OBTENIR LES GAINS DU THÉRAPEUTE
# ============================================================
@router.get("/earnings")
async def get_earnings(
    period: str = Query("month", description="Période: day, week, month, year"),
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db)
):
    """Obtenir les gains du thérapeute par période"""
    try:
        now = datetime.utcnow()
        
        if period == "day":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "week":
            start_date = now - timedelta(days=7)
        elif period == "month":
            start_date = now - timedelta(days=30)
        elif period == "year":
            start_date = now - timedelta(days=365)
        else:
            start_date = now - timedelta(days=30)
        
        bookings = db.query(Booking).filter(
            Booking.therapist_id == current_user.id,
            Booking.status == "completed",
            Booking.actual_end_time >= start_date
        ).all()
        
        total_earnings = sum(float(b.final_price or 0) for b in bookings)
        commission = total_earnings * (float(current_user.commission_rate or 10) / 100)
        net_earnings = total_earnings - commission
        
        return {
            "period": period,
            "total_bookings": len(bookings),
            "total_earnings": total_earnings,
            "commission_rate": current_user.commission_rate,
            "commission_amount": commission,
            "net_earnings": net_earnings,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": now.isoformat() if now else None
        }
    except Exception as e:
        logger.error(f"❌ Erreur get_earnings: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")