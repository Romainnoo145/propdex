"""Create change_read_states table for per-change read tracking.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-02-23

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: str = "d4e5f6a7b8c9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "change_read_states",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("change_id", sa.Uuid(), nullable=False),
        sa.Column(
            "read_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["change_id"],
            ["change_records.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "change_id",
            name="uq_change_read_states_user_change",
        ),
    )
    op.create_index(
        "ix_change_read_states_org",
        "change_read_states",
        ["organization_id"],
    )
    op.create_index(
        "ix_change_read_states_user_change",
        "change_read_states",
        ["user_id", "change_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_change_read_states_user_change", table_name="change_read_states"
    )
    op.drop_index(
        "ix_change_read_states_org", table_name="change_read_states"
    )
    op.drop_table("change_read_states")
