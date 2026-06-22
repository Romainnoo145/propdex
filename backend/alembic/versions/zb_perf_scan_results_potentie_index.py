"""perf: expression index on scan_results potentie score for dashboard kansen

Revision ID: zb_perf_potentie_idx
Revises: a06740c1fb72
Create Date: 2026-06-22

The dashboard "off-market kansen" query filters + orders by the per-parcel
potentie score, which lives in ``scan_results.flags['scores']['potentie']``.
Without an index Postgres must extract that JSONB value for every scan_result
in the gemeente (~63k for Venlo) on each request — a ~6.3s scan. This adds a
functional (expression) index on the casted potentie value so the query can do
an index-backward scan and stop at the LIMIT (measured ~6.3s -> ~1.4ms on prod).

Built CONCURRENTLY (no write-lock on scan_results) inside an autocommit block,
since CREATE INDEX CONCURRENTLY cannot run in a transaction.
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "zb_perf_potentie_idx"
down_revision: str | Sequence[str] | None = "a06740c1fb72"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

INDEX_NAME = "ix_scan_results_potentie"
# Mirrors the SQLAlchemy expression ScanResult.flags["scores"]["potentie"].as_float()
INDEX_EXPR = "(((flags->'scores'->>'potentie')::float))"


def upgrade() -> None:
    """Upgrade schema."""
    with op.get_context().autocommit_block():
        op.execute(
            f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {INDEX_NAME} "
            f"ON scan_results {INDEX_EXPR}"
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.get_context().autocommit_block():
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX_NAME}")
