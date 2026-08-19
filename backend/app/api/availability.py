from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date, time, timedelta
import logging

from ..core.database import get_db
from ..core.dependencies import get_current_therapist, get_current_user
from ..models.user import User
from ..models.availability import TherapistAvailability, BlockedDate, BookingSlot
from ..schemas.availability import (
    DaySchedule,
    WeeklyScheduleUpdate,
    BlockedDateCreate,
    DayScheduleResponse,
    BlockedDateResponse,
    FullAvailabilityResponse,
    ToggleStatusResponse,
    BookingSlotResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/therapists", tags=["Availability"])


@router.get(
    "/availability",
    response_model=FullAvailabilityResponse,
    summary="Disponibilités complètes du thérapeute connecté",
)
async def get_my_availability(
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db),
):
    try:
        rows = (
            db.query(TherapistAvailability)
            .filter(TherapistAvailability.therapist_id == current_user.id)
            .order_by(TherapistAvailability.day_of_week)
            .all()
        )

        weekly = []
        for day in range(7):
            existing = next((r for r in rows if r.day_of_week == day), None)
            if existing:
                weekly.append(DayScheduleResponse(
                    id=existing.id,
                    day=existing.day_of_week,
                    start=existing.start_time.strftime("%H:%M"),
                    end=existing.end_time.strftime("%H:%M"),
                    is_available=existing.is_available,
                    notes=existing.notes or "",
                ))
            else:
                weekly.append(DayScheduleResponse(
                    id=None,
                    day=day,
                    start="09:00",
                    end="18:00",
                    is_available=(day < 5),
                    notes="",
                ))

        now = datetime.utcnow()
        blocked_rows = (
            db.query(BlockedDate)
            .filter(
                BlockedDate.therapist_id == current_user.id,
                BlockedDate.end_date >= now,
            )
            .order_by(BlockedDate.start_date)
            .all()
        )
        blocked = [
            BlockedDateResponse(
                id=b.id,
                start=b.start_date.strftime("%Y-%m-%d"),
                end=b.end_date.strftime("%Y-%m-%d"),
                reason=b.reason or "",
                is_all_day=b.is_all_day,
            )
            for b in blocked_rows
        ]

        return FullAvailabilityResponse(
            is_online=current_user.is_online or False,
            is_available=current_user.is_available or False,
            weekly=weekly,
            blocked=blocked,
        )

    except Exception as e:
        logger.error(f"❌ get_my_availability: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put(
    "/availability",
    summary="Mettre à jour le planning hebdomadaire",
    response_model=dict,
)
async def update_weekly_schedule(
    payload: WeeklyScheduleUpdate,
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db),
):
    try:
        # ✅ Validation : pas deux entrées pour le même jour dans un
        # même payload (sinon la seconde écraserait silencieusement
        # la première).
        seen_days = set()
        for day_data in payload.weekly:
            if day_data.day in seen_days:
                raise HTTPException(
                    status_code=400,
                    detail=f"Le jour {day_data.day} apparaît plusieurs fois dans la requête",
                )
            seen_days.add(day_data.day)

        for day_data in payload.weekly:
            day_idx = day_data.day

            # Validation des horaires
            try:
                sh, sm = map(int, day_data.start.split(":"))
                eh, em = map(int, day_data.end.split(":"))
                start_t = time(sh, sm)
                end_t = time(eh, em)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Format horaire invalide pour le jour {day_idx}",
                )

            if start_t >= end_t:
                raise HTTPException(
                    status_code=400,
                    detail=f"Heure de début ({day_data.start}) doit être avant l'heure de fin ({day_data.end})",
                )

            existing = (
                db.query(TherapistAvailability)
                .filter(
                    TherapistAvailability.therapist_id == current_user.id,
                    TherapistAvailability.day_of_week == day_idx,
                )
                .first()
            )

            if existing:
                existing.start_time = start_t
                existing.end_time = end_t
                existing.is_available = day_data.is_available
                existing.notes = day_data.notes or ""
                existing.updated_at = datetime.utcnow()
            else:
                db.add(TherapistAvailability(
                    therapist_id=current_user.id,
                    day_of_week=day_idx,
                    start_time=start_t,
                    end_time=end_t,
                    is_available=day_data.is_available,
                    is_recurring=True,
                    notes=day_data.notes or "",
                ))

        db.commit()
        logger.info(f"✅ Planning mis à jour — thérapeute {current_user.id}")
        return {"message": "Planning hebdomadaire mis à jour avec succès"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ update_weekly_schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/availability/blocked",
    response_model=BlockedDateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ajouter une date bloquée",
)
async def add_blocked_date(
    payload: BlockedDateCreate,
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db),
):
    try:
        start_dt = datetime.combine(payload.start_date, time(0, 0))
        end_dt = datetime.combine(payload.end_date, time(23, 59, 59))

        overlap = (
            db.query(BlockedDate)
            .filter(
                BlockedDate.therapist_id == current_user.id,
                BlockedDate.start_date <= end_dt,
                BlockedDate.end_date >= start_dt,
            )
            .first()
        )
        if overlap:
            raise HTTPException(
                status_code=409,
                detail=f"Chevauchement avec une période existante ({overlap.start_date.date()} → {overlap.end_date.date()})",
            )

        new_block = BlockedDate(
            therapist_id=current_user.id,
            start_date=start_dt,
            end_date=end_dt,
            reason=payload.reason or "",
            is_all_day=payload.is_all_day,
        )
        db.add(new_block)
        db.commit()
        db.refresh(new_block)

        logger.info(f"✅ Date bloquée — thérapeute {current_user.id}: {start_dt.date()} → {end_dt.date()}")
        return BlockedDateResponse(
            id=new_block.id,
            start=new_block.start_date.strftime("%Y-%m-%d"),
            end=new_block.end_date.strftime("%Y-%m-%d"),
            reason=new_block.reason or "",
            is_all_day=new_block.is_all_day,
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ add_blocked_date: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/availability/blocked/{blocked_id}",
    summary="Supprimer une date bloquée",
)
async def delete_blocked_date(
    blocked_id: int,
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db),
):
    try:
        block = (
            db.query(BlockedDate)
            .filter(
                BlockedDate.id == blocked_id,
                BlockedDate.therapist_id == current_user.id,
            )
            .first()
        )
        if not block:
            raise HTTPException(status_code=404, detail="Date bloquée non trouvée")

        db.delete(block)
        db.commit()
        logger.info(f"✅ Date bloquée {blocked_id} supprimée — thérapeute {current_user.id}")
        return {"message": "Date bloquée supprimée avec succès"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ delete_blocked_date: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put(
    "/toggle-online",
    response_model=ToggleStatusResponse,
    summary="Basculer en ligne / hors ligne",
)
async def toggle_online(
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db),
):
    try:
        current_user.is_online = not current_user.is_online
        current_user.updated_at = datetime.utcnow()
        db.commit()
        label = "en ligne" if current_user.is_online else "hors ligne"
        logger.info(f"✅ Thérapeute {current_user.id} → {label}")
        return ToggleStatusResponse(
            is_online=current_user.is_online,
            is_available=current_user.is_available,
            message=f"Vous êtes maintenant {label}",
        )
    except Exception as e:
        db.rollback()
        logger.error(f"❌ toggle_online: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put(
    "/toggle-available",
    response_model=ToggleStatusResponse,
    summary="Basculer disponible / indisponible",
)
async def toggle_available(
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db),
):
    try:
        current_user.is_available = not current_user.is_available
        current_user.updated_at = datetime.utcnow()
        db.commit()
        label = "disponible" if current_user.is_available else "indisponible"
        logger.info(f"✅ Thérapeute {current_user.id} → {label}")
        return ToggleStatusResponse(
            is_online=current_user.is_online,
            is_available=current_user.is_available,
            message=f"Vous êtes maintenant {label}",
        )
    except Exception as e:
        db.rollback()
        logger.error(f"❌ toggle_available: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{therapist_id}/slots",
    response_model=List[BookingSlotResponse],
    summary="Créneaux disponibles d'un thérapeute (vue client)",
)
async def get_available_slots(
    therapist_id: int,
    from_date: Optional[date] = Query(default=None, description="Date début YYYY-MM-DD"),
    to_date: Optional[date] = Query(default=None, description="Date fin YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        therapist = db.query(User).filter(
            User.id == therapist_id,
            User.role == "THERAPIST",
            User.is_active == True,
        ).first()
        if not therapist:
            raise HTTPException(status_code=404, detail="Thérapeute non trouvé")

        today = date.today()
        start = from_date or today
        end = to_date or (today + timedelta(days=14))

        if end < start:
            raise HTTPException(status_code=400, detail="to_date doit être >= from_date")
        if (end - start).days > 60:
            raise HTTPException(status_code=400, detail="Plage maximale : 60 jours")

        schedule = (
            db.query(TherapistAvailability)
            .filter(
                TherapistAvailability.therapist_id == therapist_id,
                TherapistAvailability.is_available == True,
            )
            .all()
        )
        schedule_by_day = {s.day_of_week: s for s in schedule}

        start_dt = datetime.combine(start, time(0, 0))
        end_dt = datetime.combine(end, time(23, 59))

        # Dates bloquées par le thérapeute sur la plage demandée
        blocked = (
            db.query(BlockedDate)
            .filter(
                BlockedDate.therapist_id == therapist_id,
                BlockedDate.start_date <= end_dt,
                BlockedDate.end_date >= start_dt,
            )
            .all()
        )
        blocked_ranges = [(b.start_date, b.end_date) for b in blocked]

        # ✅ CORRECTIF anti double-réservation : on récupère les
        # créneaux déjà réservés (booking_slots.is_booked = True)
        # sur la même plage, pour les exclure des résultats.
        booked_rows = (
            db.query(BookingSlot)
            .filter(
                BookingSlot.therapist_id == therapist_id,
                BookingSlot.is_booked == True,
                BookingSlot.slot_date >= start_dt,
                BookingSlot.slot_date <= end_dt,
            )
            .all()
        )
        # On compare par (date, heure) car la disponibilité
        # hebdomadaire ne renvoie qu'un créneau (start-end) par jour.
        booked_datetimes = {b.slot_date.replace(second=0, microsecond=0) for b in booked_rows}

        slots = []
        current_date = start
        while current_date <= end:
            our_day = (current_date.weekday() + 1) % 7

            if our_day in schedule_by_day:
                sched = schedule_by_day[our_day]
                slot_dt = datetime.combine(current_date, sched.start_time)

                is_blocked = any(b_s <= slot_dt <= b_e for b_s, b_e in blocked_ranges)
                is_booked = slot_dt.replace(second=0, microsecond=0) in booked_datetimes

                if not is_blocked and not is_booked and slot_dt > datetime.utcnow():
                    slots.append(BookingSlotResponse(
                        date=current_date.strftime("%Y-%m-%d"),
                        start=sched.start_time.strftime("%H:%M"),
                        end=sched.end_time.strftime("%H:%M"),
                        is_available=True,
                        therapist_id=therapist_id,
                    ))

            current_date += timedelta(days=1)

        return slots

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ get_available_slots: {e}")
        raise HTTPException(status_code=500, detail=str(e))
