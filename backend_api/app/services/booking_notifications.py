# app/services/booking_notifications.py
# ============================================================================
# Notifications du cycle de vie d'une réservation, selon le STATUT.
#
#   Statut booking        Événement                         Destinataire
#   --------------------  --------------------------------  -----------------
#   pending               client crée une demande           thérapeutes (+ client : accusé)
#   negotiating           offre / contre-offre              l'autre partie
#   confirmed             offre acceptée                    l'autre partie (+ rappel calendrier)
#   (en route)            thérapeute a démarré le trajet    client
#   in_progress           massage démarré                   client
#   completed             massage terminé                   client (+ thérapeute)
#   cancelled_by_*        annulation                        l'autre partie + thérapeutes en négociation
#   expired               aucune réponse avant la date      client + thérapeutes en négociation
#   confirmed (< 24 h)    RAPPEL CALENDRIER                 thérapeute (+ client)
#
# Chaque notification :
#   - est enregistrée en base (liste + badge),
#   - déclenche un signal temps réel /ws/notifications (affichage immédiat),
#   - envoie un push Expo (même application fermée),
#   - porte `data.status`, `data.event`, `data.target_role`, `data.booking_id`.
#
# Rien ici ne peut faire échouer l'action métier : toutes les erreurs sont
# journalisées puis ignorées.
# ============================================================================
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy.orm import Session

from ..core.database import SessionLocal
from ..models.booking import Booking
from ..models.negotiation import Negotiation
from ..models.notification import Notification
from ..models.user import User
from .mg_time import fmt_mg
from .notification_service import send_notification

logger = logging.getLogger(__name__)

# Types de notification (tous contiennent "booking" / "offer" => la catégorie
# de préférence « Réservations » / « Négociations » s'applique).
T_NEW_BOOKING = "new_booking"
T_BOOKING_SENT = "booking_created"
T_NEW_OFFER = "new_offer"
T_COUNTER_OFFER = "counter_offer"
T_OFFER_ACCEPTED = "offer_accepted"
T_OFFER_REJECTED = "offer_rejected"
T_CONFIRMED = "booking_confirmed"
T_CANCELLED = "booking_cancelled"
T_EN_ROUTE = "booking_en_route"
T_STARTED = "booking_started"
T_COMPLETED = "booking_completed"
T_EXPIRED = "booking_expired"
T_REMINDER = "booking_reminder"


def _money(value: Any) -> str:
    try:
        return f"{float(value):,.0f}".replace(",", " ") + " Ar"
    except (TypeError, ValueError):
        return ""


def _status_str(booking: Booking) -> str:
    return str(getattr(booking.status, "value", booking.status) or "").lower()


def _service_name(booking: Booking) -> str:
    try:
        return booking.massage_type.name if booking.massage_type else "massage"
    except Exception:  # noqa: BLE001
        return "massage"


def _when(booking: Booking) -> str:
    try:
        return fmt_mg(booking.scheduled_date)
    except Exception:  # noqa: BLE001
        return ""


def _base_data(booking: Booking, event: str, target_role: str, **extra: Any) -> Dict[str, Any]:
    data: Dict[str, Any] = {
        "booking_id": booking.id,
        "status": _status_str(booking),
        "event": event,
        "target_role": target_role,  # "client" | "therapist"
    }
    data.update({k: v for k, v in extra.items() if v is not None})
    return data


def _notify(
    user_id: Optional[int],
    title: str,
    body: str,
    notification_type: str,
    booking: Booking,
    event: str,
    target_role: str,
    priority: str = "normal",
    **extra: Any,
) -> Optional[Notification]:
    if not user_id:
        return None
    try:
        return send_notification(
            user_id=user_id,
            title=title,
            body=body,
            notification_type=notification_type,
            data=_base_data(booking, event, target_role, **extra),
            priority=priority,
            booking_id=booking.id,
        )
    except Exception:  # noqa: BLE001
        logger.exception("Notification %s échouée user=%s booking=%s", event, user_id, booking.id)
        return None


def negotiating_therapist_ids(db: Session, booking_id: int, exclude: Iterable[int] = ()) -> List[int]:
    """Thérapeutes qui ont une offre OUVERTE sur cette réservation."""
    skip = {int(x) for x in exclude if x is not None}
    rows = (
        db.query(Negotiation.user_id)
        .filter(
            Negotiation.booking_id == booking_id,
            Negotiation.user_type == "therapist",
            Negotiation.status == "sent",
        )
        .distinct()
        .all()
    )
    return [r[0] for r in rows if r[0] not in skip]


# ---------------------------------------------------------------------------
# 1. Création de la demande (pending)
# ---------------------------------------------------------------------------
def notify_booking_created_client(booking: Booking, notified_count: int = 0) -> None:
    """Accusé de réception pour le CLIENT."""
    body = (
        f"Votre demande de {_service_name(booking)} du {_when(booking)} a été envoyée"
        + (f" à {notified_count} thérapeute(s)." if notified_count else ".")
        + " Vous serez prévenu dès qu'un thérapeute répond."
    )
    _notify(
        booking.client_id, "Demande envoyée ✅", body, T_BOOKING_SENT,
        booking, "booking_created", "client",
    )


# ---------------------------------------------------------------------------
# 2. Offre acceptée (confirmed)
# ---------------------------------------------------------------------------
def notify_offer_accepted(
    db: Session,
    booking: Booking,
    offer: Negotiation,
    accepted_by: User,
    rejected_therapist_ids: Iterable[int] = (),
) -> None:
    """
    - l'auteur de l'offre est prévenu (offre acceptée + réservation confirmée),
    - les AUTRES thérapeutes dont l'offre vient d'être écartée sont prévenus.
    """
    recipient_id = offer.user_id
    recipient_role = "client" if offer.user_type == "client" else "therapist"
    price = _money(offer.price_offered)

    if recipient_role == "therapist":
        title = "Offre acceptée ✅"
        body = (
            f"{accepted_by.fullname} a accepté votre offre de {price}. "
            f"Massage confirmé le {_when(booking)}."
        )
    else:
        title = "Votre offre a été acceptée ✅"
        body = (
            f"{accepted_by.fullname} a accepté votre offre de {price}. "
            f"Massage confirmé le {_when(booking)}."
        )

    _notify(
        recipient_id, title, body, T_OFFER_ACCEPTED, booking,
        "offer_accepted", recipient_role,
        offer_id=offer.id, final_price=float(offer.price_offered),
        scheduled_date=_when(booking),
    )

    for therapist_id in rejected_therapist_ids:
        if therapist_id in (recipient_id, getattr(accepted_by, "id", None)):
            continue
        _notify(
            therapist_id,
            "Demande attribuée",
            f"La demande #{booking.id} a été confirmée avec un autre thérapeute.",
            T_OFFER_REJECTED, booking, "offer_not_selected", "therapist",
        )


# ---------------------------------------------------------------------------
# 3. Annulation (cancelled_by_client / cancelled_by_therapist)
# ---------------------------------------------------------------------------
def notify_booking_cancelled(
    booking: Booking,
    cancelled_by: User,
    open_offer_therapist_ids: Iterable[int] = (),
) -> None:
    by_client = cancelled_by.id == booking.client_id
    reason = (booking.cancellation_reason or "").strip()
    reason_txt = f" Motif : {reason}" if reason and reason not in ("Client cancelled", "Therapist cancelled") else ""

    if by_client:
        # Le client annule -> thérapeute assigné + thérapeutes en négociation
        targets = {booking.therapist_id, *open_offer_therapist_ids}
        for tid in filter(None, targets):
            _notify(
                tid,
                "Réservation annulée par le client ❌",
                f"{cancelled_by.fullname} a annulé la réservation #{booking.id} "
                f"({_service_name(booking)}, {_when(booking)}).{reason_txt}",
                T_CANCELLED, booking, "cancelled_by_client", "therapist",
                priority="high",
            )
    else:
        # Le thérapeute annule -> client
        _notify(
            booking.client_id,
            "Réservation annulée par le thérapeute ❌",
            f"{cancelled_by.fullname} a annulé la réservation #{booking.id} "
            f"({_service_name(booking)}, {_when(booking)}).{reason_txt}",
            T_CANCELLED, booking, "cancelled_by_therapist", "client",
            priority="high",
        )


# ---------------------------------------------------------------------------
# 4. Cycle de vie du massage
# ---------------------------------------------------------------------------
def notify_en_route(booking: Booking, therapist_name: Optional[str], eta=None, distance=None) -> None:
    details = []
    if eta:
        details.append(f"arrivée estimée : {str(eta)[:40]}")
    if distance:
        details.append(f"à {str(distance)[:30]}")
    body = f"{therapist_name or 'Votre thérapeute'} a démarré le trajet vers vous"
    body += f" ({', '.join(details)})." if details else "."
    _notify(
        booking.client_id, "Votre thérapeute est en route 🚗", body, T_EN_ROUTE,
        booking, "en_route", "client",
        priority="high", therapist_id=booking.therapist_id,
        screen="Tracking", eta=eta, distance=distance,
    )


def notify_massage_started(booking: Booking, therapist: User) -> None:
    _notify(
        booking.client_id, "Massage commencé 💆",
        f"{therapist.fullname} a commencé votre massage.",
        T_STARTED, booking, "started", "client",
    )


def notify_massage_completed(booking: Booking, therapist: User) -> None:
    _notify(
        booking.client_id, "Massage terminé ✅",
        f"Votre massage avec {therapist.fullname} est terminé. "
        "N'oubliez pas de laisser un avis !",
        T_COMPLETED, booking, "completed", "client",
    )
    _notify(
        booking.therapist_id, "Massage terminé ✅",
        f"La séance #{booking.id} est terminée"
        + (f" ({_money(booking.final_price)})." if booking.final_price else "."),
        T_COMPLETED, booking, "completed", "therapist",
    )


def notify_booking_accepted_directly(booking: Booking, therapist: User) -> None:
    """Le thérapeute accepte directement la demande (statut -> confirmed)."""
    _notify(
        booking.client_id, "Réservation acceptée ✅",
        f"{therapist.fullname} a accepté votre demande du {_when(booking)}.",
        T_CONFIRMED, booking, "accepted", "client",
    )


# ---------------------------------------------------------------------------
# 5. Expiration : voir process_expired_bookings() plus bas
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# 6. RAPPELS CALENDRIER (massages confirmés)
# ---------------------------------------------------------------------------
# (clé, minutes avant le début). Le rappel « le plus proche » encore non
# envoyé est émis : un massage réservé pour dans 3 h reçoit directement le
# rappel « dans 3 h », puis celui d'1 h, de 15 min et « c'est l'heure ».
REMINDER_STEPS = (("24h", 24 * 60), ("1h", 60), ("15m", 15), ("now", 0))
REMINDER_LATE_GRACE_MIN = 45  # « C'est l'heure » tant que le massage n'a pas démarré (45 min)


def _humanize_delta(minutes: int) -> str:
    if minutes <= 0:
        return "maintenant"
    if minutes < 60:
        return f"dans {minutes} min"
    hours, mins = divmod(minutes, 60)
    if hours < 24:
        return f"dans {hours} h" + (f" {mins:02d}" if mins else "")
    days = hours // 24
    return "demain" if days == 1 and hours < 48 else f"dans {days} jours"


def _current_reminder_key(minutes_left: float) -> Optional[str]:
    if minutes_left < -REMINDER_LATE_GRACE_MIN:
        return None
    chosen = None
    for key, offset in REMINDER_STEPS:
        if minutes_left <= offset:
            chosen = key  # on garde le plus petit palier atteint
    return chosen


def _already_reminded(db: Session, user_id: int, booking_id: int, key: str) -> bool:
    rows = (
        db.query(Notification.data)
        .filter(
            Notification.user_id == user_id,
            Notification.booking_id == booking_id,
            Notification.type == T_REMINDER,
        )
        .all()
    )
    for (data,) in rows:
        if isinstance(data, dict) and data.get("reminder_key") == key:
            return True
    return False


def _send_reminder(db: Session, booking: Booking, user_id: int, role: str, key: str, minutes_left: int) -> bool:
    if _already_reminded(db, user_id, booking.id, key):
        return False

    when = _when(booking)
    service = _service_name(booking)
    delta = _humanize_delta(minutes_left)

    if role == "therapist":
        who = booking.client.fullname if getattr(booking, "client", None) else "le client"
        if key == "now":
            title = "⏰ C'est l'heure du massage"
            body = f"Votre séance #{booking.id} avec {who} est prévue maintenant ({when}). Pensez à démarrer le trajet."
        else:
            title = f"⏰ Rappel : massage {delta}"
            body = f"{service} avec {who} le {when}. Adresse : {(booking.address or '')[:90]}"
    else:
        who = booking.therapist.fullname if getattr(booking, "therapist", None) else "votre thérapeute"
        if key == "now":
            title = "⏰ Votre massage est prévu maintenant"
            body = f"{who} est attendu(e) pour votre {service} ({when})."
        else:
            title = f"⏰ Rappel : massage {delta}"
            body = f"{service} avec {who} le {when}. Soyez prêt(e) à l'heure !"

    return _notify(
        user_id, title, body, T_REMINDER, booking, "reminder", role,
        priority="high", reminder_key=key, minutes_left=minutes_left,
        scheduled_date=when, screen="BookingDetail",
    ) is not None


def process_booking_reminders(db: Session, now: Optional[datetime] = None) -> int:
    """Envoie les rappels dus. Retourne le nombre de notifications créées."""
    now = now or datetime.utcnow()
    horizon = now + timedelta(hours=24, minutes=1)
    earliest = now - timedelta(minutes=REMINDER_LATE_GRACE_MIN)

    bookings = (
        db.query(Booking)
        .filter(
            Booking.status == "confirmed",
            Booking.therapist_id.isnot(None),
            Booking.scheduled_date <= horizon,
            Booking.scheduled_date >= earliest,
        )
        .all()
    )

    sent = 0
    for booking in bookings:
        minutes_left = (booking.scheduled_date - now).total_seconds() / 60.0
        key = _current_reminder_key(minutes_left)
        if not key:
            continue
        m = int(round(minutes_left))
        # Thérapeute : tous les paliers. Client : 1h, 15 min et « maintenant ».
        if _send_reminder(db, booking, booking.therapist_id, "therapist", key, m):
            sent += 1
        if key != "24h" and _send_reminder(db, booking, booking.client_id, "client", key, m):
            sent += 1
    return sent


def process_expired_bookings(db: Session, now: Optional[datetime] = None) -> int:
    """Passe en « expired » les demandes sans réponse puis prévient les intéressés."""
    now = now or datetime.utcnow()
    stale = (
        db.query(Booking)
        .filter(
            Booking.status.in_(("pending", "negotiating")),
            Booking.expires_at.isnot(None),
            Booking.expires_at < now,
        )
        .all()
    )
    count = 0
    for booking in stale:
        try:
            booking.status = "expired"
            db.query(Negotiation).filter(
                Negotiation.booking_id == booking.id,
                Negotiation.status == "sent",
            ).update({"status": "expired"}, synchronize_session=False)
            # thérapeutes à prévenir : lus AVANT le changement de statut des offres
            tids = [
                r[0] for r in db.query(Negotiation.user_id)
                .filter(Negotiation.booking_id == booking.id, Negotiation.user_type == "therapist")
                .distinct().all()
            ]
            db.commit()
            db.refresh(booking)

            _notify(
                booking.client_id, "Demande expirée ⌛",
                f"Aucun thérapeute n'a confirmé votre demande de {_service_name(booking)} "
                f"du {_when(booking)}. Vous pouvez en créer une nouvelle.",
                T_EXPIRED, booking, "expired", "client",
            )
            for tid in tids:
                _notify(
                    tid, "Demande expirée ⌛",
                    f"La demande #{booking.id} du {_when(booking)} a expiré.",
                    T_EXPIRED, booking, "expired", "therapist",
                )
            count += 1
        except Exception:  # noqa: BLE001
            db.rollback()
            logger.exception("Expiration booking %s échouée", booking.id)
    return count


def run_scheduler_cycle() -> Dict[str, int]:
    """Un tour du planificateur (appelé toutes les minutes)."""
    db = SessionLocal()
    try:
        expired = process_expired_bookings(db)
        reminders = process_booking_reminders(db)
        return {"expired": expired, "reminders": reminders}
    except Exception:  # noqa: BLE001
        db.rollback()
        logger.exception("Planificateur de notifications : erreur")
        return {"expired": 0, "reminders": 0}
    finally:
        db.close()


async def booking_scheduler_loop(interval_seconds: int = 60) -> None:
    """Boucle d'arrière-plan lancée au démarrage (lifespan)."""
    logger.info("Planificateur de rappels de réservation démarré (%ss)", interval_seconds)
    await asyncio.sleep(5)
    while True:
        try:
            result = await asyncio.to_thread(run_scheduler_cycle)
            if result["expired"] or result["reminders"]:
                logger.info("Planificateur : %s", result)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            logger.exception("Planificateur : cycle échoué")
        await asyncio.sleep(interval_seconds)
