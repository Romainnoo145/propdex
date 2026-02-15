"""add bouwjaar, pand_status, wijk_naam, project_id

Revision ID: a1b2c3d4e5f6
Revises: 4fdf155bd206
Create Date: 2026-02-15 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '4fdf155bd206'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add bouwjaar/pand_status to parcel_cache and wijk_naam/project_id to area_scans."""
    # ParcelCache: BAG building attributes
    op.add_column('parcel_cache', sa.Column('bouwjaar', sa.Integer(), nullable=True))
    op.add_column('parcel_cache', sa.Column('pand_status', sa.String(100), nullable=True))

    # AreaScan: wijk identification and project link
    op.add_column('area_scans', sa.Column('wijk_naam', sa.String(200), nullable=True))
    op.add_column(
        'area_scans',
        sa.Column(
            'project_id',
            sa.Uuid(),
            sa.ForeignKey('projects.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Remove added columns."""
    op.drop_column('area_scans', 'project_id')
    op.drop_column('area_scans', 'wijk_naam')
    op.drop_column('parcel_cache', 'pand_status')
    op.drop_column('parcel_cache', 'bouwjaar')
