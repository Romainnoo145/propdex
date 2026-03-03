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
    vacancy_signal: str | None = Field(
        default=None,
        description="Vacancy classification: leeg_perceel, leegstaand_pand, in_gebruik, onbekend",
    )
    vacancy_confidence: float | None = Field(
        default=None,
        description="Vacancy confidence score (0-1) based on BAG + permit/listing behavior",
        ge=0,
        le=1,
    )
    vacancy_reasons: list[str] | None = Field(
        default=None,
        description="Top 3 explainable reasons behind vacancy confidence",
    )
    vacancy_model_version: str | None = Field(
        default=None,
        description="Version id of vacancy confidence model",
    )
    market_signals: dict[str, int] | None = Field(
        default=None,
        description=(
            "External market friction signals per parcel "
            "(e.g., listing_duration_days, price_change_count)"
        ),
    )
    opportunity_signals: list[str] | None = Field(
        default=None,
        description="Human-readable development opportunity signals",
    )
    building_metrics: dict | None = Field(
        default=None,
        description="Zoning build metrics (e.g., max_bebouwingspercentage, max_floor_area_ratio)",
    )
    has_report: bool = Field(
        default=False,
        description="Whether this parcel already has an active saved report",
    )


class ScanResultsResponse(BaseModel):
    """Schema for paginated scan results list."""

    scan_id: uuid.UUID = Field(
        description="Scan UUID",
    )
    gemeente_naam: str = Field(
        description="Gemeente display name",
    )
    wijk_naam: str | None = Field(
        default=None,
        description="CBS wijk name (if scan was wijk-scoped)",
    )
    scan_date: datetime = Field(
        description="Scan creation timestamp",
    )
    parcels_total: int = Field(
        description="Total parcels scanned (before qualification)",
        ge=0,
    )
    total: int = Field(
        description="Total ranked results (before pagination)",
        ge=0,
    )
    total_unfiltered: int = Field(
        description="Total results before score threshold filter (for hidden-count display)",
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


class ParcelCentroidResponse(BaseModel):
    """Parcel centroid and optional geometry metadata for map focus flows."""

    lng: float = Field(description="Centroid longitude in WGS84")
    lat: float = Field(description="Centroid latitude in WGS84")
    address: str | None = Field(default=None, description="Display address")
    parcel_code: str | None = Field(default=None, description="Kadastrale aanduiding")
    gemeente_code: str | None = Field(default=None, description="CBS gemeentecode")
    area_m2: float | None = Field(default=None, description="Parcel area in m2")
    has_pand: bool | None = Field(default=None, description="True when parcel has BAG building")
    bouwjaar: int | None = Field(default=None, description="BAG bouwjaar")
    pand_status: str | None = Field(default=None, description="BAG pandstatus")
    geometry: dict | None = Field(
        default=None,
        description="Parcel geometry as GeoJSON (WGS84)",
    )


class ParcelAtPointResponse(BaseModel):
    """Parcel lookup response for map clicks at a WGS84 coordinate."""

    parcel_id: uuid.UUID = Field(description="ParcelCache UUID")
    lng: float = Field(description="Parcel centroid longitude in WGS84")
    lat: float = Field(description="Parcel centroid latitude in WGS84")
    address: str | None = Field(default=None, description="Display address")
    parcel_code: str | None = Field(default=None, description="Kadastrale aanduiding")
    gemeente_code: str | None = Field(default=None, description="CBS gemeentecode")
    area_m2: float | None = Field(default=None, description="Parcel area in m2")
    has_pand: bool = Field(description="True when parcel has a BAG building")
    bouwjaar: int | None = Field(default=None, description="BAG bouwjaar")
    pand_status: str | None = Field(default=None, description="BAG pandstatus")
    score: float | None = Field(
        default=None,
        description="Optional scan score when scan_id context is provided",
        ge=0,
        le=100,
    )
    score_category: str | None = Field(
        default=None,
        description="Score category from scan flags (High/Medium/Low)",
    )
    score_breakdown: dict | None = Field(
        default=None,
        description="Per-factor score contributions from scan flags",
    )
    vacancy_signal: str | None = Field(
        default=None,
        description="Vacancy classification from scan flags",
    )
    vacancy_confidence: float | None = Field(
        default=None,
        description="Vacancy confidence score (0-1) based on BAG + permit/listing behavior",
        ge=0,
        le=1,
    )
    vacancy_reasons: list[str] | None = Field(
        default=None,
        description="Top 3 explainable reasons behind vacancy confidence",
    )
    vacancy_model_version: str | None = Field(
        default=None,
        description="Version id of vacancy confidence model",
    )
    market_signals: dict[str, int] | None = Field(
        default=None,
        description="Market listing friction signals from scan flags",
    )
    opportunity_signals: list[str] | None = Field(
        default=None,
        description="Human-readable opportunity signals from scan flags",
    )
    building_metrics: dict | None = Field(
        default=None,
        description="Zoning build metrics from scan flags",
    )
    has_report: bool = Field(description="True when at least one saved report exists")
    geometry: dict | None = Field(
        default=None,
        description="Parcel geometry as GeoJSON (WGS84)",
    )


class ScanListItem(BaseModel):
    """Schema for a single scan in the history list."""

    scan_id: uuid.UUID = Field(description="AreaScan UUID")
    gemeente_naam: str = Field(description="Gemeente display name")
    gemeente_code: str = Field(description="CBS gemeentecode")
    wijk_naam: str | None = Field(default=None, description="CBS wijk name")
    bbox_wgs84: tuple[float, float, float, float] | None = Field(
        default=None,
        description="Scan bounding box in WGS84 (min_lon, min_lat, max_lon, max_lat)",
    )
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
