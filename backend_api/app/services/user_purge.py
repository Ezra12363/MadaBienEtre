# app/services/user_purge.py
"""
Suppression DÉFINITIVE d'un utilisateur, sans erreur de clé étrangère.

Le schéma contient de nombreuses tables liées à `users` (réservations, paiements, notifications,
jetons push, avis, alertes SOS, disponibilités, portefeuille...). Plutôt que de les lister à la main
(et d'en oublier), on parcourt les métadonnées SQLAlchemy :

  - colonne liée NULLABLE      -> mise à NULL (ex. réservation sans thérapeute, modérateur d'un avis)
  - colonne liée NON NULLABLE  -> les lignes sont supprimées, après avoir traité récursivement
                                  leurs propres dépendances (ex. client -> réservations -> paiements)

Tout se passe dans la transaction de l'appelant (commit / rollback fait par lui).
"""
import logging
from typing import List

from sqlalchemy import delete, select, update

from ..core.database import Base

logger = logging.getLogger(__name__)


def _children(table):
    """(table_enfant, colonne_enfant, colonne_référencée) pour chaque clé étrangère vers `table`."""
    out = []
    for t in Base.metadata.tables.values():
        for fk in t.foreign_keys:
            if fk.column.table is table:
                out.append((t, fk.parent, fk.column))
    return out


def _purge(db, table, cond, stack: frozenset) -> None:
    stack = stack | {table.name}
    for child, col, ref in _children(table):
        sub = select(ref).where(cond)
        if child.name in stack:
            # auto-référence / cycle : on ne peut que détacher
            if col.nullable and not col.primary_key:
                db.execute(update(child).where(col.in_(sub)).values({col: None}))
            continue
        if col.nullable and not col.primary_key:
            db.execute(update(child).where(col.in_(sub)).values({col: None}))
        else:
            _purge(db, child, col.in_(sub), stack)
    db.execute(delete(table).where(cond))


def purge_user(db, user) -> List[str]:
    """Supprime l'utilisateur et toutes ses données liées. Retourne les chemins des PDF de
    certificats à effacer du disque APRÈS le commit. Ne commit pas."""
    from ..models.therapist_certificate import TherapistCertificate
    from ..models.user import User

    paths = [
        c.certificate_path
        for c in db.query(TherapistCertificate).filter(TherapistCertificate.therapist_id == user.id).all()
        if c.certificate_path
    ]
    users_table = User.__table__
    user_id = user.id
    db.expunge(user)  # évite que l'ORM tente de re-mettre à NULL / re-supprimer
    _purge(db, users_table, users_table.c.id == user_id, frozenset())
    return paths


def remove_certificate_files(paths: List[str], base_dir) -> None:
    import os

    for rel in paths:
        try:
            fp = base_dir / rel
            if fp.is_file():
                os.remove(fp)
        except Exception as e:  # noqa: BLE001
            logger.warning("Fichier certificat non supprimé '%s' : %s", rel, e)
