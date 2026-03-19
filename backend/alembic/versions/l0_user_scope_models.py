"""User-scope favorites, reports, and documents.

Switch 6 user-scoped models from organization_id to user_id filtering.
SavedReport gets a new user_id column. All others already have user_id.

Tables affected:
- parcel_favorites: drop org_id, rewrite unique constraint to (user_id, parcel_id)
- saved_reports: add user_id, drop org_id, rewrite indexes
- parcel_documents: drop org_id, rewrite indexes to use uploaded_by_user_id
- generated_dossiers: drop org_id, rewrite indexes to use generated_by_user_id
- change_read_states: drop org_id (user_id constraints already correct)
- user_notification_states: drop org_id (user_id constraints already correct)

Revision ID: l0_user_scope_models
Revises: k0_detenant_scan_pipeline
Create Date: 2026-03-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "l0_user_scope_models"
down_revision: Union[str, Sequence[str], None] = "k0_detenant_scan_pipeline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── saved_reports ─────────────────────────────────────────────────
    # Add user_id column (nullable initially for backfill)
    op.add_column("saved_reports", sa.Column(
        "user_id", sa.UUID(), nullable=True,
    ))
    op.create_foreign_key(
        "fk_saved_reports_user_id", "saved_reports", "users",
        ["user_id"], ["id"], ondelete="CASCADE",
    )

    # Backfill: set user_id from the organization's first user
    # In practice, each org has one primary user during dev phase
    op.execute("""
        UPDATE saved_reports sr
        SET user_id = (
            SELECT u.id FROM users u
            WHERE u.organization_id = sr.organization_id
            ORDER BY u.created_at ASC
            LIMIT 1
        )
        WHERE sr.user_id IS NULL
    """)

    # Make user_id NOT NULL after backfill
    op.alter_column("saved_reports", "user_id", nullable=False)

    # Drop old org-based indexes
    op.drop_index("ix_saved_reports_org_created", table_name="saved_reports")
    op.drop_index("ix_saved_reports_org_updated", table_name="saved_reports")
    op.drop_index("ix_saved_reports_org_city", table_name="saved_reports")
    op.drop_index("ix_saved_reports_org_project", table_name="saved_reports")
    op.drop_index("ix_saved_reports_org_source_parcel", table_name="saved_reports")
    op.drop_index("uq_saved_reports_org_source_parcel_active", table_name="saved_reports")

    # Drop TenantMixin auto-index and org_id column
    op.drop_index("ix_saved_reports_organization_id", table_name="saved_reports")
    op.drop_column("saved_reports", "organization_id")

    # Create new user-based indexes
    op.create_index("ix_saved_reports_user_created", "saved_reports", ["user_id", "created_at"])
    op.create_index("ix_saved_reports_user_city", "saved_reports", ["user_id", "city"])
    op.create_index("ix_saved_reports_user_project", "saved_reports", ["user_id", "project_id"])
    op.create_index("ix_saved_reports_user_source_parcel", "saved_reports", ["user_id", "source_parcel_id"])
    op.execute("""
        CREATE UNIQUE INDEX uq_saved_reports_user_source_parcel_active
        ON saved_reports (user_id, source_parcel_id)
        WHERE deleted_at IS NULL AND source_parcel_id IS NOT NULL
    """)

    # RLS: user-scoped
    op.execute("DROP POLICY IF EXISTS tenant_isolation_saved_reports ON saved_reports")
    op.execute("""
        CREATE POLICY user_scope_saved_reports ON saved_reports
            FOR ALL USING (user_id::text = current_setting('app.current_user_id', TRUE))
    """)

    # ── parcel_favorites ──────────────────────────────────────────────
    # Drop old org-based constraints and indexes
    op.drop_constraint("uq_parcel_favorites_org_user_parcel", table_name="parcel_favorites", type_="unique")
    op.drop_index("ix_parcel_favorites_org_user", table_name="parcel_favorites")
    op.drop_index("ix_parcel_favorites_org_gemeente", table_name="parcel_favorites")
    op.drop_index("ix_parcel_favorites_organization_id", table_name="parcel_favorites")
    op.drop_column("parcel_favorites", "organization_id")

    # Create new user-based constraints and indexes
    op.create_unique_constraint("uq_parcel_favorites_user_parcel", "parcel_favorites", ["user_id", "parcel_id"])
    op.create_index("ix_parcel_favorites_user", "parcel_favorites", ["user_id"])
    op.create_index("ix_parcel_favorites_user_gemeente", "parcel_favorites", ["user_id", "gemeente_code"])

    # RLS: user-scoped
    op.execute("DROP POLICY IF EXISTS tenant_isolation_parcel_favorites ON parcel_favorites")
    op.execute("""
        CREATE POLICY user_scope_parcel_favorites ON parcel_favorites
            FOR ALL USING (user_id::text = current_setting('app.current_user_id', TRUE))
    """)

    # ── parcel_documents ──────────────────────────────────────────────
    # Drop old org-based indexes
    op.drop_index("ix_parcel_documents_org_parcel", table_name="parcel_documents")
    op.drop_index("ix_parcel_documents_org_parcel_type", table_name="parcel_documents")
    op.drop_index("ix_parcel_documents_organization_id", table_name="parcel_documents")

    # Make uploaded_by_user_id NOT NULL (was nullable)
    op.execute("UPDATE parcel_documents SET uploaded_by_user_id = (SELECT id FROM users LIMIT 1) WHERE uploaded_by_user_id IS NULL")
    op.alter_column("parcel_documents", "uploaded_by_user_id", nullable=False)

    op.drop_column("parcel_documents", "organization_id")

    # Create new user-based indexes
    op.create_index("ix_parcel_documents_user_parcel", "parcel_documents", ["uploaded_by_user_id", "parcel_id"])
    op.create_index("ix_parcel_documents_user_parcel_type", "parcel_documents", ["uploaded_by_user_id", "parcel_id", "document_type"])

    # RLS: user-scoped
    op.execute("""
        ALTER TABLE parcel_documents ENABLE ROW LEVEL SECURITY;
        CREATE POLICY user_scope_parcel_documents ON parcel_documents
            FOR ALL USING (uploaded_by_user_id::text = current_setting('app.current_user_id', TRUE))
    """)

    # ── generated_dossiers ────────────────────────────────────────────
    op.drop_index("ix_generated_dossiers_org_report", table_name="generated_dossiers")
    op.drop_index("ix_generated_dossiers_org_created", table_name="generated_dossiers")
    op.drop_index("ix_generated_dossiers_organization_id", table_name="generated_dossiers")

    # Make generated_by_user_id NOT NULL (was nullable)
    op.execute("UPDATE generated_dossiers SET generated_by_user_id = (SELECT id FROM users LIMIT 1) WHERE generated_by_user_id IS NULL")
    op.alter_column("generated_dossiers", "generated_by_user_id", nullable=False)

    op.drop_column("generated_dossiers", "organization_id")

    op.create_index("ix_generated_dossiers_user_report", "generated_dossiers", ["generated_by_user_id", "report_id"])
    op.create_index("ix_generated_dossiers_user_created", "generated_dossiers", ["generated_by_user_id", "created_at"])

    # RLS: user-scoped
    op.execute("""
        ALTER TABLE generated_dossiers ENABLE ROW LEVEL SECURITY;
        CREATE POLICY user_scope_generated_dossiers ON generated_dossiers
            FOR ALL USING (generated_by_user_id::text = current_setting('app.current_user_id', TRUE))
    """)

    # ── change_read_states ────────────────────────────────────────────
    op.drop_index("ix_change_read_states_organization_id", table_name="change_read_states")
    op.drop_column("change_read_states", "organization_id")

    # RLS: user-scoped (constraints already use user_id)
    op.execute("""
        ALTER TABLE change_read_states ENABLE ROW LEVEL SECURITY;
        CREATE POLICY user_scope_change_read_states ON change_read_states
            FOR ALL USING (user_id::text = current_setting('app.current_user_id', TRUE))
    """)

    # ── user_notification_states ──────────────────────────────────────
    op.drop_index("ix_user_notification_states_organization_id", table_name="user_notification_states")
    op.drop_column("user_notification_states", "organization_id")

    # RLS: user-scoped (constraints already use user_id)
    op.execute("""
        ALTER TABLE user_notification_states ENABLE ROW LEVEL SECURITY;
        CREATE POLICY user_scope_user_notification_states ON user_notification_states
            FOR ALL USING (user_id::text = current_setting('app.current_user_id', TRUE))
    """)


def downgrade() -> None:
    # ── user_notification_states ──────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS user_scope_user_notification_states ON user_notification_states")
    op.add_column("user_notification_states", sa.Column("organization_id", sa.UUID(), nullable=True))
    op.create_index("ix_user_notification_states_organization_id", "user_notification_states", ["organization_id"])

    # ── change_read_states ────────────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS user_scope_change_read_states ON change_read_states")
    op.add_column("change_read_states", sa.Column("organization_id", sa.UUID(), nullable=True))
    op.create_index("ix_change_read_states_organization_id", "change_read_states", ["organization_id"])

    # ── generated_dossiers ────────────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS user_scope_generated_dossiers ON generated_dossiers")
    op.drop_index("ix_generated_dossiers_user_created", table_name="generated_dossiers")
    op.drop_index("ix_generated_dossiers_user_report", table_name="generated_dossiers")
    op.add_column("generated_dossiers", sa.Column("organization_id", sa.UUID(), nullable=True))
    op.create_index("ix_generated_dossiers_organization_id", "generated_dossiers", ["organization_id"])
    op.create_index("ix_generated_dossiers_org_report", "generated_dossiers", ["organization_id", "report_id"])
    op.create_index("ix_generated_dossiers_org_created", "generated_dossiers", ["organization_id", "created_at"])
    op.alter_column("generated_dossiers", "generated_by_user_id", nullable=True)

    # ── parcel_documents ──────────────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS user_scope_parcel_documents ON parcel_documents")
    op.drop_index("ix_parcel_documents_user_parcel_type", table_name="parcel_documents")
    op.drop_index("ix_parcel_documents_user_parcel", table_name="parcel_documents")
    op.add_column("parcel_documents", sa.Column("organization_id", sa.UUID(), nullable=True))
    op.create_index("ix_parcel_documents_organization_id", "parcel_documents", ["organization_id"])
    op.create_index("ix_parcel_documents_org_parcel", "parcel_documents", ["organization_id", "parcel_id"])
    op.create_index("ix_parcel_documents_org_parcel_type", "parcel_documents", ["organization_id", "parcel_id", "document_type"])
    op.alter_column("parcel_documents", "uploaded_by_user_id", nullable=True)

    # ── parcel_favorites ──────────────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS user_scope_parcel_favorites ON parcel_favorites")
    op.drop_index("ix_parcel_favorites_user_gemeente", table_name="parcel_favorites")
    op.drop_index("ix_parcel_favorites_user", table_name="parcel_favorites")
    op.drop_constraint("uq_parcel_favorites_user_parcel", table_name="parcel_favorites", type_="unique")
    op.add_column("parcel_favorites", sa.Column("organization_id", sa.UUID(), nullable=True))
    op.create_index("ix_parcel_favorites_organization_id", "parcel_favorites", ["organization_id"])
    op.create_index("ix_parcel_favorites_org_user", "parcel_favorites", ["organization_id", "user_id"])
    op.create_index("ix_parcel_favorites_org_gemeente", "parcel_favorites", ["organization_id", "gemeente_code"])
    op.create_unique_constraint("uq_parcel_favorites_org_user_parcel", "parcel_favorites", ["organization_id", "user_id", "parcel_id"])

    # ── saved_reports ─────────────────────────────────────────────────
    op.execute("DROP POLICY IF EXISTS user_scope_saved_reports ON saved_reports")
    op.execute("DROP INDEX IF EXISTS uq_saved_reports_user_source_parcel_active")
    op.drop_index("ix_saved_reports_user_source_parcel", table_name="saved_reports")
    op.drop_index("ix_saved_reports_user_project", table_name="saved_reports")
    op.drop_index("ix_saved_reports_user_city", table_name="saved_reports")
    op.drop_index("ix_saved_reports_user_created", table_name="saved_reports")

    op.add_column("saved_reports", sa.Column("organization_id", sa.UUID(), nullable=True))
    op.create_index("ix_saved_reports_organization_id", "saved_reports", ["organization_id"])
    op.create_index("ix_saved_reports_org_created", "saved_reports", ["organization_id", "created_at"])
    op.create_index("ix_saved_reports_org_updated", "saved_reports", ["organization_id", "updated_at"])
    op.create_index("ix_saved_reports_org_city", "saved_reports", ["organization_id", "city"])
    op.create_index("ix_saved_reports_org_project", "saved_reports", ["organization_id", "project_id"])
    op.create_index("ix_saved_reports_org_source_parcel", "saved_reports", ["organization_id", "source_parcel_id"])
    op.execute("""
        CREATE UNIQUE INDEX uq_saved_reports_org_source_parcel_active
        ON saved_reports (organization_id, source_parcel_id)
        WHERE deleted_at IS NULL AND source_parcel_id IS NOT NULL
    """)

    # Drop user_id column (added in upgrade)
    op.drop_constraint("fk_saved_reports_user_id", table_name="saved_reports", type_="foreignkey")
    op.drop_column("saved_reports", "user_id")
