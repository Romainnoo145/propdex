"""Pydantic schemas for the bulk query pipeline."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ParsedQuery(BaseModel):
    """Structured filter parameters extracted from a natural-language query.

    All fields are optional — only those mentioned in the query are populated.
    """

    municipality: str | None = Field(
        default=None,
        description="Municipality name (gemeente), e.g. 'Venlo', 'Amsterdam'",
    )
    build_year_min: int | None = Field(
        default=None,
        description="Minimum build year (inclusive), e.g. 2000 for 'na 2000'",
    )
    build_year_max: int | None = Field(
        default=None,
        description="Maximum build year (inclusive), e.g. 1970 for 'voor 1970'",
    )
    area_min: float | None = Field(
        default=None,
        description="Minimum parcel area in m²",
    )
    area_max: float | None = Field(
        default=None,
        description="Maximum parcel area in m²",
    )
    bestemming: str | None = Field(
        default=None,
        description="Zoning type, e.g. 'Wonen', 'Bedrijf', 'Agrarisch'",
    )
    pand_status: str | None = Field(
        default=None,
        description="Building status, e.g. 'Pand in gebruik', 'Bouw gestart'",
    )


class BulkResult(BaseModel):
    """Single parcel result from a bulk query."""

    parcel_id: str = Field(description="Kadaster parcel identifier")
    address: str | None = Field(default=None, description="Denormalized address")
    municipality: str | None = Field(default=None, description="Municipality name")
    build_year: int | None = Field(default=None, description="Building year")
    area_m2: float | None = Field(default=None, description="Parcel area in m²")
    bestemming: str | None = Field(default=None, description="Primary zoning type")
    pand_status: str | None = Field(default=None, description="Building status")


class BulkQueryRequest(BaseModel):
    """Request body for the bulk query endpoint."""

    query: str = Field(
        description="Natural language query in Dutch, e.g. 'Alle woningen in Venlo met bouwjaar voor 1970'",
        min_length=3,
        max_length=2000,
    )


class BulkQueryResponse(BaseModel):
    """Response from the bulk query endpoint."""

    type: Literal["results", "unsupported"] = Field(
        description="'results' when query was parsed and executed, 'unsupported' when query asks for unavailable dimensions",
    )
    query_id: str = Field(description="UUID of the persisted BulkQuery record")
    results: list[BulkResult] = Field(
        default_factory=list,
        description="Matching parcels (empty for unsupported queries)",
    )
    total: int = Field(
        default=0,
        description="Total number of matching parcels",
    )
    parsed: ParsedQuery | None = Field(
        default=None,
        description="Structured filters extracted from the query (null for unsupported)",
    )
    reason: str | None = Field(
        default=None,
        description="Explanation when type is 'unsupported'",
    )


# --- History & request schemas (S02) ---


class BulkQuerySummary(BaseModel):
    """Lightweight query summary for history lists (no result rows)."""

    id: str = Field(description="Query UUID")
    query_text: str = Field(description="Original natural language query")
    result_count: int = Field(description="Number of results")
    status: str = Field(description="completed / unsupported / failed")
    created_at: str = Field(description="ISO datetime")


class BulkQueryHistoryResponse(BaseModel):
    """Paginated list of user's past queries."""

    queries: list[BulkQuerySummary] = Field(default_factory=list)
    total: int = Field(default=0, description="Total queries for this user")


class BulkQueryDetailResponse(BaseModel):
    """Full results for a single persisted query."""

    id: str
    query_text: str
    result_count: int
    status: str
    parsed: ParsedQuery | None = None
    results: list[BulkResult] = Field(default_factory=list)
    created_at: str


class BulkRequestCreate(BaseModel):
    """Request body for submitting a manual request."""

    query_text: str = Field(
        description="The query that couldn't be auto-resolved",
        min_length=3,
        max_length=2000,
    )


class BulkRequestResponse(BaseModel):
    """Response for a manual request."""

    id: str
    query_text: str
    status: str
    admin_note: str | None = None
    results_query_id: str | None = None
    created_at: str


class BulkRequestUpdate(BaseModel):
    """Request body for updating a manual request (admin action)."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["pending", "completed", "rejected"] | None = None
    admin_note: str | None = None
    results_query_id: str | None = None


class BulkRequestListResponse(BaseModel):
    """List of manual requests (admin view)."""

    requests: list[BulkRequestResponse] = Field(default_factory=list)
    total: int = Field(default=0)
