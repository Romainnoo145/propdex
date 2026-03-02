"""add professionals table

Revision ID: b166d55eeb91
Revises: 3d97e34821f2
Create Date: 2026-03-02 23:38:45.173529

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b166d55eeb91'
down_revision: Union[str, Sequence[str], None] = '3d97e34821f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create professionals table with cross-tenant RLS policy (FOR SELECT USING TRUE)."""
    op.create_table(
        'professionals',
        sa.Column('id', sa.Uuid(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('naam', sa.String(length=255), nullable=False),
        sa.Column('bedrijfsnaam', sa.String(length=255), nullable=True),
        sa.Column(
            'werkgebied',
            postgresql.ARRAY(sa.String()),
            server_default=sa.text("'{}'::text[]"),
            nullable=False,
        ),
        sa.Column(
            'gevolgklassen',
            postgresql.ARRAY(sa.String()),
            server_default=sa.text("'{}'::text[]"),
            nullable=False,
        ),
        sa.Column('email', sa.String(length=320), nullable=True),
        sa.Column('telefoon', sa.String(length=50), nullable=True),
        sa.Column('website', sa.String(length=500), nullable=True),
        sa.Column('tlokb_url', sa.String(length=500), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('TRUE'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    # GIN indexes for efficient ARRAY containment queries (@> operator)
    op.create_index(
        'ix_professionals_werkgebied_gin',
        'professionals',
        ['werkgebied'],
        unique=False,
        postgresql_using='gin',
    )
    op.create_index(
        'ix_professionals_gevolgklassen_gin',
        'professionals',
        ['gevolgklassen'],
        unique=False,
        postgresql_using='gin',
    )
    # btree indexes for standard lookups
    op.create_index('ix_professionals_naam', 'professionals', ['naam'], unique=False)
    op.create_index('ix_professionals_is_active', 'professionals', ['is_active'], unique=False)

    # Enable RLS — professionals are a platform resource visible to ALL tenants
    # The FOR SELECT USING (TRUE) policy allows any authenticated session to read
    # No INSERT/UPDATE/DELETE policy: app_role has table-level GRANT, and RLS only
    # restricts commands that have matching policies (so write access flows normally)
    op.execute("ALTER TABLE professionals ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE professionals FORCE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY professionals_select ON professionals
            FOR SELECT
            USING (TRUE)
    """)


def downgrade() -> None:
    """Drop professionals table."""
    op.execute("DROP POLICY IF EXISTS professionals_select ON professionals")
    op.drop_index('ix_professionals_is_active', table_name='professionals')
    op.drop_index('ix_professionals_naam', table_name='professionals')
    op.drop_index('ix_professionals_gevolgklassen_gin', table_name='professionals')
    op.drop_index('ix_professionals_werkgebied_gin', table_name='professionals')
    op.drop_table('professionals')
