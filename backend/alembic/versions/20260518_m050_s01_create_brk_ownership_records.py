"""m050_s01_create_brk_ownership_records

Revision ID: 20260518_m050_s01
Revises: 79117298d1ad
Create Date: 2026-05-18 00:00:00.000000

M050/S01 — Persistent BRK eigendomsdata foundation.
Per ENG-PLAN locked 2026-05-18 (M050-S01-ENG-PLAN.md, decisions D1-D8):
- CHECK constraint enforces D1 AVG Tier-3 defense-in-depth at DB layer
- UNIQUE (organization_id, parcel_id, fetched_at) supports D5 koopwaarde_trend
- Partial idx_brk_hard_delete backs the daily retention cron (D6)
- First migration under the new date-based naming convention.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '20260518_m050_s01'
down_revision: str | Sequence[str] | None = '79117298d1ad'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'brk_ownership_records',
        sa.Column(
            'id',
            sa.Uuid(),
            server_default=sa.text('gen_random_uuid()'),
            nullable=False,
        ),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('parcel_id', sa.String(length=64), nullable=False),
        sa.Column('eigenaar_type', sa.String(length=32), nullable=False),
        sa.Column('eigenaar_naam', sa.Text(), nullable=True),
        sa.Column('kvk_nummer', sa.String(length=8), nullable=True),
        sa.Column('statutaire_zetel', sa.Text(), nullable=True),
        sa.Column('zakelijk_recht_type', sa.String(length=32), nullable=True),
        sa.Column('aandeel', sa.Text(), nullable=True),
        sa.Column('koopsom', sa.Numeric(), nullable=True),
        sa.Column('koopjaar', sa.Integer(), nullable=True),
        sa.Column(
            'heeft_hypotheek',
            sa.Boolean(),
            server_default=sa.text('false'),
            nullable=False,
        ),
        sa.Column(
            'raw_brk_response',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            'fetched_at',
            sa.TIMESTAMP(timezone=False),
            server_default=sa.text('CURRENT_TIMESTAMP'),
            nullable=False,
        ),
        sa.Column(
            'soft_deleted_at',
            sa.TIMESTAMP(timezone=False),
            nullable=True,
        ),
        sa.Column(
            'hard_delete_after',
            sa.TIMESTAMP(timezone=False),
            nullable=True,
        ),
        sa.Column(
            'created_at',
            sa.DateTime(),
            server_default=sa.text('CURRENT_TIMESTAMP'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(),
            server_default=sa.text('CURRENT_TIMESTAMP'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['organization_id'], ['organizations.id'], ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "eigenaar_type IN ('rechtspersoon', 'overheid')",
            name='eigenaar_type_check',
        ),
        sa.UniqueConstraint(
            'organization_id',
            'parcel_id',
            'fetched_at',
            name='uq_brk_org_parcel_fetched',
        ),
    )
    op.create_index(
        'ix_brk_ownership_records_organization_id',
        'brk_ownership_records',
        ['organization_id'],
        unique=False,
    )
    op.create_index(
        'idx_brk_org_parcel',
        'brk_ownership_records',
        ['organization_id', 'parcel_id'],
        unique=False,
    )
    op.create_index(
        'idx_brk_hard_delete',
        'brk_ownership_records',
        ['hard_delete_after'],
        unique=False,
        postgresql_where=sa.text('soft_deleted_at IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index('idx_brk_hard_delete', table_name='brk_ownership_records')
    op.drop_index('idx_brk_org_parcel', table_name='brk_ownership_records')
    op.drop_index(
        'ix_brk_ownership_records_organization_id',
        table_name='brk_ownership_records',
    )
    op.drop_table('brk_ownership_records')
