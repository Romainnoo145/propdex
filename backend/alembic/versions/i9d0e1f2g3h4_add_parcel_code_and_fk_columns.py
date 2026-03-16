"""Add parcel_code to parcel_cache and parcel_cache_id FK to parcel_favorites.

Revision ID: i9d0e1f2g3h4
Revises: h8c9d0e1f2g3
Create Date: 2026-03-16 00:00:00.000000

Purpose: Unify the three identifier namespaces so favorites can join to
geometry/address/enrichment data via parcel_cache.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "i9d0e1f2g3h4"
down_revision: str | None = "h8c9d0e1f2g3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add parcel_code to parcel_cache; add parcel_cache_id FK to parcel_favorites."""
    # 1. Add parcel_code to parcel_cache
    op.add_column(
        "parcel_cache",
        sa.Column(
            "parcel_code",
            sa.String(length=50),
            nullable=True,
            comment="PDOK display string (e.g. 'Venlo I 6658')",
        ),
    )
    # 2. Composite index for org-scoped parcel_code lookups
    op.create_index(
        "ix_parcel_cache_org_parcel_code",
        "parcel_cache",
        ["organization_id", "parcel_code"],
    )

    # 3. Add parcel_cache_id FK to parcel_favorites
    op.add_column(
        "parcel_favorites",
        sa.Column(
            "parcel_cache_id",
            sa.Uuid(),
            nullable=True,
            comment="FK to parcel_cache.id -- nullable until backfill complete",
        ),
    )
    # 4. FK constraint with SET NULL on parcel_cache delete
    op.create_foreign_key(
        "fk_parcel_favorites_parcel_cache",
        "parcel_favorites",
        "parcel_cache",
        ["parcel_cache_id"],
        ["id"],
        ondelete="SET NULL",
    )
    # 5. Index for fast lookups via parcel_cache_id
    op.create_index(
        "ix_parcel_favorites_parcel_cache_id",
        "parcel_favorites",
        ["parcel_cache_id"],
    )


def downgrade() -> None:
    """Reverse: drop indexes, FK, and columns in reverse order."""
    op.drop_index("ix_parcel_favorites_parcel_cache_id", table_name="parcel_favorites")
    op.drop_constraint(
        "fk_parcel_favorites_parcel_cache", "parcel_favorites", type_="foreignkey"
    )
    op.drop_column("parcel_favorites", "parcel_cache_id")
    op.drop_index("ix_parcel_cache_org_parcel_code", table_name="parcel_cache")
    op.drop_column("parcel_cache", "parcel_code")
