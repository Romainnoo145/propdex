"""add_rechtsgronden_to_ruling_cache

Revision ID: c7e2f1a3b9d5
Revises: aa04a6b0b14c
Create Date: 2026-03-09 02:38:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c7e2f1a3b9d5'
down_revision: str | Sequence[str] | None = 'aa04a6b0b14c'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add rechtsgronden JSONB column with GIN index to ruling_cache."""
    op.add_column('ruling_cache', sa.Column('rechtsgronden', JSONB(astext_type=sa.Text()), nullable=True))
    op.create_index('ix_ruling_cache_rechtsgronden', 'ruling_cache', ['rechtsgronden'], unique=False, postgresql_using='gin')


def downgrade() -> None:
    """Remove rechtsgronden column and GIN index from ruling_cache."""
    op.drop_index('ix_ruling_cache_rechtsgronden', table_name='ruling_cache')
    op.drop_column('ruling_cache', 'rechtsgronden')
