"""Pydantic schemas for change monitoring API responses."""

from pydantic import BaseModel, ConfigDict


class MatchedParcel(BaseModel):
    """A parcel that matches a bekendmaking postcode."""

    parcel_id: str
    scan_id: str
    address: str | None


class MatchedReport(BaseModel):
    """A saved report that matches a bekendmaking postcode."""

    report_id: str
    report_name: str


class ChangeRecordResponse(BaseModel):
    """Schema for a single change record (permit or zoning change)."""

    model_config = ConfigDict(from_attributes=True)

    id: str  # UUID as string
    project_id: str
    change_type: str  # "permit" | "zoning"
    external_id: str
    title: str
    detected_at: str  # ISO datetime
    change_date: str  # ISO datetime
    gemeente_naam: str
    address: str | None
    source_url: str | None
    postcode: str | None
    huisnummer_hint: int | None = None
    matched_parcel_id: str | None = None
    matched_parcels: list[MatchedParcel] | None = None
    matched_reports: list[MatchedReport] | None = None
    project_name: str | None = None
    category_label: str | None = None


class ChangeRecordListResponse(BaseModel):
    """Schema for paginated list of change records."""

    changes: list[ChangeRecordResponse]
    total: int
    read_change_ids: list[str] | None = None
    has_more: bool = False


class MarkAllReadResponse(BaseModel):
    """Schema for mark-all-read response."""

    status: str
    marked_count: int


class UnreadCountResponse(BaseModel):
    """Schema for unread change count summary."""

    unread_count: int
    projects_with_changes: int


class ProjectUnreadCount(BaseModel):
    """Schema for per-project unread count."""

    project_id: str
    unread_count: int


class UnreadDetailResponse(BaseModel):
    """Schema for detailed unread counts per project."""

    total_unread: int
    projects_with_changes: int
    per_project: list[ProjectUnreadCount]


class MonitoringSubscriptionRequest(BaseModel):
    """Request payload for enabling/disabling gemeente monitoring."""

    gemeente_code: str
    gemeente_naam: str
    enabled: bool = True


class MonitoringSubscriptionResponse(BaseModel):
    """Response payload for gemeente monitoring subscription changes."""

    gemeente_code: str
    gemeente_naam: str
    enabled: bool
    project_id: str | None = None
    affected_projects: int = 0
    monitored_projects: int = 0
    total_projects: int = 0
    has_root_project: bool = False


class FundaSnapshotRequest(BaseModel):
    """Manual trigger payload for Funda listing snapshot ingestion."""

    area_names: list[str] = ["arcen"]
    max_listings: int = 60


class FundaSnapshotResponse(BaseModel):
    """Queue response for Funda snapshot ingestion job."""

    status: str
    job_id: str
    area_names: list[str]
    max_listings: int


class FundaSnapshotStatsResponse(BaseModel):
    """High-level stats for ingested Funda listing snapshots."""

    total_snapshots: int
    unique_listings: int
    matched_parcels: int
    latest_snapshot_date: str | None = None
