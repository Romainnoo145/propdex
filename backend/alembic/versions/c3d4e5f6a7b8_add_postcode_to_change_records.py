"""Add postcode column to change_records for bekendmaking matching.

Revision ID: c3d4e5f6a7b8
Revises: b7a8c9d0e1f2
Create Date: 2026-02-21

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: str = "b7a8c9d0e1f2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "change_records",
        sa.Column("postcode", sa.String(7), nullable=True),
    )
    op.create_index(
        "ix_change_records_postcode",
        "change_records",
        ["postcode"],
    )


def downgrade() -> None:
    op.drop_index("ix_change_records_postcode", table_name="change_records")
    op.drop_column("change_records", "postcode")
