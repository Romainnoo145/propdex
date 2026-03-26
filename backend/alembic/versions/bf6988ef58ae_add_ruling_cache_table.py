"""add ruling_cache table

Revision ID: bf6988ef58ae
Revises: 2b8c3d4e5f6a
Create Date: 2026-03-07 21:09:38.553185

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'bf6988ef58ae'
down_revision: str | Sequence[str] | None = '2b8c3d4e5f6a'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('ruling_cache',
    sa.Column('ecli', sa.String(length=100), nullable=False),
    sa.Column('court_code', sa.String(length=20), nullable=False),
    sa.Column('instantie', sa.String(length=200), nullable=True),
    sa.Column('datum_uitspraak', sa.String(length=20), nullable=True),
    sa.Column('title', sa.String(length=500), nullable=True),
    sa.Column('summary', sa.Text(), nullable=True),
    sa.Column('full_text', sa.Text(), nullable=True),
    sa.Column('gemeente_query', sa.String(length=200), nullable=True),
    sa.Column('fetched_at', sa.DateTime(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.PrimaryKeyConstraint('ecli')
    )
    op.create_index(op.f('ix_ruling_cache_court_code'), 'ruling_cache', ['court_code'], unique=False)
    op.create_index(op.f('ix_ruling_cache_datum_uitspraak'), 'ruling_cache', ['datum_uitspraak'], unique=False)
    op.create_index(op.f('ix_ruling_cache_gemeente_query'), 'ruling_cache', ['gemeente_query'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_ruling_cache_gemeente_query'), table_name='ruling_cache')
    op.drop_index(op.f('ix_ruling_cache_datum_uitspraak'), table_name='ruling_cache')
    op.drop_index(op.f('ix_ruling_cache_court_code'), table_name='ruling_cache')
    op.drop_table('ruling_cache')
