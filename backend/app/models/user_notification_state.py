"""UserNotificationState model for tracking per-user per-project notification state."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class UserNotificationState(Base, TimestampMixin):
    """
    UserNotificationState model - tracks when each user last viewed changes for each project.

    Used to compute unread change counts:
    - Compare ChangeRecord.detected_at with UserNotificationState.last_viewed_at
    - Records newer than last_viewed_at are "unread"

    User-scoped — each user has their own notification state.
    Updated whenever user views changes for a specific project.
    """

    __tablename__ = "user_notification_states"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )

    last_viewed_at: Mapped[datetime] = mapped_column(
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "project_id",
            name="uq_user_notification_states_user_project",
        ),
        Index("ix_user_notification_states_user_project", "user_id", "project_id"),
    )
