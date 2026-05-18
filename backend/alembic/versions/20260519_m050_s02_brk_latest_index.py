"""M050/S02 — partial composite index idx_brk_latest (D15).

Revision ID: 20260519_m050_s02
Revises: 20260518_m050_s01
Create Date: 2026-05-19 00:00:00.000000

Backs the brk_fetch_service.get_latest_for_parcel 30-day cache hot path. Partial
keeps the index tiny (only non-soft-deleted rows). DESC order on fetched_at lets
Postgres satisfy ORDER BY fetched_at DESC LIMIT 1 with an index-only scan.

Per ENG-PLAN locked 2026-05-18 (M050-S02-ENG-PLAN.md, decision D15).
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260519_m050_s02"
down_revision: str | Sequence[str] | None = "20260518_m050_s01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "idx_brk_latest",
        "brk_ownership_records",
        [
            "organization_id",
            "parcel_id",
            sa.text("fetched_at DESC"),
        ],
        unique=False,
        postgresql_where=sa.text("soft_deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_brk_latest", table_name="brk_ownership_records")
