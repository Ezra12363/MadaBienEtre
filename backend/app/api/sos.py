# app/api/sos.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from ..core.database import get_db
from ..core.dependencies import get_current_user, get_current_admin
from ..models.user import User
from ..models.sos import SOSAlert
from ..models.booking import Booking
from ..schemas.sos import SOSCreate, SOSResponse, SOSResolveRequest, SOSStatsResponse
from ..services.notification_service import send_notification, send_sms  # ✅ Maintenant disponible
from ..services.email_service import send_emergency_email

router = APIRouter(prefix="/api/sos", tags=["SOS"])

@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_sos_alert(
    sos_data: SOSCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Créer une alerte SOS"""
    # Créer l'alerte
    sos_alert = SOSAlert(
        user_id=current_user.id,
        booking_id=sos_data.booking_id,
        alert_type=sos_data.alert_type,
        latitude=sos_data.latitude,
        longitude=sos_data.longitude,
        status="active",
        details=sos_data.details,
        severity=sos_data.severity
    )
    
    db.add(sos_alert)
    db.commit()
    db.refresh(sos_alert)
    
    # Récupérer les détails de la réservation
    booking = None
    if sos_data.booking_id:
        booking = db.query(Booking).filter(Booking.id == sos_data.booking_id).first()
    
    # Notifier les administrateurs
    admins = db.query(User).filter(User.role == "ADMIN", User.is_active == True).all()
    
    for admin in admins:
        send_notification(
            admin.id,
            "🚨 ALERTE SOS URGENTE",
            f"Utilisateur: {current_user.fullname} - Type: {sos_data.alert_type}",
            "sos_alert",
            {
                "sos_id": sos_alert.id,
                "user_id": current_user.id,
                "latitude": sos_data.latitude,
                "longitude": sos_data.longitude,
                "booking_id": sos_data.booking_id
            },
            priority="urgent"
        )
    
    # Envoyer un email d'urgence
    location = f"{sos_data.latitude}, {sos_data.longitude}" if sos_data.latitude else "Position inconnue"
    send_emergency_email(
        user=current_user,
        location=location,
        alert_type=sos_data.alert_type,
        details=sos_data.details,
        booking=booking
    )
    
    # ✅ Envoyer un SMS d'urgence (si configuré)
    if sos_data.alert_type == "emergency":
        # Envoyer aux administrateurs
        for admin in admins:
            if admin.phone:
                send_sms(
                    admin.phone,
                    f"🚨 URGENT: SOS de {current_user.fullname} à {location}"
                )
    
    return {
        "message": "SOS alert created",
        "sos_id": sos_alert.id,
        "status": "active"
    }

@router.get("/", response_model=List[SOSResponse])
async def get_sos_alerts(
    status: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtenir les alertes SOS"""
    if current_user.role == "ADMIN":
        query = db.query(SOSAlert)
    else:
        query = db.query(SOSAlert).filter(SOSAlert.user_id == current_user.id)
    
    if status:
        query = query.filter(SOSAlert.status == status)
    
    return query.order_by(SOSAlert.created_at.desc()).limit(limit).all()

@router.get("/{sos_id}", response_model=SOSResponse)
async def get_sos_alert(
    sos_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Détails d'une alerte SOS"""
    sos_alert = db.query(SOSAlert).filter(SOSAlert.id == sos_id).first()
    if not sos_alert:
        raise HTTPException(status_code=404, detail="SOS alert not found")
    
    if sos_alert.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return sos_alert

@router.put("/close/{sos_id}")
async def close_sos_alert(
    sos_id: int,
    request: SOSResolveRequest,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Fermer une alerte SOS (Admin uniquement)"""
    sos_alert = db.query(SOSAlert).filter(SOSAlert.id == sos_id).first()
    if not sos_alert:
        raise HTTPException(status_code=404, detail="SOS alert not found")
    
    sos_alert.status = "resolved"
    sos_alert.resolved_at = datetime.utcnow()
    sos_alert.response_notes = request.response_notes
    sos_alert.responded_by = current_user.id
    db.commit()
    
    # Notifier l'utilisateur
    send_notification(
        sos_alert.user_id,
        "Alerte SOS résolue",
        "Votre alerte SOS a été traitée",
        "sos_resolved",
        {"sos_id": sos_alert.id}
    )
    
    return {"message": "SOS alert closed"}

@router.get("/admin/active")
async def get_active_sos_alerts(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Admin - Alertes SOS actives"""
    alerts = db.query(SOSAlert).filter(SOSAlert.status == "active").all()
    
    # Récupérer les informations des utilisateurs
    result = []
    for alert in alerts:
        user = db.query(User).filter(User.id == alert.user_id).first()
        result.append({
            "id": alert.id,
            "user": user.fullname if user else "Unknown",
            "user_phone": user.phone if user else "Unknown",
            "alert_type": alert.alert_type,
            "latitude": alert.latitude,
            "longitude": alert.longitude,
            "created_at": alert.created_at,
            "booking_id": alert.booking_id,
            "details": alert.details,
            "severity": alert.severity
        })
    
    return result

@router.get("/stats", response_model=SOSStatsResponse)
async def get_sos_stats(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Admin - Statistiques SOS"""
    total_alerts = db.query(SOSAlert).count()
    active_alerts = db.query(SOSAlert).filter(SOSAlert.status == "active").count()
    resolved_alerts = db.query(SOSAlert).filter(SOSAlert.status == "resolved").count()
    
    # Statistiques par type
    by_type = {}
    for alert_type in ['client', 'therapist', 'other', 'emergency']:
        count = db.query(SOSAlert).filter(SOSAlert.alert_type == alert_type).count()
        by_type[alert_type] = count
    
    # Statistiques par sévérité
    by_severity = {}
    for severity in ['low', 'medium', 'high', 'critical']:
        count = db.query(SOSAlert).filter(SOSAlert.severity == severity).count()
        by_severity[severity] = count
    
    return {
        "total_alerts": total_alerts,
        "active_alerts": active_alerts,
        "resolved_alerts": resolved_alerts,
        "by_type": by_type,
        "by_severity": by_severity,
        "average_response_time": None
    }