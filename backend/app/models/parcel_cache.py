"""ParcelCache model for spatial parcel data with three-tier caching."""

import uuid
from datetime import datetime

from geoalchemy2 import Geometry
from geoalchemy2.types import WKBElement
from sqlalchemy import Index, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class ParcelCache(Base, TenantMixin, TimestampMixin):
    """
    ParcelCache model for storing parcel geometry and enrichment data.

    Three-tier cache architecture:
    - Tier 1: Lightweight pre-scan data (geometry, flags, bestemmingen JSONB array)
              Always populated during area scan. Stable, rarely changes.
    - Tier 2: On-demand enrichment (enrichment_data JSONB)
              Populated when user opens parcel detail. Cached for performance.
    - Tier 3: BRK eigendomsdata - NEVER stored here (legitimate interest basis)
              Always queried fresh at request time from Kadaster API.

    Multi-tenant isolated via organization_id. Geometry stored in EPSG:28992
    (RD New - Dutch national grid) with GIST spatial index for fast intersection queries.
    """

    __tablename__ = "parcel_cache"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    # Kadaster parcel identifier (e.g., "HTT02-A-1234")
    parcel_id: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True,
    )

    # PDOK display string (e.g., "Venlo I 6658") — derived at scan time from
    # kadastrale_gemeente_waarde + sectie + perceelnummer properties
    parcel_code: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True,
        comment="PDOK display string (e.g. 'Venlo I 6658')",
    )

    # --- Tier 1: Lightweight pre-scan data (stable, always populated) ---

    # Geometry stored in EPSG:28992 (RD New - Dutch national grid)
    # GIST index created explicitly in migration (not auto-detected by Alembic)
    geometry: Mapped[WKBElement] = mapped_column(
        Geometry(geometry_type="MULTIPOLYGON", srid=28992),
        nullable=False,
    )

    # Denormalized address for display (from kadaster/BAG)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Municipality code (CBS gemeentecode, e.g., "0363" for Amsterdam)
    gemeente_code: Mapped[str | None] = mapped_column(String(10), nullable=True, index=True)

    # Parcel area in square meters
    area_m2: Mapped[float | None] = mapped_column(nullable=True)

    # BAG cross-reference flag
    has_pand: Mapped[bool] = mapped_column(default=False, nullable=False)

    # BAG building attributes (from WFS properties)
    bouwjaar: Mapped[int | None] = mapped_column(nullable=True)
    pand_status: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # --- Tier 1: Bestemming data (dubbele bestemming as JSONB array) ---

    # Stores multiple overlapping zonings as JSONB array
    # Example: [{"type": "Wonen", "naam": "Wonen - 1"}, {"type": "Waarde", "naam": "Waarde - Archeologie"}]
    # NULL means not yet fetched, empty array [] means no bestemmingen found
    bestemmingen: Mapped[list | None] = mapped_column(
        type_=JSONB, nullable=True, default=None,
    )

    # --- Tier 2: On-demand enrichment (populated when user opens detail) ---

    # JSONB for bestemming details, vergunningen, etc.
    # NULL means not yet enriched
    enrichment_data: Mapped[dict | None] = mapped_column(
        type_=JSONB, nullable=True, default=None,
    )
    enriched_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # --- Tier 3: BRK eigendomsdata = NEVER stored here ---
    # No owner_name, no owner_address, no kadaster eigendoms fields
    # BRK data is always queried fresh at request time (legitimate interest)

    __table_args__ = (
        Index("ix_parcel_cache_org_gemeente", "organization_id", "gemeente_code"),
        Index("ix_parcel_cache_org_parcel", "organization_id", "parcel_id"),
        Index("ix_parcel_cache_org_parcel_code", "organization_id", "parcel_code"),
        UniqueConstraint("organization_id", "parcel_id", name="uq_parcel_cache_org_parcel"),
    )
