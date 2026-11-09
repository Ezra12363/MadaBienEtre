# app/services/messenger_hub.py
# ============================================================================
# Hub WebSocket de la messagerie : UNE connexion par appareil, qui reçoit les
# évènements de TOUTES les conversations de l'utilisateur (messages, reçus,
# saisie, présence, appels).
#
# ⚠️ État en mémoire (1 worker uvicorn). Avec plusieurs workers, remplacer
# `send_to_user` par un pub/sub Redis (même interface).
# ============================================================================
import asyncio
import logging
from collections import defaultdict
from typing import Any, Dict, Iterable, List, Optional, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class MessengerHub:
    def __init__(self) -> None:
        self._conns: Dict[int, Set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------- connexions
    async def connect(self, user_id: int, ws: WebSocket) -> bool:
        """Retourne True si c'est la PREMIÈRE connexion de l'utilisateur."""
        async with self._lock:
            first = not self._conns[user_id]
            self._conns[user_id].add(ws)
            return first

    async def disconnect(self, user_id: int, ws: WebSocket) -> bool:
        """Retourne True si c'était la DERNIÈRE connexion de l'utilisateur."""
        async with self._lock:
            conns = self._conns.get(user_id)
            if not conns:
                return False
            conns.discard(ws)
            if not conns:
                self._conns.pop(user_id, None)
                return True
            return False

    def is_online(self, user_id: int) -> bool:
        return bool(self._conns.get(user_id))

    def online_user_ids(self) -> List[int]:
        return list(self._conns.keys())

    # ---------------------------------------------------------------- envoi
    async def send_to_user(self, user_id: int, payload: Dict[str, Any]) -> int:
        dead: List[WebSocket] = []
        sent = 0
        for ws in list(self._conns.get(user_id, ())):
            try:
                await ws.send_json(payload)
                sent += 1
            except Exception:  # noqa: BLE001 - connexion déjà fermée
                dead.append(ws)
        for ws in dead:
            await self.disconnect(user_id, ws)
        return sent

    async def send_to_users(
        self,
        user_ids: Iterable[int],
        payload: Dict[str, Any],
        exclude_user_id: Optional[int] = None,
    ) -> None:
        for uid in set(user_ids):
            if exclude_user_id is not None and uid == exclude_user_id:
                continue
            if uid in self._conns:
                await self.send_to_user(uid, payload)


hub = MessengerHub()
