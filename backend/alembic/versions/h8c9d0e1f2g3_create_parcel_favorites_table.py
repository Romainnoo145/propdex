"""create parcel_favorites table

Revision ID: h8c9d0e1f2g3
Revises: g7b8c9d0e1f2
Create Date: 2026-03-15 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "h8c9d0e1f2g3"
down_revision: str | None = "g7b8c9d0e1f2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create parcel_favorites table with indexes and RLS."""
    op.create_table(
        "parcel_favorites",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "parcel_id",
            sa.String(length=50),
            nullable=False,
            comment="Kadaster parcel ID (e.g. HTT02-A-1234)",
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            nullable=False,
            comment="User who favorited this parcel",
        ),
        sa.Column(
            "gemeente_code",
            sa.String(length=10),
            nullable=True,
            comment="CBS gemeente code (e.g. 0983)",
        ),
        sa.Column(
            "gemeente_naam",
            sa.String(length=100),
            nullable=True,
            comment="Municipality name",
        ),
        sa.Column(
            "wijk_naam",
            sa.String(length=200),
            nullable=True,
            comment="Wijk name from scan context",
        ),
        sa.Column(
            "pipeline_stage",
            sa.String(length=30),
            server_default=sa.text("'Gesignaleerd'"),
            nullable=False,
            comment="Pipeline stage: Gesignaleerd/Onderzoek/Contact/Besluit/Afgerond",
        ),
        sa.Column(
            "afgerond_reden",
            sa.String(length=30),
            nullable=True,
            comment="Reason when Afgerond: Gekocht or Afgewezen",
        ),
        sa.Column(
            "notitie",
            sa.String(length=500),
            nullable=True,
            comment="Optional note (used with Afgerond)",
        ),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "user_id",
            "parcel_id",
            name="uq_parcel_favorites_org_user_parcel",
        ),
    )

    op.create_index(
        "ix_parcel_favorites_org_user",
        "parcel_favorites",
        ["organization_id", "user_id"],
    )
    op.create_index(
        "ix_parcel_favorites_org_gemeente",
        "parcel_favorites",
        ["organization_id", "gemeente_code"],
    )
    op.create_index(
        op.f("ix_parcel_favorites_organization_id"),
        "parcel_favorites",
        ["organization_id"],
    )

    # Enable RLS (matching pattern from 3882c5c83b07)
    op.execute("ALTER TABLE parcel_favorites ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE parcel_favorites FORCE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation_parcel_favorites ON parcel_favorites
            FOR ALL
            USING (
                organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
            )
            WITH CHECK (
                organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
            )
    """)


def downgrade() -> None:
    """Drop parcel_favorites table."""
    op.execute(
        "DROP POLICY IF EXISTS tenant_isolation_parcel_favorites ON parcel_favorites"
    )
    op.execute("ALTER TABLE parcel_favorites DISABLE ROW LEVEL SECURITY")
    op.drop_index("ix_parcel_favorites_org_gemeente", table_name="parcel_favorites")
    op.drop_index("ix_parcel_favorites_org_user", table_name="parcel_favorites")
    op.drop_index(
        op.f("ix_parcel_favorites_organization_id"), table_name="parcel_favorites"
    )
    op.drop_table("parcel_favorites")
