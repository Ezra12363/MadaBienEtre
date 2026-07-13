from typing import Optional, Dict, Any, List
import json
import requests
import logging
from ..core.config import settings

logger = logging.getLogger(__name__)

class PushNotificationService:
    """Service de notifications push avec Expo et Firebase"""
    
    def __init__(self):
        self.expo_api_url = "https://exp.host/--/api/v2/push/send"
        self.fcm_api_url = "https://fcm.googleapis.com/fcm/send"
        
        # Stockage des tokens par utilisateur (à remplacer par une base de données)
        self.user_tokens: Dict[int, List[str]] = {}
    
    def register_token(self, user_id: int, token: str, platform: str = "expo") -> bool:
        """Enregistrer un token de notification push"""
        if user_id not in self.user_tokens:
            self.user_tokens[user_id] = []
        
        if token not in self.user_tokens[user_id]:
            self.user_tokens[user_id].append(token)
            logger.info(f"Token registered for user {user_id}: {token[:10]}...")
            return True
        return False
    
    def unregister_token(self, user_id: int, token: str) -> bool:
        """Supprimer un token de notification push"""
        if user_id in self.user_tokens and token in self.user_tokens[user_id]:
            self.user_tokens[user_id].remove(token)
            logger.info(f"Token unregistered for user {user_id}: {token[:10]}...")
            return True
        return False
    
    def get_user_tokens(self, user_id: int) -> List[str]:
        """Obtenir les tokens d'un utilisateur"""
        return self.user_tokens.get(user_id, [])
    
    async def send_expo_push(
        self,
        token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        sound: str = "default",
        priority: str = "high"
    ) -> bool:
        """Envoyer une notification push via Expo"""
        try:
            message = {
                "to": token,
                "sound": sound,
                "priority": priority,
                "title": title,
                "body": body,
                "data": data or {}
            }
            
            response = requests.post(
                self.expo_api_url,
                json=message,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("data", {}).get("status") == "ok":
                    logger.info(f"Expo push sent to {token[:10]}...")
                    return True
                else:
                    logger.error(f"Expo push failed: {result}")
                    return False
            else:
                logger.error(f"Expo push HTTP error: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Expo push error: {e}")
            return False
    
    async def send_fcm_push(
        self,
        token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Envoyer une notification push via Firebase Cloud Messaging"""
        try:
            message = {
                "to": token,
                "notification": {
                    "title": title,
                    "body": body
                },
                "data": data or {}
            }
            
            response = requests.post(
                self.fcm_api_url,
                json=message,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"key={settings.FCM_SERVER_KEY}"
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success", 0) > 0:
                    logger.info(f"FCM push sent to {token[:10]}...")
                    return True
                else:
                    logger.error(f"FCM push failed: {result}")
                    return False
            else:
                logger.error(f"FCM push HTTP error: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"FCM push error: {e}")
            return False
    
    async def send_to_user(
        self,
        user_id: int,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        platform: str = "expo"
    ) -> int:
        """Envoyer une notification push à un utilisateur"""
        tokens = self.get_user_tokens(user_id)
        if not tokens:
            logger.warning(f"No push tokens for user {user_id}")
            return 0
        
        sent_count = 0
        for token in tokens:
            if platform == "expo":
                success = await self.send_expo_push(token, title, body, data)
            else:
                success = await self.send_fcm_push(token, title, body, data)
            
            if success:
                sent_count += 1
        
        return sent_count
    
    async def send_to_multiple_users(
        self,
        user_ids: List[int],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[int, int]:
        """Envoyer une notification push à plusieurs utilisateurs"""
        results = {}
        for user_id in user_ids:
            count = await self.send_to_user(user_id, title, body, data)
            results[user_id] = count
        return results
    
    async def send_broadcast(
        self,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None
    ) -> int:
        """Envoyer une notification push à tous les utilisateurs"""
        total_sent = 0
        for user_id in list(self.user_tokens.keys()):
            count = await self.send_to_user(user_id, title, body, data)
            total_sent += count
        return total_sent

# Instance globale
push_service = PushNotificationService()