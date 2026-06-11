"""m053_s12_parcel_cache_buurt_code

Revision ID: a06740c1fb72
Revises: a062dfa56d91
Create Date: 2026-06-11 22:00:32.676915

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a06740c1fb72'
down_revision: Union[str, Sequence[str], None] = 'a062dfa56d91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add parcel_cache.buurt_code (CBS buurtcode, nullable, indexed)."""
    op.add_column(
        'parcel_cache',
        sa.Column(
            'buurt_code',
            sa.String(length=12),
            nullable=True,
            comment='CBS buurtcode (BU + 8 cijfers), gevuld via backfill_buurt_codes',
        ),
    )
    op.create_index(
        op.f('ix_parcel_cache_buurt_code'),
        'parcel_cache',
        ['buurt_code'],
        unique=False,
    )


def downgrade() -> None:
    """Remove parcel_cache.buurt_code."""
    op.drop_index(op.f('ix_parcel_cache_buurt_code'), table_name='parcel_cache')
    op.drop_column('parcel_cache', 'buurt_code')
