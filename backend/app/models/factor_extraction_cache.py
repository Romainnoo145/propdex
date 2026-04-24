"""Persistent cache voor per-factor document-extracties (M047/S04).

Cache-key: (parcel_id, policy_document_id, factor_id, schema_version).
Unique constraint over die 4 kolommen garandeert 1 rij per cache-slot.
schema_version in de key betekent: bij schema-bump blijft oude entry bestaan
maar wordt niet meer als hit behandeld — S05 cascade job kan via separate
cleanup-query oude versies verwijderen (out-of-scope voor S04).

NIET TenantMixin: cache is globaal per document+parcel. policy_documents
zelf kan global zijn (is_global=True per M045) of org-scoped. parcel_id
staat op dezelfde parcel in meerdere orgs tegelijk mogelijk maar de
extractie output is org-agnostic (zelfde document + zelfde parcel + zelfde
factor = zelfde output). Org-context komt in op scoring-laag (S03), niet hier.

M5 expliciet: No organization_id column — isolation is TRANSITIVELY enforced
via policy_document_id (non-global docs hebben per-org UUIDs, cross-org
collision onmogelijk op PK-niveau) en via scoring-laag (S03 past org-specifieke
weights toe na cache-read). Deze afwijking van de CLAUDE.md "every model needs
organization_id" regel is bewust — gedocumenteerd hier én in slice-summary.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, Index, Integer, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class FactorExtractionCache(Base):
    """One row per (parcel, document, factor, schema_version) extraction."""

    __tablename__ = "factor_extraction_cache"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    # "__document__" sentinel used for document-level factor types
    # (woonvisie_match and future cascade factors where extraction is
    # not parcel-specific). See factor_extraction_schemas.DOCUMENT_SENTINEL.
    parcel_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Kadaster/BAG parcel ID (e.g. NL.IMBAG.Pand.0983100000000001)",
    )
    policy_document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("policy_documents.id", ondelete="CASCADE"),
        nullable=False,
        comment=(
            "FK naar specifieke policy_documents row — elke versie is aparte row "
            "(version_number increment bij re-upload per M045). Cache-hit vereist "
            "exact zelfde document_id; nieuwe upload = nieuwe row = cache-miss."
        ),
    )
    factor_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Stable factor-identifier, matcht FactorDefinition.factor_id.",
    )
    schema_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("1"),
        comment=(
            "factor_extraction_schemas.SCHEMA_VERSION op moment van write. "
            "Bij runtime-mismatch met huidige SCHEMA_VERSION: cache-miss."
        ),
    )
    extracted_payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        comment=(
            "Claude's tool_use.input dict, Pydantic-gevalideerd tegen "
            "FactorDefinition.payload_model op moment van write."
        ),
    )
    extracted_at: Mapped[datetime] = mapped_column(
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
        comment="Moment van Claude-call (niet cache-insert — zelfde voor verse write).",
    )
    cached_at: Mapped[datetime] = mapped_column(
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False,
        comment="Moment van row-insert/update (onupdate = cache-refresh-bump).",
    )

    __table_args__ = (
        UniqueConstraint(
            "parcel_id",
            "policy_document_id",
            "factor_id",
            "schema_version",
            name="uq_factor_extraction_cache_key",
        ),
        Index(
            "ix_factor_extraction_cache_doc_factor",
            "policy_document_id",
            "factor_id",
        ),
        Index(
            "ix_factor_extraction_cache_parcel",
            "parcel_id",
        ),
    )
