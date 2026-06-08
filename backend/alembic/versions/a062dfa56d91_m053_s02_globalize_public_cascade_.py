"""m053_s02 globalize public cascade policy docs

Published gemeente policy documents (woonvisie, omgevingsvisie) are vendor-global
by design — shared across orgs like every other reader in policy_documents/service.py
and documents/cascade_service.py already assumes. Seed tools created them
is_global=false, which hid the woonvisie from the Hauzer demo org. Scope: ONLY these
public source_keys, never arbitrary org uploads (multi-tenant safety).
"""
from alembic import op

revision = "a062dfa56d91"
down_revision = "20260603_m052_s04_disp"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE policy_documents
        SET is_global = true
        WHERE source_key IN ('woonvisie', 'omgevingsvisie')
          AND is_global = false
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE policy_documents
        SET is_global = false
        WHERE source_key IN ('woonvisie', 'omgevingsvisie')
        """
    )
