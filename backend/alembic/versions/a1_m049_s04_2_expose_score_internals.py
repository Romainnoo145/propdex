"""m049_s04_2_add_expose_score_internals

Revision ID: b2a4f6c8e1d3
Revises: 657143b79099
Create Date: 2026-05-16 13:00:00.000000

Add expose_score_internals flag to organizations for Phase 04.2 security
hardening. New orgs (including demo signups) default to FALSE — public API
will redact factor weights. Existing orgs at migration time are flipped to
TRUE so paying customers see no behavioral change.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = 'b2a4f6c8e1d3'
down_revision: str | Sequence[str] | None = '657143b79099'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'organizations',
        sa.Column(
            'expose_score_internals',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false'),
            comment=(
                'When False, public scoring responses redact factor weights '
                '(gewicht/bijdrage/percentage_of_category/waarde). Defaults '
                'False for new orgs; existing orgs at migration time are '
                'flipped True so legacy paying customers see no UI change.'
            ),
        ),
    )
    op.execute(
        "UPDATE organizations SET expose_score_internals = true "
        "WHERE expose_score_internals = false"
    )


def downgrade() -> None:
    op.drop_column('organizations', 'expose_score_internals')
