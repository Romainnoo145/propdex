"""Create funda_listing_snapshots table.

Revision ID: 07f8a9b0c1d2
Revises: f6a7b8c9d0e1
Create Date: 2026-02-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "07f8a9b0c1d2"
down_revision: str = "f6a7b8c9d0e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "funda_listing_snapshots",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column(
            "source",
            sa.String(length=32),
            nullable=False,
            server_default=sa.text("'funda'"),
        ),
        sa.Column("listing_external_id", sa.String(length=128), nullable=False),
        sa.Column("listing_url", sa.Text(), nullable=False),
        sa.Column("area_name", sa.String(length=120), nullable=True),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("street", sa.String(length=255), nullable=True),
        sa.Column("house_number", sa.String(length=32), nullable=True),
        sa.Column("postcode", sa.String(length=7), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("price_eur", sa.Integer(), nullable=True),
        sa.Column("price_text", sa.String(length=255), nullable=True),
        sa.Column("listing_status", sa.String(length=64), nullable=True),
        sa.Column("offered_since_text", sa.String(length=255), nullable=True),
        sa.Column("matched_parcel_id", sa.Uuid(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["matched_parcel_id"],
            ["parcel_cache.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "source",
            "listing_external_id",
            "snapshot_date",
            name="uq_funda_listing_snapshots_org_source_listing_day",
        ),
    )

    op.create_index(
        "ix_funda_listing_snapshots_organization_id",
        "funda_listing_snapshots",
        ["organization_id"],
    )
    op.create_index(
        "ix_funda_listing_snapshots_source",
        "funda_listing_snapshots",
        ["source"],
    )
    op.create_index(
        "ix_funda_listing_snapshots_snapshot_date",
        "funda_listing_snapshots",
        ["snapshot_date"],
    )
    op.create_index(
        "ix_funda_listing_snapshots_postcode",
        "funda_listing_snapshots",
        ["postcode"],
    )
    op.create_index(
        "ix_funda_listing_snapshots_city",
        "funda_listing_snapshots",
        ["city"],
    )
    op.create_index(
        "ix_funda_listing_snapshots_matched_parcel_id",
        "funda_listing_snapshots",
        ["matched_parcel_id"],
    )
    op.create_index(
        "ix_funda_listing_snapshots_org_parcel_day",
        "funda_listing_snapshots",
        ["organization_id", "matched_parcel_id", "snapshot_date"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_funda_listing_snapshots_org_parcel_day",
        table_name="funda_listing_snapshots",
    )
    op.drop_index(
        "ix_funda_listing_snapshots_matched_parcel_id",
        table_name="funda_listing_snapshots",
    )
    op.drop_index(
        "ix_funda_listing_snapshots_city",
        table_name="funda_listing_snapshots",
    )
    op.drop_index(
        "ix_funda_listing_snapshots_postcode",
        table_name="funda_listing_snapshots",
    )
    op.drop_index(
        "ix_funda_listing_snapshots_snapshot_date",
        table_name="funda_listing_snapshots",
    )
    op.drop_index(
        "ix_funda_listing_snapshots_source",
        table_name="funda_listing_snapshots",
    )
    op.drop_index(
        "ix_funda_listing_snapshots_organization_id",
        table_name="funda_listing_snapshots",
    )
    op.drop_table("funda_listing_snapshots")
