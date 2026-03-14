"""Add score_weights JSONB column to organizations table.

Revision ID: a1b2c3d4e5f6
Revises: 4c5d6e7f8a9b
Create Date: 2026-03-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "4c5d6e7f8a9b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column(
            "score_weights",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Per-org score weight config: {preset, potentie_risico_balance, potentie_weights, risico_weights}",
        ),
    )


def downgrade() -> None:
    op.drop_column("organizations", "score_weights")
