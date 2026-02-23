"""Add matched_parcel_id column to change_records for spatial parcel matching.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-23

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: str = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "change_records",
        sa.Column(
            "matched_parcel_id",
            sa.Uuid(),
            sa.ForeignKey("parcel_cache.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_change_records_matched_parcel_id",
        "change_records",
        ["matched_parcel_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_change_records_matched_parcel_id", table_name="change_records"
    )
    op.drop_column("change_records", "matched_parcel_id")
