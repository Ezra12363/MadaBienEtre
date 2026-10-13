
# app/schemas/ai.py

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AIRecommendationRequest(BaseModel):
    user_id: int = Field(..., gt=0)
    massage_type: Optional[str] = None
    budget_max: Optional[float] = Field(None, gt=0)
    distance_max: Optional[int] = Field(10, ge=1, le=50)
    preferred_gender: Optional[str] = Field(
        None,
        pattern="^(male|female|any)$",
    )
    symptoms: Optional[str] = None
    preferred_date: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(
        None,
        ge=30,
        le=180,
    )


class AIRecommendationResponse(BaseModel):
    therapist_id: int
    fullname: str
    rating: float
    total_reviews: int
    distance_km: float
    price_suggested: float
    availability: bool
    score: float
    reason: Optional[str] = None
    profile_image: Optional[str] = None
    experience_years: int
    base_price: Optional[float] = None


class AIPricingRequest(BaseModel):
    massage_type: str
    duration: int = Field(..., ge=30, le=180)
    distance: float = Field(..., ge=0)
    demand_level: str = Field(
        "medium",
        pattern="^(low|medium|high)$",
    )
    time_of_day: Optional[str] = Field(
        None,
        pattern="^(morning|afternoon|evening|night)$",
    )
    day_of_week: Optional[int] = Field(None, ge=0, le=6)


class AIPricingResponse(BaseModel):
    suggested_price: float
    min_price: float
    max_price: float
    confidence: float
    factors: Dict[str, float]
    breakdown: Optional[Dict[str, float]] = None


class AIAcceptancePrediction(BaseModel):
    booking_id: int
    proposed_price: float
    probability: float
    confidence: float
    factors: Dict[str, float]


class ChatbotRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        max_length=500,
    )
    user_id: Optional[int] = None
    conversation_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class ChatbotResponse(BaseModel):
    response: str

    conversation_id: str

    intent: Optional[str] = None

    confidence: Optional[float] = Field(
        default=None,
        ge=0,
        le=1,
    )

    suggestions: List[str] = Field(
        default_factory=list,
    )

    data: Dict[str, Any] = Field(
        default_factory=dict,
    )


class AIPredictionResponse(BaseModel):
    prediction_id: int
    prediction_type: str
    value: float
    confidence: float
    factors: Dict[str, Any]
    created_at: datetime


class AIFraudDetectionRequest(BaseModel):
    booking_id: int
    user_id: Optional[int] = None
    therapist_id: Optional[int] = None


class AIFraudDetectionResponse(BaseModel):
    is_fraudulent: bool
    risk_score: float
    confidence: float
    flags: List[str]
    recommendations: List[str]


class AITrainingRequest(BaseModel):
    model_type: str = Field(
        ...,
        pattern="^(recommendation|pricing|chatbot|fraud_detection)$",
    )
    data_start_date: datetime
    data_end_date: datetime
    parameters: Optional[Dict[str, Any]] = None
