# app/api/certificates.py
import os

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    Query,
)

from fastapi.responses import FileResponse

from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import (
    get_current_therapist,
    get_current_user,
    get_current_user_optional,
    _get_user_from_token,
)
from ..services.certificate_service import ensure_certificate_pdf

from ..models.user import User
from ..models.therapist_certificate import (
    TherapistCertificate,
)

from ..schemas.certificate import (
    CertificateResponse,
    VerificationStatusResponse,
    PublicCertificateVerifyResponse,  # ✅ NOUVEAU
)


router = APIRouter(
    prefix="/therapists/me",
    tags=["Therapist Certificates"],
)

# ✅ NOUVEAU : Router public pour la vérification par QR code
public_router = APIRouter(
    prefix="/certificates",
    tags=["Certificate Verification"],
)


# ============================================================
# UTILITAIRE
# ============================================================

def _get_valid_certificate(therapist_id: int, db: Session):
    return (
        db.query(TherapistCertificate)
        .filter(
            TherapistCertificate.therapist_id == therapist_id,
            TherapistCertificate.status == "valid",
        )
        .order_by(TherapistCertificate.issued_at.desc())
        .first()
    )


def _certificate_to_response(certificate: TherapistCertificate) -> CertificateResponse:
    admin_name = None
    if certificate.verifier:
        admin_name = certificate.verifier.fullname
    return CertificateResponse(
        number=certificate.certificate_number,
        issued_at=certificate.issued_at,
        status=certificate.status,
        download_url="/therapists/me/certificate/download",
        verified_by_name=admin_name,
    )


# ============================================================
# STATUT VÉRIFICATION
# ============================================================

@router.get(
    "/verification",
    response_model=VerificationStatusResponse,
)
async def get_my_verification_status(
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db),
):
    """
    Retourne le statut de vérification du thérapeute connecté.
    """
    status_value = current_user.verification_status or "pending"
    certificate_response = None

    if status_value == "approved":
        certificate = _get_valid_certificate(current_user.id, db)
        if certificate:
            certificate_response = _certificate_to_response(certificate)

    return VerificationStatusResponse(
        is_verified=(status_value == "approved"),
        status=status_value,
        certificate=certificate_response,
        rejection_reason=getattr(current_user, "rejection_reason", None),
    )


# ============================================================
# DÉTAIL CERTIFICAT
# ============================================================

@router.get(
    "/certificate",
    response_model=CertificateResponse,
)
async def get_my_certificate(
    current_user: User = Depends(get_current_therapist),
    db: Session = Depends(get_db),
):
    """
    Retourne les informations du certificat du thérapeute.
    """
    if current_user.verification_status != "approved":
        raise HTTPException(
            status_code=403,
            detail="Votre profil n'est pas encore vérifié.",
        )

    certificate = _get_valid_certificate(current_user.id, db)

    if not certificate:
        raise HTTPException(
            status_code=404,
            detail="Aucun certificat valide n'a été trouvé.",
        )

    return _certificate_to_response(certificate)


# ============================================================
# TÉLÉCHARGEMENT PDF
# ============================================================

@router.get("/certificate/download")
async def download_my_certificate(
    request: Request,
    db: Session = Depends(get_db),
    token: str = Query(None),
):
    """
    Télécharge le certificat PDF.
    Supporte :
    - Authorization header (Bearer token)
    - Query parameter ?token=...
    """

    current_user = None

    try:
        current_user = await get_current_user_optional(request, db)
    except Exception:
        pass

    if not current_user and token:
        try:
            current_user = _get_user_from_token(token=token, db=db)
        except Exception:
            pass

    if not current_user:
        raise HTTPException(
            status_code=401,
            detail="Authentification requise. Veuillez fournir un token valide.",
        )

    if current_user.role not in ["THERAPIST", "ADMIN"]:
        raise HTTPException(
            status_code=403,
            detail="Seuls les thérapeutes peuvent télécharger leur certificat.",
        )

    if current_user.verification_status != "approved":
        raise HTTPException(
            status_code=403,
            detail="Votre profil n'est pas encore vérifié.",
        )

    certificate = _get_valid_certificate(current_user.id, db)

    if not certificate:
        raise HTTPException(
            status_code=404,
            detail="Certificat introuvable.",
        )

    pdf_path = ensure_certificate_pdf(certificate, db)

    if not pdf_path:
        raise HTTPException(
            status_code=404,
            detail="Fichier PDF du certificat introuvable sur le serveur.",
        )

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"{certificate.certificate_number}.pdf",
        headers={
            "Content-Disposition": f"attachment; filename=\"{certificate.certificate_number}.pdf\""
        },
    )


# ============================================================
# ✅ NOUVEAU : VÉRIFICATION PUBLIQUE (scan QR code)
# ============================================================

@public_router.get("/verify/{certificate_number}", response_model=PublicCertificateVerifyResponse)
async def verify_certificate_public(
    certificate_number: str,
    db: Session = Depends(get_db),
):
    """
    ✅ Endpoint public — permet à quiconque scanne le QR code du
    certificat de vérifier son authenticité sans se connecter.
    """
    certificate = (
        db.query(TherapistCertificate)
        .filter(
            TherapistCertificate.certificate_number == certificate_number
        )
        .first()
    )

    if not certificate:
        return PublicCertificateVerifyResponse(valid=False)

    return PublicCertificateVerifyResponse(
        valid=(certificate.status == "valid"),
        certificate_number=certificate.certificate_number,
        therapist_fullname=certificate.therapist.fullname if certificate.therapist else None,
        issued_at=certificate.issued_at,
        status=certificate.status,
    )


# ============================================================
# ✅ CLIENT : CONSULTATION (lecture seule) DU CERTIFICAT D'UN THÉRAPEUTE
# ============================================================

@public_router.get("/therapist/{therapist_id}/view")
async def view_therapist_certificate(
    therapist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Permet à un utilisateur connecté (client, thérapeute, admin) de CONSULTER
    le certificat officiel d'un thérapeute vérifié.

    - Authentification obligatoire (Bearer).
    - Le PDF est servi « inline » (affichage), jamais en pièce jointe, et
      sans mise en cache : l'application l'affiche dans une visionneuse
      sans bouton de téléchargement. Seul le thérapeute (et l'admin) peut
      télécharger son certificat via /therapists/me/certificate/download.
    """
    therapist = (
        db.query(User)
        .filter(User.id == therapist_id, User.role == "THERAPIST")
        .first()
    )

    if not therapist or therapist.verification_status != "approved":
        raise HTTPException(
            status_code=404,
            detail="Ce thérapeute n'a pas encore de certificat.",
        )

    certificate = _get_valid_certificate(therapist.id, db)

    if not certificate:
        raise HTTPException(
            status_code=404,
            detail="Ce thérapeute n'a pas encore de certificat.",
        )

    pdf_path = ensure_certificate_pdf(certificate, db)

    if not pdf_path:
        raise HTTPException(
            status_code=404,
            detail="Fichier du certificat introuvable sur le serveur.",
        )

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
