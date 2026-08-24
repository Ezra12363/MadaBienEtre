from fastapi import WebSocket, WebSocketDisconnect
from typing import Optional, Dict, Any
import json
import logging
from datetime import datetime
from .connection_manager import manager
from ..core.dependencies import get_current_user_ws
from ..services.websocket_manager import WebSocketService

logger = logging.getLogger(__name__)

class WebSocketHandler:
    """Gestionnaire des événements WebSocket"""
    
    def __init__(self):
        self.services = WebSocketService()
    
    async def handle_connection(self, websocket: WebSocket, user_id: Optional[int] = None):
        """Gérer une connexion WebSocket"""
        connection_id = await manager.connect(websocket, user_id)
        
        try:
            # Envoyer un message de bienvenue
            await manager.send_message(connection_id, {
                "type": "connection_established",
                "connection_id": connection_id,
                "user_id": user_id,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            while True:
                # Recevoir les messages
                data = await websocket.receive_json()
                manager.update_activity(connection_id)
                
                # Traiter le message
                await self.handle_message(connection_id, data, websocket)
                
        except WebSocketDisconnect:
            await manager.disconnect(websocket)
            logger.info(f"WebSocket disconnected: {connection_id}")
        except Exception as e:
            logger.error(f"WebSocket error: {e}")
            await manager.disconnect(websocket)
    
    async def handle_message(self, connection_id: str, data: Dict[str, Any], websocket: WebSocket):
        """Traiter un message reçu"""
        message_type = data.get("type")
        
        if message_type == "ping":
            await manager.send_message(connection_id, {
                "type": "pong",
                "timestamp": datetime.utcnow().isoformat()
            })
        
        elif message_type == "join_room":
            room_id = data.get("room_id")
            if room_id:
                await manager.join_room(connection_id, room_id)
                await manager.send_message(connection_id, {
                    "type": "joined_room",
                    "room_id": room_id,
                    "timestamp": datetime.utcnow().isoformat()
                })
        
        elif message_type == "leave_room":
            room_id = data.get("room_id")
            if room_id:
                await manager.leave_room(connection_id, room_id)
                await manager.send_message(connection_id, {
                    "type": "left_room",
                    "room_id": room_id,
                    "timestamp": datetime.utcnow().isoformat()
                })
        
        elif message_type == "chat_message":
            await self.handle_chat_message(connection_id, data, websocket)
        
        elif message_type == "location_update":
            await self.handle_location_update(connection_id, data, websocket)
        
        elif message_type == "booking_update":
            await self.handle_booking_update(connection_id, data, websocket)
        
        elif message_type == "typing":
            await self.handle_typing(connection_id, data, websocket)
        
        else:
            await manager.send_message(connection_id, {
                "type": "error",
                "message": f"Unknown message type: {message_type}",
                "timestamp": datetime.utcnow().isoformat()
            })
    
    async def handle_chat_message(self, connection_id: str, data: Dict[str, Any], websocket: WebSocket):
        """Gérer un message de chat"""
        room_id = data.get("room_id")
        message = data.get("message")
        user_id = data.get("user_id")
        username = data.get("username")
        
        if not room_id or not message:
            return
        
        # Envoyer le message à tous les membres de la room
        await manager.broadcast_to_room(room_id, {
            "type": "chat_message",
            "room_id": room_id,
            "user_id": user_id,
            "username": username,
            "message": message,
            "timestamp": datetime.utcnow().isoformat()
        }, exclude=websocket)
        
        # Sauvegarder le message dans la base de données
        await self.services.save_chat_message(room_id, user_id, message)
    
    async def handle_location_update(self, connection_id: str, data: Dict[str, Any], websocket: WebSocket):
        """Gérer une mise à jour de localisation"""
        user_id = data.get("user_id")
        latitude = data.get("latitude")
        longitude = data.get("longitude")
        booking_id = data.get("booking_id")
        
        if not user_id or latitude is None or longitude is None:
            return
        
        # Mettre à jour la localisation en base de données
        await self.services.update_user_location(user_id, latitude, longitude)
        
        # Diffuser la mise à jour si c'est pour un booking
        if booking_id:
            room_id = f"tracking_{booking_id}"
            await manager.broadcast_to_room(room_id, {
                "type": "location_update",
                "user_id": user_id,
                "latitude": latitude,
                "longitude": longitude,
                "timestamp": datetime.utcnow().isoformat()
            }, exclude=websocket)
    
    async def handle_booking_update(self, connection_id: str, data: Dict[str, Any], websocket: WebSocket):
        """Gérer une mise à jour de réservation"""
        booking_id = data.get("booking_id")
        status = data.get("status")
        user_id = data.get("user_id")
        
        if not booking_id or not status:
            return
        
        # Mettre à jour le statut en base de données
        await self.services.update_booking_status(booking_id, status)
        
        # Diffuser la mise à jour
        room_id = f"booking_{booking_id}"
        await manager.broadcast_to_room(room_id, {
            "type": "booking_update",
            "booking_id": booking_id,
            "status": status,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        }, exclude=websocket)
    
    async def handle_typing(self, connection_id: str, data: Dict[str, Any], websocket: WebSocket):
        """Gérer l'indicateur de saisie"""
        room_id = data.get("room_id")
        user_id = data.get("user_id")
        is_typing = data.get("is_typing", False)
        
        if not room_id:
            return
        
        await manager.broadcast_to_room(room_id, {
            "type": "typing",
            "user_id": user_id,
            "is_typing": is_typing,
            "timestamp": datetime.utcnow().isoformat()
        }, exclude=websocket)

# Instance globale
websocket_handler = WebSocketHandler()