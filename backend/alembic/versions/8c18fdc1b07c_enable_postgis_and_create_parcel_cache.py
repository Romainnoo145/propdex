"""enable_postgis_and_create_parcel_cache

Revision ID: 8c18fdc1b07c
Revises: 0800fa8394d7
Create Date: 2026-02-10 18:51:51.815696

"""
from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '8c18fdc1b07c'
down_revision: str | Sequence[str] | None = '0800fa8394d7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Enable PostGIS extension and create parcel_cache table with GIST spatial index."""
    # Enable PostGIS extension
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # Create parcel_cache table
    op.create_table(
        'parcel_cache',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('parcel_id', sa.String(length=50), nullable=False),
        sa.Column('geometry', geoalchemy2.types.Geometry(geometry_type='MULTIPOLYGON', srid=28992, from_text='ST_GeomFromEWKT', name='geometry'), nullable=False),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('gemeente_code', sa.String(length=10), nullable=True),
        sa.Column('area_m2', sa.Float(), nullable=True),
        sa.Column('has_pand', sa.Boolean(), nullable=False),
        sa.Column('bestemmingen', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('enrichment_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('enriched_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'parcel_id', name='uq_parcel_cache_org_parcel')
    )

    # Create regular indexes
    op.create_index('ix_parcel_cache_org_gemeente', 'parcel_cache', ['organization_id', 'gemeente_code'], unique=False)
    op.create_index('ix_parcel_cache_org_parcel', 'parcel_cache', ['organization_id', 'parcel_id'], unique=False)
    op.create_index(op.f('ix_parcel_cache_gemeente_code'), 'parcel_cache', ['gemeente_code'], unique=False)
    op.create_index(op.f('ix_parcel_cache_organization_id'), 'parcel_cache', ['organization_id'], unique=False)
    op.create_index(op.f('ix_parcel_cache_parcel_id'), 'parcel_cache', ['parcel_id'], unique=False)

    # Create GIST spatial index for geometry column
    op.execute("""
        CREATE INDEX idx_parcel_cache_geometry_gist
        ON parcel_cache
        USING GIST (geometry)
    """)

    # Enable RLS on parcel_cache table (follow existing pattern)
    op.execute('ALTER TABLE parcel_cache ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE parcel_cache FORCE ROW LEVEL SECURITY')
    op.execute("""
        CREATE POLICY tenant_isolation_parcel_cache ON parcel_cache
            FOR ALL
            USING (
                organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
            )
            WITH CHECK (
                organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
            )
    """)


def downgrade() -> None:
    """Drop parcel_cache table and PostGIS extension."""
    # Drop RLS policy
    op.execute('DROP POLICY IF EXISTS tenant_isolation_parcel_cache ON parcel_cache')
    op.execute('ALTER TABLE parcel_cache DISABLE ROW LEVEL SECURITY')

    # Drop table (will cascade drop all indexes)
    op.drop_table('parcel_cache')

    # Drop PostGIS extension
    op.execute("DROP EXTENSION IF EXISTS postgis CASCADE")
