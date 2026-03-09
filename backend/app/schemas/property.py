"""Property lookup schemas with aggregated data and source attribution."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.ai.schemas import AIParsingSection
from app.schemas.address import BAGAddressResponse, BuildingData
from app.schemas.bodem import BodemData
from app.schemas.brk_ownership import BRKOwnership
from app.schemas.energy_label import EnergyLabel
from app.schemas.fysiek_risico import FunderingsrisicogebiedData, FysiekRisicoProfiel, SoilProfile
from app.schemas.monument import MonumentStatus
from app.schemas.woz import WOZData
from app.schemas.zoning import ZoningData


class CadastralParcel(BaseModel):
    """Cadastral parcel data from PDOK Cadastral API."""

    identificatie: str | None = Field(
        default=None,
        description="PDOK/BRK kadastraalOnroerendeZaakIdentificatie (NL.IMKAD.KadastraalObject.XXXXXXXX) — used for BRK Bevragen V2 ownership lookup",
    )
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


class MarketSignals(BaseModel):
    """External market-friction signals (currently Funda snapshots)."""

    listing_duration_days: int = Field(
        default=0,
        ge=0,
        description="Number of days between first and last seen listing snapshot",
    )
    price_change_count: int = Field(
        default=0,
        ge=0,
        description="Distinct price change count over listing lifetime",
    )
    listing_snapshots_count: int = Field(
        default=0,
        ge=0,
        description="Number of snapshots observed for this listing/address",
    )
    days_since_last_seen: int = Field(
        default=0,
        ge=0,
        description="Days since last listing snapshot was seen",
    )
    source: str = Field(
        default="funda",
        description="Signal source identifier",
    )


class BuildabilityDelta(BaseModel):
    """Normalized current-vs-allowed build envelope for one property dossier."""

    parcel_area_m2: float | None = Field(
        default=None,
        description="Total cadastral parcel area in m² (sum of linked parcels)",
    )
    current_built_area_m2: float | None = Field(
        default=None,
        description="Current built/used area proxy in m²",
    )
    current_built_ratio_pct: float | None = Field(
        default=None,
        description="Current built ratio as percentage of parcel area",
    )
    max_bebouwingspercentage_pct: float | None = Field(
        default=None,
        description="Allowed max bebouwingspercentage from zoning dimensions",
    )
    max_buildable_area_m2: float | None = Field(
        default=None,
        description="Allowed max buildable area in m² based on bebouwingspercentage",
    )
    remaining_buildable_area_m2: float | None = Field(
        default=None,
        description="Remaining buildable area in m² (max minus current proxy)",
    )
    current_far: float | None = Field(
        default=None,
        description="Current FAR proxy (current area / parcel area)",
    )
    max_far: float | None = Field(
        default=None,
        description="Maximum FAR from zoning dimensions",
    )
    remaining_far: float | None = Field(
        default=None,
        description="Remaining FAR headroom (max_far - current_far)",
    )
    limit_source: str | None = Field(
        default=None,
        description="Primary source used for TAR/FAR limits (e.g., DSO maatvoering, AI planregels)",
    )
    limit_confidence: Literal["high", "medium", "low"] | None = Field(
        default=None,
        description="Confidence of TAR/FAR limit source interpretation",
    )
    confidence: Literal["high", "medium", "low"] = Field(
        default="low",
        description="Confidence level based on available dimensional inputs",
    )
    missing_fields: list[str] = Field(
        default_factory=list,
        description="Missing input fields that reduce certainty",
    )
    notes: list[str] = Field(
        default_factory=list,
        description="Human-readable caveats and interpretation notes",
    )


class WkbRefinementInput(BaseModel):
    """Optional Layer B refinement inputs for Wkb precheck."""

    constructieve_wijziging: bool | None = Field(
        default=None,
        description="Whether load-bearing/constructive elements are modified",
    )
    uitbreiding_m2: float | None = Field(
        default=None,
        ge=0,
        description="Planned extension area in m² (if known)",
    )
    functiewijziging: bool | None = Field(
        default=None,
        description="Whether the use function of the property changes",
    )


class WkbRuleHit(BaseModel):
    """Single explainable rule evaluation result."""

    code: str = Field(description="Stable rule identifier")
    title: str = Field(description="Short rule title")
    impact: Literal["increase", "decrease", "uncertainty"] = Field(
        description="Effect on Wkb-required likelihood",
    )
    reason: str = Field(description="Human-readable explanation for the rule hit")


class WkbLayerBResult(BaseModel):
    """Optional refinement metadata for Layer B inputs."""

    applied: bool = Field(
        default=False,
        description="Whether Layer B refinement was applied",
    )
    input: WkbRefinementInput | None = Field(
        default=None,
        description="Refinement input payload if provided",
    )
    effect_note: str | None = Field(
        default=None,
        description="Short summary of how Layer B changed the result",
    )
    available_inputs: list[str] = Field(
        default_factory=lambda: [
            "constructieve_wijziging",
            "uitbreiding_m2",
            "functiewijziging",
        ],
        description="Supported optional Layer B inputs",
    )


class WkbPrecheck(BaseModel):
    """Explainable Wkb startdossier precheck block."""

    status: Literal[
        "likely_required",
        "uncertain",
        "likely_not_required",
        "not_applicable",
    ] = Field(
        default="uncertain",
        description="Likelihood classification for Wkb involvement",
    )
    confidence: Literal["high", "medium", "low"] = Field(
        default="low",
        description="Confidence based on available context and refinement",
    )
    triggered_rules: list[WkbRuleHit] = Field(
        default_factory=list,
        description="Explainable rules that contributed to the status",
    )
    missing_inputs: list[str] = Field(
        default_factory=list,
        description="Missing context signals limiting certainty",
    )
    required_documents: list[str] = Field(
        default_factory=list,
        description="Suggested next documents for a startdossier",
    )
    disclaimer: str = Field(
        default=(
            "Indicatieve precheck, geen juridisch bindend advies. "
            "Laat eindbeoordeling uitvoeren door gemeente/kwaliteitsborger."
        ),
        description="Legal and operational disclaimer",
    )
    layer_b: WkbLayerBResult = Field(
        default_factory=WkbLayerBResult,
        description="Optional refinement metadata",
    )


class WkbClassification(BaseModel):
    """Deterministic Wkb gevolgklasse classification block. Phase 9 (v9.0)."""

    wkb_applicable: bool = Field(
        description="False when monument or verbouwing exclusion applies",
    )
    gevolgklasse: Literal["GK1", "niet_van_toepassing", "onbekend"] = Field(
        description="Determined gevolgklasse — GK1 for ground-level residential; 'niet_van_toepassing' when excluded; 'onbekend' when data insufficient",
    )
    exclusion_reason: Literal["rijksmonument", "verbouwing"] | None = Field(
        default=None,
        description="Why Wkb is not applicable, or None if applicable",
    )
    disclaimer: str = Field(
        default="Indicatieve classificatie op basis van openbare BAG- en monumentendata. Geen juridisch bindend advies.",
    )


class AsbestIndicator(BaseModel):
    """Bouwjaar-based asbest risk indicator per NEN 2991. Phase 9 (v9.0)."""

    risk: Literal["hoog", "middel", "geen", "onbekend"] = Field(
        description="hoog: bouwjaar 1963-1993; middel: pre-1963; geen: post-1993; onbekend: bouwjaar missing",
    )
    bouwjaar: int | None = Field(
        default=None,
        description="Bouwjaar used in determination",
    )
    norm_reference: str | None = Field(
        default=None,
        description="Applicable norm (e.g. 'NEN 2991') when risk is hoog or middel",
    )
    reden: str = Field(
        description="Human-readable explanation of the risk level",
    )


class PermitPrecedentReference(BaseModel):
    """Single reference case used in permit benchmark output."""

    change_record_id: str = Field(description="ChangeRecord UUID string")
    title: str = Field(description="Public publication title")
    change_date: str = Field(description="ISO date of publication/change")
    outcome: str = Field(description="Derived outcome label")
    source_url: str | None = Field(
        default=None,
        description="Official publication/source URL",
    )


class PermitPrecedentBenchmark(BaseModel):
    """Municipality-scoped benchmark for comparable permit history."""

    gemeente_scope: str = Field(description="Municipality scope used for benchmarking")
    comparable_type: str = Field(
        default="Omgevingsvergunning",
        description="Comparable permit category label",
    )
    sample_size: int = Field(
        default=0,
        ge=0,
        description="Number of records used in benchmark",
    )
    lookback_days: int = Field(
        default=730,
        ge=1,
        description="Lookback window used for aggregation",
    )
    median_processing_days: int | None = Field(
        default=None,
        description="Median aanvraag->uitkomst duration in days for matched trajectories",
    )
    p75_processing_days: int | None = Field(
        default=None,
        description="P75 aanvraag->uitkomst duration in days for matched trajectories",
    )
    outcome_distribution: dict[str, int] = Field(
        default_factory=dict,
        description="Outcome counts (granted/rejected/withdrawn/requested/other)",
    )
    low_sample_warning: str | None = Field(
        default=None,
        description="Low-sample caveat when benchmark confidence is limited",
    )
    references: list[PermitPrecedentReference] = Field(
        default_factory=list,
        description="Recent reference cases used as examples",
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

    # Phase 4 additions
    ai_parsing: AIParsingSection | None = Field(
        default=None,
        description="AI-parsed bestemmingsplan data (complete, in-progress, or not available)",
    )

    # Phase 7 additions (v7.0 Deep Property Data)
    energy_label: EnergyLabel | None = Field(
        default=None,
        description="Registered energy label from EP-Online V5",
    )
    woz_data: WOZData | None = Field(
        default=None,
        description="WOZ assessed value from waardeloket",
    )
    market_signals: MarketSignals | None = Field(
        default=None,
        description="External market-friction signals (e.g., Funda listing behavior)",
    )
    buildability_delta: BuildabilityDelta | None = Field(
        default=None,
        description="Current-vs-allowed build envelope with confidence and gaps",
    )
    wkb_precheck: WkbPrecheck | None = Field(
        default=None,
        description="Layer A automatic Wkb precheck with optional Layer B refinement metadata",
    )
    # Phase 9 additions (v9.0 Professional Marketplace)
    wkb_classification: WkbClassification | None = Field(
        default=None,
        description="Deterministic gevolgklasse classification with exclusion flags",
    )
    asbest_indicator: AsbestIndicator | None = Field(
        default=None,
        description="Bouwjaar-based asbest risk indicator per NEN 2991",
    )
    bodem_data: BodemData | None = Field(
        default=None,
        description="Bodemkwaliteit data from Bodemloket (WBB dossiers). Phase 68.",
    )
    permit_precedents: PermitPrecedentBenchmark | None = Field(
        default=None,
        description="Municipality-scoped benchmark for comparable permit trajectories",
    )
    brk_ownership: BRKOwnership = Field(
        default_factory=lambda: BRKOwnership(
            status="unavailable",
            reason="Eigendomsdata niet opgehaald",
        ),
        description="Property ownership from BRK Bevragen V2 (never stored — live only)",
    )
    # Phase 87 additions (v14.0 Fysiek Risicoprofiel)
    soil_profile: SoilProfile | None = Field(
        default=None,
        description="BRO Bodemkaart soil classification at parcel location",
    )
    funderingsrisicogebied: FunderingsrisicogebiedData | None = Field(
        default=None,
        description="PDOK funderingsrisicogebied context for parcel postcode area",
    )
    # Phase 88 additions (v14.0 Foundation Risk Engine)
    fysiek_risico_profiel: FysiekRisicoProfiel | None = Field(
        default=None,
        description="Combined physical risk profile: foundation, soil, asbest, contamination",
    )
