"""add coverage_ratio address_resolution_ratio error_detail to area_scans

Revision ID: 5a8a4c23d4e6
Revises: 07f8a9b0c1d2
Create Date: 2026-02-28 19:20:00.503636

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '5a8a4c23d4e6'
down_revision: str | Sequence[str] | None = '07f8a9b0c1d2'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add coverage tracking columns to area_scans
    op.add_column('area_scans', sa.Column('coverage_ratio', sa.Float(), nullable=True))
    op.add_column('area_scans', sa.Column('address_resolution_ratio', sa.Float(), nullable=True))
    op.add_column('area_scans', sa.Column('error_detail', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    # Widen status column to accommodate 'completed_with_warnings' (24 chars)
    op.alter_column('area_scans', 'status',
                    existing_type=sa.String(length=20),
                    type_=sa.String(length=30),
                    existing_nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('area_scans', 'status',
                    existing_type=sa.String(length=30),
                    type_=sa.String(length=20),
                    existing_nullable=False)
    op.drop_column('area_scans', 'error_detail')
    op.drop_column('area_scans', 'address_resolution_ratio')
    op.drop_column('area_scans', 'coverage_ratio')
