# app/schemas/availability.py
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import date
import re


class DaySchedule(BaseModel):
    day: int = Field(..., ge=0, le=6, description="0=Dimanche … 6=Samedi")
    start: str = Field(..., description="Heure de début HH:MM")
    end: str = Field(..., description="Heure de fin HH:MM")
    is_available: bool = Field(default=True)
    notes: Optional[str] = Field(None, max_length=255)

    @validator("start", "end")
    def validate_time_format(cls, v):
        if not re.match(r"^\d{2}:\d{2}$", v):
            raise ValueError("Format HH:MM requis")
        h, m = map(int, v.split(":"))
        if not (0 <= h <= 23 and 0 <= m <= 59):
            raise ValueError("Heure invalide")
        return v


class WeeklyScheduleUpdate(BaseModel):
    weekly: List[DaySchedule] = Field(
        ...,
        min_items=1,
        max_items=7,
        description="Liste des jours à mettre à jour (1 à 7 entrées)",
    )


class BlockedDateCreate(BaseModel):
    start_date: date = Field(..., description="Date de début (YYYY-MM-DD)")
    end_date: date = Field(..., description="Date de fin (YYYY-MM-DD)")
    reason: Optional[str] = Field(None, max_length=255)
    is_all_day: bool = Field(default=True)

    @validator("end_date")
    def end_after_start(cls, v, values):
        if "start_date" in values and v < values["start_date"]:
            raise ValueError("end_date doit être >= start_date")
        return v


class DayScheduleResponse(BaseModel):
    id: Optional[int] = None
    day: int
    start: str
    end: str
    is_available: bool
    notes: Optional[str] = ""

    class Config:
        from_attributes = True


class BlockedDateResponse(BaseModel):
    id: int
    start: str
    end: str
    reason: Optional[str] = ""
    is_all_day: bool

    class Config:
        from_attributes = True


class FullAvailabilityResponse(BaseModel):
    is_online: bool
    is_available: bool
    weekly: List[DayScheduleResponse]
    blocked: List[BlockedDateResponse]

    class Config:
        from_attributes = True


class ToggleStatusResponse(BaseModel):
    is_online: bool
    is_available: bool
    message: str

    class Config:
        from_attributes = True


class BookingSlotResponse(BaseModel):
    date: str
    start: str
    end: str
    is_available: bool
    therapist_id: int

    class Config:
        from_attributes = True