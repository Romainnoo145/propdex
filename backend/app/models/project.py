"""Project model for report folder organization."""

import uuid

from sqlalchemy import Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class Project(Base, TenantMixin, TimestampMixin):
    """
    Project model for organizing saved reports into named folders.

    Multi-tenant isolated via organization_id.
    Projects are optional - reports can exist without a project.
    """

    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    __table_args__ = (
        Index("ix_projects_org_name", "organization_id", "name"),
    )
