"""add parcels_failed to area_scans

Revision ID: 4fdf155bd206
Revises: 2f812ea42f2e
Create Date: 2026-02-10 21:55:56.816727

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4fdf155bd206'
down_revision: Union[str, Sequence[str], None] = '2f812ea42f2e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'area_scans',
        sa.Column('parcels_failed', sa.Integer(), nullable=False, server_default='0')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('area_scans', 'parcels_failed')
