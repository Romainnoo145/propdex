"""De-tenant scan pipeline tables.

Drop organization_id column and org-based constraints/indexes from 4 scan
pipeline tables. Replace org-based RLS policies with permissive shared-access
policies (USING (TRUE)).

Tables affected:
- area_scans
- scan_results
- parcel_cache
- change_records

Revision ID: k0_detenant_scan_pipeline
Revises: j0_detenant_cache
Create Date: 2026-03-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "k0_detenant_scan_pipeline"
down_revision: Union[str, Sequence[str], None] = "j0_detenant_cache"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Tables with existing RLS policies (from migration 2f812ea42f2e)
TABLES_WITH_EXISTING_RLS = {
    "area_scans",
    "scan_results",
    "parcel_cache",
}

# Tables without existing RLS policies
TABLES_WITHOUT_EXISTING_RLS = {
    "change_records",
}


def upgrade() -> None:
    # ── area_scans ────────────────────────────────────────────────────
    # Drop existing org-based RLS policy
    op.execute("DROP POLICY IF EXISTS tenant_isolation_area_scans ON area_scans")

    # Drop old composite indexes
    op.drop_index("ix_area_scans_org_status", table_name="area_scans")
    op.drop_index("ix_area_scans_org_gemeente", table_name="area_scans")

    # Drop TenantMixin auto-index on organization_id
    op.drop_index("ix_area_scans_organization_id", table_name="area_scans")

    # Drop organization_id column
    op.drop_column("area_scans", "organization_id")

    # Create new indexes without org_id
    # Note: status and gemeente_code already have column-level index=True
    # which creates ix_area_scans_status and ix_area_scans_gemeente_code automatically.
    # Only need explicit indexes for names that differ from auto-generated ones.

    # Create permissive shared-access RLS policy
    op.execute("""
        CREATE POLICY shared_access_area_scans ON area_scans
            FOR ALL USING (TRUE)
    """)

    # ── scan_results ──────────────────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS tenant_isolation_scan_results ON scan_results")

    # Drop old composite index and unique constraint
    op.drop_index("ix_scan_results_org_parcel", table_name="scan_results")
    op.drop_constraint("uq_scan_results_org_parcel", table_name="scan_results", type_="unique")

    # Drop TenantMixin auto-index
    op.drop_index("ix_scan_results_organization_id", table_name="scan_results")

    # Drop organization_id column
    op.drop_column("scan_results", "organization_id")

    # Create new unique constraint without org_id
    # Note: parcel_id already has column-level index=True
    op.create_unique_constraint("uq_scan_results_parcel", "scan_results", ["parcel_id"])

    # Create permissive shared-access RLS policy
    op.execute("""
        CREATE POLICY shared_access_scan_results ON scan_results
            FOR ALL USING (TRUE)
    """)

    # ── parcel_cache ──────────────────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS tenant_isolation_parcel_cache ON parcel_cache")

    # Drop old composite indexes and unique constraint
    op.drop_index("ix_parcel_cache_org_gemeente", table_name="parcel_cache")
    op.drop_index("ix_parcel_cache_org_parcel", table_name="parcel_cache")
    op.drop_index("ix_parcel_cache_org_parcel_code", table_name="parcel_cache")
    op.drop_constraint("uq_parcel_cache_org_parcel", table_name="parcel_cache", type_="unique")

    # Drop TenantMixin auto-index
    op.drop_index("ix_parcel_cache_organization_id", table_name="parcel_cache")

    # Drop organization_id column
    op.drop_column("parcel_cache", "organization_id")

    # Create new unique constraint without org_id
    # Note: gemeente_code, parcel_id, parcel_code already have column-level index=True
    op.create_unique_constraint("uq_parcel_cache_parcel", "parcel_cache", ["parcel_id"])

    # Create permissive shared-access RLS policy
    op.execute("""
        CREATE POLICY shared_access_parcel_cache ON parcel_cache
            FOR ALL USING (TRUE)
    """)

    # ── change_records ────────────────────────────────────────────────
    # Older local databases may still have the tenant policy from prior RLS rollout.
    op.execute("DROP POLICY IF EXISTS tenant_isolation_change_records ON change_records")

    # Drop TenantMixin auto-index
    op.drop_index("ix_change_records_organization_id", table_name="change_records")

    # Drop organization_id column
    op.drop_column("change_records", "organization_id")

    # Enable RLS and create permissive shared-access policy
    op.execute("ALTER TABLE change_records ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY shared_access_change_records ON change_records
            FOR ALL USING (TRUE)
    """)


def downgrade() -> None:
    # ── change_records ────────────────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS shared_access_change_records ON change_records")
    op.execute("ALTER TABLE change_records DISABLE ROW LEVEL SECURITY")

    op.add_column("change_records", sa.Column(
        "organization_id", sa.UUID(), nullable=True,
    ))
    op.create_index("ix_change_records_organization_id", "change_records", ["organization_id"])

    # ── parcel_cache ──────────────────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS shared_access_parcel_cache ON parcel_cache")

    op.drop_constraint("uq_parcel_cache_parcel", table_name="parcel_cache", type_="unique")

    op.add_column("parcel_cache", sa.Column(
        "organization_id", sa.UUID(), nullable=True,
    ))
    op.create_index("ix_parcel_cache_organization_id", "parcel_cache", ["organization_id"])
    op.create_index("ix_parcel_cache_org_gemeente", "parcel_cache", ["organization_id", "gemeente_code"])
    op.create_index("ix_parcel_cache_org_parcel", "parcel_cache", ["organization_id", "parcel_id"])
    op.create_index("ix_parcel_cache_org_parcel_code", "parcel_cache", ["organization_id", "parcel_code"])
    op.create_unique_constraint("uq_parcel_cache_org_parcel", "parcel_cache", ["organization_id", "parcel_id"])

    op.execute("""
        CREATE POLICY tenant_isolation_parcel_cache ON parcel_cache
            FOR ALL USING (organization_id::text = current_setting('app.current_tenant_id', TRUE))
    """)

    # ── scan_results ──────────────────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS shared_access_scan_results ON scan_results")

    op.drop_constraint("uq_scan_results_parcel", table_name="scan_results", type_="unique")

    op.add_column("scan_results", sa.Column(
        "organization_id", sa.UUID(), nullable=True,
    ))
    op.create_index("ix_scan_results_organization_id", "scan_results", ["organization_id"])
    op.create_index("ix_scan_results_org_parcel", "scan_results", ["organization_id", "parcel_id"])
    op.create_unique_constraint("uq_scan_results_org_parcel", "scan_results", ["organization_id", "parcel_id"])

    op.execute("""
        CREATE POLICY tenant_isolation_scan_results ON scan_results
            FOR ALL USING (organization_id::text = current_setting('app.current_tenant_id', TRUE))
    """)

    # ── area_scans ────────────────────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS shared_access_area_scans ON area_scans")

    op.add_column("area_scans", sa.Column(
        "organization_id", sa.UUID(), nullable=True,
    ))
    op.create_index("ix_area_scans_organization_id", "area_scans", ["organization_id"])
    op.create_index("ix_area_scans_org_status", "area_scans", ["organization_id", "status"])
    op.create_index("ix_area_scans_org_gemeente", "area_scans", ["organization_id", "gemeente_code"])

    op.execute("""
        CREATE POLICY tenant_isolation_area_scans ON area_scans
            FOR ALL USING (organization_id::text = current_setting('app.current_tenant_id', TRUE))
    """)
