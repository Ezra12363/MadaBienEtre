"""Mise à niveau manuelle du schéma de la messagerie (idempotent).

    cd backend_api
    python fix_messenger_schema.py

Ajoute les colonnes manquantes de `chat_messages` / `messenger_conversations`,
rattache les anciens chats de réservation à des conversations, et reprend
l'ancienne table `messenger_messages` si elle existe. Ne perd aucun message.
"""
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

from app.core.database import engine  # noqa: E402
from app.core.messenger_schema import schema_is_outdated, upgrade_schema  # noqa: E402

if __name__ == "__main__":
    print("Schéma obsolète avant :", schema_is_outdated())
    with engine.begin() as conn:
        upgrade_schema(conn)
    print("Schéma obsolète après  :", schema_is_outdated())
    print("OK ✅  — relancez le backend.")
