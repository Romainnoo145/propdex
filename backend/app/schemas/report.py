"""Report schemas for saving and managing property intelligence reports."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.property import PropertyReportResponse


class ReportFromParcelRequest(BaseModel):
    """Schema for generating a report from a scan result parcel."""

    parcel_id: uuid.UUID = Field(description="ParcelCache UUID")
    notes: str | None = Field(default=None, description="Optional notes for the report")
    project_id: uuid.UUID | None = Field(default=None, description="Optional project folder ID")
    address_override: str | None = Field(
        default=None,
        description="Display address to use instead of parcel_cache.address (e.g. 'Houtstraat 13, 5911JB Venlo')",
    )


class ReportFromAddressRequest(BaseModel):
    """Schema for generating a report directly from postcode + huisnummer."""

    postcode: str = Field(description="Dutch postcode (e.g. '1234AB' or '1234 AB')")
    huisnummer: int = Field(ge=1, description="House number")
    notes: str | None = Field(default=None, description="Optional notes for the report")
    project_id: uuid.UUID | None = Field(default=None, description="Optional project folder ID")


class ReportSaveRequest(BaseModel):
    """Schema for saving a property report."""

    report_data: dict = Field(
        description="Full PropertyReportResponse dict from a property lookup",
    )
    notes: str | None = Field(
        default=None,
        description="Optional free-text notes for team collaboration",
    )
    project_id: uuid.UUID | None = Field(
        default=None,
        description="Optional project folder ID",
    )

    @field_validator("report_data")
    @classmethod
    def validate_report_data(cls, v: dict) -> dict:
        """Validate that report_data can be parsed as PropertyReportResponse."""
        try:
            PropertyReportResponse.model_validate(v)
        except Exception as e:
            raise ValueError(f"Invalid report_data: {e}") from e
        return v


class ReportUpdateNotes(BaseModel):
    """Schema for updating report notes."""

    notes: str | None = Field(
        description="Free-text notes for team collaboration",
    )


class ReportAssignProject(BaseModel):
    """Schema for assigning report to a project."""

    project_id: uuid.UUID | None = Field(
        description="Project ID (null = auto-assign by location)",
    )


class ReportListItem(BaseModel):
    """Lightweight schema for report list view (without full report_data)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(
        description="Report ID",
    )
    report_name: str = Field(
        description="Auto-generated report name from address",
    )
    postcode: str = Field(
        description="Dutch postcode (e.g., '1234 AB')",
    )
    city: str = Field(
        description="City/gemeente name",
    )
    notes: str | None = Field(
        description="Free-text notes",
    )
    project_id: uuid.UUID | None = Field(
        description="Project folder ID (if assigned)",
    )
    source_parcel_id: uuid.UUID | None = Field(
        default=None,
        description="Source ParcelCache UUID (if report was generated from parcel flow)",
    )
    completeness_score: float = Field(
        description="Report completeness score (0.0 to 1.0)",
        ge=0.0,
        le=1.0,
    )
    created_at: datetime = Field(
        description="Report creation timestamp",
    )
    updated_at: datetime = Field(
        description="Report last update timestamp",
    )


class ReportListResponse(BaseModel):
    """Schema for report list response."""

    reports: list[ReportListItem] = Field(
        description="List of reports",
    )
    total: int = Field(
        description="Total number of reports",
    )


class ReportDetailResponse(BaseModel):
    """Schema for full report detail (includes report_data)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(
        description="Report ID",
    )
    report_name: str = Field(
        description="Auto-generated report name from address",
    )
    report_data: dict = Field(
        description="Full PropertyReportResponse as JSONB",
    )
    postcode: str = Field(
        description="Dutch postcode (e.g., '1234 AB')",
    )
    city: str = Field(
        description="City/gemeente name",
    )
    notes: str | None = Field(
        description="Free-text notes",
    )
    project_id: uuid.UUID | None = Field(
        description="Project folder ID (if assigned)",
    )
    source_parcel_id: uuid.UUID | None = Field(
        default=None,
        description="Source ParcelCache UUID (if report was generated from parcel flow)",
    )
    created_at: datetime = Field(
        description="Report creation timestamp",
    )
    updated_at: datetime = Field(
        description="Report last update timestamp",
    )


class GenerateReportFromParcelResponse(BaseModel):
    """Schema for parcel-based report generation with explicit idempotency state."""

    report: ReportDetailResponse = Field(
        description="Saved report payload",
    )
    created: bool = Field(
        description="True when a new report row was created, false when existing report was reused",
    )


class ReportFreshnessResponse(BaseModel):
    """Schema for checking if saved report has available updates."""

    report_id: uuid.UUID = Field(
        description="Report ID",
    )
    has_updates: bool = Field(
        description="Whether fresh data differs from saved report",
    )
    updated_sections: list[dict] = Field(
        default_factory=list,
        description="Sections with available updates",
    )


class GeneratedDossierResponse(BaseModel):
    """Schema for a generated dossier audit record."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(description="Dossier generation record ID")
    report_id: uuid.UUID = Field(description="SavedReport ID this dossier was generated from")
    generated_by_user_id: uuid.UUID | None = Field(
        default=None,
        description="User ID who generated the dossier (null if user deleted)",
    )
    file_size_bytes: int = Field(description="PDF file size in bytes")
    template_version: str = Field(description="Template version used for generation")
    created_at: datetime = Field(description="Generation timestamp")


# Type aliases for sort parameters
SortField = Literal["created", "updated", "address"]
SortOrder = Literal["asc", "desc"]
