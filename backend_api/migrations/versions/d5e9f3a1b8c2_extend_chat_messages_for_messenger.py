"""extend chat_messages for the full messenger (no parallel message table)

Revision ID: d5e9f3a1b8c2
Revises: c4d8e1f2a9b7
Create Date: 2026-11-08 20:00:00.000000

La messagerie complète CONTINUE le chat existant :
  * `chat_messages` reçoit les colonnes nécessaires (réponse, transfert, fichier,
    sticker, épingle, modification...) et `booking_id` devient facultatif ;
  * chaque réservation qui a déjà des messages devient une conversation de type
    « booking » (les anciens messages sont rattachés, rien n'est perdu) ;
  * si la première version de la messagerie avait créé `messenger_messages`, ses
    messages (et réactions) sont COPIÉS dans `chat_messages`, puis cette table
    parallèle est supprimée.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

revision: str = "d5e9f3a1b8c2"
down_revision: Union[str, None] = "c4d8e1f2a9b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_COLUMNS = [
    ("conversation_id", sa.Integer(), {}),
    ("reply_to_id", sa.Integer(), {}),
    ("is_forwarded", sa.Boolean(), {"nullable": False, "server_default": sa.false()}),
    ("forwarded_from_name", sa.String(100), {}),
    ("allow_reply", sa.Boolean(), {"nullable": False, "server_default": sa.true()}),
    ("file_name", sa.String(255), {}),
    ("file_key", sa.String(80), {}),
    ("file_mime", sa.String(100), {}),
    ("file_size", sa.Integer(), {}),
    ("duration_seconds", sa.Integer(), {}),
    ("sticker_id", sa.String(40), {}),
    ("call_id", sa.Integer(), {}),
    ("is_pinned", sa.Boolean(), {"nullable": False, "server_default": sa.false()}),
    ("pinned_at", sa.DateTime(), {}),
    ("pinned_by_id", sa.Integer(), {}),
    ("edited_at", sa.DateTime(), {}),
    ("deleted_by_id", sa.Integer(), {}),
]


def _cols(insp, table):
    return {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    # Source unique : app/core/messenger_schema.py (idempotent, aussi lancé au démarrage de l'API)
    from app.core.messenger_schema import upgrade_schema

    upgrade_schema(op.get_bind())


def downgrade() -> None:
    bind = op.get_bind()
    # Les conversations hors réservation (booking_id NULL) n'existent plus dans l'ancien schéma.
    bind.execute(text("DELETE FROM chat_messages WHERE booking_id IS NULL"))
    op.drop_index("ix_chat_messages_conv_id", table_name="chat_messages")
    for fk in ("fk_chat_messages_conversation", "fk_chat_messages_reply"):
        op.drop_constraint(fk, "chat_messages", type_="foreignkey")
    for name, _t, _kw in reversed(NEW_COLUMNS):
        op.drop_column("chat_messages", name)
    op.alter_column("chat_messages", "booking_id", existing_type=sa.Integer(), nullable=False)
