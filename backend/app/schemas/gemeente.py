"""Gemeente profile and raadsinformatie schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class GemeenteProfile(BaseModel):
    """Aggregated regulatory posture for a municipality."""

    gemeente_naam: str = Field(description="Municipality display name")
    severity_label: str = Field(
        description="Regulatory climate severity: Gunstig / Gemiddeld / Ongunstig / Zeer ongunstig / Onbekend",
    )
    approval_rate_pct: float | None = Field(
        default=None,
        description="Percentage of permits granted (verleend) out of decided permits",
    )
    rejection_rate_pct: float | None = Field(
        default=None,
        description="Percentage of permits rejected (geweigerd/buiten behandeling)",
    )
    avg_doorlooptijd_days: int | None = Field(
        default=None,
        description="Median court procedure duration in days (from RulingCache)",
    )
    bekendmakingen_30d: int = Field(default=0, description="Bekendmakingen in last 30 days")
    bekendmakingen_90d: int = Field(default=0, description="Bekendmakingen in last 90 days")
    bekendmakingen_365d: int = Field(default=0, description="Bekendmakingen in last year")
    permit_type_distribution: dict[str, int] = Field(
        default_factory=dict,
        description="Permit count by category (e.g. Omgevingsvergunning, Sloop)",
    )
    sample_size: int = Field(default=0, description="Total permit records used")
    data_coverage: str = Field(
        default="none",
        description="Data confidence: high (>50), medium (10-50), low (<10), none (0)",
    )


class RaadsstukResponse(BaseModel):
    """A single council document from Open Raadsinformatie."""

    doc_id: str = Field(description="ORI document ID")
    titel: str = Field(description="Document title")
    datum: str | None = Field(default=None, description="Document date (ISO 8601)")
    type: str | None = Field(default=None, description="Document type (AgendaItem, Meeting, etc.)")
    samenvatting: str | None = Field(default=None, description="Summary or description preview")
    bron_url: str | None = Field(default=None, description="Link to original document on ORI")


class RaadsinformatieResponse(BaseModel):
    """Raadsinformatie search results for a municipality."""

    gemeente_naam: str = Field(description="Municipality display name")
    dekking: bool = Field(description="Whether the gemeente is covered by ORI")
    stukken: list[RaadsstukResponse] = Field(default_factory=list, description="Council documents")
    total_found: int = Field(default=0, description="Total documents found")


class SubsidieResponse(BaseModel):
    """A development-relevant subsidy from RVO."""

    id: str = Field(description="RVO subsidy ID")
    title: str = Field(description="Subsidy name")
    intro: str | None = Field(default=None, description="Short description")
    url: str | None = Field(default=None, description="Link to RVO page")
    sectors: list[str] = Field(default_factory=list, description="Relevant sectors")
    targets: list[str] = Field(default_factory=list, description="Target groups")


class SubsidiesResponse(BaseModel):
    """Development-relevant subsidies list."""

    subsidies: list[SubsidieResponse] = Field(default_factory=list)
    total: int = Field(default=0, description="Number of relevant subsidies")
    source: str = Field(default="RVO", description="Data source")


class HuisvestingsverordeningResponse(BaseModel):
    """Huisvestingsverordening metadata for a municipality."""

    gemeente_naam: str = Field(description="Municipality name")
    heeft_verordening: bool = Field(description="Whether a huisvestingsverordening was found")
    title: str | None = Field(default=None, description="Document title")
    identifier: str | None = Field(default=None, description="KOOP document identifier")
    modified: str | None = Field(default=None, description="Last modified date")
    subject: str | None = Field(default=None, description="Subject classification")
    url: str | None = Field(default=None, description="Link to officielebekendmakingen.nl")


class BeschermdGezichtResponse(BaseModel):
    """A beschermd stads- or dorpsgezicht."""

    naam: str = Field(description="Name of the protected area")
    type: str = Field(description="stadsgezicht or dorpsgezicht")
    aangewezen: str | None = Field(default=None, description="Date of designation")
    oppervlakte_ha: float | None = Field(default=None, description="Area in hectares")


class ErfgoedResponse(BaseModel):
    """Erfgoed overview for a municipality."""

    gemeente_naam: str = Field(description="Municipality name")
    beschermde_gezichten: list[BeschermdGezichtResponse] = Field(default_factory=list)
    total: int = Field(default=0)


class IngestedDocumentItem(BaseModel):
    """A single ingested gemeente document."""

    id: str = Field(description="Document UUID")
    gemeente_naam: str = Field(description="Municipality name")
    document_type: str = Field(description="Document type key")
    filename: str = Field(description="Stored filename")
    content_type: str = Field(description="MIME type")
    file_size: int = Field(description="File size in bytes")
    source_url: str | None = Field(default=None, description="Source URL")
    koop_identifier: str | None = Field(default=None, description="KOOP identifier")
    ai_summary: str | None = Field(default=None, description="AI summary")


class BeleidsdocumentenIngestResponse(BaseModel):
    """Result of beleidsdocumenten ingest for a municipality."""

    gemeente_naam: str = Field(description="Municipality name")
    ingested: list[IngestedDocumentItem] = Field(
        default_factory=list,
        description="Newly ingested documents",
    )
    total_ingested: int = Field(default=0, description="Number of newly ingested documents")


class BeleidsdocumentItem(BaseModel):
    """A single beleidsdocument search result."""

    document_type: str = Field(description="Document type key (e.g. omgevingsvisie, woonvisie)")
    gevonden: bool = Field(description="Whether a document was found for this type")
    title: str | None = Field(default=None, description="Document title")
    identifier: str | None = Field(default=None, description="KOOP document identifier")
    modified: str | None = Field(default=None, description="Last modified date")
    subject: str | None = Field(default=None, description="Subject classification")
    url: str | None = Field(default=None, description="Link to officielebekendmakingen.nl")


class BeleidsdocumentenResponse(BaseModel):
    """All beleidsdocumenten for a municipality."""

    gemeente_naam: str = Field(description="Municipality name")
    documenten: list[BeleidsdocumentItem] = Field(
        default_factory=list,
        description="List of beleidsdocument search results per type",
    )
    total_gevonden: int = Field(default=0, description="Number of document types found")
    total_types: int = Field(default=0, description="Total number of document types searched")


class ChecklistItemResponse(BaseModel):
    """A single checklist item in the response."""

    id: str
    category: str
    phase: str
    title: str
    description: str
    required: bool = True
    estimated_cost: str | None = None
    cta_text: str | None = None
    cta_type: str | None = None
    detail: str | None = None
    why_needed: str | None = None
    provider_type: str | None = None


class ChecklistResponse(BaseModel):
    """Vergunning preparation checklist for a use case."""

    use_case: str
    items: list[ChecklistItemResponse]
    total: int
    phases: list[str]
    error: str | None = None
