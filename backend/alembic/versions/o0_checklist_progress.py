"""create checklist_progress table

Revision ID: o0_checklist_progress
Revises: n1_bulk_requests
Create Date: 2026-03-30

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "o0_checklist_progress"
down_revision: str | Sequence[str] | None = "n1_bulk_requests"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "checklist_progress",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("parcel_id", sa.String(50), nullable=False),
        sa.Column("use_case", sa.String(30), nullable=False),
        sa.Column(
            "checked_items",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "uploaded_documents",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
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
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "parcel_id",
            "use_case",
            name="uq_checklist_progress_user_parcel_usecase",
        ),
    )
    op.create_index(
        "ix_checklist_progress_user_parcel",
        "checklist_progress",
        ["user_id", "parcel_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_checklist_progress_user_parcel",
        table_name="checklist_progress",
    )
    op.drop_table("checklist_progress")
