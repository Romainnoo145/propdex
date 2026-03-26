"""Add score_weights JSONB column to organizations.

Revision ID: g7b8c9d0e1f2
Revises: 4c5d6e7f8a9b
Create Date: 2026-03-14 16:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "g7b8c9d0e1f2"
down_revision: str | None = "4c5d6e7f8a9b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("score_weights", postgresql.JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("organizations", "score_weights")
