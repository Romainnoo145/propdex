"""Property lookup schemas with aggregated data and source attribution."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.address import BAGAddressResponse, BuildingData
from app.schemas.monument import MonumentStatus
from app.schemas.zoning import ZoningData


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
    confidence: Literal["HIGH", "MEDIUM", "LOW"] | None = Field(
        default=None,
        description="Data confidence indicator (HIGH for API sources, MEDIUM/LOW for parsed data)",
    )


class SectionSourceInfo(BaseModel):
    """Source metadata for a specific report section."""

    section: str = Field(
        description="Report section name (e.g., 'zoning', 'monuments')",
    )
    sources: list[DataSourceInfo] = Field(
        description="Data sources used for this section",
    )
    cached_at: str | None = Field(
        default=None,
        description="ISO 8601 timestamp when section data was cached",
    )
    age_seconds: int | None = Field(
        default=None,
        description="Cache age in seconds for this section",
    )

    @property
    def freshness_display_nl(self) -> str | None:
        """Dutch-language relative timestamp for data freshness."""
        if self.age_seconds is None:
            return None

        if self.age_seconds < 60:
            return "Zojuist bijgewerkt"
        elif self.age_seconds < 3600:
            minutes = self.age_seconds // 60
            return f"{minutes} minuten geleden"
        elif self.age_seconds < 86400:
            uur = self.age_seconds // 3600
            return f"{uur} uur geleden"
        else:
            dagen = self.age_seconds // 86400
            return f"{dagen} dagen geleden"


class MapData(BaseModel):
    """Map rendering data with geometries and tile configuration."""

    center_rd: list[float] | None = Field(
        default=None,
        description="Map center coordinates in RD (EPSG:28992) [x, y]",
    )
    center_wgs84: list[float] | None = Field(
        default=None,
        description="Map center coordinates in WGS84 [lon, lat]",
    )
    property_geometry: dict | None = Field(
        default=None,
        description="Property boundary GeoJSON geometry",
    )
    parcel_geometries: list[dict] = Field(
        default_factory=list,
        description="Cadastral parcel GeoJSON geometries",
    )
    zoning_geometries: list[dict] = Field(
        default_factory=list,
        description="Zoning rule GeoJSON geometries",
    )
    tile_url: str = Field(
        default="https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png",
        description="WMTS tile URL for base map layer",
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


class PropertyReportResponse(BaseModel):
    """
    Extended property report with zoning, monuments, and map data.

    Includes all data from PropertyLookupResponse plus additional
    Phase 3 intelligence sections.
    """

    # Core property data (from PropertyLookupResponse)
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

    # Phase 3 additions
    zoning: ZoningData | None = Field(
        default=None,
        description="Zoning information from DSO Ruimtelijke Plannen",
    )
    monuments: MonumentStatus | None = Field(
        default=None,
        description="Monument status from RCE, BAG, and Kadaster",
    )
    map_data: MapData | None = Field(
        default=None,
        description="Map rendering data with geometries",
    )
    section_sources: list[SectionSourceInfo] = Field(
        default_factory=list,
        description="Per-section source metadata with freshness",
    )
