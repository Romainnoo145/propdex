# Architecture Patterns

**Domain:** Professional Marketplace — Bodemloket, Wkb classification, asbest risk, dossier generation, lead capture, professional directory
**Researched:** 2026-03-01
**Confidence:** HIGH — based on direct codebase analysis of existing v7.2 pipeline + verified Dutch government API documentation + Bodemloket WMS endpoint verification

---

## Context: What We're Building On

v9.0 adds six interconnected features to a mature platform. The existing architecture is stable and well-understood. This document focuses exclusively on how the new features integrate — not on the base architecture, which is documented in the v7.0 ARCHITECTURE.md.

**Existing pipeline summary:**

```
STEP 1: resolve_address(BAG) → verblijfsobject_id, pand_id, RD coordinates
STEP 2a: asyncio.gather(cadastral, zoning, monuments, energy_label, woz)
STEP 2b: fetch_brk_ownership(cadastral result) — BRK never cached
STEP 3: AI parsing, MapData, completeness_score, PropertyReportResponse
```

**Central data contract:** `PropertyReportResponse` is the single schema that flows from aggregator through DB save to PDF export. All new data sources must produce Pydantic-serializable fields that extend this schema.

---

## System Overview: v9.0 Feature Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         React Frontend                                   │
│                                                                          │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────────────────┐    │
│  │  ReportDetail   │  │ DossierExport│  │  ProfessionalDirectory   │    │
│  │  + BodemSection │  │ (PDF + Lead) │  │  + LeadCaptureForm       │    │
│  │  + WkbSection   │  └──────┬───────┘  └────────────┬─────────────┘   │
│  │  + AsbstSection │         │                        │                 │
│  └────────┬────────┘         │                        │                 │
│           │                  │                        │                 │
│           └──────────────────┴────────────────────────┘                 │
│                              │ HTTP (TanStack Query)                     │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────────┐
│                         FastAPI Backend                                   │
│                                                                          │
│  ┌─────────────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  /api/reports        │  │ /api/dossier │  │  /api/professionals  │   │
│  │  (extended: bodem,  │  │  POST generate│  │  GET list, POST lead │   │
│  │   wkb_class,        │  │  GET download │  └──────────┬───────────┘   │
│  │   asbest_risk)      │  └──────┬───────┘             │               │
│  └─────────┬───────────┘         │                      │               │
│            │                     │                      │               │
│  ┌─────────▼─────────────────────▼──────────────────────▼────────────┐  │
│  │                   Service Layer                                     │  │
│  │                                                                     │  │
│  │  property_aggregator   dossier_generator   professional_service    │  │
│  │  + bodemloket_fetch    + pdf_export        + lead_capture          │  │
│  │  + wkb_classifier      (extended)                                  │  │
│  │  + asbest_indicator                                                │  │
│  └───────┬─────────────────────┬──────────────────────────────────────┘  │
│          │                     │                                         │
│  ┌───────▼──────────┐  ┌───────▼──────────────────────────────────────┐ │
│  │ Government APIs  │  │  PostgreSQL/PostGIS                           │ │
│  │                  │  │                                               │ │
│  │  bodemloket_wms  │  │  saved_reports (extended)                    │ │
│  │  (existing APIs) │  │  professionals (NEW)                         │ │
│  └──────────────────┘  │  lead_requests (NEW)                         │ │
│                         └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Feature 1: Bodemloket API Integration

### API Details (Verified)

**Service:** Bodemloket (rijksoverheid) via GDN Geo Services ArcGIS MapServer
**WMS Endpoint:** `https://gis.gdngeoservices.nl/standalone/services/blk_gdn/lks_blk_rd_v1/MapServer/WMSServer`
**GetCapabilities confirms:** Three layers available:
- `WBB_locaties` — contaminated site polygons (WBB = Wet Bodembescherming)
- `Bevoegd_gezag` — jurisdiction/authority boundaries
- `Beschikbaarheid_gegevens` — data availability zones

**Supported CRS:** EPSG:28992 (RD New — matches existing Propdex coordinate system)
**GetFeatureInfo:** Supported via WMS. Formats include text/html and text/xml.

**Alternative REST endpoint:** `https://www.gdngeoservices.nl/arcgis/rest/services/blk/lks_blk_rd/MapServer/1/query`
Query parameters: `geometry={x},{y}&geometryType=esriGeometryPoint&inSR=28992&spatialRel=esriSpatialRelIntersects&outFields=*&f=json`
Known fields: `NEN3610_ID_SOIL_LOCATION`, `STATUS_OORD`, `STATUSVER`, `WBB_DOSSIER_DBK`, `NEN3610_ID_SOIL_MANAGEMENT`, `SIKB_ID`, `LOCATIECODE_BEVOEGD_GEZAG`, `TYPE_CD`
Limitation: Max 1,000 results per query — not an issue for point-in-polygon lookup

**Confidence:** MEDIUM — WMS GetCapabilities verified live; REST endpoint documented by community sources but returned 404 during direct testing; WMS is the fallback

### Integration Point: New API Client

```
backend/app/government_apis/bodemloket_wms.py  (NEW)
```

Pattern: Same as `woz_waardeloket.py` — public endpoint, no auth, three-state contract.

```python
"""Bodemloket WMS client for soil contamination lookups.

Queries the Bodemloket WMS (Wet Bodembescherming) for soil contamination
status at a given RD coordinate. Returns contamination status for display
in property reports.

Authentication: None required (public government WMS).
Input: RD coordinates (EPSG:28992) from BAG resolution (Step 1).

Three-state contract:
- Data found        -> BodemData with contamination status
- Not found/no hit  -> None (most parcels have no contamination record)
- API error         -> raise GovernmentAPIError

WMS endpoint: https://gis.gdngeoservices.nl/standalone/services/blk_gdn/
              lks_blk_rd_v1/MapServer/WMSServer
"""

class BodemloketWMSClient:
    WMS_URL = (
        "https://gis.gdngeoservices.nl/standalone/services/"
        "blk_gdn/lks_blk_rd_v1/MapServer/WMSServer"
    )

    async def get_soil_status_at(
        self,
        rd_x: float,
        rd_y: float,
        client: httpx.AsyncClient,
    ) -> "BodemData | None":
        """Query Bodemloket WMS for soil contamination at RD coordinates.

        Uses GetFeatureInfo on WBB_locaties layer with a minimal bounding box
        around the query point (50m buffer in RD units).

        Returns None if no contamination record exists (normal for most parcels).
        """
        # GetFeatureInfo requires a bbox + pixel query
        buffer = 50  # 50m in RD units
        bbox = f"{rd_x - buffer},{rd_y - buffer},{rd_x + buffer},{rd_y + buffer}"

        params = {
            "SERVICE": "WMS",
            "VERSION": "1.3.0",
            "REQUEST": "GetFeatureInfo",
            "LAYERS": "WBB_locaties",
            "QUERY_LAYERS": "WBB_locaties",
            "CRS": "EPSG:28992",
            "BBOX": bbox,
            "WIDTH": "100",
            "HEIGHT": "100",
            "I": "50",
            "J": "50",
            "INFO_FORMAT": "text/xml",
        }
        # ... parse response, return BodemData or None
```

### New Schema

```
backend/app/schemas/bodem.py  (NEW)
```

```python
class BodemData(BaseModel):
    """Soil contamination status from Bodemloket WBB registry."""

    has_contamination_record: bool = Field(
        description="Whether a WBB soil investigation record exists at this location"
    )
    status_oord: str | None = Field(
        default=None,
        description="Soil status code from WBB registry (e.g., 'Geheel gesaneerd')"
    )
    locatie_naam: str | None = Field(
        default=None,
        description="Name of the contamination location/dossier"
    )
    dossier_id: str | None = Field(
        default=None,
        description="WBB dossier reference (WBB_DOSSIER_DBK)"
    )
    bevoegd_gezag: str | None = Field(
        default=None,
        description="Competent authority for this soil case"
    )
    bodemloket_url: str | None = Field(
        default=None,
        description="Link to Bodemloket kaart for this location"
    )
    source: str = "Bodemloket WMS (Wet Bodembescherming)"
    low_confidence: bool = Field(
        default=False,
        description="True if WMS query returned ambiguous result"
    )
```

### Aggregator Integration

Add `fetch_bodem_data()` nested function to `property_aggregator.py`, called in the existing `asyncio.gather()` (Step 2a). Input: `rd_x, rd_y` from BAG resolution.

**Cache key:** `f"bodemloket:wbb:{rd_x:.0f}:{rd_y:.0f}"`
**CACHE_TTL:** `"bodemloket"` → 2592000 (30 days — contamination status changes slowly)
**Rate limiter:** Add `bodemloket_limiter` (2 concurrent, 100/hour — public WMS is not meant for bulk)

**PropertyReportResponse addition:**
```python
bodem_data: BodemData | None = Field(
    default=None,
    description="Soil contamination status from Bodemloket WBB registry"
)
```

### Frontend Component

New `BodemSection` in `ReportDetailPage.tsx`:
- Alert-style indicator when `has_contamination_record=True` (amber warning, not red — status varies)
- Status badge showing `status_oord` value
- Link to Bodemloket kaart (`bodemloket_url`) for detailed investigation
- "Geen bodemverontreinigingsregistratie gevonden" state when None/False

---

## Feature 2: Wkb Classification Engine

### Current State (v7.2)

The existing `wkb_precheck.py` already evaluates Layer A (auto from report data) and Layer B (optional user refinement). This is the PRECHECK — it answers "does Wkb likely apply?".

v9.0 adds the **classification engine** — it answers "which gevolgklasse applies?" This is a distinct, deterministic calculation based on building type, bouwjaar, height, and usage — not a probabilistic precheck.

### Gevolgklasse Classification Rules (HIGH confidence — iplo.nl verified)

**Gevolgklasse 1** (current implementation target): Ground-level dwellings (no care facilities, no shared rentals), industrial buildings max 2 stories, standalone holiday homes, structures max 20m height
**Gevolgklasse 2:** Schools, libraries, municipal buildings, residential >3 stories but <70m
**Gevolgklasse 3:** Hospitals, metro stations, stadiums, buildings >70m

Key finding: **Building year is NOT a gevolgklasse criterion.** The classification is based on current use and physical characteristics. However, bouwjaar IS relevant for asbest risk (separate feature).

### New Service

```
backend/app/services/wkb_classifier.py  (NEW)
```

This is a pure Python rule engine — no API calls, no DB access. Input from existing report data.

```python
"""Wkb gevolgklasse classifier.

Determines the likely gevolgklasse (1, 2, or 3) for a property based on:
- BAG gebruiksdoel (usage function)
- BAG oppervlakte (building area)
- Zoning bestemming type
- Building height from zoning dimensions (max_hoogte proxy)

This is NOT the same as wkb_precheck.py (which assesses probability of
Wkb applicability). This classifier assesses which gevolgklasse applies
ASSUMING Wkb is applicable.

Sources:
- iplo.nl gevolgklasse criteria (Omgevingsregeling bijlage I)
- BWT gevolgklasse factsheet (Rijksoverheid 2021)
"""

class WkbGevolgklasse(str, Enum):
    GK1 = "gevolgklasse_1"
    GK2 = "gevolgklasse_2"
    GK3 = "gevolgklasse_3"
    UNKNOWN = "unknown"

class WkbClassification(BaseModel):
    gevolgklasse: WkbGevolgklasse
    confidence: Literal["high", "medium", "low"]
    classification_basis: list[str]  # Human-readable rules that fired
    missing_inputs: list[str]        # Fields that would improve confidence
    notes: str | None = None


def classify_gevolgklasse(
    *,
    building: BuildingData | None,
    zoning_data: ZoningData | None,
    buildability_delta: BuildabilityDelta | None,
) -> WkbClassification:
    """Classify Wkb gevolgklasse from available report data."""
    ...
```

### Integration Point

`wkb_classifier.py` is called INSIDE `evaluate_wkb_precheck()` in `wkb_precheck.py` to produce a `WkbClassification` that gets embedded in `WkbPrecheck`. Alternatively, it can be a separate field in `PropertyReportResponse`. Recommended: separate field to keep concerns distinct.

**PropertyReportResponse addition:**
```python
wkb_classification: WkbClassification | None = Field(
    default=None,
    description="Wkb gevolgklasse classification (1/2/3) based on building type and zoning"
)
```

### Frontend Component

Extend existing `WkbSection` in `ReportDetailPage.tsx`:
- Add gevolgklasse badge (GK1/GK2/GK3) as a colored chip
- Classification basis bullets (what rules fired)
- "This determines which kwaliteitsborger type is needed" educational tooltip

---

## Feature 3: Asbest Risk Indicator

### Rules (HIGH confidence — Dutch legislation verified)

**Rule:** Properties with `bouwjaar < 1994` carry asbest risk. The Netherlands banned asbestos trading/application in 1994 (Besluit asbestverwijdering). Before 1994 is the risk window; highest risk period is 1963–1993.

**No API required.** This is a pure rule-based indicator computed from `bouwjaar` already stored in `ParcelCache.bouwjaar` and `BuildingData.bouwjaar` in the report.

### New Service

```
backend/app/services/asbest_indicator.py  (NEW)
```

```python
"""Asbest risk indicator based on bouwjaar.

Dutch legislation (Besluit asbestverwijdering): asbestos was banned from
1994 onwards. Buildings constructed before 1994 may contain asbestos and
require mandatory inspection before demolition/renovation.

NEN 2991 defines the risk assessment methodology.

This is a pure rule engine — no external API calls.
"""

class AsbstRisk(BaseModel):
    risk_level: Literal["high", "medium", "none", "unknown"]
    bouwjaar: int | None
    threshold_year: int = 1994
    risk_label: str                  # Dutch label for display
    norms_reference: str = "NEN 2991 / Besluit asbestverwijdering"
    asbest_inventaris_required: bool  # True if demolition/renovation planned + pre-1994
    notes: list[str]

def assess_asbest_risk(bouwjaar: int | None) -> AsbstRisk:
    """Assess asbestos risk from construction year.

    high   = bouwjaar 1963-1993 (peak asbestos use period)
    medium = bouwjaar < 1963 (earlier construction, less common asbestos types)
    none   = bouwjaar >= 1994 (post-ban)
    unknown = bouwjaar is None
    """
```

### Integration Point

Called in `property_aggregator.py` during Step 3 (sequential, after gather) — no API dependency, pure computation from `building.bouwjaar`.

**PropertyReportResponse addition:**
```python
asbest_risk: AsbstRisk | None = Field(
    default=None,
    description="Asbestos risk indicator based on construction year"
)
```

### Frontend Component

New `AsbstSection` in `ReportDetailPage.tsx`:
- Risk badge: "Hoog risico" (amber), "Mogelijk risico" (yellow), "Geen risico" (green), "Onbekend" (grey)
- Bouwjaar display + threshold explanation
- Link to NEN 2991 asbestinventarisatie information (external)
- Context: "Verplicht bij sloop of renovatie" advisory

---

## Feature 4: Risicobeoordeling Dossier Generator

### Architecture Decision

The dossier is a **curated PDF export** of existing report data — it is NOT a new data source. It aggregates the Wkb precheck, Wkb classification, asbest risk, bodem data, monument status, and buildability delta into a kwaliteitsborger-oriented document.

**Key design:** The dossier is generated from an existing `SavedReport.report_data` JSONB payload. No new API calls at generation time. The only compute is Jinja2 template rendering + WeasyPrint.

### New API Endpoint

```
backend/app/dossier/router.py  (NEW)
backend/app/dossier/generator.py  (NEW)
```

```
POST /api/dossier/{report_id}/generate
  Auth: required (JWT)
  Rate limit: 5/minute (PDF generation is CPU-intensive)
  Body: DossierGenerateRequest (type: "wkb_kwaliteitsborger" | "full")
  Returns: DossierGenerateResponse (dossier_id, download_url)

GET /api/dossier/{dossier_id}/download
  Auth: required
  Returns: StreamingResponse (application/pdf)
```

**Dossier types for v9.0:**
- `"wkb_kwaliteitsborger"` — sections: property summary, Wkb precheck, Wkb classification, asbest risk, bodem data, monument status, buildability delta. Tailored for kwaliteitsborger intake.

### New Model

```
backend/app/models/dossier.py  (NEW)
```

```python
class GeneratedDossier(Base, TenantMixin, TimestampMixin):
    """Generated dossier document linked to a saved report."""

    __tablename__ = "generated_dossiers"

    id: Mapped[uuid.UUID]
    report_id: Mapped[uuid.UUID]          # FK to saved_reports
    dossier_type: Mapped[str]             # "wkb_kwaliteitsborger"
    generated_by: Mapped[uuid.UUID]       # FK to users
    pdf_storage_key: Mapped[str | None]   # Future: S3/storage path
    expires_at: Mapped[datetime | None]   # Future: time-limited share links
    lead_request_id: Mapped[uuid.UUID | None]  # FK to lead_requests if generated via lead flow
```

**v9.0 storage approach:** Store PDF bytes in PostgreSQL BYTEA column (or generate on-demand without storage). At current scale, on-demand generation is simpler — no S3 needed. Store generation metadata only, regenerate on each download.

### New Jinja2 Template

```
backend/app/dossier/templates/wkb_kwaliteitsborger.html  (NEW)
```

Template structure:
1. Cover page: property address, generation date, "Risicobeoordeling voor kwaliteitsborger"
2. Property summary: BAG data, bouwjaar, status, gebruiksdoel
3. Wkb beoordeling: precheck status + classification gevolgklasse + required documents list
4. Asbest risico: risk level + bouwjaar + NEN 2991 advisory
5. Bodemkwaliteit: contamination status from Bodemloket (or "geen registratie")
6. Monument/erfgoed: status if applicable
7. Bouwruimte delta: remaining capacity summary
8. Data bronnen: source attribution table
9. CTA footer: "Vraag een gecertificeerde kwaliteitsborger aan via Propdex"

### Data Flow: Dossier Generation

```
User clicks "Genereer dossier" in ReportDetailPage
  │
  ▼
POST /api/dossier/{report_id}/generate
  │
  ├── Fetch SavedReport from DB (validates org + exists + not deleted)
  ├── Validate report_data has required sections (wkb_precheck, etc.)
  ├── Record GeneratedDossier row (status=pending)
  │
  ▼
asyncio.to_thread(generate_dossier_pdf, report_data, dossier_type)
  │
  ├── Jinja2 template render (wkb_kwaliteitsborger.html)
  ├── WeasyPrint HTML→PDF
  ├── Return bytes
  │
  ▼
Return DossierGenerateResponse(dossier_id, download_url)
  │
  ▼
GET /api/dossier/{dossier_id}/download → StreamingResponse PDF
```

---

## Feature 5: Lead Capture Flow

### Architecture Decision

Lead capture is a **workflow, not a data source**. It adds a user journey: generate dossier → see CTA → submit lead request → lead is routed to professional.

**No payment processing in v9.0.** Leads are stored in DB and routed manually (email notification to kwaliteitsborger). Payment infrastructure is future work.

### New Model

```
backend/app/models/lead_request.py  (NEW)
```

```python
class LeadRequest(Base, TenantMixin, TimestampMixin):
    """Lead request from developer to kwaliteitsborger.

    Captures the intent to engage a professional service.
    v9.0: Manual routing via email. No payment processing.
    """

    __tablename__ = "lead_requests"

    id: Mapped[uuid.UUID]
    organization_id: Mapped[uuid.UUID]    # Which developer org made the request
    report_id: Mapped[uuid.UUID]          # Which property report
    dossier_id: Mapped[uuid.UUID | None]  # Which dossier was generated (if any)
    professional_id: Mapped[uuid.UUID | None]  # Target professional (if from directory)
    vertical: Mapped[str]                 # "wkb_kwaliteitsborger" (future: more verticals)
    status: Mapped[str]                   # "new" | "sent" | "contacted" | "closed"
    requester_email: Mapped[str]          # Contact email for lead
    requester_name: Mapped[str]
    requester_phone: Mapped[str | None]
    project_description: Mapped[str | None]  # Free text: what they're building
    gemeente_code: Mapped[str | None]     # For geographic routing
    notes: Mapped[str | None]            # Internal notes
    contacted_at: Mapped[datetime | None]

    __table_args__ = (
        Index("ix_lead_requests_org_status", "organization_id", "status"),
        Index("ix_lead_requests_org_report", "organization_id", "report_id"),
        Index("ix_lead_requests_vertical", "vertical"),
    )
```

### New API Endpoints

```
backend/app/leads/router.py  (NEW)
```

```
POST /api/leads
  Auth: required
  Body: LeadCreateRequest
  Returns: LeadResponse (201)
  Effect: Creates LeadRequest row, triggers email notification

GET /api/leads
  Auth: required (admin only in v9.0)
  Returns: list[LeadResponse] paginated
```

### Data Flow: Lead Capture

```
Report page → User sees Wkb precheck "likely_required"
  │
  ▼
"Genereer dossier voor kwaliteitsborger" CTA
  │
  ▼
POST /api/dossier/{report_id}/generate
  ↓ (PDF ready)
DossierReadyPage
  │  Shows: PDF preview, "Deel met kwaliteitsborger" CTA
  │
  ▼
LeadCaptureForm (inline or modal)
  Fields: name, email, phone (optional), project description
  │
  ▼
POST /api/leads
  ├── Creates LeadRequest in DB
  ├── Sends notification email to admin (v9.0: manual routing)
  └── Future: routes to matched professional from directory
  │
  ▼
ConfirmationPage: "Uw aanvraag is ontvangen. Een kwaliteitsborger neemt contact op."
```

### CTA Placement Strategy

The lead capture CTA appears in THREE locations, in order of user intent:

1. **WkbSection in ReportDetailPage** — soft CTA when `wkb_precheck.status === 'likely_required'`: "Download dossier voor kwaliteitsborger"
2. **After dossier download** — hard CTA: "Kwaliteitsborger nodig? Vraag direct aan via Propdex"
3. **ProfessionalDirectory listing page** — "Neem contact op" per professional card

---

## Feature 6: Professional Directory

### Architecture Decision

The directory is a **simple CRUD listing** of kwaliteitsborgers with geographic coverage and service area. No marketplace matching algorithm in v9.0 — just a searchable list that developers can browse.

**Data management:** Professionals are added manually by Propdex admin. No self-signup portal in v9.0.

### New Model

```
backend/app/models/professional.py  (NEW)
```

```python
class Professional(Base, TimestampMixin):
    """Kwaliteitsborger (or future: other professional) listing.

    NOT tenant-isolated — professionals are visible to all organizations.
    The directory is platform-wide, not per-tenant.
    """

    __tablename__ = "professionals"

    id: Mapped[uuid.UUID]
    vertical: Mapped[str]             # "wkb_kwaliteitsborger" (extensible)
    bedrijfsnaam: Mapped[str]
    contactpersoon: Mapped[str | None]
    email: Mapped[str]
    phone: Mapped[str | None]
    website: Mapped[str | None]
    gemeente_codes: Mapped[list | None]  # JSONB: ["0917", "0756"] CBS codes
    provincies: Mapped[list | None]      # JSONB: ["Noord-Holland"] fallback
    is_active: Mapped[bool]              # Admin can deactivate
    is_certified: Mapped[bool]           # Certified kwaliteitsborger (BRL 5006)
    certificaat_url: Mapped[str | None]  # Link to certification document
    description: Mapped[str | None]      # Short pitch text
    max_leads_per_month: Mapped[int | None]  # Future: lead throttling
    notes_internal: Mapped[str | None]   # Admin-only notes

    __table_args__ = (
        Index("ix_professionals_vertical_active", "vertical", "is_active"),
    )
```

### New API Endpoints

```
backend/app/professionals/router.py  (NEW)
```

```
GET /api/professionals
  Auth: required
  Query params: vertical, gemeente_code, is_certified
  Returns: ProfessionalListResponse

GET /api/professionals/{professional_id}
  Auth: required
  Returns: ProfessionalDetailResponse

POST /api/professionals (admin only)
  Auth: required (admin check — use organization role or superuser flag)
  Returns: ProfessionalResponse (201)
```

**Note on auth:** v9.0 does not add role-based access control. Admin endpoints use a simple `is_admin` check on the `User` model (add `is_admin: bool = False` field) or a hardcoded admin organization check. Full RBAC is future work.

### Frontend Component

New route: `/professionals` (or accessible from `/rapporten` as a sidebar tab)

```
frontend/src/components/professionals/
  ProfessionalDirectory.tsx    (NEW) — listing + filter
  ProfessionalCard.tsx          (NEW) — single professional card
  LeadCaptureForm.tsx           (NEW) — shared: used here + post-dossier
  LeadConfirmation.tsx          (NEW) — success state
```

**ProfessionalCard renders:**
- Bedrijfsnaam + contactpersoon
- Gecertificeerd badge (BRL 5006) if `is_certified`
- Werkgebied (gemeenten or provincies)
- "Neem contact op" button → LeadCaptureForm modal

---

## New Database Models Summary

| Model | File | Notes |
|-------|------|-------|
| `GeneratedDossier` | `backend/app/models/dossier.py` | Tenant-isolated via `organization_id` |
| `LeadRequest` | `backend/app/models/lead_request.py` | Tenant-isolated via `organization_id` |
| `Professional` | `backend/app/models/professional.py` | NOT tenant-isolated — platform-wide |

**No changes to existing models.** `PropertyReportResponse` extensions are backward-compatible (all new fields `Optional`/`None` default).

---

## Component Boundaries

### New Backend Files

| File | Type | Purpose |
|------|------|---------|
| `backend/app/government_apis/bodemloket_wms.py` | API client | Bodemloket WMS GetFeatureInfo query |
| `backend/app/schemas/bodem.py` | Pydantic schema | `BodemData` model |
| `backend/app/services/wkb_classifier.py` | Pure service | Gevolgklasse classification engine |
| `backend/app/services/asbest_indicator.py` | Pure service | Asbest risk assessment from bouwjaar |
| `backend/app/dossier/router.py` | FastAPI router | POST generate, GET download |
| `backend/app/dossier/generator.py` | Service | Jinja2 + WeasyPrint dossier PDF |
| `backend/app/dossier/templates/wkb_kwaliteitsborger.html` | Template | Kwaliteitsborger dossier layout |
| `backend/app/leads/router.py` | FastAPI router | POST lead, GET list |
| `backend/app/leads/service.py` | Service | Lead CRUD + email notification |
| `backend/app/professionals/router.py` | FastAPI router | GET list, GET detail, POST (admin) |
| `backend/app/professionals/service.py` | Service | Professional CRUD |
| `backend/app/models/dossier.py` | SQLAlchemy model | GeneratedDossier |
| `backend/app/models/lead_request.py` | SQLAlchemy model | LeadRequest |
| `backend/app/models/professional.py` | SQLAlchemy model | Professional |

### Modified Backend Files

| File | Change | Scope |
|------|--------|-------|
| `backend/app/schemas/property.py` | Add `bodem_data`, `wkb_classification`, `asbest_risk` fields to `PropertyReportResponse` | EXTEND — all Optional |
| `backend/app/services/property_aggregator.py` | Add `fetch_bodem_data()` to asyncio.gather; add `wkb_classifier.classify_gevolgklasse()` and `asbest_indicator.assess_asbest_risk()` calls in Step 3 | MODIFY — core orchestration |
| `backend/app/core/config.py` | Add `CACHE_TTL["bodemloket"]` = 2592000 (30 days) | EXTEND |
| `backend/app/government_apis/rate_limiter.py` | Add `bodemloket_limiter` (2 concurrent, 100/hour) | EXTEND |
| `backend/app/main.py` | Register new routers: dossier, leads, professionals | EXTEND |
| `backend/app/models/user.py` | Add `is_admin: bool = False` field (for professional CRUD auth) | EXTEND |

### New Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/components/reports/BodemSection.tsx` | Soil contamination status block |
| `frontend/src/components/reports/AsbstSection.tsx` | Asbestos risk indicator block |
| `frontend/src/components/reports/DossierCTA.tsx` | "Genereer dossier" CTA button + flow |
| `frontend/src/components/dossier/DossierReadyPage.tsx` | Post-generation: preview + lead CTA |
| `frontend/src/components/professionals/ProfessionalDirectory.tsx` | Directory listing + filter |
| `frontend/src/components/professionals/ProfessionalCard.tsx` | Individual professional card |
| `frontend/src/components/professionals/LeadCaptureForm.tsx` | Lead capture form (shared) |
| `frontend/src/components/professionals/LeadConfirmation.tsx` | Success confirmation |

### Modified Frontend Files

| File | Change |
|------|--------|
| `frontend/src/lib/types/property.ts` | Add `BodemData`, `WkbClassification`, `AsbstRisk` interfaces; extend `PropertyReportResponse` |
| `frontend/src/components/reports/ReportDetailPage.tsx` | Add `BodemSection`, `AsbstSection`, `DossierCTA`; extend `WkbSection` with gevolgklasse |

---

## Data Flow Diagrams

### Flow 1: Report with New Sections

```
POST /api/property/lookup  OR  POST /api/reports/from-parcel
  │
  ▼
STEP 1: resolve_address(BAG)
  → rd_x, rd_y               ← bodemloket query input
  → verblijfsobject_id       ← (existing uses)
  → bouwjaar                 ← asbest_indicator input (from BAG building)
  │
  ▼
STEP 2a: asyncio.gather(
  fetch_cadastral_parcels(),  ← existing
  fetch_zoning(),             ← existing
  fetch_monuments(),          ← existing
  fetch_energy_label(),       ← existing (v7.0)
  fetch_woz_data(),           ← existing (v7.0)
  fetch_bodem_data(rd_x, rd_y),  ← NEW v9.0
)
  │
  ▼
STEP 2b: fetch_brk_ownership()  ← existing (v7.0, no cache)
  │
  ▼
STEP 3 (sequential, no API calls):
  evaluate_wkb_precheck(building, monuments, zoning, buildability_delta)  ← existing
  classify_gevolgklasse(building, zoning, buildability_delta)              ← NEW
  assess_asbest_risk(building.bouwjaar)                                    ← NEW
  build_buildability_delta(...)  ← existing
  trigger_ai_parsing(...)        ← existing
  build_map_data(...)            ← existing
  │
  ▼
PropertyReportResponse (extended with bodem_data, wkb_classification, asbest_risk)
```

### Flow 2: Dossier Generation

```
User is viewing ReportDetailPage (report already exists and saved)
  │
  ▼ Click "Genereer dossier voor kwaliteitsborger"
POST /api/dossier/{report_id}/generate
  │
  ├── Validate SavedReport exists, belongs to org
  ├── Check report_data has wkb_precheck, bodem_data, asbest_risk sections
  ├── Create GeneratedDossier row (status=generating)
  │
  ▼
asyncio.to_thread(generate_dossier_pdf(report_data, type="wkb_kwaliteitsborger"))
  │
  ├── Jinja2: render wkb_kwaliteitsborger.html with report_data context
  ├── WeasyPrint: HTML → PDF bytes
  └── Return DossierGenerateResponse(dossier_id)
  │
  ▼
Frontend: DossierReadyPage
  ├── Shows dossier download button
  └── Shows "Kwaliteitsborger aanvragen" CTA → LeadCaptureForm
```

### Flow 3: Lead Capture

```
User fills LeadCaptureForm (name, email, project description)
  │
  ▼
POST /api/leads
  │
  ├── Validate input
  ├── Create LeadRequest(status="new", professional_id=selected or null)
  ├── Send notification email (admin receives lead details)
  └── Return LeadResponse(id, status)
  │
  ▼
Frontend: LeadConfirmation
  "Uw aanvraag is ontvangen. Een kwaliteitsborger neemt binnen 2 werkdagen contact op."
```

---

## Build Order

Build order is driven by three dependency chains:
1. Schema layer before aggregator integration
2. API client before aggregator integration
3. New report sections before dossier (dossier reads from report_data)
4. Dossier before lead capture (lead captures dossier intent)
5. Lead capture before professional directory (directory provides lead routing target)

### Phase A: Core Data Additions (no UI dependency)

1. `backend/app/schemas/bodem.py` — `BodemData`
2. Add `bodem_data`, `wkb_classification`, `asbest_risk` to `PropertyReportResponse` in `property.py`
3. `backend/app/government_apis/bodemloket_wms.py` — API client
4. `backend/app/services/wkb_classifier.py` — pure classification engine
5. `backend/app/services/asbest_indicator.py` — pure risk engine
6. Add `bodemloket_limiter` to `rate_limiter.py`; add `CACHE_TTL["bodemloket"]` to `config.py`
7. Wire all three into `property_aggregator.py` (bodem to gather, wkb_class + asbest to Step 3)

**Gate:** `ruff check . && mypy .`; manual test: `POST /api/property/lookup` returns `bodem_data`, `wkb_classification`, `asbest_risk` in response

**Why first:** These are pure data additions with no dependencies on other new features. They extend the existing, well-tested pipeline.

### Phase B: Report UI (depends on Phase A)

8. Extend `frontend/src/lib/types/property.ts` with new interfaces
9. `frontend/src/components/reports/BodemSection.tsx`
10. `frontend/src/components/reports/AsbstSection.tsx`
11. Extend `WkbSection` in `ReportDetailPage.tsx` with gevolgklasse display
12. Mount new sections in `ReportDetailPage.tsx`

**Gate:** `npm run check`; open a real report and verify all new sections render (including None/empty state)

**Why here:** UI before dossier because dossier depends on confirmed section data rendering correctly.

### Phase C: Dossier Generation (depends on Phases A + B)

13. `backend/app/models/dossier.py` + Alembic migration
14. `backend/app/dossier/templates/wkb_kwaliteitsborger.html`
15. `backend/app/dossier/generator.py`
16. `backend/app/dossier/router.py` + register in `main.py`
17. `frontend/src/components/reports/DossierCTA.tsx`
18. `frontend/src/components/dossier/DossierReadyPage.tsx`

**Gate:** Generate a dossier PDF for a real report; verify all sections render; verify streaming download works

**Why here:** Dossier references the report data already enriched in Phase A. The PDF template references the new sections added in Phase B.

### Phase D: Lead Capture (depends on Phase C)

19. `backend/app/models/lead_request.py` + Alembic migration
20. `backend/app/leads/service.py` (CRUD + email notification)
21. `backend/app/leads/router.py` + register in `main.py`
22. `frontend/src/components/professionals/LeadCaptureForm.tsx`
23. `frontend/src/components/professionals/LeadConfirmation.tsx`
24. Wire lead CTA into `DossierReadyPage.tsx`
25. Wire lead CTA into `WkbSection` (soft CTA when `status === 'likely_required'`)

**Gate:** Submit a test lead; verify it appears in DB; verify notification email is sent

**Why here:** Lead capture makes no sense without the dossier. Users generate the dossier, then see the lead CTA.

### Phase E: Professional Directory (depends on Phase D, mostly independent)

26. Add `is_admin: bool = False` to `User` model + migration
27. `backend/app/models/professional.py` + migration
28. `backend/app/professionals/service.py`
29. `backend/app/professionals/router.py` + register in `main.py`
30. `frontend/src/components/professionals/ProfessionalDirectory.tsx`
31. `frontend/src/components/professionals/ProfessionalCard.tsx`
32. Seed initial professional records (1-3 kwaliteitsborgers for demo)
33. Wire `professional_id` selection from directory into `LeadCaptureForm.tsx`

**Gate:** Browse directory; click "Neem contact op" on a card; submit lead form; verify `lead_request.professional_id` is populated

**Why last:** The directory is the discovery surface for leads. Leads work without the directory (Phase D), but the directory makes lead routing more specific.

---

## Integration Points with Existing Code

### Bodemloket ↔ Property Aggregator

Integration point: `aggregate_property_data()` in `property_aggregator.py`, Step 2a gather. Input: `rd_x, rd_y` — already available from BAG resolution in Step 1. No new inputs needed.

### Wkb Classifier ↔ Existing Wkb Precheck

`wkb_precheck.py` evaluates probability. `wkb_classifier.py` evaluates class. They share input data (`building`, `zoning_data`, `buildability_delta`) but are independent functions. The classifier can be called alongside the precheck in Step 3. They share the `WkbPrecheck` and `WkbClassification` models but do not call each other.

### Dossier Generator ↔ Report PDF Export

Both use `WeasyPrint` + Jinja2. The existing `backend/app/reports/pdf_export.py` is a good pattern to follow. The dossier generator is a NEW file, not a modification of the existing PDF export. The existing report PDF covers all sections; the dossier PDF is kwaliteitsborger-scoped (subset of sections, different layout).

### Lead Capture ↔ Saved Reports

A `LeadRequest` has a FK to `SavedReport.id`. The lead references the specific property that triggered the professional inquiry. This enables future analytics: which properties generate the most leads.

### Professional Directory ↔ Lead Routing

`LeadRequest.professional_id` is nullable. In Phase D (lead capture without directory), it is null. In Phase E (with directory), the user selects a professional from the directory card, and that ID is sent with the lead request.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Blocking Dossier on Live API Calls

**What goes wrong:** Triggering new Bodemloket/Wkb API calls at dossier generation time.
**Why it happens:** Developer assumes dossier needs fresh data.
**Consequences:** Dossier generation becomes slow + brittle (external API dependency).
**Do this instead:** Dossier reads exclusively from `SavedReport.report_data` JSONB. All live data was fetched at report generation time. If data is stale, the user should refresh the report first, then generate the dossier.

### Anti-Pattern 2: Making Professional Model Tenant-Isolated

**What goes wrong:** Adding `organization_id` to `Professional` like all other models.
**Why it happens:** Following the TenantMixin convention without thinking about intent.
**Consequences:** Each org has its own list — platform can't have a shared directory.
**Do this instead:** `Professional` does NOT use `TenantMixin`. It is platform-wide. The API endpoint still requires auth (no public access), but the directory is shared across all orgs.

### Anti-Pattern 3: Storing Lead Contact Details in Report JSONB

**What goes wrong:** Embedding lead requester email/name in `SavedReport.report_data`.
**Why it happens:** Trying to associate lead data with report.
**Consequences:** PII stored in the wrong place, harder to delete per GDPR right-to-erasure requests.
**Do this instead:** `LeadRequest` is its own model with its own table. `LeadRequest.report_id` FK provides the association. PII can be erased from `lead_requests` independently.

### Anti-Pattern 4: Bodemloket WMS Without 50m Buffer

**What goes wrong:** Using exact point coordinates for GetFeatureInfo without a bounding box buffer.
**Why it happens:** Point-exact queries seem logical.
**Consequences:** Point misses polygon edges; contamination records just outside the pixel may be missed.
**Do this instead:** Use a 50-100m RD buffer around the point. The WMS GetFeatureInfo query requires a BBOX — make it meaningful (not 1m).

### Anti-Pattern 5: Asbest Risk as Hard Boolean

**What goes wrong:** Returning `is_asbest_risk: True/False` without nuance.
**Why it happens:** Simple boolean seems clean.
**Consequences:** Pre-1900 buildings have less asbestos risk than 1970s buildings; both get the same flag.
**Do this instead:** Three levels: `high` (1963-1993 peak period), `medium` (pre-1963), `none` (post-1993), `unknown` (no bouwjaar). The 1963 cutoff is the start of widespread asbestos use in Dutch construction.

### Anti-Pattern 6: Gevolgklasse Classification on New Construction Only

**What goes wrong:** Assuming gevolgklasse only applies to new construction.
**Why it happens:** Wkb started January 2024 for new builds in gevolgklasse 1.
**Consequences:** Missing transformation/renovation cases that also require kwaliteitsborger.
**Do this instead:** Classify based on building type and planned intervention (from Wkb precheck Layer B inputs). Transformation of existing buildings can trigger gevolgklasse 1 under certain conditions.

---

## Scalability Considerations

| Concern | At Current Scale | With v9.0 | Mitigation |
|---------|-----------------|-----------|------------|
| Bodemloket WMS load | N/A | 1 call/report, low volume | 30d cache TTL; limiter prevents bulk |
| Dossier PDF CPU | N/A | WeasyPrint per generation | asyncio.to_thread; no blocking |
| Lead storage | N/A | Low volume (manual routing) | Simple CRUD; no queue needed |
| Professional directory | N/A | Static list, rarely changes | 60min TanStack Query cache |
| Report_data JSONB growth | ~20KB/report | +3-5KB (bodem+wkb_class+asbest) | Fine at current scale |

---

## Sources

- Direct codebase analysis (HIGH confidence):
  - `backend/app/services/property_aggregator.py` — aggregation pipeline, Step 2a gather pattern
  - `backend/app/services/wkb_precheck.py` — existing precheck service structure to extend from
  - `backend/app/government_apis/base.py` — three-state contract, GovernmentAPIError
  - `backend/app/government_apis/woz_waardeloket.py` — pattern for public WMS/JSON clients
  - `backend/app/reports/pdf_export.py` — WeasyPrint + Jinja2 pattern for dossier generator
  - `backend/app/models/report.py` — JSONB storage pattern, multi-tenant isolation
  - `backend/app/models/base.py` — TenantMixin, TimestampMixin patterns
  - `backend/app/schemas/property.py` — PropertyReportResponse extension points
  - `frontend/src/lib/types/property.ts` — TypeScript interface extension pattern
  - `frontend/src/components/reports/ReportDetailPage.tsx` — section rendering pattern
- [Bodemloket GIS inladen (WMS endpoints)](https://www.bodemloket.nl/content/kan-ik-bodemloket-ook-mijn-gis-inladen) — confirmed WMS URL and GetFeatureInfo support (MEDIUM confidence — page content verified via WebFetch)
- [De Friese Woudloper — bodemkwaliteitsgegevens ArcGIS REST](http://www.friesewoudloper.nl/2019/05/30/Hergebruik-van-bodemkwaliteitsgegevens.html) — WBB_locaties field names (MEDIUM confidence — community article; field list matches known WBB schema)
- [iplo.nl gevolgklasse criteria](https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/kwaliteitsborging/bouwwerken-gevolgklasse/) — Wkb gevolgklasse 1/2/3 classification rules (HIGH confidence — official government source)
- [Rijksoverheid Wkb factsheet gevolgklassen](https://www.rijksoverheid.nl/documenten/publicaties/2021/03/01/factsheet-de-wet-kwaliteitsborging-voor-het-bouwen-gevolgklassen) — building type examples per gevolgklasse (HIGH confidence — official government publication)
- [NL Arbeidsinspectie asbest wetgeving](https://www.nlarbeidsinspectie.nl/onderwerpen/arbeidsomstandighedenwet-gevaarlijke-stoffen/asbest/wet--en-regelgeving-asbest) — 1994 ban confirmation (HIGH confidence — official authority)
- [Bobex.nl — asbest verbod 1994](https://www.bobex.nl/nl-nl/asbest-verwijderen/wat-is-asbest/verbod/) — 1963-1993 peak risk period, mandatory inventory pre-1994 (MEDIUM confidence — verified against NL Arbeidsinspectie source)

---

*Architecture research for: Propdex v9.0 Professional Marketplace*
*Researched: 2026-03-01*
