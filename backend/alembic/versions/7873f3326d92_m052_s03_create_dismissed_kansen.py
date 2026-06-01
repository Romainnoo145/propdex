"""M052/S03 create dismissed_kansen

Revision ID: 7873f3326d92
Revises: 20260521_m052_s01
Create Date: 2026-06-01 13:34:51.170271

Alleen de dismissed_kansen-tabel. De autogenerate-drift (PostGIS tiger-tabellen
droppen + comment-wijzigingen) is bewust verwijderd — niet-app-schema, niet aanraken.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7873f3326d92"
down_revision: Union[str, Sequence[str], None] = "20260521_m052_s01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "dismissed_kansen",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("parcel_id", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "parcel_id", name="uq_dismissed_kans_user_parcel"),
    )
    op.create_index(
        op.f("ix_dismissed_kansen_user_id"),
        "dismissed_kansen",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_dismissed_kansen_user_id"), table_name="dismissed_kansen")
    op.drop_table("dismissed_kansen")
