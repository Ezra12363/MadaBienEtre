
# app/api/chatbot.py
from typing import Any, Dict, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.user import User
from ..schemas.ai import ChatbotRequest, ChatbotResponse
from ..services.ai.chatbot_service import (
    ChatbotService,
    get_chatbot_response,
)

router = APIRouter(prefix="/chatbot", tags=["Chatbot AI"])

_faq_service = ChatbotService()


def _normalize_chatbot_response(
    result: Any,
    conversation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Garantit que la réponse respecte le schéma ChatbotResponse.
    Compatible avec un dictionnaire ou un modèle Pydantic.
    """

    if isinstance(result, dict):
        payload = dict(result)
    elif hasattr(result, "model_dump"):
        # Pydantic v2
        payload = result.model_dump()
    elif hasattr(result, "dict"):
        # Pydantic v1
        payload = result.dict()
    else:
        raise HTTPException(
            status_code=500,
            detail="Le service chatbot a retourné un format invalide.",
        )

    if not isinstance(payload.get("response"), str):
        raise HTTPException(
            status_code=500,
            detail="La réponse du chatbot est absente ou invalide.",
        )

    # Conserver l'identifiant généré par le service lorsqu'il existe.
    payload["conversation_id"] = (
        payload.get("conversation_id")
        or conversation_id
        or str(uuid4())
    )

    # Champs attendus par le schéma de réponse.
    payload.setdefault("intent", None)
    payload.setdefault("confidence", None)
    payload.setdefault("suggestions", [])
    payload.setdefault("data", {})

    # Éviter les valeurs nulles pour les collections.
    if payload["suggestions"] is None:
        payload["suggestions"] = []

    if payload["data"] is None:
        payload["data"] = {}

    return payload


@router.post("/message", response_model=ChatbotResponse)
async def chatbot_message(
    request: ChatbotRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Message au chatbot IA :
    - FAQ et intelligence artificielle ;
    - historique de conversation ;
    - utilisateur authentifié ;
    - réponse normalisée selon ChatbotResponse.
    """

    try:
        result = await get_chatbot_response(
            message=request.message.strip(),
            user_id=current_user.id,
            conversation_id=request.conversation_id,
            db=db,
        )

        return _normalize_chatbot_response(
            result=result,
            conversation_id=request.conversation_id,
        )

    except HTTPException:
        raise

    except Exception as exc:
        # Conserver le détail dans les logs du serveur,
        # sans exposer les détails internes au client.
        import logging

        logging.getLogger(__name__).exception(
            "Erreur pendant le traitement du chatbot."
        )

        raise HTTPException(
            status_code=500,
            detail="Une erreur interne est survenue pendant le traitement du chatbot.",
        ) from exc


@router.post("/faq")
async def get_faq_answer(question: str):
    """Réponse FAQ uniquement, sans appel IA."""

    question = question.strip()

    if not question:
        raise HTTPException(
            status_code=422,
            detail="La question ne peut pas être vide.",
        )

    faq = _faq_service.match_faq(question)

    if faq:
        return {
            "question": question,
            "answer": faq["response"],
            "intent": faq.get("intent"),
            "source": "faq",
        }

    return {
        "question": question,
        "answer": (
            "Je suis désolé, je ne comprends pas votre question. "
            "Veuillez contacter le support client pour plus d'informations."
        ),
        "intent": "unknown",
        "source": "default",
    }


@router.get("/suggestions")
async def get_chat_suggestions(
    context: Optional[str] = None,
):
    """Suggestions de conversation."""

    suggestions = [
        "Quel type de massage me convient le mieux ?",
        "Quels sont les prix pratiqués ?",
        "Comment puis-je annuler une réservation ?",
        "Comment payer avec MVola ?",
        "Que faire en cas d'urgence ?",
        "Les masseurs sont-ils vérifiés ?",
        "Puis-je choisir le sexe du masseur ?",
        "Comment donner mon avis ?",
    ]

    return {
        "suggestions": suggestions,
        "context": context,
    }
