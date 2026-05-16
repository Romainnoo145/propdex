"""m049_s05_create_audit_log

Revision ID: ad5af9028eb1
Revises: b2a4f6c8e1d3
Create Date: 2026-05-16 00:00:00.000000

Generic audit-log table. First emitter (M049/S05): credential rotation.
Schema is intentionally generic so future features reuse it without DDL.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'ad5af9028eb1'
down_revision: str | Sequence[str] | None = 'b2a4f6c8e1d3'  # M049/S04.2 expose_score_internals
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'audit_logs',
        sa.Column(
            'id',
            sa.Uuid(),
            server_default=sa.text('gen_random_uuid()'),
            nullable=False,
        ),
        sa.Column('actor_user_id', sa.Uuid(), nullable=True),
        sa.Column('action', sa.String(length=64), nullable=False),
        sa.Column('target_type', sa.String(length=64), nullable=False),
        sa.Column('target_id', sa.String(length=64), nullable=False),
        sa.Column(
            'metadata',
            postgresql.JSONB(astext_type=sa.Text()),
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
            ['actor_user_id'], ['users.id'], ondelete='SET NULL',
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_audit_logs_target',
        'audit_logs',
        ['target_type', 'target_id'],
        unique=False,
    )
    op.create_index(
        'ix_audit_logs_action',
        'audit_logs',
        ['action'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_audit_logs_action', table_name='audit_logs')
    op.drop_index('ix_audit_logs_target', table_name='audit_logs')
    op.drop_table('audit_logs')
