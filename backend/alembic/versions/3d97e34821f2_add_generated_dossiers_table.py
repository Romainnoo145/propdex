"""add generated_dossiers table

Revision ID: 3d97e34821f2
Revises: 5a8a4c23d4e6
Create Date: 2026-03-02 20:30:21.541277

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '3d97e34821f2'
down_revision: str | Sequence[str] | None = '5a8a4c23d4e6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'generated_dossiers',
        sa.Column('id', sa.Uuid(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('report_id', sa.Uuid(), nullable=False),
        sa.Column('generated_by_user_id', sa.Uuid(), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False),
        sa.Column('template_version', sa.String(length=20), server_default=sa.text("'v1'"), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['generated_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['report_id'], ['saved_reports.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_generated_dossiers_org_created',
        'generated_dossiers',
        ['organization_id', 'created_at'],
        unique=False,
    )
    op.create_index(
        'ix_generated_dossiers_org_report',
        'generated_dossiers',
        ['organization_id', 'report_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_generated_dossiers_organization_id'),
        'generated_dossiers',
        ['organization_id'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_generated_dossiers_organization_id'), table_name='generated_dossiers')
    op.drop_index('ix_generated_dossiers_org_report', table_name='generated_dossiers')
    op.drop_index('ix_generated_dossiers_org_created', table_name='generated_dossiers')
    op.drop_table('generated_dossiers')
