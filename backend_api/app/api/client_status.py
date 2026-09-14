# ============================================================
# app/api/client_status.py
# ============================================================
#
# Gestion du statut En ligne / Hors ligne du CLIENT.
#
# Utilise la colonne existante :
#     users.is_online
#
# Aucune nouvelle table.
# Aucune nouvelle colonne.
# Aucun changement dans config.py ou database.py.
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User

from app.schemas.user_online_status import (
    ClientOnlineStatusUpdate,
    ClientOnlineStatusResponse,
)

# ------------------------------------------------------------
# IMPORTANT :
# get_current_user ne se trouve pas dans app.core.security.py
# d'après l'erreur affichée.
#
# Ici, on suppose qu'il se trouve dans app.api.auth.py.
# ------------------------------------------------------------
from app.api.auth import get_current_user


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/client",
    tags=["Client - Statut en ligne"],
)


# ============================================================
# VERIFICATION DU CLIENT
# ============================================================

def verify_client(current_user: User) -> User:
    """
    Vérifie que l'utilisateur connecté est bien un client.

    Le statut du thérapeute ne sera jamais modifié par ce router.
    """

    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur non authentifié",
        )

    # Récupération du rôle de manière sécurisée
    user_role = getattr(current_user, "role", None)

    if user_role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Le rôle de l'utilisateur est introuvable",
        )

    # Conversion en majuscules :
    # CLIENT, client, Client seront acceptés
    role = str(user_role).upper()

    # Selon ton modèle, le rôle peut être CLIENT ou USER.
    # Si ton projet utilise uniquement CLIENT, tu peux retirer USER.
    if role not in ["CLIENT", "USER"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul un client peut modifier son statut en ligne",
        )

    # Vérification du compte actif si cette colonne existe
    if hasattr(current_user, "is_active"):
        if current_user.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Votre compte est désactivé",
            )

    return current_user


# ============================================================
# GET : CONSULTER SON STATUT
# ============================================================

@router.get(
    "/me/online-status",
    response_model=ClientOnlineStatusResponse,
    summary="Consulter le statut en ligne du client",
)
def get_my_online_status(
    current_user: User = Depends(get_current_user),
):
    """
    Retourne le statut du client connecté.

    True  = En ligne
    False = Hors ligne
    """

    client = verify_client(current_user)

    # Utilisation de la colonne existante users.is_online
    is_online = bool(client.is_online)

    if is_online:
        message = "Vous êtes actuellement En ligne"
    else:
        message = "Vous êtes actuellement Hors ligne"

    return ClientOnlineStatusResponse(
        success=True,
        is_online=is_online,
        message=message,
    )


# ============================================================
# PUT : MODIFIER SON STATUT
# ============================================================

@router.put(
    "/me/online-status",
    response_model=ClientOnlineStatusResponse,
    summary="Modifier le statut en ligne du client",
)
def update_my_online_status(
    payload: ClientOnlineStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Permet au client de choisir son statut.

    Body JSON :

    {
        "is_online": true
    }

    ou :

    {
        "is_online": false
    }
    """

    client = verify_client(current_user)

    try:
        # Mise à jour de la colonne déjà existante
        client.is_online = bool(payload.is_online)

        db.add(client)
        db.commit()
        db.refresh(client)

        is_online = bool(client.is_online)

        if is_online:
            message = "Votre statut est maintenant En ligne"
        else:
            message = "Votre statut est maintenant Hors ligne"

        return ClientOnlineStatusResponse(
            success=True,
            is_online=is_online,
            message=message,
        )

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la modification du statut en ligne",
        )


# ============================================================
# PUT : BASCULER LE STATUT
# ============================================================

@router.put(
    "/me/toggle-online",
    response_model=ClientOnlineStatusResponse,
    summary="Basculer le statut En ligne / Hors ligne",
)
def toggle_my_online_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Inverse le statut actuel du client.

    En ligne  -> Hors ligne
    Hors ligne -> En ligne
    """

    client = verify_client(current_user)

    try:
        # Inversion du statut existant
        client.is_online = not bool(client.is_online)

        db.add(client)
        db.commit()
        db.refresh(client)

        is_online = bool(client.is_online)

        if is_online:
            message = "Votre statut est maintenant En ligne"
        else:
            message = "Votre statut est maintenant Hors ligne"

        return ClientOnlineStatusResponse(
            success=True,
            is_online=is_online,
            message=message,
        )

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors du changement de statut en ligne",
        )