from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime


class ReviewCreate(BaseModel):
    booking_id: int = Field(..., gt=0)
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)
    is_anonymous: bool = False
    professionalism: Optional[int] = Field(None, ge=1, le=5)
    quality: Optional[int] = Field(None, ge=1, le=5)
    punctuality: Optional[int] = Field(None, ge=1, le=5)
    cleanliness: Optional[int] = Field(None, ge=1, le=5)
    tags: Optional[List[str]] = None


class ReviewUpdate(BaseModel):
    """Modification d'un avis par son auteur (tous les champs sont optionnels)."""
    rating: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)
    is_anonymous: Optional[bool] = None
    professionalism: Optional[int] = Field(None, ge=1, le=5)
    quality: Optional[int] = Field(None, ge=1, le=5)
    punctuality: Optional[int] = Field(None, ge=1, le=5)
    cleanliness: Optional[int] = Field(None, ge=1, le=5)
    tags: Optional[List[str]] = None


class ReviewResponse(BaseModel):
    id: int
    booking_id: int
    reviewer_id: int
    therapist_id: int
    rating: int
    comment: Optional[str]
    is_anonymous: bool
    professionalism: Optional[int]
    quality: Optional[int]
    punctuality: Optional[int]
    cleanliness: Optional[int]
    tags: Optional[List[str]]
    response_from_therapist: Optional[str]
    created_at: datetime
    updated_at: datetime
    reviewer_name: Optional[str] = None
    therapist_name: Optional[str] = None

    class Config:
        from_attributes = True


class ReviewResponseRequest(BaseModel):
    """Réponse du thérapeute à un avis."""
    response: str = Field(..., min_length=2, max_length=1000)


class ReviewStatsResponse(BaseModel):
    total_reviews: int
    average_rating: float
    distribution: Dict[int, int]
    last_month_rating: float
    last_month_reviews: int


class ReviewHelpfulVote(BaseModel):
    review_id: int = Field(..., gt=0)
    is_helpful: bool = True


class ReviewReportRequest(BaseModel):
    reason: str = Field(..., pattern="^(inappropriate|fake|offensive|spam|other)$")
    description: Optional[str] = Field(None, max_length=500)


class ReviewModerationRequest(BaseModel):
    """Modération admin d'un avis : masquer (avec motif) ou rétablir."""
    action: str = Field(..., pattern="^(hide|restore)$")
    reason: Optional[str] = Field(None, max_length=500)


class ReportResolveRequest(BaseModel):
    """Traitement d'un signalement par l'admin."""
    action: str = Field(..., pattern="^(dismiss|hide|delete)$")
    admin_notes: Optional[str] = Field(None, max_length=500)
