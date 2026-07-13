# app/api/chatbot.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.user import User
from ..schemas.ai import ChatbotRequest, ChatbotResponse
from ..services.ai.chatbot_service import get_chatbot_response

router = APIRouter(prefix="/api/chatbot", tags=["Chatbot AI"])

@router.post("/message", response_model=ChatbotResponse)
async def chatbot_message(
    request: ChatbotRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Message au chatbot IA"""
    response = await get_chatbot_response(
        message=request.message,
        user_id=current_user.id,
        conversation_id=request.conversation_id,
        db=db
    )
    
    return response

@router.post("/faq")
async def get_faq_answer(
    question: str,
    db: Session = Depends(get_db)
):
    """Répondre aux questions fréquentes"""
    faqs = {
        "prix": "Les prix varient selon le type de massage et la durée. Le prix minimum conseillé est de 30 000 Ar.",
        "annulation": "Vous pouvez annuler gratuitement jusqu'à 2 heures avant le rendez-vous.",
        "paiement": "Nous acceptons MVola, Orange Money, Airtel Money, cartes bancaires et espèces.",
        "securite": "Tous nos masseurs sont vérifiés. Un bouton SOS est disponible en cas d'urgence.",
        "disponibilite": "Les masseurs disponibles sont affichés sur la carte en temps réel.",
        "inscription": "L'inscription est gratuite. Vous devez vérifier votre email avec un code OTP."
    }
    
    # Recherche simple de mots-clés
    for key, value in faqs.items():
        if key in question.lower():
            return {"question": question, "answer": value, "source": "faq"}
    
    return {
        "question": question,
        "answer": "Je suis désolé, je ne comprends pas votre question. Veuillez contacter le support client pour plus d'informations.",
        "source": "default"
    }

@router.get("/suggestions")
async def get_chat_suggestions(
    context: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Obtenir des suggestions de conversation"""
    suggestions = [
        "Quel type de massage me convient le mieux ?",
        "Quels sont les prix pratiqués ?",
        "Comment puis-je annuler une réservation ?",
        "Comment payer avec MVola ?",
        "Que faire en cas d'urgence ?",
        "Les masseurs sont-ils vérifiés ?",
        "Puis-je choisir le sexe du masseur ?",
        "Comment donner mon avis ?"
    ]
    
    return {"suggestions": suggestions}