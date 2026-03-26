"""De-tenant cache and reference data tables.

Drop organization_id column and org-based constraints/indexes from 5 shared
data tables. Replace org-based RLS policies with permissive shared-access
policies (USING (TRUE)).

Tables affected:
- cached_api_responses
- pdf_documents
- parsing_jobs
- juridisch_analyse_jobs
- funda_listing_snapshots

Revision ID: j0_detenant_cache
Revises: i9d0e1f2g3h4
Create Date: 2026-03-19

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "j0_detenant_cache"
down_revision: str | Sequence[str] | None = "i9d0e1f2g3h4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Tables that already had RLS enabled (from migration 0800fa8394d7)
TABLES_WITH_EXISTING_RLS = {
    "cached_api_responses",
    "pdf_documents",
    "parsing_jobs",
}

# Tables that never had RLS policies (only had org_id column filtering)
TABLES_WITHOUT_EXISTING_RLS = {
    "juridisch_analyse_jobs",
    "funda_listing_snapshots",
}


def upgrade() -> None:
    # ── cached_api_responses ──────────────────────────────────────────
    # Drop existing org-based RLS policy
    op.execute("DROP POLICY IF EXISTS tenant_isolation_cached_api_responses ON cached_api_responses")

    # Drop old composite index and unique constraint
    op.drop_index("ix_cached_responses_org_key", table_name="cached_api_responses")
    op.drop_constraint("uq_cached_responses_org_key", table_name="cached_api_responses", type_="unique")

    # Drop the TenantMixin index on organization_id alone
    op.drop_index("ix_cached_api_responses_organization_id", table_name="cached_api_responses")

    # Drop organization_id column
    op.drop_column("cached_api_responses", "organization_id")

    # Create new indexes/constraints without org_id
    op.create_index("ix_cached_responses_key", "cached_api_responses", ["cache_key"])
    op.create_unique_constraint("uq_cached_responses_key", "cached_api_responses", ["cache_key"])

    # Create permissive shared-access RLS policy
    op.execute("""
        CREATE POLICY shared_access_cached_api_responses ON cached_api_responses
            FOR ALL USING (TRUE)
    """)

    # ── pdf_documents ─────────────────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS tenant_isolation_pdf_documents ON pdf_documents")
    op.drop_index("ix_pdf_documents_org_plan", table_name="pdf_documents")
    op.drop_index("ix_pdf_documents_organization_id", table_name="pdf_documents")
    op.drop_column("pdf_documents", "organization_id")
    op.create_index("ix_pdf_documents_plan", "pdf_documents", ["plan_idn"])
    op.execute("""
        CREATE POLICY shared_access_pdf_documents ON pdf_documents
            FOR ALL USING (TRUE)
    """)

    # ── parsing_jobs ──────────────────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS tenant_isolation_parsing_jobs ON parsing_jobs")
    op.drop_index("ix_parsing_jobs_org_plan", table_name="parsing_jobs")
    op.drop_index("ix_parsing_jobs_organization_id", table_name="parsing_jobs")
    op.drop_column("parsing_jobs", "organization_id")
    op.create_index("ix_parsing_jobs_plan", "parsing_jobs", ["plan_idn"])
    op.execute("""
        CREATE POLICY shared_access_parsing_jobs ON parsing_jobs
            FOR ALL USING (TRUE)
    """)

    # ── juridisch_analyse_jobs ────────────────────────────────────────
    # Older local databases may still have the tenant policy from prior RLS rollout.
    op.execute("DROP POLICY IF EXISTS tenant_isolation_juridisch_analyse_jobs ON juridisch_analyse_jobs")
    op.execute("ALTER TABLE juridisch_analyse_jobs ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE juridisch_analyse_jobs FORCE ROW LEVEL SECURITY")
    op.drop_index("ix_juridisch_analyse_jobs_org_gemeente", table_name="juridisch_analyse_jobs")
    op.drop_index("ix_juridisch_analyse_jobs_organization_id", table_name="juridisch_analyse_jobs")
    op.drop_column("juridisch_analyse_jobs", "organization_id")
    op.create_index("ix_juridisch_analyse_jobs_gemeente", "juridisch_analyse_jobs", ["gemeente_naam"])
    op.execute("""
        CREATE POLICY shared_access_juridisch_analyse_jobs ON juridisch_analyse_jobs
            FOR ALL USING (TRUE)
    """)

    # ── funda_listing_snapshots ───────────────────────────────────────
    # Older local databases may still have the tenant policy from prior RLS rollout.
    op.execute("DROP POLICY IF EXISTS tenant_isolation_funda_listing_snapshots ON funda_listing_snapshots")
    op.execute("ALTER TABLE funda_listing_snapshots ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE funda_listing_snapshots FORCE ROW LEVEL SECURITY")
    op.drop_constraint(
        "uq_funda_listing_snapshots_org_source_listing_day",
        table_name="funda_listing_snapshots",
        type_="unique",
    )
    op.drop_index("ix_funda_listing_snapshots_org_parcel_day", table_name="funda_listing_snapshots")
    op.drop_index("ix_funda_listing_snapshots_organization_id", table_name="funda_listing_snapshots")
    op.drop_column("funda_listing_snapshots", "organization_id")
    op.create_unique_constraint(
        "uq_funda_listing_snapshots_source_listing_day",
        "funda_listing_snapshots",
        ["source", "listing_external_id", "snapshot_date"],
    )
    op.create_index(
        "ix_funda_listing_snapshots_parcel_day",
        "funda_listing_snapshots",
        ["matched_parcel_id", "snapshot_date"],
    )
    op.execute("""
        CREATE POLICY shared_access_funda_listing_snapshots ON funda_listing_snapshots
            FOR ALL USING (TRUE)
    """)


def downgrade() -> None:
    # Reverse order: funda → juridisch → parsing → pdf → cached

    # ── funda_listing_snapshots ───────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS shared_access_funda_listing_snapshots ON funda_listing_snapshots")
    op.drop_index("ix_funda_listing_snapshots_parcel_day", table_name="funda_listing_snapshots")
    op.drop_constraint(
        "uq_funda_listing_snapshots_source_listing_day",
        table_name="funda_listing_snapshots",
        type_="unique",
    )
    op.add_column(
        "funda_listing_snapshots",
        sa.Column("organization_id", sa.dialects.postgresql.UUID(), nullable=True),
    )
    op.create_index(
        "ix_funda_listing_snapshots_organization_id",
        "funda_listing_snapshots",
        ["organization_id"],
    )
    op.create_index(
        "ix_funda_listing_snapshots_org_parcel_day",
        "funda_listing_snapshots",
        ["organization_id", "matched_parcel_id", "snapshot_date"],
    )
    op.create_unique_constraint(
        "uq_funda_listing_snapshots_org_source_listing_day",
        "funda_listing_snapshots",
        ["organization_id", "source", "listing_external_id", "snapshot_date"],
    )
    op.execute("ALTER TABLE funda_listing_snapshots DISABLE ROW LEVEL SECURITY")

    # ── juridisch_analyse_jobs ────────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS shared_access_juridisch_analyse_jobs ON juridisch_analyse_jobs")
    op.drop_index("ix_juridisch_analyse_jobs_gemeente", table_name="juridisch_analyse_jobs")
    op.add_column(
        "juridisch_analyse_jobs",
        sa.Column("organization_id", sa.dialects.postgresql.UUID(), nullable=True),
    )
    op.create_index(
        "ix_juridisch_analyse_jobs_organization_id",
        "juridisch_analyse_jobs",
        ["organization_id"],
    )
    op.create_index(
        "ix_juridisch_analyse_jobs_org_gemeente",
        "juridisch_analyse_jobs",
        ["organization_id", "gemeente_naam"],
    )
    op.execute("ALTER TABLE juridisch_analyse_jobs DISABLE ROW LEVEL SECURITY")

    # ── parsing_jobs ──────────────────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS shared_access_parsing_jobs ON parsing_jobs")
    op.drop_index("ix_parsing_jobs_plan", table_name="parsing_jobs")
    op.add_column(
        "parsing_jobs",
        sa.Column("organization_id", sa.dialects.postgresql.UUID(), nullable=True),
    )
    op.create_index("ix_parsing_jobs_organization_id", "parsing_jobs", ["organization_id"])
    op.create_index("ix_parsing_jobs_org_plan", "parsing_jobs", ["organization_id", "plan_idn"])
    # Restore original tenant RLS policy
    op.execute("""
        CREATE POLICY tenant_isolation_parsing_jobs ON parsing_jobs
            FOR ALL
            USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    """)

    # ── pdf_documents ─────────────────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS shared_access_pdf_documents ON pdf_documents")
    op.drop_index("ix_pdf_documents_plan", table_name="pdf_documents")
    op.add_column(
        "pdf_documents",
        sa.Column("organization_id", sa.dialects.postgresql.UUID(), nullable=True),
    )
    op.create_index("ix_pdf_documents_organization_id", "pdf_documents", ["organization_id"])
    op.create_index("ix_pdf_documents_org_plan", "pdf_documents", ["organization_id", "plan_idn"])
    op.execute("""
        CREATE POLICY tenant_isolation_pdf_documents ON pdf_documents
            FOR ALL
            USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    """)

    # ── cached_api_responses ──────────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS shared_access_cached_api_responses ON cached_api_responses")
    op.drop_index("ix_cached_responses_key", table_name="cached_api_responses")
    op.drop_constraint("uq_cached_responses_key", table_name="cached_api_responses", type_="unique")
    op.add_column(
        "cached_api_responses",
        sa.Column("organization_id", sa.dialects.postgresql.UUID(), nullable=True),
    )
    op.create_index(
        "ix_cached_api_responses_organization_id",
        "cached_api_responses",
        ["organization_id"],
    )
    op.create_index(
        "ix_cached_responses_org_key",
        "cached_api_responses",
        ["organization_id", "cache_key"],
    )
    op.create_unique_constraint(
        "uq_cached_responses_org_key",
        "cached_api_responses",
        ["organization_id", "cache_key"],
    )
    op.execute("""
        CREATE POLICY tenant_isolation_cached_api_responses ON cached_api_responses
            FOR ALL
            USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    """)
