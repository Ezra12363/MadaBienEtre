# app/services/push_notifications.py
"""Push Expo : tokens persistés en base (survivent aux redémarrages)."""
import asyncio
import json
import logging
import urllib.request
from typing import Any, Dict, List, Optional

from ..core.database import SessionLocal
from ..models.push_token import PushToken

logger = logging.getLogger(__name__)

EXPO_URL = "https://exp.host/--/api/v2/push/send"


def is_expo_token(token: str) -> bool:
    return isinstance(token, str) and token.startswith(("ExponentPushToken", "ExpoPushToken"))


class PushNotificationService:
    """Notifications push via Expo (tokens en base de données)."""

    # ----------------------------- tokens ---------------------------------
    def register_token(self, user_id: int, token: str, platform: str = "expo",
                       device_id: Optional[str] = None) -> bool:
        db = SessionLocal()
        try:
            row = db.query(PushToken).filter(PushToken.token == token).first()
            if row:
                # Le même téléphone peut changer de compte : on réattribue
                row.user_id = user_id
                row.platform = platform
                row.device_id = device_id or row.device_id
                row.is_active = True
            else:
                db.add(PushToken(user_id=user_id, token=token, platform=platform,
                                 device_id=device_id, is_active=True))
            db.commit()
            logger.info("Push token enregistré user=%s %s...", user_id, token[:12])
            return True
        except Exception:  # noqa: BLE001
            db.rollback()
            logger.exception("register_token a échoué")
            return False
        finally:
            db.close()

    def unregister_token(self, user_id: int, token: str) -> bool:
        db = SessionLocal()
        try:
            n = db.query(PushToken).filter(
                PushToken.user_id == user_id, PushToken.token == token
            ).delete(synchronize_session=False)
            db.commit()
            return n > 0
        except Exception:  # noqa: BLE001
            db.rollback()
            logger.exception("unregister_token a échoué")
            return False
        finally:
            db.close()

    def get_user_tokens(self, user_id: int) -> List[str]:
        db = SessionLocal()
        try:
            rows = db.query(PushToken.token).filter(
                PushToken.user_id == user_id, PushToken.is_active == True  # noqa: E712
            ).all()
            return [r[0] for r in rows if is_expo_token(r[0])]
        except Exception:  # noqa: BLE001
            logger.exception("get_user_tokens a échoué")
            return []
        finally:
            db.close()

    def _deactivate(self, tokens: List[str]) -> None:
        if not tokens:
            return
        db = SessionLocal()
        try:
            db.query(PushToken).filter(PushToken.token.in_(tokens)).update(
                {"is_active": False}, synchronize_session=False
            )
            db.commit()
        except Exception:  # noqa: BLE001
            db.rollback()
        finally:
            db.close()

    # ----------------------------- envoi ----------------------------------
    def send_sync(self, user_id: int, title: str, body: str,
                  data: Optional[Dict[str, Any]] = None,
                  channel_id: str = "default") -> int:
        """Envoi bloquant (à appeler dans un thread). Renvoie le nb d'envois OK."""
        tokens = self.get_user_tokens(user_id)
        if not tokens:
            logger.info("Aucun push token pour user %s", user_id)
            return 0

        messages = [{
            "to": t, "title": title, "body": body, "data": data or {},
            "sound": "default", "priority": "high", "channelId": channel_id,
        } for t in tokens]

        try:
            req = urllib.request.Request(
                EXPO_URL,
                data=json.dumps(messages).encode("utf-8"),
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                method="POST",
            )
            raw = urllib.request.urlopen(req, timeout=8).read()
            tickets = json.loads(raw).get("data", [])
        except Exception as exc:  # noqa: BLE001
            logger.warning("Expo push impossible : %r", exc)
            return 0

        ok, dead = 0, []
        for token, ticket in zip(tokens, tickets):
            if ticket.get("status") == "ok":
                ok += 1
            else:
                logger.warning("Expo ticket erreur : %s", ticket)
                if (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                    dead.append(token)
        self._deactivate(dead)
        return ok

    async def send_to_user(self, user_id: int, title: str, body: str,
                           data: Optional[Dict[str, Any]] = None,
                           platform: str = "expo", channel_id: str = "default") -> int:
        return await asyncio.to_thread(self.send_sync, user_id, title, body, data, channel_id)

    async def send_to_multiple_users(self, user_ids: List[int], title: str, body: str,
                                     data: Optional[Dict[str, Any]] = None) -> Dict[int, int]:
        return {uid: await self.send_to_user(uid, title, body, data) for uid in user_ids}

    async def send_broadcast(self, title: str, body: str,
                             data: Optional[Dict[str, Any]] = None) -> int:
        db = SessionLocal()
        try:
            ids = [r[0] for r in db.query(PushToken.user_id).filter(
                PushToken.is_active == True).distinct().all()]  # noqa: E712
        finally:
            db.close()
        total = 0
        for uid in ids:
            total += await self.send_to_user(uid, title, body, data)
        return total


push_service = PushNotificationService()
