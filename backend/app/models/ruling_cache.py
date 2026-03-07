"""RulingCache model -- org-agnostic persistent court ruling storage.

Court rulings are public data (rechtspraak.nl) shared across all tenants.
This model intentionally does NOT use TenantMixin / organization_id.
"""

from datetime import datetime

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class RulingCache(Base, TimestampMixin):
    """Cached court ruling -- org-agnostic, ECLI is globally unique public data.

    No organization_id: court rulings are public data shared across all tenants.
    This is an explicit departure from TenantMixin used by other models.
    """

    __tablename__ = "ruling_cache"

    ecli: Mapped[str] = mapped_column(String(100), primary_key=True)
    court_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    instantie: Mapped[str | None] = mapped_column(String(200))
    datum_uitspraak: Mapped[str | None] = mapped_column(String(20), index=True)
    title: Mapped[str | None] = mapped_column(String(500))
    summary: Mapped[str | None] = mapped_column(Text)
    full_text: Mapped[str | None] = mapped_column(Text)
    gemeente_query: Mapped[str | None] = mapped_column(String(200), index=True)
    fetched_at: Mapped[datetime] = mapped_column(nullable=False)
