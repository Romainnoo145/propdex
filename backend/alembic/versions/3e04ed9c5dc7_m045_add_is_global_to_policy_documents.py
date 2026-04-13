"""m045_add_is_global_to_policy_documents

Revision ID: 3e04ed9c5dc7
Revises: 5e756fd3ebe3
Create Date: 2026-04-13 12:16:48.965092

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '3e04ed9c5dc7'
down_revision: str | Sequence[str] | None = '5e756fd3ebe3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add column with server_default='true' so the column is non-null from the start.
    # Existing rows get is_global=true by default (correct for the single-admin scenario:
    # all pre-M045 policy_documents were uploaded by the Propdex vendor org).
    op.add_column(
        "policy_documents",
        sa.Column(
            "is_global",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    # Defense-in-depth: explicitly UPDATE all existing rows even though server_default
    # already set them to true. This makes the intent explicit and survives any future
    # migration cleanup that might change the server_default.
    op.execute("UPDATE policy_documents SET is_global = true WHERE is_global IS NULL OR is_global = false")


def downgrade() -> None:
    op.drop_column("policy_documents", "is_global")
