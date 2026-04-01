"""add superuser flag and ai_usage_log table

Revision ID: p0_superuser_and_ai_usage_log
Revises: o0_checklist_progress
Create Date: 2026-04-01

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "p0_superuser_and_ai_usage_log"
down_revision: str | Sequence[str] | None = "o0_checklist_progress"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add is_superuser column to users table
    op.add_column(
        "users",
        sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    # Create ai_usage_log table
    op.create_table(
        "ai_usage_log",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "call_site",
            sa.String(50),
            nullable=False,
            comment="Identifies the code path, e.g. 'bestemmingsplan_parsing'",
        ),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column("cache_creation_input_tokens", sa.Integer(), nullable=True),
        sa.Column("cache_read_input_tokens", sa.Integer(), nullable=True),
        sa.Column("total_tokens", sa.Integer(), nullable=False, comment="Sum of input_tokens + output_tokens"),
        sa.Column("estimated_cost_usd", sa.Float(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("error", sa.String(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_usage_log_call_site", "ai_usage_log", ["call_site"])
    op.create_index("ix_ai_usage_log_created_at", "ai_usage_log", ["created_at"])
    op.create_index("ix_ai_usage_log_user_id", "ai_usage_log", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_usage_log_user_id", table_name="ai_usage_log")
    op.drop_index("ix_ai_usage_log_created_at", table_name="ai_usage_log")
    op.drop_index("ix_ai_usage_log_call_site", table_name="ai_usage_log")
    op.drop_table("ai_usage_log")
    op.drop_column("users", "is_superuser")
