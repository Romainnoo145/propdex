"""create gemeente_documents table for beleidsdocumenten

Revision ID: s0_create_gemeente_documents
Revises: r0_add_address_to_favorites
Create Date: 2026-04-13
"""

from alembic import op
import sqlalchemy as sa

revision = "s0_create_gemeente_documents"
down_revision = "r0_add_address_to_favorites"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create gemeente_documents table for municipality-level beleidsdocumenten."""
    op.create_table(
        "gemeente_documents",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("gemeente_naam", sa.String(100), nullable=False, comment="Municipality display name"),
        sa.Column("document_type", sa.String(50), nullable=False, comment="Beleidsdocument type"),
        sa.Column("filename", sa.String(255), nullable=False, comment="Original or derived filename"),
        sa.Column("content_type", sa.String(100), nullable=False, comment="MIME type"),
        sa.Column("file_data", sa.LargeBinary(), nullable=False, comment="File bytes (max 25MB)"),
        sa.Column("file_size", sa.Integer(), nullable=False, comment="File size in bytes"),
        sa.Column("source_url", sa.String(500), nullable=True, comment="URL on officielebekendmakingen.nl"),
        sa.Column("koop_identifier", sa.String(200), nullable=True, comment="KOOP SRU document identifier"),
        sa.Column("ai_summary", sa.Text(), nullable=True, comment="AI-generated summary"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("gemeente_naam", "koop_identifier", name="uq_gemeente_doc_identifier"),
    )
    op.create_index("ix_gemeente_documents_naam", "gemeente_documents", ["gemeente_naam"])
    op.create_index("ix_gemeente_documents_naam_type", "gemeente_documents", ["gemeente_naam", "document_type"])


def downgrade() -> None:
    """Drop gemeente_documents table."""
    op.drop_index("ix_gemeente_documents_naam_type", table_name="gemeente_documents")
    op.drop_index("ix_gemeente_documents_naam", table_name="gemeente_documents")
    op.drop_table("gemeente_documents")
