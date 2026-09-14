"""add therapist assigned at to bookings

Revision ID: 3a1b713daa55
Revises: 52866c785c45
Create Date: 2026-09-14 00:22:47.586883

"""

from alembic import op
import sqlalchemy as sa
import geoalchemy2

# Revision identifiers, used by Alembic.
revision = "3a1b713daa55"
down_revision = "52866c785c45"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
