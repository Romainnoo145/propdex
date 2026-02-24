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
