# app/services/chat_manager.py
# Gestionnaire de connexions WebSocket, une « salle » par réservation.
import asyncio
import logging
from collections import defaultdict
from typing import Any, Dict, List, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ChatConnectionManager:
    def __init__(self) -> None:
        self._rooms: Dict[int, List[tuple]] = defaultdict(list)  # booking_id -> [(ws, user_id)]
        self._lock = asyncio.Lock()

    async def connect(self, booking_id: int, user_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            self._rooms[booking_id].append((websocket, user_id))

    async def disconnect(self, booking_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            self._rooms[booking_id] = [
                item for item in self._rooms.get(booking_id, []) if item[0] is not websocket
            ]
            if not self._rooms[booking_id]:
                self._rooms.pop(booking_id, None)

    def is_user_online(self, booking_id: int, user_id: int) -> bool:
        return any(uid == user_id for _, uid in self._rooms.get(booking_id, []))

    async def broadcast(
        self,
        booking_id: int,
        payload: Dict[str, Any],
        exclude_user_id: Optional[int] = None,
    ) -> None:
        """Envoie `payload` à toute la salle (sauf `exclude_user_id` s'il est fourni)."""
        dead: List[WebSocket] = []

        for websocket, user_id in list(self._rooms.get(booking_id, [])):
            if exclude_user_id is not None and user_id == exclude_user_id:
                continue
            try:
                await websocket.send_json(payload)
            except Exception:  # connexion déjà fermée
                dead.append(websocket)

        for websocket in dead:
            await self.disconnect(booking_id, websocket)


chat_manager = ChatConnectionManager()
