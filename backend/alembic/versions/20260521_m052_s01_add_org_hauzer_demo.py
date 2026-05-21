"""M052/S01 add organizations.hauzer_demo

Revision ID: 20260521_m052_s01
Revises: 20260519_m050_s02
Create Date: 2026-05-21 00:00:00.000000

Per-org boolean gate for mock surfaces in the Hauzer engagement-demo.
Default false for all existing orgs (server_default). S06 seeds the
demo-org with True; no other code path sets this to True pre-prod.
"""
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260521_m052_s01"
down_revision = "20260519_m050_s02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column(
            "hauzer_demo",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("organizations", "hauzer_demo")
