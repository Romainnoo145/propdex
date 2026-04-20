"""Per-parcel projecttype assignment (M047/S01).

Org-scoped: één assignment per (organization_id, parcel_id). Default wanneer
geen record bestaat = 'onbepaald' (zie endpoint layer). Score-engine refactor
(M047/S03) leest dit om conditional weights per factor toe te passen.
"""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin


class ParcelProjectType(Base, TenantMixin):
    """User-gekozen projecttype per parcel binnen een organization.

    NIET TimestampMixin: deze tabel heeft domein-specifieke timestamp (`set_at`
    = moment van assignment, niet "rij bijgewerkt"). `updated_at` zou semantisch
    dubbelop zijn en verwarring creëren in audit-trails.
    """

    __tablename__ = "parcel_project_types"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    parcel_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Kadaster/BAG parcel ID (e.g. NL.IMBAG.Pand.0983100000000001)",
    )
    # organization_id komt uit TenantMixin (nullable=False, index=True)
    project_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment=(
            "Eén van: nieuwbouw_wonen, transformatie_wonen, optoppen, splitsen, "
            "commercieel_naar_wonen, onbepaald. Gevalideerd in API-laag via "
            "ProjectType Literal (zie parcel_project_type_schemas.py)."
        ),
    )
    set_at: Mapped[datetime] = mapped_column(
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False,
        comment="Moment van (meest recente) assignment.",
    )
    set_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment=(
            "User die deze assignment heeft gezet. SET NULL bij user-delete zodat "
            "de projecttype-historie in de org behouden blijft."
        ),
    )

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "parcel_id",
            name="uq_parcel_project_types_org_parcel",
        ),
        Index(
            "ix_parcel_project_types_org_parcel",
            "organization_id",
            "parcel_id",
        ),
    )
