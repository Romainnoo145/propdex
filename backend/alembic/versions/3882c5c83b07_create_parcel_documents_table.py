"""create parcel_documents table

Revision ID: 3882c5c83b07
Revises: c7e2f1a3b9d5
Create Date: 2026-03-12 00:37:14.282463

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3882c5c83b07'
down_revision: Union[str, Sequence[str], None] = 'c7e2f1a3b9d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create parcel_documents table with indexes and RLS."""
    op.create_table('parcel_documents',
        sa.Column('id', sa.Uuid(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('parcel_id', sa.String(length=50), nullable=False, comment='Kadaster parcel identifier'),
        sa.Column('document_type', sa.String(length=50), nullable=False, comment='Dossier category key (e.g. bestemmingscheck, bodem, fundering)'),
        sa.Column('filename', sa.String(length=255), nullable=False, comment='Original upload filename'),
        sa.Column('content_type', sa.String(length=100), nullable=False, comment='MIME type (application/pdf, image/jpeg, etc.)'),
        sa.Column('file_data', sa.LargeBinary(), nullable=False, comment='File bytes (max 25MB)'),
        sa.Column('file_size', sa.Integer(), nullable=False, comment='File size in bytes'),
        sa.Column('uploaded_by_user_id', sa.Uuid(), nullable=True, comment='User who uploaded the document'),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_parcel_documents_org_parcel', 'parcel_documents', ['organization_id', 'parcel_id'])
    op.create_index('ix_parcel_documents_org_parcel_type', 'parcel_documents', ['organization_id', 'parcel_id', 'document_type'])
    op.create_index(op.f('ix_parcel_documents_organization_id'), 'parcel_documents', ['organization_id'])

    # Enable RLS (matching pattern from 0800fa8394d7)
    op.execute('ALTER TABLE parcel_documents ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE parcel_documents FORCE ROW LEVEL SECURITY')
    op.execute("""
        CREATE POLICY tenant_isolation_parcel_documents ON parcel_documents
            FOR ALL
            USING (
                organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
            )
            WITH CHECK (
                organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
            )
    """)


def downgrade() -> None:
    """Drop parcel_documents table."""
    op.execute('DROP POLICY IF EXISTS tenant_isolation_parcel_documents ON parcel_documents')
    op.execute('ALTER TABLE parcel_documents DISABLE ROW LEVEL SECURITY')
    op.drop_index('ix_parcel_documents_org_parcel_type', table_name='parcel_documents')
    op.drop_index('ix_parcel_documents_org_parcel', table_name='parcel_documents')
    op.drop_index(op.f('ix_parcel_documents_organization_id'), table_name='parcel_documents')
    op.drop_table('parcel_documents')
