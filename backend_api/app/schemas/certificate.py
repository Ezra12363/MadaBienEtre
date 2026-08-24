from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CertificateResponse(BaseModel):
    """
    Informations retournées au thérapeute.
    """

    number: str
    issued_at: datetime
    status: str
    download_url: Optional[str] = None
    # ✅ NOUVEAU
    verified_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class VerificationStatusResponse(BaseModel):
    """
    Statut de vérification du thérapeute.
    """

    is_verified: bool
    status: str

    certificate: Optional[CertificateResponse] = None

    rejection_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ✅ NOUVEAU : Réponse publique pour le QR code
class PublicCertificateVerifyResponse(BaseModel):
    valid: bool
    certificate_number: Optional[str] = None
    therapist_fullname: Optional[str] = None
    issued_at: Optional[datetime] = None
    status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)