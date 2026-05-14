"""m049_s01_create_data_source_status

Revision ID: 657143b79099
Revises: 3d1196c58771
Create Date: 2026-05-14 00:00:00.000000

Vendor-managed catalog table. No TenantMixin / organization_id by design —
RBAC at the route layer via Depends(get_current_superuser). Eng-review
locked 2026-05-14.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '657143b79099'
down_revision: str | Sequence[str] | None = '3d1196c58771'  # M048/S04 user_factor_pins
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'data_source_status',
        sa.Column(
            'id',
            sa.Uuid(),
            server_default=sa.text('gen_random_uuid()'),
            nullable=False,
        ),
        sa.Column('gemeente_code', sa.String(length=6), nullable=False),
        sa.Column('source_key', sa.String(length=64), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('last_checked', sa.TIMESTAMP(timezone=False), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column(
            'configuratie',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column('managed_by_user_id', sa.Uuid(), nullable=True),
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
            ['managed_by_user_id'], ['users.id'], ondelete='SET NULL',
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'gemeente_code',
            'source_key',
            name='uq_data_source_status_gemeente_source',
        ),
    )
    op.create_index(
        'ix_data_source_status_gemeente_code',
        'data_source_status',
        ['gemeente_code'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        'ix_data_source_status_gemeente_code',
        table_name='data_source_status',
    )
    op.drop_table('data_source_status')
