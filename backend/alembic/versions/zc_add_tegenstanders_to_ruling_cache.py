"""add_tegenstanders_to_ruling_cache

Revision ID: zc_tegenstanders
Revises: zb_perf_potentie_idx
Create Date: 2026-06-29 00:00:00.000000

Backfills a missing migration: the RulingCache.tegenstanders JSONB column
(opponent profiling) was added to the model but never had an accompanying
migration, leaving fresh databases out of sync with the model. This migration
is idempotent (ADD/DROP COLUMN IF [NOT] EXISTS) so it is safe to run against an
existing production database that already has the column.
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "zc_tegenstanders"
down_revision: str | Sequence[str] | None = "zb_perf_potentie_idx"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add tegenstanders JSONB column to ruling_cache (idempotent)."""
    op.execute("ALTER TABLE ruling_cache ADD COLUMN IF NOT EXISTS tegenstanders JSONB")


def downgrade() -> None:
    """Remove tegenstanders column from ruling_cache (idempotent)."""
    op.execute("ALTER TABLE ruling_cache DROP COLUMN IF EXISTS tegenstanders")
