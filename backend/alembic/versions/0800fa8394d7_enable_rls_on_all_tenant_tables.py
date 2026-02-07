"""enable rls on all tenant tables

Revision ID: 0800fa8394d7
Revises: 6a29dfcdd7e2
Create Date: 2026-02-07 20:20:05.403250

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0800fa8394d7'
down_revision: Union[str, Sequence[str], None] = '6a29dfcdd7e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Enable RLS with fail-closed policies on all tenant-scoped tables."""
    tables = [
        'users',
        'refresh_tokens',
        'cached_api_responses',
        'pdf_documents',
        'parsing_jobs',
        'saved_reports',
        'projects',
    ]

    for table in tables:
        # Enable RLS on the table
        op.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
        # Force RLS even for table owner (critical for non-superuser enforcement)
        op.execute(f'ALTER TABLE {table} FORCE ROW LEVEL SECURITY')

        # Drop old policy if exists (may have fail-open COALESCE logic)
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
    """Disable RLS on all tenant-scoped tables."""
    tables = [
        'users',
        'refresh_tokens',
        'cached_api_responses',
        'pdf_documents',
        'parsing_jobs',
        'saved_reports',
        'projects',
    ]

    for table in tables:
        # Drop policies
        op.execute(f'DROP POLICY IF EXISTS tenant_isolation_{table} ON {table}')
        # Disable RLS
        op.execute(f'ALTER TABLE {table} DISABLE ROW LEVEL SECURITY')
