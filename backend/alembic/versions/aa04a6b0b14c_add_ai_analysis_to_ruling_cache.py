"""add_ai_analysis_to_ruling_cache

Revision ID: aa04a6b0b14c
Revises: d44ef8c851c9
Create Date: 2026-03-08 10:59:42.458135

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'aa04a6b0b14c'
down_revision: Union[str, Sequence[str], None] = 'd44ef8c851c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add per-ruling AI analysis columns to ruling_cache."""
    op.add_column('ruling_cache', sa.Column('ai_analysis', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('ruling_cache', sa.Column('vergunningstype', sa.String(length=100), nullable=True))
    op.add_column('ruling_cache', sa.Column('datum_indiening', sa.String(length=20), nullable=True))
    op.add_column('ruling_cache', sa.Column('doorlooptijd_dagen', sa.Integer(), nullable=True))
    op.add_column('ruling_cache', sa.Column('ai_analyzed_at', sa.DateTime(), nullable=True))
    op.create_index(op.f('ix_ruling_cache_vergunningstype'), 'ruling_cache', ['vergunningstype'], unique=False)


def downgrade() -> None:
    """Remove per-ruling AI analysis columns from ruling_cache."""
    op.drop_index(op.f('ix_ruling_cache_vergunningstype'), table_name='ruling_cache')
    op.drop_column('ruling_cache', 'ai_analyzed_at')
    op.drop_column('ruling_cache', 'doorlooptijd_dagen')
    op.drop_column('ruling_cache', 'datum_indiening')
    op.drop_column('ruling_cache', 'vergunningstype')
    op.drop_column('ruling_cache', 'ai_analysis')
