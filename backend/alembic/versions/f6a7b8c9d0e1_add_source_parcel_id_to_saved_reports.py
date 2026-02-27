"""Add source_parcel_id to saved_reports for idempotent parcel reports.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-02-26 13:40:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "saved_reports",
        sa.Column("source_parcel_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_saved_reports_source_parcel_id_parcel_cache",
        "saved_reports",
        "parcel_cache",
        ["source_parcel_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_saved_reports_org_source_parcel",
        "saved_reports",
        ["organization_id", "source_parcel_id"],
        unique=False,
    )
    op.create_index(
        "uq_saved_reports_org_source_parcel_active",
        "saved_reports",
        ["organization_id", "source_parcel_id"],
        unique=True,
        postgresql_where=sa.text(
            "deleted_at IS NULL AND source_parcel_id IS NOT NULL"
        ),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_saved_reports_org_source_parcel_active",
        table_name="saved_reports",
    )
    op.drop_index("ix_saved_reports_org_source_parcel", table_name="saved_reports")
    op.drop_constraint(
        "fk_saved_reports_source_parcel_id_parcel_cache",
        "saved_reports",
        type_="foreignkey",
    )
    op.drop_column("saved_reports", "source_parcel_id")
