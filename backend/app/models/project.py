"""Project model for report folder organization."""

import uuid

from sqlalchemy import ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Project(Base, TimestampMixin):
    """
    Project model for organizing saved reports into named folders.

    Organization_id is nullable — retained for backward compatibility
    with existing project hierarchies but not required for new projects.
    Projects are optional - reports can exist without a project.

    Extended in Phase 26 to support hierarchical gemeente/wijk grouping
    and change monitoring capabilities.
    """

    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Phase 26: Hierarchical project grouping (gemeente -> wijk -> project)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    gemeente_code: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
    )

    wijk_naam: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )

    is_monitored: Mapped[bool] = mapped_column(
        nullable=False,
        server_default=text("true"),
    )

    # Self-referential relationships for hierarchy
    children: Mapped[list["Project"]] = relationship(
        "Project",
        back_populates="parent",
        cascade="all, delete-orphan",
        foreign_keys="[Project.parent_id]",
    )

    parent: Mapped["Project | None"] = relationship(
        "Project",
        back_populates="children",
        remote_side="[Project.id]",
        foreign_keys="[Project.parent_id]",
    )

    __table_args__ = (
        Index("ix_projects_org_name", "organization_id", "name"),
    )
