"""m047_s04_create_factor_extraction_cache

Revision ID: 28d2d029856d
Revises: dd1e956d1300
Create Date: 2026-04-21 00:19:51.739166

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '28d2d029856d'
down_revision: str | Sequence[str] | None = 'dd1e956d1300'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'factor_extraction_cache',
        sa.Column(
            'id',
            sa.Uuid(),
            server_default=sa.text('gen_random_uuid()'),
            nullable=False,
        ),
        sa.Column('parcel_id', sa.String(length=50), nullable=False),
        sa.Column('policy_document_id', sa.Uuid(), nullable=False),
        sa.Column('factor_id', sa.String(length=100), nullable=False),
        sa.Column(
            'schema_version',
            sa.Integer(),
            server_default=sa.text('1'),
            nullable=False,
        ),
        sa.Column(
            'extracted_payload',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            'extracted_at',
            sa.DateTime(),
            server_default=sa.text('CURRENT_TIMESTAMP'),
            nullable=False,
        ),
        sa.Column(
            'cached_at',
            sa.DateTime(),
            server_default=sa.text('CURRENT_TIMESTAMP'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['policy_document_id'],
            ['policy_documents.id'],
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'parcel_id',
            'policy_document_id',
            'factor_id',
            'schema_version',
            name='uq_factor_extraction_cache_key',
        ),
    )
    op.create_index(
        'ix_factor_extraction_cache_doc_factor',
        'factor_extraction_cache',
        ['policy_document_id', 'factor_id'],
        unique=False,
    )
    op.create_index(
        'ix_factor_extraction_cache_parcel',
        'factor_extraction_cache',
        ['parcel_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_factor_extraction_cache_parcel', table_name='factor_extraction_cache')
    op.drop_index('ix_factor_extraction_cache_doc_factor', table_name='factor_extraction_cache')
    op.drop_table('factor_extraction_cache')
