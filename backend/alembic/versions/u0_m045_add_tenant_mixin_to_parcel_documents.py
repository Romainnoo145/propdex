"""m045_add_tenant_mixin_to_parcel_documents

Revision ID: 9f1c1ce73d72
Revises: 42e91b6729e7
Create Date: 2026-04-13 13:34:54.198479

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9f1c1ce73d72"
down_revision: str | Sequence[str] | None = "42e91b6729e7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Pre-flight check: identify any parcel_documents rows where the uploaded_by_user_id
    # points to a deleted user (orphan) OR a user whose organization_id is NULL. The
    # migration must abort BEFORE any schema change if such rows exist, because the
    # backfill can't assign them an organization_id and the subsequent NOT NULL
    # constraint would fail mid-migration.
    bind = op.get_bind()
    result = bind.execute(
        sa.text(
            """
            SELECT pd.id, pd.uploaded_by_user_id
            FROM parcel_documents pd
            LEFT JOIN users u ON u.id = pd.uploaded_by_user_id
            WHERE u.id IS NULL OR u.organization_id IS NULL
            """
        )
    )
    bad_rows = result.fetchall()
    if bad_rows:
        ids = ", ".join(f"{row[0]} (user: {row[1]})" for row in bad_rows)
        raise RuntimeError(
            f"M045/S01 T03 pre-flight failed: {len(bad_rows)} parcel_documents rows "
            f"have null-org or orphaned uploaded_by_user_id. Clean up before retrying. "
            f"Offending rows: {ids}"
        )

    # Add organization_id as nullable first, then backfill, then make NOT NULL.
    op.add_column(
        "parcel_documents",
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )

    # Backfill from the row's user → user's organization
    op.execute(
        """
        UPDATE parcel_documents pd
        SET organization_id = u.organization_id
        FROM users u
        WHERE pd.uploaded_by_user_id = u.id
        """
    )

    # Now lock NOT NULL — pre-flight guaranteed every row has a value
    op.alter_column("parcel_documents", "organization_id", nullable=False)

    # Indexes for tenant-scoped queries
    op.create_index(
        "ix_parcel_documents_organization",
        "parcel_documents",
        ["organization_id"],
    )
    op.create_index(
        "ix_parcel_documents_org_parcel",
        "parcel_documents",
        ["organization_id", "parcel_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_parcel_documents_org_parcel", table_name="parcel_documents")
    op.drop_index("ix_parcel_documents_organization", table_name="parcel_documents")
    op.drop_column("parcel_documents", "organization_id")
