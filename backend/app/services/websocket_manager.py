# app/services/websocket_manager.py
from fastapi import WebSocket
from typing import Dict, Set, Optional, Any, List
import json
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class WebSocketManager:
    """Gestionnaire de connexions WebSocket"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.rooms: Dict[str, Set[str]] = {}
        self.user_connections: Dict[int, str] = {}
        self.connection_data: Dict[str, Dict[str, Any]] = {}
    
    async def connect(self, websocket: WebSocket) -> str:
        """Connecter un nouveau client WebSocket"""
        await websocket.accept()
        connection_id = str(id(websocket))
        self.active_connections[connection_id] = websocket
        self.connection_data[connection_id] = {
            "connected_at": datetime.utcnow().isoformat(),
            "last_activity": datetime.utcnow().isoformat()
        }
        logger.info(f"WebSocket connected: {connection_id}")
        return connection_id
    
    async def disconnect(self, websocket: WebSocket) -> None:
        """Déconnecter un client WebSocket"""
        connection_id = str(id(websocket))
        
        # Supprimer des rooms
        for room_id, connections in list(self.rooms.items()):
            if connection_id in connections:
                connections.remove(connection_id)
                if not connections:
                    del self.rooms[room_id]
        
        # Supprimer de la liste des connexions actives
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        
        # Supprimer de user_connections
        for user_id, conn_id in list(self.user_connections.items()):
            if conn_id == connection_id:
                del self.user_connections[user_id]
        
        if connection_id in self.connection_data:
            del self.connection_data[connection_id]
        
        logger.info(f"WebSocket disconnected: {connection_id}")
    
    async def send_message(self, connection_id: str, message: Dict[str, Any]) -> bool:
        """Envoyer un message à un client spécifique"""
        if connection_id in self.active_connections:
            try:
                await self.active_connections[connection_id].send_json(message)
                return True
            except Exception as e:
                logger.error(f"Error sending message to {connection_id}: {e}")
                return False
        return False
    
    async def send_to_user(self, user_id: int, message: Dict[str, Any]) -> bool:
        """Envoyer un message à un utilisateur spécifique"""
        if user_id in self.user_connections:
            connection_id = self.user_connections[user_id]
            return await self.send_message(connection_id, message)
        return False
    
    async def broadcast_to_room(self, room_id: str, message: Dict[str, Any], exclude: Optional[WebSocket] = None) -> int:
        """Diffuser un message à tous les clients d'une room"""
        if room_id not in self.rooms:
            return 0
        
        sent_count = 0
        exclude_id = str(id(exclude)) if exclude else None
        
        for connection_id in list(self.rooms[room_id]):
            if connection_id == exclude_id:
                continue
            if await self.send_message(connection_id, message):
                sent_count += 1
        
        return sent_count
    
    async def broadcast(self, message: Dict[str, Any]) -> int:
        """Diffuser un message à tous les clients connectés"""
        sent_count = 0
        for connection_id in list(self.active_connections.keys()):
            if await self.send_message(connection_id, message):
                sent_count += 1
        return sent_count
    
    async def join_room(self, websocket: WebSocket, room_id: str) -> None:
        """Ajouter un client à une room"""
        connection_id = str(id(websocket))
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        self.rooms[room_id].add(connection_id)
        logger.debug(f"Connection {connection_id} joined room {room_id}")
    
    async def leave_room(self, websocket: WebSocket, room_id: str) -> None:
        """Retirer un client d'une room"""
        connection_id = str(id(websocket))
        if room_id in self.rooms:
            self.rooms[room_id].discard(connection_id)
            if not self.rooms[room_id]:
                del self.rooms[room_id]
            logger.debug(f"Connection {connection_id} left room {room_id}")

# Instance globale
manager = WebSocketManager()