"""M052/S04 add organizations afzender-velden

Revision ID: 20260603_m052_s04_afz
Revises: 7873f3326d92
Create Date: 2026-06-03 00:00:00.000000
"""
import sqlalchemy as sa
from alembic import op

revision = "20260603_m052_s04_afz"
down_revision = "7873f3326d92"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("afzender_adres", sa.Text(), nullable=True))
    op.add_column("organizations", sa.Column("contactpersoon", sa.Text(), nullable=True))
    op.add_column("organizations", sa.Column("contact_email", sa.Text(), nullable=True))
    op.add_column("organizations", sa.Column("contact_telefoon", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("organizations", "contact_telefoon")
    op.drop_column("organizations", "contact_email")
    op.drop_column("organizations", "contactpersoon")
    op.drop_column("organizations", "afzender_adres")
