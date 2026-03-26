"""add_geo_columns_to_ruling_cache

Revision ID: d44ef8c851c9
Revises: bf6988ef58ae
Create Date: 2026-03-07 22:20:13.674857

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd44ef8c851c9'
down_revision: str | Sequence[str] | None = 'bf6988ef58ae'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add extracted_gemeente and uitkomst columns to ruling_cache."""
    op.add_column('ruling_cache', sa.Column('extracted_gemeente', sa.String(length=200), nullable=True))
    op.add_column('ruling_cache', sa.Column('uitkomst', sa.String(length=30), nullable=True))
    op.create_index(op.f('ix_ruling_cache_extracted_gemeente'), 'ruling_cache', ['extracted_gemeente'], unique=False)


def downgrade() -> None:
    """Remove extracted_gemeente and uitkomst columns from ruling_cache."""
    op.drop_index(op.f('ix_ruling_cache_extracted_gemeente'), table_name='ruling_cache')
    op.drop_column('ruling_cache', 'uitkomst')
    op.drop_column('ruling_cache', 'extracted_gemeente')
