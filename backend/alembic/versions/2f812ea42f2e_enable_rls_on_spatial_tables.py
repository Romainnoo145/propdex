"""enable_rls_on_spatial_tables

Revision ID: 2f812ea42f2e
Revises: fa6f15c17340
Create Date: 2026-02-10 19:04:15.962857

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '2f812ea42f2e'
down_revision: str | Sequence[str] | None = 'fa6f15c17340'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Enable RLS with fail-closed policies on spatial tables."""
    tables = ['parcel_cache', 'area_scans', 'scan_results']

    for table in tables:
        # Enable RLS on the table
        op.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
        # Force RLS even for table owner (critical for non-superuser enforcement)
        op.execute(f'ALTER TABLE {table} FORCE ROW LEVEL SECURITY')

        # Drop old policy if exists
        op.execute(f'DROP POLICY IF EXISTS tenant_isolation_{table} ON {table}')

        # Create fail-closed policy
        # NULLIF(current_setting(...), '') converts empty string to NULL
        # NULL::uuid never equals organization_id, so access is denied
        op.execute(f"""
            CREATE POLICY tenant_isolation_{table} ON {table}
                FOR ALL
                USING (
                    organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
                )
                WITH CHECK (
                    organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
                )
        """)


def downgrade() -> None:
    """Disable RLS on spatial tables."""
    tables = ['parcel_cache', 'area_scans', 'scan_results']

    for table in tables:
        # Drop policies
        op.execute(f'DROP POLICY IF EXISTS tenant_isolation_{table} ON {table}')
        # Disable RLS
        op.execute(f'ALTER TABLE {table} DISABLE ROW LEVEL SECURITY')
