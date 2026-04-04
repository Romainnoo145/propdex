"""add address column to parcel_favorites

Revision ID: r0_add_address_to_favorites
Revises: q0_chat_conversations
Create Date: 2026-04-03
"""

from alembic import op
import sqlalchemy as sa

revision = "r0_add_address_to_favorites"
down_revision = "q0_chat_conversations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add address column to parcel_favorites table."""
    op.add_column(
        "parcel_favorites",
        sa.Column(
            "address",
            sa.String(length=500),
            nullable=True,
            comment="Denormalized BAG address for display",
        ),
    )


def downgrade() -> None:
    """Remove address column from parcel_favorites table."""
    op.drop_column("parcel_favorites", "address")
