"""Static lookup table mapping gemeente_code (GM####) to provincie_code (PV##).

Seed data from CBS Open Data table 85385NED, generated via
backend/app/data/generate_gemeente_provincie_map.py and committed as
backend/app/data/gemeente_provincie_map.json. The M045 cascade query
uses this table to resolve a parcel's provincie from its gemeente_code.

This table is public reference data — NOT organization-scoped (no
TenantMixin) and NOT time-tracked (no TimestampMixin). Rows are only
updated when CBS publishes a new boundary update (typically January 1
of each year when gemeentes merge or split).
"""

from sqlalchemy import Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GemeenteProvincieMap(Base):
    """Static CBS-sourced mapping: gemeente_code -> provincie_code.

    Both codes use the CBS prefix convention:
    - gemeente_code: "GM####" (e.g., "GM0983" for Venlo)
    - provincie_code: "PV##" (e.g., "PV31" for Limburg)

    The gemeente_code format matches parcel_cache.gemeente_code exactly
    (verified via production data: both store the "GM"-prefixed form).
    """

    __tablename__ = "gemeente_provincie_map"

    gemeente_code: Mapped[str] = mapped_column(
        String(10),
        primary_key=True,
        comment="CBS gemeente code with GM prefix, e.g. 'GM0983' for Venlo",
    )
    provincie_code: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="CBS provincie code with PV prefix, e.g. 'PV31' for Limburg",
    )

    __table_args__ = (
        Index("ix_gemeente_provincie_map_provincie", "provincie_code"),
    )
