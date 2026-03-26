"""add parcels_failed to area_scans

Revision ID: 4fdf155bd206
Revises: 2f812ea42f2e
Create Date: 2026-02-10 21:55:56.816727

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '4fdf155bd206'
down_revision: str | Sequence[str] | None = '2f812ea42f2e'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'area_scans',
        sa.Column('parcels_failed', sa.Integer(), nullable=False, server_default='0')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('area_scans', 'parcels_failed')
