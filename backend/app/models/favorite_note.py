"""FavoriteNote model — individual notes attached to a parcel favorite."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class FavoriteNote(Base):
    """
    One note within the werkhypothese/notities section of a workspace.

    Each ParcelFavorite can have multiple notes. Notes are user-owned —
    only the user who created the favorite can CRUD notes.
    """

    __tablename__ = "favorite_notes"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    favorite_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("parcel_favorites.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    content: Mapped[str] = mapped_column(
        String(2000),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )
