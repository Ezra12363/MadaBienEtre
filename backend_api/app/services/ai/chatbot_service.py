# app/services/ai/chatbot_service.py
from typing import Dict, Any, Optional, List
import re
import json
from datetime import datetime
import openai
from ...core.config import settings

# Configurer OpenRouter
if settings.OPENROUTER_API_KEY:
    openai.api_key = settings.OPENROUTER_API_KEY
    openai.base_url = settings.OPENROUTER_BASE_URL

class ChatbotService:
    """Service de chatbot IA"""
    
    def __init__(self):
        self.conversations = {}
        self.faq_patterns = {
            "prix|tarif|couts|combien": self.handle_price_question,
            "annulation|annuler|report|modifier": self.handle_cancellation_question,
            "paiement|payer|reglement|mobile money": self.handle_payment_question,
            "securite|sos|urgence|danger": self.handle_security_question,
            "disponibilite|disponible|horaire|creneau": self.handle_availability_question,
            "inscription|creer compte|s'inscrire": self.handle_registration_question,
            "massage|type|quel massage": self.handle_massage_question,
            "therapeute|masseur|professionnel": self.handle_therapist_question
        }
    
    async def get_response(
        self,
        message: str,
        user_id: Optional[int] = None,
        conversation_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Obtenir une réponse du chatbot"""
        # Vérifier les FAQs
        for pattern, handler in self.faq_patterns.items():
            if re.search(pattern, message.lower()):
                return handler(message, context)
        
        # Utiliser l'IA pour les questions complexes
        if settings.OPENROUTER_API_KEY:
            return await self.get_ai_response(message, user_id, conversation_id, context)
        
        # Réponse par défaut
        return {
            "response": "Je suis désolé, je ne comprends pas votre question. "
                         "Pouvez-vous reformuler ou contacter notre support ?",
            "conversation_id": conversation_id or "default",
            "intent": "unknown",
            "confidence": 0.3,
            "suggestions": [
                "Quel type de massage me convient le mieux ?",
                "Quels sont les prix pratiqués ?",
                "Comment puis-je annuler une réservation ?",
                "Comment payer avec MVola ?"
            ]
        }
    
    async def get_ai_response(
        self,
        message: str,
        user_id: Optional[int] = None,
        conversation_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Obtenir une réponse via OpenRouter"""
        try:
            system_prompt = """Tu es l'assistant virtuel de Mada Bien-être, une plateforme de massage à domicile.
            Tu dois être professionnel, amical et serviable. Réponds en français.
            Informations sur la plateforme:
            - Massage à domicile avec des thérapeutes vérifiés
            - Paiement via MVola, Orange Money, Airtel Money, carte bancaire
            - Prix négociables (modèle InDrive)
            - Bouton SOS pour la sécurité
            - Géolocalisation en temps réel
            - IA pour recommander les meilleurs thérapeutes"""
            
            if context:
                system_prompt += f"\nContexte utilisateur: {json.dumps(context)}"
            
            response = openai.chat.completions.create(
                model=settings.OPENROUTER_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message}
                ],
                temperature=0.7,
                max_tokens=300
            )
            
            ai_response = response.choices[0].message.content
            
            return {
                "response": ai_response,
                "conversation_id": conversation_id or "ai_chat",
                "intent": "ai_response",
                "confidence": 0.85,
                "suggestions": [
                    "Je souhaite réserver un massage",
                    "Quels sont les tarifs ?",
                    "Je veux en savoir plus sur les thérapeutes"
                ]
            }
        except Exception as e:
            print(f"AI response error: {e}")
            return {
                "response": "Je suis désolé, une erreur s'est produite. "
                             "Veuillez réessayer ou contacter notre support.",
                "conversation_id": conversation_id or "error",
                "intent": "error",
                "confidence": 0.0,
                "suggestions": [
                    "Réessayer",
                    "Contacter le support"
                ]
            }
    
    def handle_price_question(self, message: str, context: Optional[Dict] = None) -> Dict:
        return {
            "response": "Les prix varient selon le type de massage et la durée. "
                        "Voici une estimation :\n"
                        "• Massage Relaxant : 25 000 - 35 000 Ar\n"
                        "• Massage Thérapeutique : 35 000 - 60 000 Ar\n"
                        "• Massage Sportif : 40 000 - 70 000 Ar\n"
                        "• Réflexologie : 30 000 - 45 000 Ar\n"
                        "• Massage Prénatal : 40 000 - 65 000 Ar\n"
                        "• Pierres Chaudes : 50 000 - 80 000 Ar\n\n"
                        "Prix négociables avec les thérapeutes !",
            "conversation_id": "faq_price",
            "intent": "price",
            "confidence": 0.95,
            "suggestions": [
                "Je veux réserver un massage relaxant",
                "Quel est le prix minimum ?"
            ]
        }
    
    def handle_cancellation_question(self, message: str, context: Optional[Dict] = None) -> Dict:
        return {
            "response": "Vous pouvez annuler une réservation gratuitement "
                        "jusqu'à 2 heures avant le rendez-vous.\n"
                        "Pour annuler :\n"
                        "1. Allez dans vos réservations\n"
                        "2. Sélectionnez la réservation\n"
                        "3. Cliquez sur 'Annuler'\n\n"
                        "En cas d'urgence, utilisez le bouton SOS.",
            "conversation_id": "faq_cancellation",
            "intent": "cancellation",
            "confidence": 0.95,
            "suggestions": [
                "Annuler ma réservation",
                "Comment modifier un rendez-vous ?"
            ]
        }
    
    def handle_payment_question(self, message: str, context: Optional[Dict] = None) -> Dict:
        return {
            "response": "Nous acceptons plusieurs modes de paiement :\n"
                        "• MVola, Orange Money, Airtel Money\n"
                        "• Cartes bancaires (Visa, Mastercard)\n"
                        "• Vanila Pay (paiement sécurisé)\n"
                        "• Espèces (au thérapeute)\n\n"
                        "Tous les paiements sont sécurisés.",
            "conversation_id": "faq_payment",
            "intent": "payment",
            "confidence": 0.95,
            "suggestions": [
                "Payer avec MVola",
                "Comment fonctionne Vanila Pay ?"
            ]
        }
    
    def handle_security_question(self, message: str, context: Optional[Dict] = None) -> Dict:
        return {
            "response": "Votre sécurité est notre priorité :\n"
                        "• Tous les thérapeutes sont vérifiés (CIN, certificats)\n"
                        "• Bouton SOS disponible en un clic\n"
                        "• Géolocalisation en temps réel\n"
                        "• Évaluations et avis des utilisateurs\n"
                        "• Support disponible 24/7\n\n"
                        "En cas d'urgence, utilisez le bouton SOS.",
            "conversation_id": "faq_security",
            "intent": "security",
            "confidence": 0.95,
            "suggestions": [
                "Comment activer le bouton SOS ?",
                "Les thérapeutes sont-ils fiables ?"
            ]
        }
    
    def handle_availability_question(self, message: str, context: Optional[Dict] = None) -> Dict:
        return {
            "response": "Les thérapeutes disponibles sont affichés en temps réel sur la carte.\n"
                        "Pour voir les disponibilités :\n"
                        "1. Créez une demande de massage\n"
                        "2. Les thérapeutes à proximité vous répondront\n"
                        "3. Choisissez celui qui vous convient\n\n"
                        "Vous pouvez aussi consulter les disponibilités des thérapeutes "
                        "sur leur profil.",
            "conversation_id": "faq_availability",
            "intent": "availability",
            "confidence": 0.95,
            "suggestions": [
                "Voir les thérapeutes disponibles",
                "Thérapeutes près de chez moi"
            ]
        }
    
    def handle_registration_question(self, message: str, context: Optional[Dict] = None) -> Dict:
        return {
            "response": "L'inscription est simple et gratuite :\n"
                        "1. Téléchargez l'application Mada Bien-être\n"
                        "2. Cliquez sur 'S'inscrire'\n"
                        "3. Remplissez vos informations\n"
                        "4. Vérifiez votre email avec le code OTP\n"
                        "5. Vous êtes prêt à réserver !\n\n"
                        "Si vous êtes thérapeute, vous pouvez postuler "
                        "dans votre espace professionnel.",
            "conversation_id": "faq_registration",
            "intent": "registration",
            "confidence": 0.95,
            "suggestions": [
                "Comment devenir thérapeute ?",
                "J'ai un problème avec mon inscription"
            ]
        }
    
    def handle_massage_question(self, message: str, context: Optional[Dict] = None) -> Dict:
        return {
            "response": "Nous proposons plusieurs types de massage :\n"
                        "• 🧘 Massage Relaxant (Suédois) - Pour se détendre\n"
                        "• 💪 Massage Thérapeutique - Pour les tensions\n"
                        "• 🏃 Massage Sportif - Préparation et récupération\n"
                        "• 🦶 Réflexologie - Massage des pieds\n"
                        "• 🤰 Massage Prénatal - Pour les femmes enceintes\n"
                        "• 🔥 Pierres Chaudes - Relaxation profonde\n"
                        "• 🇯🇵 Shiatsu - Massage japonais\n\n"
                        "Chaque massage a des bienfaits spécifiques. "
                        "N'hésitez pas à me demander des détails !",
            "conversation_id": "faq_massage",
            "intent": "massage",
            "confidence": 0.95,
            "suggestions": [
                "Quel massage pour mal au dos ?",
                "Différence entre relaxant et thérapeutique ?"
            ]
        }
    
    def handle_therapist_question(self, message: str, context: Optional[Dict] = None) -> Dict:
        return {
            "response": "Nos thérapeutes sont :\n"
                        "• ✅ Vérifiés (CIN, diplômes, certificats)\n"
                        "• ⭐ Évalués par les clients\n"
                        "• 📍 Géolocalisés en temps réel\n"
                        "• 👨‍⚕️ Professionnels expérimentés\n\n"
                        "Pour devenir thérapeute :\n"
                        "1. Inscrivez-vous dans l'application\n"
                        "2. Postulez avec vos documents\n"
                        "3. Attendez la validation administrateur\n"
                        "4. Commencez à recevoir des demandes !",
            "conversation_id": "faq_therapist",
            "intent": "therapist",
            "confidence": 0.95,
            "suggestions": [
                "Comment devenir thérapeute ?",
                "Voir les thérapeutes disponibles"
            ]
        }

async def get_chatbot_response(
    message: str,
    user_id: Optional[int] = None,
    conversation_id: Optional[str] = None,
    db = None
) -> Dict[str, Any]:
    chatbot = ChatbotService()
    return await chatbot.get_response(message, user_id, conversation_id)