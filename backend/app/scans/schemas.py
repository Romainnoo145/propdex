"""Pydantic schemas for area scan operations."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ScanCreateRequest(BaseModel):
    """Schema for triggering a new area scan."""

    gemeente_code: str = Field(
        description="CBS gemeentecode (e.g., '0363' for Amsterdam)",
        min_length=4,
        max_length=10,
    )
    gemeente_naam: str = Field(
        description="Display name (e.g., 'Amsterdam')",
        min_length=1,
        max_length=100,
    )
    force_rescan: bool = Field(
        default=False,
        description="Override existing scan and start fresh",
    )
    bbox_wgs84: tuple[float, float, float, float] | None = Field(
        default=None,
        description=(
            "Optional bounding box [min_lon, min_lat, max_lon, max_lat] in EPSG:4326 (WGS84). "
            "If provided, scan is limited to this area instead of entire gemeente. "
            "Backend converts to EPSG:28992 for BAG WFS queries. Max area: 10 km²."
        ),
    )
    wijk_naam: str | None = Field(
        default=None,
        description="CBS wijk name (for auto-creating project folder)",
        max_length=200,
    )
    project_id: uuid.UUID | None = Field(
        default=None,
        description=(
            "Optional existing project folder to link this scan to. "
            "When provided, backend links the scan directly instead of auto-creating "
            "a gemeente/wijk project."
        ),
    )


class ScanResponse(BaseModel):
    """Schema returned after triggering a scan."""

    scan_id: uuid.UUID = Field(
        description="Scan UUID",
    )
    status: str = Field(
        description="Scan status: pending, running, completed, failed, cancelled, existing",
    )
    gemeente_naam: str = Field(
        description="Gemeente display name",
    )
    gemeente_code: str = Field(
        description="CBS gemeentecode",
    )
    scan_date: datetime | None = Field(
        default=None,
        description="Scan creation timestamp (for existing scans)",
    )
    needs_rescan: bool = Field(
        default=False,
        description="True if scan is >30 days old",
    )
    message: str | None = Field(
        default=None,
        description="Additional context message",
    )


class ScanStatusResponse(BaseModel):
    """Schema for polling scan progress."""

    scan_id: uuid.UUID = Field(
        description="Scan UUID",
    )
    status: str = Field(
        description="Scan status",
    )
    progress_pct: int = Field(
        description="Overall progress percentage (0-100)",
        ge=0,
        le=100,
    )
    current_phase: str | None = Field(
        default=None,
        description="Current processing phase: fetching_parcels, cross_referencing_bag, querying_bestemmingen",
    )
    parcels_total: int = Field(
        description="Total parcels discovered",
        ge=0,
    )
    parcels_processed: int = Field(
        description="Parcels processed so far",
        ge=0,
    )
    parcels_failed: int = Field(
        description="Parcels that failed processing",
        ge=0,
    )
    results_count: int = Field(
        description="Number of ScanResult rows created",
        ge=0,
    )
    started_at: datetime | None = Field(
        default=None,
        description="Job start timestamp",
    )
    completed_at: datetime | None = Field(
        default=None,
        description="Job completion timestamp",
    )


class ScanResultItem(BaseModel):
    """Schema for a single parcel result in scan list."""

    parcel_id: uuid.UUID = Field(
        description="ParcelCache UUID",
    )
    parcel_code: str = Field(
        description="Kadaster parcel identifier",
    )
    address: str | None = Field(
        default=None,
        description="Street address from BAG",
    )
    gemeente_code: str | None = Field(
        default=None,
        description="CBS gemeentecode",
    )
    area_m2: float | None = Field(
        default=None,
        description="Parcel area in square meters",
        ge=0,
    )
    has_pand: bool = Field(
        description="Whether parcel has existing building",
    )
    bouwjaar: int | None = Field(
        default=None,
        description="BAG construction year",
    )
    pand_status: str | None = Field(
        default=None,
        description="BAG building status (e.g., 'Pand in gebruik', 'Sloopvergunning verleend')",
    )
    bestemmingen: list[dict] | None = Field(
        default=None,
        description="Zoning designations from DSO",
    )
    score: float | None = Field(
        default=None,
        description="Development opportunity score (0-100)",
        ge=0,
        le=100,
    )
    score_category: str | None = Field(
        default=None,
        description="Score category: High, Medium, Low",
    )
    score_breakdown: dict | None = Field(
        default=None,
        description="Per-factor score contributions for transparency",
    )


class ScanResultsResponse(BaseModel):
    """Schema for paginated scan results list."""

    scan_id: uuid.UUID = Field(
        description="Scan UUID",
    )
    gemeente_naam: str = Field(
        description="Gemeente display name",
    )
    scan_date: datetime = Field(
        description="Scan creation timestamp",
    )
    parcels_total: int = Field(
        description="Total parcels scanned (before qualification)",
        ge=0,
    )
    total: int = Field(
        description="Total qualifying results (before pagination)",
        ge=0,
    )
    offset: int = Field(
        description="Current offset",
        ge=0,
    )
    limit: int = Field(
        description="Page size",
        ge=0,
    )
    results: list[ScanResultItem] = Field(
        description="Paginated result items",
    )


class ParcelEnrichmentResponse(BaseModel):
    """On-demand Tier 2 enrichment data for a parcel."""

    parcel_id: uuid.UUID = Field(
        description="ParcelCache UUID",
    )
    enrichment_data: dict | None = Field(
        default=None,
        description="Tier 2 enrichment data (vergunningen, etc.)",
    )
    enriched_at: datetime | None = Field(
        default=None,
        description="Timestamp when enrichment was last updated",
    )
    is_cached: bool = Field(
        default=False,
        description="True if returned from cache, False if freshly fetched",
    )


class ScanListItem(BaseModel):
    """Schema for a single scan in the history list."""

    scan_id: uuid.UUID = Field(description="AreaScan UUID")
    gemeente_naam: str = Field(description="Gemeente display name")
    gemeente_code: str = Field(description="CBS gemeentecode")
    wijk_naam: str | None = Field(default=None, description="CBS wijk name")
    scan_date: datetime = Field(description="Scan creation timestamp")
    status: str = Field(description="Scan status: pending, running, completed, failed, cancelled")
    parcel_count: int = Field(description="Number of qualifying scan results (COUNT of scan_results)", ge=0)
    project_id: uuid.UUID | None = Field(default=None, description="Linked project folder ID")


class ScanListResponse(BaseModel):
    """Schema for paginated scan history list."""

    scans: list[ScanListItem] = Field(description="Paginated scan items")
    total: int = Field(description="Total scans matching filters (before pagination)", ge=0)
    offset: int = Field(description="Current offset", ge=0)
    limit: int = Field(description="Page size", ge=0)
