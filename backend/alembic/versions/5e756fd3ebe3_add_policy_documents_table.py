"""add policy_documents table

Revision ID: 5e756fd3ebe3
Revises: r0_add_address_to_favorites
Create Date: 2026-04-06 22:04:48.419937

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '5e756fd3ebe3'
down_revision: Union[str, Sequence[str], None] = 'r0_add_address_to_favorites'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create policy_documents table for beleidsconfiguratie document uploads."""
    op.create_table(
        'policy_documents',
        sa.Column('id', sa.Uuid(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('entity_type', sa.String(length=20), nullable=False, comment="Level: 'gemeente', 'provincie', or 'landelijk'"),
        sa.Column('entity_code', sa.String(length=20), nullable=False, comment='Entity identifier: GM0363, PV26, or NL'),
        sa.Column('source_key', sa.String(length=50), nullable=False, comment='Data source key (e.g. welstandsnota, omgevingsvisie, parkeerbeleid)'),
        sa.Column('filename', sa.String(length=255), nullable=False, comment='Original upload filename'),
        sa.Column('content_type', sa.String(length=100), nullable=False, comment='MIME type (application/pdf, etc.)'),
        sa.Column('file_data', sa.LargeBinary(), nullable=False, comment='File bytes (max 25MB)'),
        sa.Column('file_size', sa.Integer(), nullable=False, comment='File size in bytes'),
        sa.Column('uploaded_by_user_id', sa.Uuid(), nullable=False, comment='User who uploaded the document'),
        sa.Column('status', sa.String(length=20), server_default=sa.text("'uploaded'"), nullable=False, comment='Processing status: uploaded, parsing, parsed, error'),
        sa.Column('ai_summary', sa.Text(), nullable=True, comment='AI-generated summary of document contents (future)'),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_policy_documents_entity', 'policy_documents', ['entity_type', 'entity_code'])
    op.create_index('ix_policy_documents_org_entity', 'policy_documents', ['organization_id', 'entity_type', 'entity_code'])
    op.create_index('ix_policy_documents_source', 'policy_documents', ['entity_type', 'entity_code', 'source_key'])
    op.create_index(op.f('ix_policy_documents_organization_id'), 'policy_documents', ['organization_id'])


def downgrade() -> None:
    """Drop policy_documents table."""
    op.drop_index(op.f('ix_policy_documents_organization_id'), table_name='policy_documents')
    op.drop_index('ix_policy_documents_source', table_name='policy_documents')
    op.drop_index('ix_policy_documents_org_entity', table_name='policy_documents')
    op.drop_index('ix_policy_documents_entity', table_name='policy_documents')
    op.drop_table('policy_documents')
