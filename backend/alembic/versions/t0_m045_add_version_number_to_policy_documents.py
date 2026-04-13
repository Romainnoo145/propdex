"""m045_add_version_number_to_policy_documents

Revision ID: 42e91b6729e7
Revises: 3e04ed9c5dc7
Create Date: 2026-04-13 13:22:51.783665

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '42e91b6729e7'
down_revision: str | Sequence[str] | None = '3e04ed9c5dc7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add version_number column with server_default='1' so all existing rows
    # become version 1. Future re-uploads of the same (entity_type, entity_code,
    # source_key) triple insert new rows with version_number = MAX(existing) + 1
    # (logic added in T07 service layer).
    op.add_column(
        "policy_documents",
        sa.Column(
            "version_number",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("1"),
        ),
    )
    # Covering index for the cascade query's DISTINCT ON pattern in S02.
    # Order: entity_type, entity_code, source_key (the DISTINCT ON columns)
    # then version_number DESC (so the latest version comes first per group).
    op.create_index(
        "ix_policy_documents_versioning",
        "policy_documents",
        [
            "entity_type",
            "entity_code",
            "source_key",
            sa.text("version_number DESC"),
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_policy_documents_versioning", table_name="policy_documents")
    op.drop_column("policy_documents", "version_number")
