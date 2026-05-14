"""DataSourceStatus model — vendor-managed catalog row per (gemeente, source_key).

M049/S01: Phase 2 admin API + Phase 5 IntegrationCredential reuse this
vendor-managed pattern.

DELIBERATELY OMITS TenantMixin: Propdex BV (superuser) maintains this catalog
centrally for all customer orgs. RBAC is enforced at the route layer via
Depends(get_current_superuser), NOT at the row layer. Eng-review locked
2026-05-14.

Status enum (`live` / `broken` / `missing` / `not_applicable`) is validated at
the Pydantic layer via `DataSourceStatusCreate`. The DB column is plain
String(20) — no Postgres native ENUM (eng-review: avoid migration-friction;
revisit when statuses stabilize).
"""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict
from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

DataSourceStatusValue = Literal["live", "broken", "missing", "not_applicable"]


class DataSourceStatus(Base, TimestampMixin):
    """Vendor-managed status row for one (gemeente_code, source_key) combination.

    Reads/writes are restricted to superuser routes (Phase 2). No TenantMixin
    means cross-org enumeration: a single GM0983/woonvisie row is visible to all
    customer organizations — that is the contract.
    """

    __tablename__ = "data_source_status"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    gemeente_code: Mapped[str] = mapped_column(
        String(6),
        nullable=False,
        comment="Gemeente identifier (e.g. 'GM0983' for Venlo)",
    )
    source_key: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        comment="Kebab-case key from data_source_keys catalog (e.g. 'woonvisie')",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment=(
            "One of: live, broken, missing, not_applicable. "
            "Validated via Pydantic at the API boundary."
        ),
    )
    last_checked: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=False),
        nullable=True,
        comment="When status was last confirmed by probe / refresh",
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Diagnostic message if status=broken",
    )
    configuratie: Mapped[dict[str, object] | None] = mapped_column(
        JSONB,
        nullable=True,
        comment=(
            "Non-secret state (refresh-interval, last_synced_doc_id, "
            "retry-count). Secrets live in integration_credentials (Phase 5)."
        ),
    )
    managed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Vendor superuser who last managed this row (audit-trail)",
    )

    __table_args__ = (
        UniqueConstraint(
            "gemeente_code",
            "source_key",
            name="uq_data_source_status_gemeente_source",
        ),
        Index("ix_data_source_status_gemeente_code", "gemeente_code"),
    )


# ─── Pydantic schemas (status-enum validation) ──────────────────────────────


class DataSourceStatusCreate(BaseModel):
    """Create payload — enforces status enum + extra="forbid" at the API boundary."""

    model_config = ConfigDict(extra="forbid")

    gemeente_code: str
    source_key: str
    status: DataSourceStatusValue
    last_checked: datetime | None = None
    error_message: str | None = None
    configuratie: dict[str, object] | None = None
    managed_by_user_id: uuid.UUID | None = None


class DataSourceStatusRead(BaseModel):
    """Read payload returned by GET endpoints (Phase 2)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gemeente_code: str
    source_key: str
    status: DataSourceStatusValue
    last_checked: datetime | None
    error_message: str | None
    configuratie: dict[str, object] | None
    managed_by_user_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
