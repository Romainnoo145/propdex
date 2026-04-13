"""m045_create_gemeente_provincie_map

Revision ID: bbdb5c6ff811
Revises: 9f1c1ce73d72
Create Date: 2026-04-13 17:06:43.901158

"""

import json
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "bbdb5c6ff811"
down_revision: str | Sequence[str] | None = "9f1c1ce73d72"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# backend/alembic/versions/{migration}.py -> backend/app/data/gemeente_provincie_map.json
# Path: __file__ -> versions/ -> alembic/ -> backend/ -> app/data/
FIXTURE_PATH = (
    Path(__file__).resolve().parents[2] / "app" / "data" / "gemeente_provincie_map.json"
)


def upgrade() -> None:
    """Create gemeente_provincie_map table and seed with CBS fixture data."""
    # Create the table
    op.create_table(
        "gemeente_provincie_map",
        sa.Column("gemeente_code", sa.String(length=10), nullable=False),
        sa.Column("provincie_code", sa.String(length=10), nullable=False),
        sa.PrimaryKeyConstraint("gemeente_code"),
    )
    op.create_index(
        "ix_gemeente_provincie_map_provincie",
        "gemeente_provincie_map",
        ["provincie_code"],
    )

    # Seed the table from the committed CBS fixture.
    # Idempotent via ON CONFLICT DO NOTHING — re-running the migration
    # against an already-seeded table is a no-op.
    if not FIXTURE_PATH.exists():
        raise RuntimeError(
            f"M045/S01 T04 fixture not found at {FIXTURE_PATH}. "
            "Run 'python -m app.data.generate_gemeente_provincie_map' "
            "first (see T05 for details)."
        )

    with FIXTURE_PATH.open("r", encoding="utf-8") as f:
        rows = json.load(f)

    if not rows:
        raise RuntimeError(
            f"M045/S01 T04 fixture at {FIXTURE_PATH} is empty. "
            "Regenerate via 'python -m app.data.generate_gemeente_provincie_map'."
        )

    # Bulk insert with ON CONFLICT DO NOTHING for idempotency
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "INSERT INTO gemeente_provincie_map (gemeente_code, provincie_code) "
            "VALUES (:gemeente_code, :provincie_code) "
            "ON CONFLICT (gemeente_code) DO NOTHING"
        ),
        rows,
    )


def downgrade() -> None:
    """Drop gemeente_provincie_map table and its index."""
    op.drop_index(
        "ix_gemeente_provincie_map_provincie", table_name="gemeente_provincie_map"
    )
    op.drop_table("gemeente_provincie_map")
