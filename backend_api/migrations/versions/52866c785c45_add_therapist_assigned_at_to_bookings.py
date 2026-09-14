"""add therapist assigned at to bookings

Revision ID: 52866c785c45
Revises: 788558d13ada
Create Date: 2026-09-14 00:03:58.713678

"""

from alembic import op
import sqlalchemy as sa
import geoalchemy2

# Revision identifiers, used by Alembic.
revision = "52866c785c45"
down_revision = "788558d13ada"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
