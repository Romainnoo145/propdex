"""M052/S04 create brief_dispatches

Revision ID: 20260603_m052_s04_disp
Revises: 20260603_m052_s04_afz
Create Date: 2026-06-03 00:00:00.000000
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260603_m052_s04_disp"
down_revision = "20260603_m052_s04_afz"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "brief_dispatches",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parcel_id", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("template_id", sa.String(64), nullable=False),
        sa.Column("dispatcher", sa.String(32), nullable=False),
        sa.Column("sent_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_brief_dispatches_org_parcel",
        "brief_dispatches",
        ["organization_id", "parcel_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_brief_dispatches_org_parcel", table_name="brief_dispatches")
    op.drop_table("brief_dispatches")
