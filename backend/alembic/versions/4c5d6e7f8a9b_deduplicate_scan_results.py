"""Deduplicate scan_results: one row per parcel per organization.

Overlapping wijk bounding boxes caused ~32k parcels to appear in 2-7
scan_results rows. This migration:
1. Deletes duplicate rows (keeps the most recently created per org+parcel)
2. Drops the old (scan_id, parcel_id) unique constraint
3. Adds a new (organization_id, parcel_id) unique constraint

Revision ID: 4c5d6e7f8a9b
Revises: 3882c5c83b07
Create Date: 2026-03-13
"""

from alembic import op

revision = "4c5d6e7f8a9b"
down_revision = "3882c5c83b07"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Delete duplicate scan_results, keeping only the newest per
    # (organization_id, parcel_id). Uses a CTE to identify the "best" row
    # per parcel: prefer enriched rows (flags has 'bodem' key), then newest.
    op.execute("""
        DELETE FROM scan_results
        WHERE id NOT IN (
            SELECT DISTINCT ON (organization_id, parcel_id) id
            FROM scan_results
            ORDER BY organization_id, parcel_id,
                     CASE WHEN flags ? 'bodem' THEN 0 ELSE 1 END,
                     created_at DESC
        )
    """)

    # Step 2: Drop old constraint and index
    op.drop_constraint("uq_scan_results_scan_parcel", "scan_results", type_="unique")
    op.drop_index("ix_scan_results_scan_parcel", table_name="scan_results")

    # Step 3: Add new unique constraint and index
    op.create_unique_constraint(
        "uq_scan_results_org_parcel",
        "scan_results",
        ["organization_id", "parcel_id"],
    )
    op.create_index(
        "ix_scan_results_org_parcel",
        "scan_results",
        ["organization_id", "parcel_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_scan_results_org_parcel", table_name="scan_results")
    op.drop_constraint("uq_scan_results_org_parcel", "scan_results", type_="unique")
    op.create_index(
        "ix_scan_results_scan_parcel",
        "scan_results",
        ["scan_id", "parcel_id"],
    )
    op.create_unique_constraint(
        "uq_scan_results_scan_parcel",
        "scan_results",
        ["scan_id", "parcel_id"],
    )
