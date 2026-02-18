"""Add preferences JSONB column to users table.

Revision ID: b7a8c9d0e1f2
Revises: 089ed9b025cb
Create Date: 2026-02-18

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7a8c9d0e1f2"
down_revision: str | None = "089ed9b025cb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add preferences JSONB column with empty object default."""
    op.add_column(
        "users",
        sa.Column(
            "preferences",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    """Remove preferences column from users."""
    op.drop_column("users", "preferences")
