"""create bulk_queries table

Revision ID: n0_bulk_queries
Revises: m0_rls_hardening
Create Date: 2026-03-25

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "n0_bulk_queries"
down_revision: str | Sequence[str] | None = "m0_rls_hardening"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "bulk_queries",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("query_text", sa.String(2000), nullable=False),
        sa.Column("parsed_query", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "result_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("results", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
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
    )
    op.create_index("ix_bulk_queries_user_id", "bulk_queries", ["user_id"])
    op.create_index("ix_bulk_queries_status", "bulk_queries", ["status"])


def downgrade() -> None:
    op.drop_index("ix_bulk_queries_status", table_name="bulk_queries")
    op.drop_index("ix_bulk_queries_user_id", table_name="bulk_queries")
    op.drop_table("bulk_queries")
