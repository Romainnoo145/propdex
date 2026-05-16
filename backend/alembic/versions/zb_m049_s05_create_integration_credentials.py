"""m049_s05_create_integration_credentials

Revision ID: 79117298d1ad
Revises: ad5af9028eb1
Create Date: 2026-05-16 00:00:01.000000

Vendor-managed encrypted credentials table. NO TenantMixin / organization_id
by design — RBAC at the route layer via Depends(get_current_superuser).
Eng-review locked 2026-05-14 + 2026-05-16.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '79117298d1ad'
down_revision: str | Sequence[str] | None = 'ad5af9028eb1'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'integration_credentials',
        sa.Column(
            'id',
            sa.Uuid(),
            server_default=sa.text('gen_random_uuid()'),
            nullable=False,
        ),
        sa.Column('source_key', sa.String(length=64), nullable=False),
        sa.Column('credential_name', sa.String(length=64), nullable=False),
        sa.Column('encrypted_value', sa.Text(), nullable=False),
        sa.Column('created_by_user_id', sa.Uuid(), nullable=True),
        sa.Column(
            'last_rotated_at',
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
            ['created_by_user_id'], ['users.id'], ondelete='SET NULL',
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'source_key',
            'credential_name',
            name='uq_integration_credentials_source_name',
        ),
    )


def downgrade() -> None:
    op.drop_table('integration_credentials')
