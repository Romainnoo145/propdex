"""Project schemas for report folder organization."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    """Schema for creating a new project."""

    name: str = Field(
        max_length=100,
        description="Project name",
    )
    description: str | None = Field(
        default=None,
        description="Optional project description",
    )


class ProjectUpdate(BaseModel):
    """Schema for updating an existing project."""

    name: str | None = Field(
        default=None,
        max_length=100,
        description="Project name",
    )
    description: str | None = Field(
        default=None,
        description="Optional project description",
    )


class ProjectResponse(BaseModel):
    """Schema for project response."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(
        description="Project ID",
    )
    name: str = Field(
        description="Project name",
    )
    description: str | None = Field(
        description="Project description",
    )
    created_at: datetime = Field(
        description="Project creation timestamp",
    )
    updated_at: datetime = Field(
        description="Project last update timestamp",
    )
    report_count: int = Field(
        default=0,
        description="Number of reports in this project",
    )


class ProjectListResponse(BaseModel):
    """Schema for project list response."""

    projects: list[ProjectResponse] = Field(
        description="List of projects",
    )
    total: int = Field(
        description="Total number of projects",
    )
