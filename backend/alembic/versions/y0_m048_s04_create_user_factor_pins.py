"""m048_s04_create_user_factor_pins

Revision ID: 3d1196c58771
Revises: 28d2d029856d
Create Date: 2026-04-26 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '3d1196c58771'
down_revision: str | Sequence[str] | None = '28d2d029856d'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'user_factor_pins',
        sa.Column(
            'id',
            sa.Uuid(),
            server_default=sa.text('gen_random_uuid()'),
            nullable=False,
        ),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('category', sa.String(length=16), nullable=False),
        sa.Column('factor_key', sa.String(length=64), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
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
        sa.ForeignKeyConstraint(
            ['user_id'], ['users.id'], ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'user_id', 'category', 'factor_key',
            name='uq_user_factor_pins_user_cat_key',
        ),
    )
    op.create_index(
        'ix_user_factor_pins_organization_id',
        'user_factor_pins',
        ['organization_id'],
        unique=False,
    )
    op.create_index(
        'ix_user_factor_pins_user_id',
        'user_factor_pins',
        ['user_id'],
        unique=False,
    )
    op.create_index(
        'ix_user_factor_pins_lookup',
        'user_factor_pins',
        ['user_id', 'category'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_user_factor_pins_lookup', table_name='user_factor_pins')
    op.drop_index('ix_user_factor_pins_user_id', table_name='user_factor_pins')
    op.drop_index('ix_user_factor_pins_organization_id', table_name='user_factor_pins')
    op.drop_table('user_factor_pins')
