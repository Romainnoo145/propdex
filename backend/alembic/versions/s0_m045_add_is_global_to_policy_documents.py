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
    # Add column with server_default='true' so every pre-M045 row gets is_global=true.
    # The single-admin scenario (Propdex vendor is the only org with policy_documents
    # upload rights) means all pre-M045 uploads were made by the vendor and are therefore
    # global by definition. The application-layer default in the model is False — service
    # layer must explicitly set is_global=True on new vendor uploads (defense in depth).
    op.add_column(
        "policy_documents",
        sa.Column(
            "is_global",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("policy_documents", "is_global")
