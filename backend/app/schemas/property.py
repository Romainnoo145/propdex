"""Property lookup schemas with aggregated data and source attribution."""

from pydantic import BaseModel, Field

from app.schemas.address import BAGAddressResponse, BuildingData


class CadastralParcel(BaseModel):
    """Cadastral parcel data from PDOK Cadastral API."""

    kadastrale_aanduiding: str | None = Field(
        default=None,
        description="Full cadastral designation (e.g., 'ASD04 S 12345')",
    )
    perceelnummer: str | None = Field(
        default=None,
        description="Parcel number within section",
    )
    sectie: str | None = Field(
        default=None,
        description="Cadastral section code",
    )
    oppervlakte: int | None = Field(
        default=None,
        description="Parcel surface area in m²",
    )
    geometry: dict | None = Field(
        default=None,
        description="GeoJSON geometry (polygon)",
    )


class DataSourceInfo(BaseModel):
    """Metadata about data source and caching."""

    source: str = Field(
        description="API source name (e.g., 'BAG API v2', 'PDOK Cadastral OGC API')",
    )
    cached_at: str | None = Field(
        default=None,
        description="ISO 8601 timestamp when data was cached",
    )
    age_seconds: int | None = Field(
        default=None,
        description="Cache age in seconds (None if not cached)",
    )
    is_cached: bool = Field(
        default=False,
        description="Whether data came from cache",
    )


class PropertyLookupResponse(BaseModel):
    """
    Complete property data aggregated from multiple government APIs.

    Includes source attribution, cache metadata, and completeness scoring.
    """

    address: BAGAddressResponse = Field(
        description="Address details from BAG API",
    )
    building: BuildingData | None = Field(
        default=None,
        description="Building details from BAG (None if not available)",
    )
    cadastral_parcels: list[CadastralParcel] = Field(
        default_factory=list,
        description="Cadastral parcel data from PDOK (empty if not available)",
    )
    data_sources: list[DataSourceInfo] = Field(
        default_factory=list,
        description="Source attribution for each API called",
    )
    completeness_score: float = Field(
        description="Fraction of data sections that returned data (0.0 to 1.0)",
        ge=0.0,
        le=1.0,
    )
    errors: list[str] = Field(
        default_factory=list,
        description="Human-readable error messages for failed API calls",
    )
    resolved_at: str = Field(
        description="ISO 8601 timestamp when lookup was performed",
    )
