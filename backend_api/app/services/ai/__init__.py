# app/services/ai/__init__.py
from .chatbot_service import get_chatbot_response, ChatbotService
from .recommendation_service import recommend_therapists
from .pricing_service import calculate_dynamic_price, predict_price, suggest_price_with_acceptance
from .fraud_detection import detect_fraud
from .prediction import (
    predict_acceptance_probability,
    predict_acceptance_for_booking,
    predict_demand,
    predict_revenue,
)
from .insights_service import build_insights
from .model_registry import init_ai_module, load_models

__all__ = [
    "get_chatbot_response",
    "ChatbotService",
    "recommend_therapists",
    "calculate_dynamic_price",
    "predict_price",
    "suggest_price_with_acceptance",
    "detect_fraud",
    "predict_acceptance_probability",
    "predict_acceptance_for_booking",
    "predict_demand",
    "predict_revenue",
    "build_insights",
    "init_ai_module",
    "load_models",
]
