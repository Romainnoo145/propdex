# Stack Research — v9.0 Professional Marketplace

**Domain:** Dutch PropTech — Soil Intelligence, Wkb Classification, Lead Marketplace
**Researched:** 2026-03-01
**Confidence:** HIGH (Wkb rules, asbest rule, PDF reuse, lead/directory patterns), MEDIUM (Bodemloket API — community-documented endpoint, no official API docs published)

---

## Context: Subsequent Milestone

This covers ONLY new stack requirements for v9.0. The existing validated stack must not be changed. All base stack (FastAPI, SQLAlchemy 2.x, httpx, pyproj, WeasyPrint, fastapi-mail, Jinja2, TanStack, react-hook-form, zod, etc.) is already installed and proven across v1.0-v7.2.

---

## Existing Stack — Already Installed, Not Re-researched

**Backend (`pyproject.toml`):** FastAPI[standard]>=0.115.0, SQLAlchemy[asyncio]>=2.0.25, asyncpg>=0.29.0, httpx[http2]>=0.27.0, pyproj>=3.7.0, shapely>=2.0.0, GeoAlchemy2>=0.15.0, WeasyPrint>=68.0, jinja2>=3.1.0, fastapi-mail>=1.4.1, anthropic>=0.40.0, arq>=0.27.0, aiolimiter>=1.2.0, pydantic-settings>=2.1.0, PyJWT[crypto]>=2.9.0, pwdlib[argon2]>=0.2.0, lxml>=5.3.0, openpyxl>=3.1.0

**Frontend (`package.json`):** React 19, Vite 7, TypeScript strict, MapLibre GL JS 5.x, TanStack Query v5, TanStack Router, TanStack Table, Tailwind v4, react-hook-form ^7.71.1, zod ^4.3.6, sonner, lucide-react, clsx, class-variance-authority

---

## New Stack Requirements by Feature

### Feature 1: Bodemloket API Integration

**What:** Query Dutch national soil contamination register (Wet bodembescherming dossiers) at parcel level.

**API endpoint (MEDIUM confidence — community-documented via Friesewoudloper blog 2019; official API docs not published; ArcGIS server confirmed active):**

```
# WMS for map overlay visualization only:
https://gis.gdngeoservices.nl/standalone/services/blk_gdn/lks_blk_rd_v1/MapServer/WMSServer
  ?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities

# ArcGIS REST MapServer for data queries:
Base: https://www.gdngeoservices.nl/arcgis/rest/services/blk/lks_blk_rd/MapServer
  Layer 0: WBB_punten (point features — investigation point locations)
  Layer 1: WBB_locaties (polygon features — contamination zone polygons)

# Spatial intersection query (GET or POST, GeoJSON output):
https://www.gdngeoservices.nl/arcgis/rest/services/blk/lks_blk_rd/MapServer/1/query
  ?geometryType=esriGeometryPoint
  &geometry=<x>,<y>               # EPSG:28992 (RD New) coordinates
  &inSR=28992
  &spatialRel=esriSpatialRelIntersects
  &distance=50                    # 50m buffer around parcel centroid
  &units=esriSRUnit_Meter
  &outFields=*
  &f=geojson
  &returnGeometry=false           # data only, no polygon output needed

# Known response fields (LOW confidence — inferred from blog, verify on live call):
WBB_DOSSIER_DBK, NEN3610_ID_SOIL_MANAGEMENT, LOCATIECODE_BEVOEGD_GEZAG
```

**No new Python library required.** Integration uses existing stack:
- `httpx.AsyncClient` — existing HTTP client
- `pyproj.Transformer` — WGS84 → RD New coordinate conversion (EPSG:28992), already used in `rce_monuments.py`
- JSONB cache via `get_cached_or_fetch()` from `services/cache_manager.py`
- `GovernmentAPIError` / `handle_api_response()` from `government_apis/base.py`

**Cache TTL:** 90 days — WBB dossier status changes rarely (contamination investigations are historical).

**New config needed:**

```python
# Add to backend/app/core/config.py CACHE_TTL dict:
"bodemloket": 7776000,  # 90 days

# Add to Settings class:
BODEMLOKET_BASE_URL: str = Field(
    default="https://www.gdngeoservices.nl/arcgis/rest/services/blk/lks_blk_rd/MapServer",
    description="Bodemloket ArcGIS REST MapServer URL (no auth required — public service)",
)
```

**New file:** `backend/app/government_apis/bodemloket.py`

**Rate limiter:** Add conservative limiter — 5 concurrent, 200/hour. No published limits; treat as polite public service.

**Validation gate before Phase 1:** Verify `https://www.gdngeoservices.nl/arcgis/rest/services/blk/lks_blk_rd/MapServer/1/query?where=1=1&outFields=*&f=json&resultRecordCount=1` returns valid JSON before building the client. If endpoint is down, fall back to WMS GetFeatureInfo (lxml already available to parse HTML response).

---

### Feature 2: Wkb Gevolgklasse Classification Engine

**What:** Determine gevolgklasse (GK1/GK2/GK3) for a building under the Wet kwaliteitsborging voor het bouwen (Wkb), mandatory for new construction since 1 January 2024, renovation GK1 since 1 January 2025.

**Rules (HIGH confidence — sourced from IPLO.nl and TLO-KB, both official government sources):**

```
GK1 — Beperkte persoonlijke gevolgen (limited consequences):
  INCLUDES:
    - Grondgebonden woningen: vrijstaand, twee-onder-één-kap, rij
      (gebruiksdoel="woonfunctie", NOT apartment/woongebouw)
    - Vakantiewoningen (single-unit, grondgebonden, not in lodging complex)
    - Industriegebouwen ≤ 2 bouwlagen
    - Voetgangers-/fietsbrug met overspanning ≤ 20m
      (not over state/provincial roads)
    - Overig bouwwerk (non-building) ≤ 20m hoog, no water-retention function

  EXCLUDES:
    - Rijksmonumenten (monument_status=True → NOT GK1)
    - Zorgwoningen (care housing)
    - Woongebouwen (apartment buildings — stacked, multi-tenant)
    - Any building requiring usage notification (meldingsplichtige inrichting)

GK2 — Reële kans op gevolgen (realistic chance of consequences):
  - Libraries, schools, municipality buildings
  - Woongebouwen up to 70m height
  NOTE: GK2 full rule set under ministerial evaluation as of 2026-03;
        GK2 implementation not yet mandatory — future milestone

GK3 — Kans op aanzienlijke gevolgen (substantial consequences):
  - Stadiums, hospitals, metro stations
  - Buildings > 70m height
  NOTE: GK3 implementation: future — no action required in v9.0
```

**Data inputs from existing stack:**

| Input | Source | Available in BAG data |
|-------|--------|----------------------|
| `gebruiksdoel` | BAG verblijfsobject | YES — in `BuildingData` |
| `monument_status` | RCE | YES — in `MonumentStatus` |
| `bouwjaar` | BAG pand | YES — in `BuildingData` |
| `bag_status` | BAG pand | YES — in `BuildingData` |
| `pand_hoogte_m` | NOT in BAG | NO — derive or leave uncertain |
| `bouwlagen_count` | NOT in BAG standard | PARTIAL — from DSO bestemmingsplan |

**Height gap resolution:** For GK1 determination, `pand_hoogte_m` is only critical for "overige bouwwerken" category. For `woonfunctie` grondgebonden, height rule is implicitly satisfied (ground-connected by definition). Use `max_bouwlagen` from DSO bestemmingsplan when available as proxy. Output `GK2_mogelijk` when height is unknown and gebruiksdoel is ambiguous.

**Output values:** `"GK1" | "GK2_mogelijk" | "GK1_of_GK2" | "onbekend"` with confidence level (same `high/medium/low` pattern as existing `WkbPrecheck`).

**No new library required.** Pure Python rule engine, extends existing `wkb_precheck.py`.

**Integration:** Add `gevolgklasse: str` and `gevolgklasse_confidence: str` fields to `WkbPrecheck` Pydantic schema in `schemas/property.py`. The classification runs inside `evaluate_wkb_precheck()` using already-fetched inputs.

---

### Feature 3: Asbest Risk Indicator

**What:** Flag buildings built before 1994 as having potential asbestos risk, per Dutch law. Mandatory asbestos inventory (NEN 2991) required before demolition/renovation of pre-1994 buildings.

**Rule (HIGH confidence — Nederlandse Arbeidsinspectie official, multiple sources confirm 1993 production ban, 1994 construction ban):**

```python
# Pure Python — no library needed
CUT_OFF_YEAR = 1994  # Asbestos use in construction banned from 1994

def asbest_risico(bouwjaar: int | None) -> dict:
    if bouwjaar is None:
        return {
            "heeft_risico": None,   # unknown, not False
            "label": "Onbekend — bouwjaar niet beschikbaar",
            "inventarisatie_vereist": None,
        }
    if bouwjaar < CUT_OFF_YEAR:
        return {
            "heeft_risico": True,
            "label": f"Mogelijk aanwezig (bouwjaar {bouwjaar}, voor 1994)",
            "inventarisatie_vereist": True,  # NEN 2991 inventory mandatory before renovation
        }
    return {
        "heeft_risico": False,
        "label": f"Niet verwacht (bouwjaar {bouwjaar}, na 1993)",
        "inventarisatie_vereist": False,
    }
```

**No new library required.** Add to the property enrichment pipeline alongside bouwjaar retrieval from BAG. `bouwjaar` is already in `BuildingData.bouwjaar`.

**Add `asbest_indicator` field** to `PropertyReportResponse` schema — simple JSONB column on the Report model or inline in `report_data` JSONB.

---

### Feature 4: Risicobeoordeling Dossier PDF Generator

**What:** Aggregated PDF dossier for kwaliteitsborgers — combines all property intelligence into a single structured document required for Wkb borgingsplan preparation.

**Decision: Reuse WeasyPrint + Jinja2 (already installed).** Do not add a new PDF library.

**Rationale:**
- `WeasyPrint >= 68.0` is already in `pyproject.toml`, already used in `backend/app/reports/pdf_export.py`
- Pattern `asyncio.to_thread(generate_report_pdf, ...)` already established (WeasyPrint is CPU-bound/synchronous)
- Jinja2 templating already used — add one new template file
- The dossier is a static multi-section document — WeasyPrint CSS print layout handles this well

**Dossier content sections (per IPLO.nl dossier requirements — HIGH confidence):**

```
1. Project identification: adres, kadastrale aanduiding, BAG-ID, peildatum
2. Bouwdata: bouwjaar, gebruiksdoel, bag_status, oppervlakte
3. Gevolgklasse: GK1/GK2/GK3 classification + rationale
4. Wkb precheck: status, triggered rules, required documents checklist
5. Asbest indicator: heeft_risico, inventarisatie_vereist, bouwjaar
6. Bodem status: Bodemloket result (WBB features or "geen bekende verontreiniging")
7. Monument status: is_monument, type, beschrijving (if applicable)
8. Zoning: bestemming, max_bouwlagen, permitted functions
9. Data freshness: per-section cache timestamps
10. Disclaimer: "Indicatief — nader onderzoek vereist per Wkb borgingsplan"
```

**New files:**
- `backend/app/reports/templates/dossier.html` — Jinja2 template (separate from existing `report.html`)
- New function `generate_dossier_pdf(report_data: dict, report_name: str) -> bytes` in `pdf_export.py` or new `dossier_export.py`

**New endpoint:** `POST /reports/{report_id}/dossier/pdf`
- Parallel to existing `GET /reports/{report_id}/pdf`
- Same `asyncio.to_thread()` pattern
- Returns `StreamingResponse(pdf_bytes, media_type="application/pdf")`

**No new libraries required.**

---

### Feature 5: Lead Capture Flow

**What:** User journey CTA ("Vraag kwaliteitsborger aan") — capture contact intent from the property report, route notification to admin and/or matched professional.

**Architecture:** Form submission → PostgreSQL record → email notification. No payment infrastructure in v9.0.

**Backend pattern (uses existing stack entirely):**

```python
# New SQLAlchemy model: LeadRequest
class LeadRequest(Base):
    __tablename__ = "lead_requests"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    report_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("reports.id"), nullable=True)
    professional_type: Mapped[str]  # "kwaliteitsborger", "constructeur", etc.
    contact_name: Mapped[str]
    contact_email: Mapped[str]
    contact_phone: Mapped[str | None]
    bericht: Mapped[str | None]
    status: Mapped[str] = mapped_column(default="nieuw")  # nieuw|in_behandeling|afgerond
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
```

**Email routing:** Use existing `fastapi-mail` (already installed) — same pattern as `auth/email.py`. Send notification to configured admin email + matched professional's email when auto-matched from directory.

**No new library required.** fastapi-mail (already in stack) handles both lead notification emails and professional response emails.

**Frontend:** Use existing `react-hook-form` + `zod` + `sonner` (toast notifications) — all already installed.

**New files needed:**
- `backend/app/models/lead_request.py`
- `backend/app/leads/router.py` + `schemas.py`
- Alembic migration: `add_lead_requests_table`
- Frontend: `src/components/leads/LeadCaptureForm.tsx` + `src/hooks/useLeadCapture.ts`

---

### Feature 6: Professional Directory

**What:** Searchable listing of certified kwaliteitsborgers with geographic coverage and specialization. First vertical in a planned multi-vertical marketplace.

**Architecture:** Standard PostgreSQL table with JSONB `attributes` column for flexible professional metadata. No external search engine needed at this scale (expected < 500 professionals initially).

**New SQLAlchemy model:**

```python
class Professional(Base):
    __tablename__ = "professionals"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # NULL org_id = platform-wide listing (not org-scoped)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("organizations.id"), nullable=True, index=True)
    type: Mapped[str]  # "kwaliteitsborger" | "constructeur" | "asbest_inspecteur"
    bedrijfsnaam: Mapped[str]
    naam: Mapped[str]
    email: Mapped[str]
    telefoon: Mapped[str | None]
    website: Mapped[str | None]
    kvk_nummer: Mapped[str | None]
    instrument_naam: Mapped[str | None]  # TLO-KB certified instrument name
    gevolgklassen: Mapped[list[int]] = mapped_column(ARRAY(Integer))  # [1], [1,2], [1,2,3]
    regio_gemeenten: Mapped[list[str]] = mapped_column(ARRAY(String))  # CBS gemeentecodes
    is_active: Mapped[bool] = mapped_column(default=True)
    is_verified: Mapped[bool] = mapped_column(default=False)
    attributes: Mapped[dict] = mapped_column(JSONB, default=dict)  # flexible extras
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)
```

**Index strategy:**
- GIN index on `gevolgklassen` array — filter by gevolgklasse coverage
- GIN index on `regio_gemeenten` array — filter by municipality
- Standard B-tree on `type`, `is_active`, `is_verified`

**Why JSONB for `attributes`:** Professional certifications vary by type (kwaliteitsborger has different extras than constructeur). Avoids schema churn when adding professional types in future milestones.

**No new library required.** SQLAlchemy 2.x `ARRAY` and `JSONB` types are already in the stack (GeoAlchemy2 dependency ensures PostGIS/JSONB support).

**Frontend:** TanStack Table (already installed) for directory listing with filtering. No new library needed.

**New files:**
- `backend/app/models/professional.py`
- `backend/app/professionals/router.py` + `schemas.py`
- Alembic migration: `add_professionals_table`
- Frontend: `src/components/directory/ProfessionalDirectory.tsx` + filter components

---

## Final Answer: New Dependencies Required

### Backend — Zero New pip Packages

All six v9.0 features use exclusively the existing stack.

| Feature | New pip package? | Uses instead |
|---------|-----------------|-------------|
| Bodemloket API | None | httpx + pyproj + JSONB cache |
| Wkb gevolgklasse | None | Pure Python rule module |
| Asbest indicator | None | Pure Python, BAG bouwjaar |
| Dossier PDF | None | WeasyPrint + Jinja2 (existing) |
| Lead capture | None | fastapi-mail + SQLAlchemy |
| Professional directory | None | SQLAlchemy + PostgreSQL ARRAY/JSONB |

**`pyproject.toml` changes: none required.**

### Frontend — Zero New npm Packages

| Feature | New npm package? | Uses instead |
|---------|-----------------|-------------|
| Dossier PDF download | None | Blob download (existing pattern from report PDF) |
| Lead capture form | None | react-hook-form + zod + sonner (existing) |
| Professional directory table | None | TanStack Table (existing) |
| Bodem data display | None | Existing card/section components |

**`package.json` changes: none required.**

---

## New Configuration Required

```python
# backend/app/core/config.py — add to CACHE_TTL dict:
"bodemloket": 7776000,  # 90 days (WBB dossiers are historical — rarely change)

# backend/app/core/config.py — add to Settings class:
BODEMLOKET_BASE_URL: str = Field(
    default="https://www.gdngeoservices.nl/arcgis/rest/services/blk/lks_blk_rd/MapServer",
    description="Bodemloket ArcGIS REST MapServer URL (public, no auth required)",
)
```

---

## New Alembic Migrations Required

| Migration name | What it adds |
|---------------|-------------|
| `add_professionals_table` | Professional model with ARRAY indexes |
| `add_lead_requests_table` | LeadRequest model |
| `add_asbest_bodem_to_report` | Add `asbest_indicator` + `bodem_status` to report_data JSONB schema (if separate column needed; may be implicit in existing JSONB) |

---

## New API Endpoints

```
# Professional directory:
GET  /professionals              List directory (public, filter: type, gevolgklasse, gemeente)
GET  /professionals/{id}         Professional detail card

# Lead capture:
POST /leads                      Submit lead request (authenticated, org-scoped)
GET  /leads                      List own leads (authenticated, org-scoped)

# Dossier PDF:
GET  /reports/{report_id}/dossier/pdf   Generate kwaliteitsborger dossier PDF

# Bodem data (per-parcel):
GET  /reports/{report_id}/bodem         Fetch Bodemloket result for parcel (cached)
```

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| pdfkit / wkhtmltopdf | Abandoned project; requires system binary; worse CSS support | WeasyPrint (already installed) |
| reportlab | Lower-level, requires programmatic layout instead of CSS | WeasyPrint + Jinja2 (existing) |
| Elasticsearch / OpenSearch | 50-500 professionals does not justify dedicated search infra | PostgreSQL full-text + ARRAY GIN indexes |
| Celery / RQ | ARQ already handles job queue | ARQ (already installed) |
| Stripe / Mollie / payment SDK | v9.0 is pre-payment; billing handled manually per PROJECT.md | Add in future milestone when revenue model validated |
| OGC API Features client library | Bodemloket uses ArcGIS REST, not OGC API Features | Plain httpx GET/POST |
| requests (sync) | Blocking — breaks async FastAPI event loop | httpx.AsyncClient (already installed) |
| aiosmtplib (direct) | fastapi-mail already wraps aiosmtplib; consistent with existing email.py | fastapi-mail (already installed) |
| Scrapling | Already in stack for scraping needs; not required for Bodemloket | Not needed |
| Dedicated PDF microservice | Unnecessary at current report volume | asyncio.to_thread() + WeasyPrint (existing) |
| PostGIS extension changes | PostGIS already installed via postgis/postgis Docker image | No change |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Bodemloket data | ArcGIS REST spatial query | WMS GetFeatureInfo | Less structured output (HTML text), harder to parse reliably |
| Bodemloket data | ArcGIS REST spatial query | Manual scrape of bodemloket.nl/kaart | Terms of service violation risk; fragile |
| Dossier PDF | WeasyPrint (existing) | New reportlab integration | New dependency, more complex layout code, no CSS support |
| Professional directory search | PostgreSQL ARRAY + GIN indexes | Elasticsearch | Disproportionate infrastructure for < 500 records |
| Lead routing | fastapi-mail (existing) | External CRM webhook (HubSpot, Pipedrive) | No CRM in v9.0; overkill for manual lead handling |
| Gevolgklasse data | IPLO.nl rule table + pure Python | External classification service | No such service exists; IPLO rules are clear enough for Python encoding |

---

## Version Compatibility Matrix

| Package | Installed Version | v9.0 Impact | Notes |
|---------|-----------------|-------------|-------|
| WeasyPrint | >=68.0 | None | New dossier template only |
| Jinja2 | >=3.1.0 | None | New `dossier.html` template |
| fastapi-mail | >=1.4.1 | None | New lead notification email templates |
| httpx | >=0.27.0 | None | New Bodemloket client |
| pyproj | >=3.7.0 | None | WGS84→RD New for Bodemloket |
| SQLAlchemy | >=2.0.25 | None | New models (Professional, LeadRequest) |
| react-hook-form | ^7.71.1 | None | Lead capture form |
| zod | ^4.3.6 | None | Form validation schema |
| TanStack Table | ^8.21.3 | None | Professional directory listing |
| sonner | ^2.0.7 | None | Lead submission toast feedback |

No version upgrades required for any existing package.

---

## Sources

- [Bodemloket GIS integration page](https://www.bodemloket.nl/content/kan-ik-bodemloket-ook-mijn-gis-inladen) — WMS URLs confirmed; ArcGIS REST base URL confirmed (MEDIUM confidence — no official query API docs published)
- [Friesewoudloper blog — Bodemloket API layer structure](http://www.friesewoudloper.nl/2019/05/30/Hergebruik-van-bodemkwaliteitsgegevens.html) — Layer names, field names `WBB_DOSSIER_DBK`, query approach (LOW-MEDIUM confidence — community blog, 2019)
- [IPLO.nl — Bouwwerken in gevolgklasse](https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/kwaliteitsborging/bouwwerken-gevolgklasse/) — GK1 classification criteria including building type list (HIGH confidence — official Dutch government portal)
- [TLO-KB — Gevolgklassen overview](https://www.tlokb.nl/wet-kwaliteitsborging/gevolgklassen) — Three-class overview and societal risk rationale (HIGH confidence — official Toelatingsorganisatie Kwaliteitsborging Bouw)
- [IPLO.nl — Kwaliteitsborger dossier requirements](https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/kwaliteitsborging/kwaliteitsborger/) — Borgingsplan and dossier content requirements (HIGH confidence — official)
- [Prostream — Wkb gevolgklasse 1 breakdown](https://www.prostream.app/blog/kwaliteit-borgen/gevolgklassen-voor-de-wkb-wat-valt-er-onder-gevolgklasse-1/) — GK1 building type sub-classification A-G (MEDIUM confidence — industry source)
- [Wkb 2025 update — kwaliteitsborger.nl](https://www.kwaliteitsborger.nl/kwaliteitsborger/wkb-2025-5-dingen-die-je-nu-moet-weten/) — GK1 renovation scope from Jan 2025 confirmed (MEDIUM confidence — professional association)
- [Nederlandse Arbeidsinspectie — Asbest inventarisatie](https://www.nlarbeidsinspectie.nl/onderwerpen/asbest/asbestinventarisatie) — Pre-1994 asbestos mandatory inventory rule (HIGH confidence — official government labor inspectorate)
- [WeasyPrint official site](https://weasyprint.org/) — Current library, Jinja2 + FastAPI integration pattern (HIGH confidence)
- [fastapi-mail PyPI](https://pypi.org/project/fastapi-mail/) — v1.4.1 confirmed, aiosmtplib-based (HIGH confidence)
- [aiosmtplib PyPI](https://pypi.org/project/aiosmtplib/) — v5.1.0, Python 3.10+ (referenced by fastapi-mail) (HIGH confidence)
- Codebase audit: `backend/app/reports/pdf_export.py` — WeasyPrint + Jinja2 pattern confirmed (HIGH confidence)
- Codebase audit: `backend/app/auth/email.py` — fastapi-mail pattern confirmed (HIGH confidence)
- Codebase audit: `backend/app/services/wkb_precheck.py` — existing Wkb rule engine pattern confirmed (HIGH confidence)
- Codebase audit: `backend/pyproject.toml` — confirmed no new dependencies required (HIGH confidence)
- Codebase audit: `frontend/package.json` — confirmed react-hook-form, zod, TanStack Table already installed (HIGH confidence)

---

*Stack research for: Propdex v9.0 Professional Marketplace (Bodemloket, Wkb classification, Asbest, Dossier PDF, Lead capture, Professional directory)*
*Researched: 2026-03-01*
