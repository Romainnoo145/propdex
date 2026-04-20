"""m047_create_parcel_project_types

Revision ID: dd1e956d1300
Revises: bbdb5c6ff811
Create Date: 2026-04-20

Creates parcel_project_types table for per-parcel projecttype assignments
(M047/S01). Org-scoped via UniqueConstraint(organization_id, parcel_id).
Empty start — no backfill needed; endpoint-laag retourneert 'onbepaald'
default voor parcels zonder rij.

NOTE: set_at onupdate wordt afgehandeld in service-laag
(parcel_project_type_service.upsert_project_type), niet in DB-trigger.
Zie T04. Raw pg_insert omzeilt SQLAlchemy onupdate hook; service zet
`set_at` expliciet bij update.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "dd1e956d1300"
down_revision: str | Sequence[str] | None = "bbdb5c6ff811"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create parcel_project_types table + indexes."""
    op.create_table(
        "parcel_project_types",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("parcel_id", sa.String(length=50), nullable=False),
        sa.Column("project_type", sa.String(length=50), nullable=False),
        sa.Column(
            "set_at",
            sa.TIMESTAMP(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("set_by_user_id", sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["set_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "parcel_id",
            name="uq_parcel_project_types_org_parcel",
        ),
    )
    op.create_index(
        "ix_parcel_project_types_organization_id",
        "parcel_project_types",
        ["organization_id"],
    )
    op.create_index(
        "ix_parcel_project_types_org_parcel",
        "parcel_project_types",
        ["organization_id", "parcel_id"],
    )
    op.create_index(
        "ix_parcel_project_types_set_by_user_id",
        "parcel_project_types",
        ["set_by_user_id"],
    )


def downgrade() -> None:
    """Drop parcel_project_types table and its indexes."""
    op.drop_index(
        "ix_parcel_project_types_set_by_user_id",
        table_name="parcel_project_types",
    )
    op.drop_index(
        "ix_parcel_project_types_org_parcel",
        table_name="parcel_project_types",
    )
    op.drop_index(
        "ix_parcel_project_types_organization_id",
        table_name="parcel_project_types",
    )
    op.drop_table("parcel_project_types")
