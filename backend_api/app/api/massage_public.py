# app/api/massage_public.py
#
# ============================================================
# ROUTE PUBLIQUE (CLIENT + THÉRAPEUTE) — TYPES DE MASSAGE
# ============================================================
#
# admin.py expose déjà GET /admin/massage-types, /admin/massage-types/{id},
# POST/PUT/DELETE — mais toutes ces routes sont protégées par
# `get_current_admin` (Depends), donc un utilisateur CLIENT ou
# THERAPIST reçoit un 403 Forbidden s'il les appelle.
#
# Ce fichier ajoute deux routes en LECTURE SEULE, accessibles à tout
# utilisateur connecté (CLIENT, THERAPIST, ADMIN), qui ne renvoient
# que les types de massage actifs (is_active = True) :
#
#   GET /massage-types             -> liste (avec filtre catégorie optionnel)
#   GET /massage-types/{type_id}   -> détail d'un type
#
# Basé sur le modèle SQLAlchemy `MassageType` (app/models/massage.py)
# et le schéma Pydantic `MassageTypeResponse` (app/schemas/massage.py)
# fournis — mêmes champs, même validation `category`, donc même forme
# de réponse JSON que côté admin (id, name, description, duration_min,
# duration_max, min_price, recommended_price, category, icon_url,
# image_url, is_active, display_order, created_at, updated_at).
#
# ⚠️ Import à vérifier : `get_current_user` est supposé exister dans
# `..core.dependencies` (à côté de `get_current_admin`, déjà utilisé
# dans admin.py) comme dépendance générique acceptant n'importe quel
# rôle connecté. Si son nom réel diffère dans votre projet
# (ex: `get_current_active_user`), remplacez-le simplement à la ligne
# d'import ci-dessous — le reste du fichier n'a pas besoin de changer.

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional, List
import logging

from ..models.massage import MassageType
from ..schemas.massage import MassageTypeResponse
from ..core.database import get_db
from ..core.dependencies import get_current_user  # ✅ à vérifier selon votre projet
from ..models.user import User

logger = logging.getLogger(__name__)

# ✅ ROUTER SANS PREFIX (même convention que admin.py)
router = APIRouter(tags=["Massage Types (Client/Thérapeute)"])

VALID_MASSAGE_CATEGORIES = {
    "relaxant",
    "therapeutique",
    "sportif",
    "reflexologie",
    "prenatal",
    "personnalise",
}


# ============================================================
# 1. LISTE DES TYPES DE MASSAGE ACTIFS
# ============================================================
@router.get("/massage-types", response_model=List[MassageTypeResponse])
async def list_massage_types_for_client_and_therapist(
    category: Optional[str] = Query(
        None,
        description="Filtrer par catégorie (relaxant, therapeutique, sportif, reflexologie, prenatal, personnalise)",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    ✅ Récupère la liste des types de massage ACTIFS uniquement.
    Accessible à tout utilisateur connecté (CLIENT, THERAPIST, ADMIN) —
    contrairement à /admin/massage-types qui exige un rôle ADMIN.

    Utilisée par :
    - SearchMassageScreen / BookingScreen / CreateBookingScreen (client)
    - tout écran thérapeute ayant besoin de la liste des types
      (ex: sélection de spécialités, filtres de demandes)
    """
    if category is not None and category not in VALID_MASSAGE_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Catégorie invalide : '{category}' "
                   f"(valeurs acceptées : {', '.join(sorted(VALID_MASSAGE_CATEGORIES))})",
        )

    query = db.query(MassageType).filter(MassageType.is_active == True)  # noqa: E712

    if category is not None:
        query = query.filter(MassageType.category == category)

    types = query.order_by(MassageType.display_order, MassageType.name).all()

    logger.info(
        "📥 [%s #%s] a consulté la liste des types de massage (%d résultats)%s",
        current_user.role,
        current_user.id,
        len(types),
        f", catégorie={category}" if category else "",
    )

    return types


# ============================================================
# 2. DÉTAIL D'UN TYPE DE MASSAGE ACTIF
# ============================================================
@router.get("/massage-types/{type_id}", response_model=MassageTypeResponse)
async def get_massage_type_for_client_and_therapist(
    type_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    ✅ Récupère le détail d'un type de massage — uniquement s'il est
    actif. Un type désactivé par l'admin renvoie 404 pour un client ou
    un thérapeute (mais reste consultable par l'admin via la route
    /admin/massage-types/{type_id}, qui elle n'a pas ce filtre).
    """
    type_obj = (
        db.query(MassageType)
        .filter(MassageType.id == type_id, MassageType.is_active == True)  # noqa: E712
        .first()
    )

    if not type_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Type de massage non trouvé",
        )

    return type_obj


# ============================================================
# À ajouter dans main.py — voir les 2 modifications exactes dans
# le message livré avec ce fichier (import + include_router, au
# même endroit que admin dans app/main.py).
#
# Aucun conflit avec /admin/massage-types : ce sont des chemins
# différents (/massage-types vs /admin/massage-types).
# ============================================================
