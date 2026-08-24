from fastapi import WebSocket
from typing import Dict, Set, Optional, Any, List
import json
import asyncio
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Gestionnaire de connexions WebSocket"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.rooms: Dict[str, Set[str]] = {}
        self.user_connections: Dict[int, str] = {}
        self.connection_data: Dict[str, Dict[str, Any]] = {}
        self.pending_messages: Dict[str, List[Dict[str, Any]]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: Optional[int] = None) -> str:
        """Connecter un nouveau client WebSocket"""
        await websocket.accept()
        connection_id = str(id(websocket))
        self.active_connections[connection_id] = websocket
        
        if user_id:
            self.user_connections[user_id] = connection_id
            self.connection_data[connection_id] = {
                "user_id": user_id,
                "connected_at": datetime.utcnow().isoformat(),
                "last_activity": datetime.utcnow().isoformat()
            }
            
            # Envoyer les messages en attente
            if user_id in self.pending_messages:
                for msg in self.pending_messages[user_id]:
                    await self.send_message(connection_id, msg)
                del self.pending_messages[user_id]
        
        logger.info(f"WebSocket connected: {connection_id} (user: {user_id})")
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
        
        # Supprimer les données de connexion
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
        else:
            # Stocker le message en attente
            if user_id not in self.pending_messages:
                self.pending_messages[user_id] = []
            self.pending_messages[user_id].append(message)
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
    
    async def join_room(self, connection_id: str, room_id: str) -> None:
        """Ajouter un client à une room"""
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        self.rooms[room_id].add(connection_id)
        logger.debug(f"Connection {connection_id} joined room {room_id}")
    
    async def leave_room(self, connection_id: str, room_id: str) -> None:
        """Retirer un client d'une room"""
        if room_id in self.rooms:
            self.rooms[room_id].discard(connection_id)
            if not self.rooms[room_id]:
                del self.rooms[room_id]
            logger.debug(f"Connection {connection_id} left room {room_id}")
    
    def get_room_members(self, room_id: str) -> List[int]:
        """Obtenir les membres d'une room"""
        members = []
        if room_id in self.rooms:
            for connection_id in self.rooms[room_id]:
                if connection_id in self.connection_data:
                    user_id = self.connection_data[connection_id].get("user_id")
                    if user_id:
                        members.append(user_id)
        return members
    
    def get_connection_count(self) -> int:
        """Obtenir le nombre de connexions actives"""
        return len(self.active_connections)
    
    def get_user_connection_id(self, user_id: int) -> Optional[str]:
        """Obtenir l'ID de connexion d'un utilisateur"""
        return self.user_connections.get(user_id)
    
    def is_user_online(self, user_id: int) -> bool:
        """Vérifier si un utilisateur est en ligne"""
        return user_id in self.user_connections
    
    def get_connection_info(self, connection_id: str) -> Optional[Dict[str, Any]]:
        """Obtenir les informations d'une connexion"""
        return self.connection_data.get(connection_id)
    
    def update_activity(self, connection_id: str) -> None:
        """Mettre à jour la dernière activité d'une connexion"""
        if connection_id in self.connection_data:
            self.connection_data[connection_id]["last_activity"] = datetime.utcnow().isoformat()

# Instance globale
manager = ConnectionManager()