"""RLS hardening and Project.organization_id nullable.

Add RLS policies to remaining tables. Make projects.organization_id nullable.

Tables getting RLS:
- ruling_cache: shared (permissive)
- projects: permissive (org_id nullable, accessed via code-level filters)
- users: permissive (auth middleware controls access)
- refresh_tokens: permissive (auth middleware controls access)
- organizations: permissive (admin table)

Revision ID: m0_rls_hardening
Revises: l0_user_scope_models
Create Date: 2026-03-19

"""
from collections.abc import Sequence

from alembic import op

revision: str = "m0_rls_hardening"
down_revision: str | Sequence[str] | None = "l0_user_scope_models"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── projects: make organization_id nullable ───────────────────────
    op.alter_column("projects", "organization_id", nullable=True)
    # Change ondelete from CASCADE to SET NULL (nullable FK)
    op.drop_constraint("projects_organization_id_fkey", table_name="projects", type_="foreignkey")
    op.create_foreign_key(
        "projects_organization_id_fkey", "projects", "organizations",
        ["organization_id"], ["id"], ondelete="SET NULL",
    )

    # ── RLS on remaining tables ───────────────────────────────────────

    # ruling_cache: shared public data
    op.execute("ALTER TABLE ruling_cache ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY shared_access_ruling_cache ON ruling_cache
            FOR ALL USING (TRUE)
    """)

    # projects: permissive (code-level org_id filtering)
    op.execute("ALTER TABLE projects ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY permissive_projects ON projects
            FOR ALL USING (TRUE)
    """)

    # users: permissive (auth middleware controls access)
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY permissive_users ON users
            FOR ALL USING (TRUE)
    """)

    # refresh_tokens: permissive (auth middleware controls access)
    op.execute("ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY permissive_refresh_tokens ON refresh_tokens
            FOR ALL USING (TRUE)
    """)

    # organizations: permissive (admin table)
    op.execute("ALTER TABLE organizations ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY permissive_organizations ON organizations
            FOR ALL USING (TRUE)
    """)


def downgrade() -> None:
    # Remove RLS from newly-enabled tables
    op.execute("DROP POLICY IF EXISTS permissive_organizations ON organizations")
    op.execute("ALTER TABLE organizations DISABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS permissive_refresh_tokens ON refresh_tokens")
    op.execute("ALTER TABLE refresh_tokens DISABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS permissive_users ON users")
    op.execute("ALTER TABLE users DISABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS permissive_projects ON projects")
    op.execute("ALTER TABLE projects DISABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS shared_access_ruling_cache ON ruling_cache")
    op.execute("ALTER TABLE ruling_cache DISABLE ROW LEVEL SECURITY")

    # Restore projects.organization_id NOT NULL
    op.drop_constraint("projects_organization_id_fkey", table_name="projects", type_="foreignkey")
    op.create_foreign_key(
        "projects_organization_id_fkey", "projects", "organizations",
        ["organization_id"], ["id"], ondelete="CASCADE",
    )
    op.alter_column("projects", "organization_id", nullable=False)
