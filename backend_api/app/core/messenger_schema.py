# app/core/messenger_schema.py
# ============================================================================
# MISE À NIVEAU DU SCHÉMA de la messagerie — SANS dépendre d'Alembic.
#
# La messagerie complète CONTINUE le chat existant : elle étend `chat_messages`
# (conversation_id, reply_to_id, fichier, sticker, épingle...) et
# `messenger_conversations` (booking_id). `create_all()` ne modifie jamais une
# table existante ; sans cette mise à niveau l'API répond :
#   « la colonne chat_messages.conversation_id n'existe pas ».
#
# `upgrade_schema()` est IDEMPOTENTE (on peut l'exécuter autant de fois qu'on
# veut) et est utilisée par :
#   1. le démarrage de l'API  (main.py -> ensure_messenger_schema)
#   2. la première requête /messenger ou /ws/messenger (filet de sécurité)
#   3. la migration Alembic d5e9f3a1b8c2
#   4. le script manuel :  python fix_messenger_schema.py
# Désactivable : MESSENGER_AUTO_MIGRATE=false
# ============================================================================
import json
import logging
import os
import threading

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from .database import engine

logger = logging.getLogger(__name__)

# (nom, définition SQL) — colonnes ajoutées à chat_messages
CHAT_MESSAGE_COLUMNS = [
    ("conversation_id", "INTEGER"),
    ("reply_to_id", "INTEGER"),
    ("is_forwarded", "BOOLEAN NOT NULL DEFAULT false"),
    ("forwarded_from_name", "VARCHAR(100)"),
    ("allow_reply", "BOOLEAN NOT NULL DEFAULT true"),
    ("file_name", "VARCHAR(255)"),
    ("file_key", "VARCHAR(80)"),
    ("file_mime", "VARCHAR(100)"),
    ("file_size", "INTEGER"),
    ("duration_seconds", "INTEGER"),
    ("sticker_id", "VARCHAR(40)"),
    ("call_id", "INTEGER"),
    ("is_pinned", "BOOLEAN NOT NULL DEFAULT false"),
    ("pinned_at", "TIMESTAMP"),
    ("pinned_by_id", "INTEGER"),
    ("edited_at", "TIMESTAMP"),
    ("deleted_by_id", "INTEGER"),
]

_lock = threading.Lock()
_checked = False


def _cols(conn, table):
    return {c["name"] for c in inspect(conn).get_columns(table)}


def schema_is_outdated(conn=None) -> bool:
    own = conn is None
    conn = conn or engine.connect()
    try:
        insp = inspect(conn)
        tables = set(insp.get_table_names())
        if "chat_messages" not in tables:
            return False
        if "conversation_id" not in {c["name"] for c in insp.get_columns("chat_messages")}:
            return True
        if "messenger_conversations" not in tables:
            return True
        if "booking_id" not in {c["name"] for c in insp.get_columns("messenger_conversations")}:
            return True
        # ancienne table de messages parallèle (v1) encore présente
        return "messenger_messages" in tables
    finally:
        if own:
            conn.close()


def upgrade_schema(conn) -> None:
    """Met le schéma à niveau (PostgreSQL). `conn` = Connection SQLAlchemy dans une transaction."""
    from app.models.messenger import MESSENGER_TABLES  # import tardif

    if conn.dialect.name != "postgresql":
        logger.info("Messagerie : mise à niveau automatique réservée à PostgreSQL (ignorée)")
        return

    tables = set(inspect(conn).get_table_names())
    if "chat_messages" not in tables:
        return

    # 1) messenger_conversations : création, ou ajout de booking_id
    if "messenger_conversations" not in tables:
        MESSENGER_TABLES[0].create(conn, checkfirst=True)
    elif "booking_id" not in _cols(conn, "messenger_conversations"):
        conn.execute(text("ALTER TABLE messenger_conversations ADD COLUMN IF NOT EXISTS booking_id INTEGER"))
        fks = {fk["name"] for fk in inspect(conn).get_foreign_keys("messenger_conversations")}
        if "fk_messenger_conv_booking" not in fks:
            conn.execute(text(
                "ALTER TABLE messenger_conversations ADD CONSTRAINT fk_messenger_conv_booking "
                "FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE"))
        uqs = {u["name"] for u in inspect(conn).get_unique_constraints("messenger_conversations")}
        if "uq_messenger_conv_booking" not in uqs:
            conn.execute(text(
                "ALTER TABLE messenger_conversations ADD CONSTRAINT uq_messenger_conv_booking UNIQUE (booking_id)"))

    # 2) chat_messages : nouvelles colonnes, booking_id facultatif, clés et index
    for name, ddl in CHAT_MESSAGE_COLUMNS:
        conn.execute(text(f"ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS {name} {ddl}"))
    conn.execute(text("ALTER TABLE chat_messages ALTER COLUMN booking_id DROP NOT NULL"))
    fks = {fk["name"] for fk in inspect(conn).get_foreign_keys("chat_messages")}
    if "fk_chat_messages_conversation" not in fks:
        conn.execute(text(
            "ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_conversation "
            "FOREIGN KEY (conversation_id) REFERENCES messenger_conversations(id) ON DELETE CASCADE"))
    if "fk_chat_messages_reply" not in fks:
        conn.execute(text(
            "ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_reply "
            "FOREIGN KEY (reply_to_id) REFERENCES chat_messages(id) ON DELETE SET NULL"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_chat_messages_conversation_id ON chat_messages (conversation_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_chat_messages_conv_id ON chat_messages (conversation_id, id)"))

    # 3) reprise de l'ancienne table parallèle `messenger_messages` (v1 de la messagerie)
    id_map, old_reactions, old_hidden = {}, [], []
    if "messenger_messages" in tables:
        rows = conn.execute(text(
            "SELECT id, conversation_id, sender_id, message_type, content, client_id, reply_to_id, "
            "is_forwarded, forwarded_from_name, allow_reply, file_name, file_key, file_mime, file_size, "
            "duration_seconds, sticker_id, latitude, longitude, address, call_id, is_pinned, pinned_at, "
            "pinned_by_id, edited_at, deleted_at, deleted_by_id, created_at "
            "FROM messenger_messages ORDER BY id"
        )).mappings().all()
        reply_pairs = []
        for r in rows:
            if r["sender_id"] is None:
                continue
            content, mtype = r["content"] or "", r["message_type"]
            if mtype == "location" and r["latitude"] is not None:
                content = "[[loc]]" + json.dumps(
                    {"lat": r["latitude"], "lng": r["longitude"], "address": r["address"], "type": "live"},
                    ensure_ascii=False, separators=(",", ":"))
                mtype = "text"
            new_id = conn.execute(text(
                "INSERT INTO chat_messages (booking_id, conversation_id, sender_id, message_type, content, "
                "client_id, is_read, is_forwarded, forwarded_from_name, allow_reply, file_name, file_key, "
                "file_mime, file_size, duration_seconds, sticker_id, call_id, is_pinned, pinned_at, "
                "pinned_by_id, edited_at, deleted_at, deleted_by_id, created_at) VALUES "
                "(NULL, :conv, :sender, :mtype, :content, :client_id, false, :fwd, :fwd_name, :allow, :fname, "
                ":fkey, :fmime, :fsize, :dur, :sticker, :call, :pinned, :pinned_at, :pinned_by, :edited, "
                ":deleted, :deleted_by, :created) RETURNING id"
            ), {
                "conv": r["conversation_id"], "sender": r["sender_id"], "mtype": mtype, "content": content,
                "client_id": r["client_id"], "fwd": r["is_forwarded"], "fwd_name": r["forwarded_from_name"],
                "allow": r["allow_reply"], "fname": r["file_name"], "fkey": r["file_key"], "fmime": r["file_mime"],
                "fsize": r["file_size"], "dur": r["duration_seconds"], "sticker": r["sticker_id"],
                "call": r["call_id"], "pinned": r["is_pinned"], "pinned_at": r["pinned_at"],
                "pinned_by": r["pinned_by_id"], "edited": r["edited_at"], "deleted": r["deleted_at"],
                "deleted_by": r["deleted_by_id"], "created": r["created_at"],
            }).scalar()
            id_map[r["id"]] = new_id
            if r["reply_to_id"]:
                reply_pairs.append((new_id, r["reply_to_id"]))
        for new_id, old_reply in reply_pairs:
            if old_reply in id_map:
                conn.execute(text("UPDATE chat_messages SET reply_to_id = :r WHERE id = :i"),
                             {"r": id_map[old_reply], "i": new_id})
        if "messenger_reactions" in tables:
            old_reactions = conn.execute(text(
                "SELECT message_id, user_id, emoji, created_at FROM messenger_reactions")).all()
            conn.execute(text("DROP TABLE messenger_reactions"))
        if "messenger_hidden" in tables:
            old_hidden = conn.execute(text("SELECT message_id, user_id FROM messenger_hidden")).all()
            conn.execute(text("DROP TABLE messenger_hidden"))
        conn.execute(text("DROP TABLE messenger_messages"))
        for (conv_id,) in conn.execute(text("SELECT id FROM messenger_conversations")).all():
            last = conn.execute(text(
                "SELECT id, created_at FROM chat_messages WHERE conversation_id = :c ORDER BY id DESC LIMIT 1"
            ), {"c": conv_id}).first()
            if last:
                conn.execute(text(
                    "UPDATE messenger_conversations SET last_message_id=:m, last_message_at=:t WHERE id=:c"),
                    {"m": last[0], "t": last[1], "c": conv_id})
        # pointeurs lu / livré : alignés sur le dernier message copié (historique v1 considéré comme lu)
        conn.execute(text(
            "UPDATE messenger_members m SET last_read_message_id = COALESCE(c.last_message_id, 0), "
            "last_delivered_message_id = COALESCE(c.last_message_id, 0), hidden_before_id = 0 "
            "FROM messenger_conversations c WHERE c.id = m.conversation_id AND c.booking_id IS NULL"))

    # 4) tables annexes (réactions, « supprimer pour moi », appels, blocages...) si absentes
    for table in MESSENGER_TABLES:
        table.create(conn, checkfirst=True)
    for old_id, user_id, emoji, created_at in old_reactions:
        if old_id in id_map:
            conn.execute(text("INSERT INTO messenger_reactions (message_id, user_id, emoji, created_at) "
                              "VALUES (:m, :u, :e, :t)"),
                         {"m": id_map[old_id], "u": user_id, "e": emoji, "t": created_at})
    for old_id, user_id in old_hidden:
        if old_id in id_map:
            conn.execute(text("INSERT INTO messenger_hidden (message_id, user_id) VALUES (:m, :u)"),
                         {"m": id_map[old_id], "u": user_id})

    # 5) chaque réservation qui a déjà des messages devient une conversation « booking »
    from app.models.booking import Booking
    from app.models.chat_message import ChatMessage
    from app.services.messenger_service import ensure_booking_conversation

    session = Session(bind=conn)
    try:
        booking_ids = [r[0] for r in session.query(ChatMessage.booking_id).filter(
            ChatMessage.booking_id.isnot(None), ChatMessage.conversation_id.is_(None)).distinct().all()]
        for bid in booking_ids:
            booking = session.query(Booking).filter(Booking.id == bid).first()
            if booking is not None:
                ensure_booking_conversation(session, booking)
        session.flush()
    finally:
        session.close()


def ensure_messenger_schema(force: bool = False) -> bool:
    """Vérifie puis met à niveau le schéma si nécessaire. Retourne True si la base est à jour."""
    global _checked
    with _lock:
        if _checked and not force:
            return True
        if os.getenv("MESSENGER_AUTO_MIGRATE", "true").lower() in ("0", "false", "no"):
            _checked = True
            return True
        try:
            if not schema_is_outdated():
                _checked = True
                return True
            logger.warning("Messagerie : schéma de base obsolète → mise à niveau automatique…")
            with engine.begin() as conn:
                upgrade_schema(conn)
            if schema_is_outdated():
                logger.error("Messagerie : la mise à niveau n'a pas suffi (voir fix_messenger_schema.py)")
                return False
            logger.info("Messagerie : schéma mis à niveau avec succès")
            _checked = True
            return True
        except Exception:  # noqa: BLE001
            logger.exception(
                "Messagerie : mise à niveau automatique impossible. Lancez : "
                "cd backend_api && python fix_messenger_schema.py"
            )
            return False
