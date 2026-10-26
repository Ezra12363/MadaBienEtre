# app/api/cards.py
"""
Cartes bancaires enregistrées (Profil > Mode de paiement) — tous les rôles.

  GET    /cards                -> mes cartes (synchronisées avec Stripe)
  POST   /cards/setup          -> ouvre le formulaire SÉCURISÉ Stripe pour ajouter une carte
  PUT    /cards/{id}/default   -> carte par défaut
  DELETE /cards/{id}           -> supprimer la carte (aussi chez Stripe)

Aucun numéro de carte ne passe par l'application : voir services/card_service.py.
"""
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.user import User
from ..services import card_service as cards

router = APIRouter(prefix="/cards", tags=["Cards"])


class SetupBody(BaseModel):
    return_url: Optional[str] = None


@router.get("/return", response_class=HTMLResponse, include_in_schema=False)
async def stripe_return(app: Optional[str] = Query(None)):
    """Page affichée après la page Stripe (mobile) : rouvre automatiquement l'application (deep link)."""
    link = app if app and re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://[^\s<>\"']*$", app) else None
    if link and link.lower().startswith(("javascript", "data")):
        link = None
    auto = f"<script>setTimeout(function(){{window.location.href={link!r};}},300);</script>" if link else ""
    button = (
        f"<p><a href='{link}' style='display:inline-block;background:#1F6B45;color:#fff;padding:12px 22px;"
        "border-radius:12px;text-decoration:none;font-weight:700'>Retourner dans l'application</a></p>"
        if link
        else "<p>Vous pouvez fermer cette page et retourner dans l'application Mada Bien-être.</p>"
    )
    return HTMLResponse(
        "<!doctype html><html lang='fr'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'><title>Mada Bien-être</title></head>"
        "<body style='font-family:system-ui,sans-serif;text-align:center;padding:48px 24px;color:#1F6B45'>"
        f"<h2>✅ Terminé</h2>{button}{auto}</body></html>"
    )


@router.get("")
async def my_cards(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sync_error = cards.sync_cards(db, current_user)
        items = cards.list_cards(db, current_user, sync=False)
    except cards.CardError as exc:
        raise HTTPException(400, str(exc))
    return {
        "cards": items,
        "sync_error": sync_error,
        "available": cards.is_available(),
        "sandbox": bool(settings.PAYMENT_SANDBOX),
    }


@router.post("/setup")
async def setup_card(
    body: SetupBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return cards.start_setup(db, current_user, body.return_url)
    except cards.CardError as exc:
        db.rollback()
        raise HTTPException(400, str(exc))


@router.put("/{card_id}/default")
async def make_default(card_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cards.set_default(db, current_user, card_id)
    except cards.CardError as exc:
        raise HTTPException(404, str(exc))
    return {"success": True, "cards": cards.list_cards(db, current_user)}


@router.delete("/{card_id}")
async def remove_card(card_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cards.delete_card(db, current_user, card_id)
    except cards.CardError as exc:
        db.rollback()
        raise HTTPException(400, str(exc))
    return {"success": True, "cards": cards.list_cards(db, current_user)}
