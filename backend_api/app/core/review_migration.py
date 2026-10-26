# app/core/review_migration.py
"""
Migration légère et IDEMPOTENTE de la table `reviews`.

Le projet utilise `Base.metadata.create_all()` : cette commande crée les
tables manquantes mais n'ajoute JAMAIS de nouvelles colonnes à une table
qui existe déjà. Comme la fonctionnalité « Avis et évaluations » ajoute des
colonnes de modération (is_hidden, hidden_reason, ...), on les ajoute ici
automatiquement au démarrage si elles manquent (aucune perte de données,
aucune action manuelle nécessaire).
"""
import logging

from sqlalchemy import inspect, text

logger = logging.getLogger(__name__)

# (nom de colonne, type SQL, valeur par défaut SQL ou None)
_REVIEW_COLUMNS = (
    ("is_hidden", "BOOLEAN", "FALSE"),
    ("hidden_reason", "TEXT", None),
    ("hidden_at", "TIMESTAMP", None),
    ("moderated_by", "INTEGER", None),
    ("edited_at", "TIMESTAMP", None),
)


def ensure_review_schema(engine) -> None:
    """Ajoute les colonnes manquantes de `reviews` (sans jamais lever d'erreur)."""
    try:
        inspector = inspect(engine)
        if "reviews" not in inspector.get_table_names():
            return  # create_all vient de la créer avec le schéma complet

        existing = {col["name"] for col in inspector.get_columns("reviews")}

        with engine.begin() as conn:
            for name, sql_type, default in _REVIEW_COLUMNS:
                if name in existing:
                    continue
                ddl = f"ALTER TABLE reviews ADD COLUMN {name} {sql_type}"
                if default is not None:
                    ddl += f" DEFAULT {default}"
                    if sql_type == "BOOLEAN":
                        ddl += " NOT NULL"
                conn.execute(text(ddl))
                logger.info("Migration reviews : colonne '%s' ajoutée", name)

            # Les anciens avis n'ont jamais été modérés
            if "is_hidden" in {c for c, _, _ in _REVIEW_COLUMNS}:
                conn.execute(
                    text("UPDATE reviews SET is_hidden = FALSE WHERE is_hidden IS NULL")
                )
    except Exception:  # noqa: BLE001
        logger.exception("Migration de la table reviews impossible (ignorée)")
