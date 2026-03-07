"""add juridisch_analyse_jobs table

Revision ID: 2b8c3d4e5f6a
Revises: 1a67b08d7c1b
Create Date: 2026-03-07 06:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '2b8c3d4e5f6a'
down_revision: Union[str, Sequence[str], None] = '1a67b08d7c1b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('juridisch_analyse_jobs',
    sa.Column('id', sa.Uuid(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('job_id', sa.String(length=100), nullable=True, comment='ARQ job identifier (set after enqueue)'),
    sa.Column('gemeente_naam', sa.String(length=200), nullable=False, comment='Municipality name for the analysis'),
    sa.Column('ecli_list', postgresql.JSONB(astext_type=sa.Text()), nullable=False, comment='List of ECLI identifiers to analyze'),
    sa.Column('status', sa.String(length=20), nullable=False, comment='Job status: queued, in_progress, complete, failed'),
    sa.Column('error_message', sa.String(length=1000), nullable=True, comment='Error message if job failed'),
    sa.Column('organization_id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_juridisch_analyse_jobs_job_id'), 'juridisch_analyse_jobs', ['job_id'], unique=True)
    op.create_index('ix_juridisch_analyse_jobs_org_gemeente', 'juridisch_analyse_jobs', ['organization_id', 'gemeente_naam'], unique=False)
    op.create_index(op.f('ix_juridisch_analyse_jobs_organization_id'), 'juridisch_analyse_jobs', ['organization_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_juridisch_analyse_jobs_organization_id'), table_name='juridisch_analyse_jobs')
    op.drop_index('ix_juridisch_analyse_jobs_org_gemeente', table_name='juridisch_analyse_jobs')
    op.drop_index(op.f('ix_juridisch_analyse_jobs_job_id'), table_name='juridisch_analyse_jobs')
    op.drop_table('juridisch_analyse_jobs')
