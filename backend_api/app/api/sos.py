# app/api/sos.py
"""
SOS — alertes d'urgence, contacts d'urgence, safety checks et suivi admin.

⚠️ Important : ce module notifie les ADMINS, la contrepartie de la réservation
et les CONTACTS D'URGENCE de l'utilisateur. Il n'appelle ni la police ni les
secours : sans intégration réelle avec ces services, l'application ne doit
jamais le promettre à l'utilisateur.

Ordre des routes : les routes statiques (/stats, /mine, /contacts,
/safety-checks, /admin/...) sont déclarées AVANT /{sos_id}, sinon FastAPI
essaie de convertir "stats" en entier et répond 422.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_user, get_current_admin, _is_admin_role
from ..models.user import User
from ..models.sos import SOSAlert, SafetyCheck, EmergencyContact
from ..models.booking import Booking
from ..schemas.sos import (
    SOSCreate, SOSResponse, SOSCreateResponse, SOSResolveRequest, SOSCancelRequest,
    SOSNoteRequest, SOSMessageRequest, SOSLocationUpdate, SOSStatsResponse,
    EmergencyContactCreate, EmergencyContactUpdate, EmergencyContactResponse,
    SafetyCheckCreate, SafetyCheckRespond, SafetyCheckResponse,
)
from ..services.notification_service import send_notification, send_sms
from ..services.email_service import send_emergency_email, send_email
from ..services.websocket_manager import manager as ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sos", tags=["SOS"])

# Un même utilisateur qui rappuie sur SOS dans cette fenêtre ne crée pas de
# doublon : on lui renvoie l'alerte active existante.
DUPLICATE_WINDOW_SECONDS = 120
MAX_EMERGENCY_CONTACTS = 5
SAFETY_CHECK_TTL_MINUTES = 10


# ======================================================================
# Helpers
# ======================================================================
def _f(value) -> Optional[float]:
    return float(value) if value is not None else None


def _now() -> datetime:
    return datetime.utcnow()


def _maps_link(lat, lng) -> Optional[str]:
    if lat is None or lng is None:
        return None
    return f"https://www.google.com/maps/search/?api=1&query={float(lat)},{float(lng)}"


def _location_label(lat, lng, address: Optional[str]) -> str:
    if address:
        return address
    if lat is not None and lng is not None:
        return f"{float(lat):.6f}, {float(lng):.6f}"
    return "Position inconnue"


def _active_admins(db: Session) -> List[User]:
    return db.query(User).filter(User.role == "ADMIN", User.is_active == True).all()  # noqa: E712


def _contact_dict(c: EmergencyContact) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "phone": c.phone,
        "relationship": c.relation,
        "email": c.email,
        "is_primary": bool(c.is_primary),
        "is_active": bool(c.is_active),
    }


def _check_dict(c: SafetyCheck, sos_id: Optional[int] = None) -> dict:
    return {
        "id": c.id,
        "booking_id": c.booking_id,
        "check_type": c.check_type,
        "status": c.status,
        "latitude": _f(c.latitude),
        "longitude": _f(c.longitude),
        "notes": c.notes,
        "created_at": c.created_at,
        "checked_at": c.checked_at,
        "expires_at": c.expires_at,
        "sos_id": sos_id,
    }


def _alert_dict(alert: SOSAlert, user: Optional[User] = None, booking: Optional[Booking] = None,
                responder: Optional[User] = None) -> dict:
    """Représentation enrichie utilisée par l'espace admin."""
    return {
        "id": alert.id,
        "user_id": alert.user_id,
        "user": user.fullname if user else "Inconnu",
        "user_phone": user.phone if user else None,
        "user_email": user.email if user else None,
        "user_role": user.role if user else None,
        "user_photo": getattr(user, "profile_image", None) if user else None,
        "alert_type": alert.alert_type,
        "status": alert.status,
        "severity": alert.severity,
        "details": alert.details,
        "latitude": _f(alert.latitude),
        "longitude": _f(alert.longitude),
        # Adresse lisible : celle de l'alerte, sinon celle de la réservation.
        "address": alert.address or (booking.address if booking else None),
        "maps_url": _maps_link(alert.latitude, alert.longitude),
        "booking_id": alert.booking_id,
        "booking": ({
            "id": booking.id,
            "status": booking.status,
            "address": booking.address,
            "scheduled_date": booking.scheduled_date,
            "client_id": booking.client_id,
            "therapist_id": booking.therapist_id,
        } if booking else None),
        "created_at": alert.created_at,
        "updated_at": alert.updated_at,
        "resolved_at": alert.resolved_at,
        "cancelled_at": alert.cancelled_at,
        "responded_by": alert.responded_by,
        "responder": responder.fullname if responder else None,
        "response_notes": alert.response_notes,
    }


def _enrich(db: Session, alert: SOSAlert) -> dict:
    user = db.query(User).filter(User.id == alert.user_id).first()
    booking = db.query(Booking).filter(Booking.id == alert.booking_id).first() if alert.booking_id else None
    responder = db.query(User).filter(User.id == alert.responded_by).first() if alert.responded_by else None
    return _alert_dict(alert, user, booking, responder)


def _append_note(alert: SOSAlert, author: User, text: str) -> None:
    """Journal de suivi : une ligne horodatée par action (colonne response_notes)."""
    line = f"[{_now().strftime('%Y-%m-%d %H:%M')} UTC] {author.fullname}: {text.strip()}"
    alert.response_notes = f"{alert.response_notes}\n{line}" if alert.response_notes else line


async def _ws_to_admins(admin_ids: List[int], payload: dict) -> None:
    for admin_id in admin_ids:
        try:
            await ws_manager.send_to_user(admin_id, payload)
        except Exception:  # le temps réel est un bonus, jamais bloquant
            logger.exception("WS SOS -> admin %s failed", admin_id)


def _notify_contacts_job(user_id: int, alert_id: int, location: str, maps_url: Optional[str]) -> None:
    """SMS + email aux contacts d'urgence (tâche de fond, session propre)."""
    from ..core.database import SessionLocal
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        contacts = db.query(EmergencyContact).filter(
            EmergencyContact.user_id == user_id, EmergencyContact.is_active == True  # noqa: E712
        ).all()
        if not user:
            return
        sms = f"🚨 SOS de {user.fullname} : besoin d'aide. Position : {location}"
        if maps_url:
            sms += f" {maps_url}"
        for c in contacts:
            send_sms(c.phone, sms)
            if c.email:
                send_email(
                    c.email, "🚨 Alerte SOS - Mada Bien-être",
                    f"<p><strong>{user.fullname}</strong> a déclenché une alerte SOS "
                    f"et vous a désigné comme contact d'urgence.</p>"
                    f"<p>Position : {location}</p>"
                    + (f'<p><a href="{maps_url}">Ouvrir la carte</a></p>' if maps_url else "")
                    + f"<p>Téléphone : {user.phone}</p>",
                )
    except Exception:
        logger.exception("Notify emergency contacts failed (sos=%s)", alert_id)
    finally:
        db.close()


def _notify_admins_email_job(user_id: int, alert_type: str, location: str,
                             details: Optional[str], booking_id: Optional[int]) -> None:
    from ..core.database import SessionLocal
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        booking = db.query(Booking).filter(Booking.id == booking_id).first() if booking_id else None
        if user:
            send_emergency_email(user=user, location=location, alert_type=alert_type,
                                 details=details, booking=booking)
    except Exception:
        logger.exception("Emergency email failed (user=%s)", user_id)
    finally:
        db.close()


async def _create_alert(db: Session, user: User, data: SOSCreate,
                        background: BackgroundTasks) -> dict:
    """Cœur du déclenchement SOS (utilisé par /create et par les safety checks)."""
    # ---- Anti-doublon : alerte déjà active et très récente ----------------
    since = _now() - timedelta(seconds=DUPLICATE_WINDOW_SECONDS)
    existing = (
        db.query(SOSAlert)
        .filter(SOSAlert.user_id == user.id, SOSAlert.status == "active", SOSAlert.created_at >= since)
        .order_by(SOSAlert.created_at.desc())
        .first()
    )
    if existing:
        return {"alert": existing, "duplicate": True, "admins": 0, "contacts": 0, "counterpart": False}

    # ---- Réservation : l'utilisateur doit en faire partie -----------------
    booking = None
    if data.booking_id:
        booking = db.query(Booking).filter(Booking.id == data.booking_id).first()
        if not booking or user.id not in (booking.client_id, booking.therapist_id):
            raise HTTPException(status_code=404, detail="Réservation introuvable")

    # Position de repli : celle de la réservation si le GPS n'est pas disponible.
    lat, lng = data.latitude, data.longitude
    address = data.address
    if lat is None and booking is not None and booking.client_latitude is not None:
        lat, lng = _f(booking.client_latitude), _f(booking.client_longitude)
    if not address and booking is not None:
        address = booking.address

    alert = SOSAlert(
        user_id=user.id,
        booking_id=data.booking_id,
        alert_type=data.alert_type,
        latitude=lat,
        longitude=lng,
        address=address,
        alert_location=_location_label(lat, lng, address)[:255],
        status="active",
        details=data.details,
        severity=data.severity or "high",
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    location = _location_label(lat, lng, address)
    maps_url = _maps_link(lat, lng)
    payload_data = {
        "sos_id": alert.id, "user_id": user.id, "latitude": lat, "longitude": lng,
        "address": address, "booking_id": data.booking_id, "severity": alert.severity,
        "alert_type": alert.alert_type,
    }

    # ---- Admins : notification persistée + push + temps réel -------------
    admins = _active_admins(db)
    for admin in admins:
        send_notification(
            admin.id, "🚨 ALERTE SOS URGENTE",
            f"{user.fullname} ({user.role}) — {data.alert_type} — {location}",
            "sos_alert", payload_data, priority="urgent", booking_id=data.booking_id,
        )
    await _ws_to_admins([a.id for a in admins], {
        "type": "sos_alert", "data": {**payload_data, "user": user.fullname},
        "timestamp": _now().isoformat(),
    })

    # ---- Contrepartie de la réservation (respecte sos_notifications) ------
    counterpart = False
    if booking is not None:
        other_id = booking.therapist_id if user.id == booking.client_id else booking.client_id
        if other_id and other_id != user.id:
            res = send_notification(
                other_id, "🚨 Alerte SOS sur votre réservation",
                f"{user.fullname} a déclenché une alerte SOS (réservation #{booking.id}).",
                "sos_alert", payload_data, priority="high", booking_id=booking.id,
            )
            counterpart = res is not None

    # ---- Contacts d'urgence + email admins : en tâche de fond -------------
    n_contacts = db.query(EmergencyContact).filter(
        EmergencyContact.user_id == user.id, EmergencyContact.is_active == True  # noqa: E712
    ).count()
    background.add_task(_notify_contacts_job, user.id, alert.id, location, maps_url)
    background.add_task(_notify_admins_email_job, user.id, data.alert_type, location,
                        data.details, data.booking_id)
    if data.alert_type == "emergency" or alert.severity == "critical":
        for admin in admins:
            if admin.phone:
                background.add_task(send_sms, admin.phone,
                                    f"🚨 URGENT: SOS de {user.fullname} — {location}")

    return {"alert": alert, "duplicate": False, "admins": len(admins),
            "contacts": n_contacts, "counterpart": counterpart}


# ======================================================================
# 1) Déclenchement / annulation / position
# ======================================================================
@router.post("/create", status_code=status.HTTP_201_CREATED, response_model=SOSCreateResponse)
async def create_sos_alert(
    sos_data: SOSCreate,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Créer une alerte SOS (client ou thérapeute)."""
    res = await _create_alert(db, current_user, sos_data, background)
    alert = res["alert"]
    return {
        "message": "SOS alert already active" if res["duplicate"] else "SOS alert created",
        "sos_id": alert.id,
        "status": alert.status,
        "duplicate": res["duplicate"],
        "notified_admins": res["admins"],
        "notified_contacts": res["contacts"],
        "notified_counterpart": res["counterpart"],
    }


@router.put("/{sos_id}/cancel")
async def cancel_sos_alert(
    sos_id: int,
    request: SOSCancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Anti-fausse alerte : l'auteur annule une alerte encore active."""
    alert = db.query(SOSAlert).filter(SOSAlert.id == sos_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="SOS alert not found")
    if alert.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if alert.status != "active":
        raise HTTPException(status_code=409, detail=f"Alerte déjà {alert.status}")

    alert.status = "cancelled"
    alert.cancelled_at = _now()
    _append_note(alert, current_user, f"Alerte annulée par l'utilisateur"
                 + (f" — {request.reason}" if request.reason else " (fausse alerte)"))
    db.commit()

    admins = _active_admins(db)
    for admin in admins:
        send_notification(
            admin.id, "ℹ️ Alerte SOS annulée",
            f"{current_user.fullname} a annulé son alerte SOS #{alert.id}.",
            "sos_alert", {"sos_id": alert.id, "cancelled": True}, priority="high",
        )
    await _ws_to_admins([a.id for a in admins], {
        "type": "sos_cancelled", "data": {"sos_id": alert.id},
        "timestamp": _now().isoformat(),
    })
    return {"message": "SOS alert cancelled", "sos_id": alert.id, "status": "cancelled"}


@router.put("/{sos_id}/location")
async def update_sos_location(
    sos_id: int,
    loc: SOSLocationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Partage de position : l'app envoie la dernière position pendant l'alerte active."""
    alert = db.query(SOSAlert).filter(SOSAlert.id == sos_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="SOS alert not found")
    if alert.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if alert.status != "active":
        raise HTTPException(status_code=409, detail="Alerte non active")

    alert.latitude = loc.latitude
    alert.longitude = loc.longitude
    if loc.address:
        alert.address = loc.address
    alert.alert_location = _location_label(loc.latitude, loc.longitude, alert.address)[:255]
    db.commit()

    await _ws_to_admins([a.id for a in _active_admins(db)], {
        "type": "sos_location", "data": {
            "sos_id": alert.id, "latitude": loc.latitude, "longitude": loc.longitude,
            "address": alert.address,
        }, "timestamp": _now().isoformat(),
    })
    return {"message": "Location updated", "sos_id": alert.id}


# ======================================================================
# 2) Contacts d'urgence  (routes statiques AVANT /{sos_id})
# ======================================================================
@router.get("/contacts", response_model=List[EmergencyContactResponse])
async def list_contacts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (db.query(EmergencyContact)
            .filter(EmergencyContact.user_id == current_user.id, EmergencyContact.is_active == True)  # noqa: E712
            .order_by(EmergencyContact.is_primary.desc(), EmergencyContact.id.asc()).all())
    return [_contact_dict(c) for c in rows]


def _unset_other_primaries(db: Session, user_id: int, keep_id: Optional[int]) -> None:
    q = db.query(EmergencyContact).filter(EmergencyContact.user_id == user_id,
                                          EmergencyContact.is_primary == True)  # noqa: E712
    if keep_id is not None:
        q = q.filter(EmergencyContact.id != keep_id)
    q.update({EmergencyContact.is_primary: False}, synchronize_session=False)


@router.post("/contacts", status_code=status.HTTP_201_CREATED, response_model=EmergencyContactResponse)
async def create_contact(data: EmergencyContactCreate,
                         current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    active = db.query(EmergencyContact).filter(
        EmergencyContact.user_id == current_user.id, EmergencyContact.is_active == True  # noqa: E712
    ).all()
    if len(active) >= MAX_EMERGENCY_CONTACTS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_EMERGENCY_CONTACTS} contacts d'urgence")
    # Le premier contact devient automatiquement le contact principal.
    is_primary = data.is_primary or not active
    contact = EmergencyContact(
        user_id=current_user.id, name=data.name.strip(), phone=data.phone,
        relation=data.relationship, email=data.email, is_primary=is_primary, is_active=True,
    )
    db.add(contact)
    db.flush()
    if is_primary:
        _unset_other_primaries(db, current_user.id, contact.id)
    db.commit()
    db.refresh(contact)
    return _contact_dict(contact)


def _own_contact(db: Session, contact_id: int, user: User) -> EmergencyContact:
    c = db.query(EmergencyContact).filter(EmergencyContact.id == contact_id,
                                          EmergencyContact.user_id == user.id,
                                          EmergencyContact.is_active == True).first()  # noqa: E712
    if not c:
        raise HTTPException(status_code=404, detail="Contact introuvable")
    return c


@router.put("/contacts/{contact_id}", response_model=EmergencyContactResponse)
async def update_contact(contact_id: int, data: EmergencyContactUpdate,
                         current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = _own_contact(db, contact_id, current_user)
    fields = data.model_dump(exclude_unset=True)
    if "name" in fields and fields["name"]:
        c.name = fields["name"].strip()
    if "phone" in fields and fields["phone"]:
        c.phone = fields["phone"]
    if "relationship" in fields:
        c.relation = fields["relationship"]
    if "email" in fields:
        c.email = fields["email"]
    if fields.get("is_primary") is True:
        c.is_primary = True
        _unset_other_primaries(db, current_user.id, c.id)
    elif fields.get("is_primary") is False:
        c.is_primary = False
    db.commit()
    db.refresh(c)
    return _contact_dict(c)


@router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: int,
                         current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = _own_contact(db, contact_id, current_user)
    was_primary = bool(c.is_primary)
    c.is_active = False
    c.is_primary = False
    db.flush()
    if was_primary:  # promouvoir le plus ancien contact restant
        nxt = (db.query(EmergencyContact)
               .filter(EmergencyContact.user_id == current_user.id, EmergencyContact.is_active == True)  # noqa: E712
               .order_by(EmergencyContact.id.asc()).first())
        if nxt:
            nxt.is_primary = True
    db.commit()
    return {"message": "Contact supprimé"}


# ======================================================================
# 3) Safety checks (avant / pendant / après la séance)
# ======================================================================
def _booking_for_participant(db: Session, booking_id: int, user: User) -> Booking:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking or (user.id not in (booking.client_id, booking.therapist_id) and not _is_admin_role(user)):
        raise HTTPException(status_code=404, detail="Réservation introuvable")
    return booking


async def _apply_check_status(db: Session, check: SafetyCheck, user: User, booking: Booking,
                              new_status: str, background: BackgroundTasks) -> Optional[int]:
    """Applique la réponse à un check. 'emergency' déclenche une vraie alerte SOS."""
    check.status = new_status
    check.checked_at = _now()
    db.commit()
    sos_id = None

    if new_status == "emergency":
        res = await _create_alert(db, user, SOSCreate(
            booking_id=booking.id,
            alert_type="emergency",
            latitude=_f(check.latitude), longitude=_f(check.longitude),
            details=f"Safety check ({check.check_type}) : urgence. {check.notes or ''}".strip(),
            severity="critical",
        ), background)
        sos_id = res["alert"].id
    elif new_status == "warning":
        for admin in _active_admins(db):
            send_notification(
                admin.id, "⚠️ Safety check : attention",
                f"{user.fullname} signale un souci (réservation #{booking.id}, {check.check_type}).",
                "sos_alert", {"booking_id": booking.id, "safety_check_id": check.id}, priority="high",
                booking_id=booking.id,
            )
    return sos_id


@router.post("/safety-checks", status_code=status.HTTP_201_CREATED, response_model=SafetyCheckResponse)
async def create_safety_check(data: SafetyCheckCreate, background: BackgroundTasks,
                              current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = _booking_for_participant(db, data.booking_id, current_user)
    check = SafetyCheck(
        booking_id=booking.id, check_type=data.check_type, status="pending",
        latitude=data.latitude, longitude=data.longitude, notes=data.notes,
        expires_at=_now() + timedelta(minutes=SAFETY_CHECK_TTL_MINUTES),
    )
    db.add(check)
    db.commit()
    db.refresh(check)

    sos_id = None
    if data.status and data.status != "pending":
        sos_id = await _apply_check_status(db, check, current_user, booking, data.status, background)
        db.refresh(check)
    return _check_dict(check, sos_id)


@router.put("/safety-checks/{check_id}/respond", response_model=SafetyCheckResponse)
async def respond_safety_check(check_id: int, data: SafetyCheckRespond, background: BackgroundTasks,
                               current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    check = db.query(SafetyCheck).filter(SafetyCheck.id == check_id).first()
    if not check:
        raise HTTPException(status_code=404, detail="Safety check introuvable")
    booking = _booking_for_participant(db, check.booking_id, current_user)
    if check.status != "pending":
        raise HTTPException(status_code=409, detail="Safety check déjà traité")
    if data.latitude is not None:
        check.latitude, check.longitude = data.latitude, data.longitude
    if data.notes:
        check.notes = data.notes
    sos_id = await _apply_check_status(db, check, current_user, booking, data.status, background)
    db.refresh(check)
    return _check_dict(check, sos_id)


@router.get("/safety-checks", response_model=List[SafetyCheckResponse])
async def list_safety_checks(booking_id: int = Query(...),
                             current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _booking_for_participant(db, booking_id, current_user)
    rows = db.query(SafetyCheck).filter(SafetyCheck.booking_id == booking_id) \
        .order_by(SafetyCheck.created_at.desc(), SafetyCheck.id.desc()).all()
    return [_check_dict(c) for c in rows]


# ======================================================================
# 4) Espace utilisateur & admin (routes statiques)
# ======================================================================
@router.get("/mine", response_model=List[SOSResponse])
async def my_alerts(limit: int = 20, current_user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    return (db.query(SOSAlert).filter(SOSAlert.user_id == current_user.id)
            .order_by(SOSAlert.created_at.desc()).limit(limit).all())


@router.get("/stats", response_model=SOSStatsResponse)
async def get_sos_stats(current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Admin - Statistiques SOS"""
    def count(**flt):
        q = db.query(SOSAlert)
        for k, v in flt.items():
            q = q.filter(getattr(SOSAlert, k) == v)
        return q.count()

    resolved = db.query(SOSAlert).filter(SOSAlert.resolved_at.isnot(None),
                                         SOSAlert.created_at.isnot(None)).all()
    avg = None
    if resolved:
        avg = round(sum((a.resolved_at - a.created_at).total_seconds() for a in resolved)
                    / len(resolved) / 60.0, 1)
    return {
        "total_alerts": count(),
        "active_alerts": count(status="active"),
        "resolved_alerts": count(status="resolved"),
        "cancelled_alerts": count(status="cancelled"),
        "by_type": {t: count(alert_type=t) for t in ("client", "therapist", "other", "emergency")},
        "by_severity": {s: count(severity=s) for s in ("low", "medium", "high", "critical")},
        "average_response_time": avg,
    }


@router.get("/admin/active")
async def get_active_sos_alerts(current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Admin - Alertes SOS actives (les plus graves / récentes d'abord)."""
    alerts = db.query(SOSAlert).filter(SOSAlert.status == "active") \
        .order_by(SOSAlert.created_at.desc()).all()
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    alerts.sort(key=lambda a: order.get(a.severity or "high", 1))
    return [_enrich(db, a) for a in alerts]


@router.get("/admin/history")
async def get_sos_history(
    limit: int = Query(50, ge=1, le=200), skip: int = Query(0, ge=0),
    status_filter: Optional[str] = Query(None, alias="status", pattern="^(resolved|cancelled)$"),
    current_user: User = Depends(get_current_admin), db: Session = Depends(get_db),
):
    """Admin - Historique des alertes traitées (resolved / cancelled)."""
    q = db.query(SOSAlert).filter(SOSAlert.status.in_([status_filter] if status_filter else ["resolved", "cancelled"]))
    rows = q.order_by(SOSAlert.created_at.desc()).offset(skip).limit(limit).all()
    return [_enrich(db, a) for a in rows]


@router.get("/admin/{sos_id}")
async def get_sos_admin_detail(sos_id: int, current_user: User = Depends(get_current_admin),
                               db: Session = Depends(get_db)):
    """Admin - Détail complet : utilisateur, réservation, contacts d'urgence, safety checks."""
    alert = db.query(SOSAlert).filter(SOSAlert.id == sos_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="SOS alert not found")
    result = _enrich(db, alert)
    contacts = db.query(EmergencyContact).filter(EmergencyContact.user_id == alert.user_id,
                                                 EmergencyContact.is_active == True) \
        .order_by(EmergencyContact.is_primary.desc()).all()  # noqa: E712
    result["emergency_contacts"] = [_contact_dict(c) for c in contacts]
    checks = []
    if alert.booking_id:
        checks = db.query(SafetyCheck).filter(SafetyCheck.booking_id == alert.booking_id) \
            .order_by(SafetyCheck.id.desc()).limit(10).all()
    result["safety_checks"] = [_check_dict(c) for c in checks]
    return result


@router.put("/close/{sos_id}")
async def close_sos_alert(
    sos_id: int, request: Optional[SOSResolveRequest] = None,
    current_user: User = Depends(get_current_admin), db: Session = Depends(get_db),
):
    """Fermer une alerte SOS (Admin uniquement)."""
    alert = db.query(SOSAlert).filter(SOSAlert.id == sos_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="SOS alert not found")
    if alert.status != "active":
        raise HTTPException(status_code=409, detail=f"Alerte déjà {alert.status}")

    alert.status = "resolved"
    alert.resolved_at = _now()
    alert.responded_by = current_user.id
    note = (request.response_notes if request and request.response_notes else None)
    msg = (request.message_to_user.strip() if request and request.message_to_user else None)
    _append_note(alert, current_user, "Alerte résolue"
                 + (f" — {note}" if note else "")
                 + (f" | Message envoyé : {msg}" if msg else ""))
    db.commit()

    # Notification à la personne qui a envoyé le SOS (client ou thérapeute).
    send_notification(
        alert.user_id, "✅ Alerte SOS résolue",
        msg or "Votre alerte SOS a été traitée par l'équipe Mada Bien-être.",
        "sos_resolved", {"sos_id": alert.id, "from_admin": current_user.fullname},
        priority="urgent", booking_id=alert.booking_id,
    )
    return {"message": "SOS alert closed", "sos_id": alert.id, "status": "resolved"}


@router.post("/{sos_id}/message")
async def message_sos_user(sos_id: int, request: SOSMessageRequest,
                           current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Admin - écrire à la personne (notification + trace dans le journal de suivi)."""
    alert = db.query(SOSAlert).filter(SOSAlert.id == sos_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="SOS alert not found")
    text = request.message.strip()
    _append_note(alert, current_user, f"Message envoyé à l'utilisateur : {text}")
    if alert.status == "active" and not alert.responded_by:
        alert.responded_by = current_user.id
    db.commit()
    send_notification(
        alert.user_id, "💬 Message de l'équipe SOS", text, "sos_message",
        {"sos_id": alert.id, "from_admin": current_user.fullname},
        priority="urgent", booking_id=alert.booking_id,
    )
    return {"message": "Message envoyé", "sos_id": alert.id}


@router.put("/{sos_id}/notes")
async def add_sos_note(sos_id: int, request: SOSNoteRequest,
                       current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Admin - noter une action de suivi (appel passé, contact joint, intervention...)."""
    alert = db.query(SOSAlert).filter(SOSAlert.id == sos_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="SOS alert not found")
    _append_note(alert, current_user, request.note)
    if request.take_charge and alert.status == "active" and not alert.responded_by:
        alert.responded_by = current_user.id
    db.commit()
    return {"message": "Note ajoutée", "sos_id": alert.id, "response_notes": alert.response_notes}


# ======================================================================
# 5) Liste générique et détail (routes à paramètre : EN DERNIER)
# ======================================================================
@router.get("/", response_model=List[SOSResponse])
async def get_sos_alerts(
    status: Optional[str] = None, limit: int = Query(50, ge=1, le=200), skip: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    """Admin : toutes les alertes. Autre utilisateur : uniquement les siennes."""
    query = db.query(SOSAlert)
    if not _is_admin_role(current_user):
        query = query.filter(SOSAlert.user_id == current_user.id)
    if status:
        query = query.filter(SOSAlert.status == status)
    return query.order_by(SOSAlert.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{sos_id}", response_model=SOSResponse)
async def get_sos_alert(sos_id: int, current_user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    alert = db.query(SOSAlert).filter(SOSAlert.id == sos_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="SOS alert not found")
    if alert.user_id != current_user.id and not _is_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    return alert
