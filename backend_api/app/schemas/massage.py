# app/schemas/massage.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

# -------------------------------
#  Schémas pour MassageType
# -------------------------------
class MassageTypeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    duration_min: int = Field(60, ge=15)
    duration_max: int = Field(120, ge=15)
    min_price: float = Field(30000, ge=0)
    recommended_price: Optional[float] = Field(None, ge=0)
    category: Optional[str] = Field("relaxant", 
        pattern="^(relaxant|therapeutique|sportif|reflexologie|prenatal|personnalise)$")
    icon_url: Optional[str] = None
    image_url: Optional[str] = None
    is_active: bool = True
    display_order: int = 0

class MassageTypeCreate(MassageTypeBase):
    pass

class MassageTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    duration_min: Optional[int] = Field(None, ge=15)
    duration_max: Optional[int] = Field(None, ge=15)
    min_price: Optional[float] = Field(None, ge=0)
    recommended_price: Optional[float] = Field(None, ge=0)
    category: Optional[str] = Field(None, 
        pattern="^(relaxant|therapeutique|sportif|reflexologie|prenatal|personnalise)$")
    icon_url: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None

class MassageTypeResponse(MassageTypeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True