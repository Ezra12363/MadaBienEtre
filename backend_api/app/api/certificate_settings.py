# app/api/certificate_settings.py
"""Admin : paramètres du certificat thérapeute (textes, couleurs, logo, signature).

GET    /admin/certificate-settings                  -> valeurs actuelles + valeurs par défaut
PUT    /admin/certificate-settings                  -> modifie textes / couleurs
POST   /admin/certificate-settings/image/{kind}     -> téléverse « logo » ou « signature »
DELETE /admin/certificate-settings/image/{kind}     -> retour à l'image par défaut du modèle
POST   /admin/certificate-settings/reset            -> retour complet au modèle d'origine
GET    /admin/certificate-settings/preview          -> PDF d'aperçu avec les paramètres courants
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_admin
from ..models.user import User
from ..services import certificate_settings as cert_cfg
from ..services.certificate_service import build_demo_certificate_pdf

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/certificate-settings",
    tags=["Admin - Certificate settings"],
)


class CertificateSettingsUpdate(BaseModel):
    platform_name: Optional[str] = None
    platform_tagline: Optional[str] = None
    title: Optional[str] = None
    intro_text: Optional[str] = None
    legal_text: Optional[str] = None
    badge_text: Optional[str] = None
    therapist_signature_label: Optional[str] = None
    admin_signature_label: Optional[str] = None
    color_primary: Optional[str] = None
    color_accent: Optional[str] = None
    color_background: Optional[str] = None


def _bad_request(exc: Exception) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("")
async def get_certificate_settings(
    current_user: User = Depends(get_current_admin),
):
    return cert_cfg.public_view(cert_cfg.get_config(use_cache=False))


@router.put("")
async def update_certificate_settings(
    data: CertificateSettingsUpdate,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        cfg = cert_cfg.save_config(db, data.model_dump(exclude_none=True), current_user.id)
    except ValueError as exc:
        raise _bad_request(exc)
    return cert_cfg.public_view(cfg)


@router.post("/image/{kind}")
async def upload_certificate_image(
    kind: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        await file.seek(0)
    except Exception:  # noqa: BLE001
        pass
    contents = await file.read()
    try:
        cfg = cert_cfg.save_image(db, kind, contents, current_user.id)
    except ValueError as exc:
        raise _bad_request(exc)
    return cert_cfg.public_view(cfg)


@router.delete("/image/{kind}")
async def delete_certificate_image(
    kind: str,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        cfg = cert_cfg.remove_image(db, kind, current_user.id)
    except ValueError as exc:
        raise _bad_request(exc)
    return cert_cfg.public_view(cfg)


@router.post("/reset")
async def reset_certificate_settings(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    cfg = cert_cfg.reset_config(db, current_user.id)
    return cert_cfg.public_view(cfg)


@router.get("/preview")
async def preview_certificate(
    current_user: User = Depends(get_current_admin),
):
    """PDF d'aperçu (données fictives) avec les paramètres enregistrés."""
    try:
        pdf_bytes = build_demo_certificate_pdf(cert_cfg.get_config(use_cache=False))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Aperçu du certificat impossible")
        raise HTTPException(status_code=500, detail=f"Aperçu impossible : {exc}")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="apercu-certificat.pdf"',
            "Cache-Control": "no-store",
        },
    )
