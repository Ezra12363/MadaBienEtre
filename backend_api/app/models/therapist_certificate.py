from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Enum,
    ForeignKey,
    Index,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class TherapistCertificate(Base):
    """
    Certificat professionnel d'un thérapeute.

    Le certificat est généré automatiquement lorsque
    verification_status = approved.
    """

    __tablename__ = "therapist_certificates"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    therapist_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    certificate_number = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    certificate_path = Column(
        String(500),
        nullable=False,
    )

    issued_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )

    status = Column(
        Enum(
            "valid",
            "revoked",
            name="certificate_status",
        ),
        nullable=False,
        default="valid",
    )

    verified_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )

    # ---------------------------------------------------------
    # RELATIONS
    # ---------------------------------------------------------

    therapist = relationship(
        "User",
        foreign_keys=[therapist_id],
        backref="certificates",
    )

    verifier = relationship(
        "User",
        foreign_keys=[verified_by],
    )

    # ---------------------------------------------------------
    # INDEX
    # ---------------------------------------------------------

    __table_args__ = (
        Index(
            "idx_certificate_therapist",
            "therapist_id",
        ),
        Index(
            "idx_certificate_number",
            "certificate_number",
        ),
        Index(
            "idx_certificate_status",
            "status",
        ),
    )

    def __repr__(self):
        return (
            f"<TherapistCertificate "
            f"id={self.id} "
            f"number={self.certificate_number} "
            f"therapist_id={self.therapist_id}>"
        )