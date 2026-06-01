"""DismissedKans — off-market kansen die een user uit z'n radar heeft verborgen.

User-scoped: elke user verbergt z'n eigen kansen, zodat de volgende berekening ze
uitsluit en er ruimte ontstaat voor nieuwe percelen. (M052/S03)
"""

import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class DismissedKans(Base, TimestampMixin):
    """Een perceel dat een user heeft weggetikt uit z'n off-market kansen."""

    __tablename__ = "dismissed_kansen"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    parcel_id: Mapped[str] = mapped_column(String, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "parcel_id", name="uq_dismissed_kans_user_parcel"),
    )
