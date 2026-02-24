# Phase 52: Schema & Config Foundation - Research

**Researched:** 2026-02-24
**Domain:** Python/Pydantic schema design, configuration extension, rate limiter setup
**Confidence:** HIGH (all findings from direct codebase inspection; external API fields MEDIUM)

---

## Summary

Phase 52 is a pure infrastructure phase — no external API calls, no database migrations, no frontend changes. It establishes the type system that phases 53-55 will build on. Every task is additive: new Pydantic models, new config fields, new TTL entries, new rate limiter singletons.

The primary risk area is schema design for external API responses that have not been validated live. The EP-Online V5 and WOZ waardeloket field names are documented with MEDIUM confidence (verified via OpenAPI specs and community docs, but not against a live API call). BRK Bevragen V2 ownership field names come from the official OpenAPI spec. RCE Linked Data detail field names are LOW confidence — the REST API returns sparse JSON-LD and may require the `rijksmonumentnummer` as a filter parameter to get the full record.

**Primary recommendation:** Build all three new schemas with `| None` defaults on every external-API field (not just Optional sections in PropertyReportResponse). This prevents validation errors when Phase 53 discovers real field names differ from documented ones.

---

## Standard Stack

### Core (already present in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pydantic | v2 (already in use) | Schema definition, validation | Established project pattern |
| pydantic-settings | (already in use) | Config/env settings | Established project pattern |
| aiolimiter | (already in use) | Token-bucket rate limiting | Already used for bag/brk/sru limiters |

### No New Dependencies Needed

Phase 52 requires zero new library installations. All required libraries are already present:
- `pydantic.BaseModel` + `pydantic.Field` for schemas
- `pydantic_settings.BaseSettings` for config
- `aiolimiter.AsyncLimiter` for rate limiters

**Installation:** None required.

---

## Architecture Patterns

### Recommended File Structure

```
backend/app/
├── schemas/
│   ├── property.py          # EXTEND: add energy_label, woz_data, brk_ownership fields
│   ├── energy_label.py      # NEW: EnergyLabel schema
│   ├── woz.py               # NEW: WOZData schema
│   └── brk_ownership.py     # NEW: BRKOwnership schema
├── core/
│   └── config.py            # EXTEND: EP_ONLINE_API_KEY; CACHE_TTL new keys
└── government_apis/
    └── rate_limiter.py      # EXTEND: ep_online_limiter, rce_detail_limiter
```

All existing schema files follow the same `from __future__ import annotations` + `BaseModel` + `Field()` pattern. Follow it exactly.

### Pattern 1: New Schema Module

**What:** A dedicated file per data domain (energy_label.py, woz.py, brk_ownership.py)
**When to use:** When a schema represents a discrete external API's response
**Example (from existing `monument.py`):**
```python
# Source: backend/app/schemas/monument.py
"""Monument status schemas for multi-source heritage information."""
from __future__ import annotations
from pydantic import BaseModel, Field, model_validator

class MonumentSourceResult(BaseModel):
    """Monument information from a single source."""
    source: str = Field(description="Source identifier ...")
    is_monument: bool | None = Field(default=None, description="...")
```

### Pattern 2: Extending PropertyReportResponse

**What:** Add new `Optional` section fields to the existing `PropertyReportResponse` class in `property.py`
**When to use:** When adding a new data section to the report
**Example (from existing `property.py`, Phase 4 extension):**
```python
# Source: backend/app/schemas/property.py (lines 219-225)
# Phase 4 additions
ai_parsing: AIParsingSection | None = Field(
    default=None,
    description="AI-parsed bestemmingsplan data (complete, in-progress, or not available)",
)
```

The pattern is clear: import the new schema at top of `property.py`, add a `schema_type | None = Field(default=None, ...)` at the bottom of `PropertyReportResponse`.

### Pattern 3: CACHE_TTL Dictionary Extension

**What:** Add new source keys to the `CACHE_TTL` dict at top of `config.py`
**Example (existing pattern):**
```python
# Source: backend/app/core/config.py (lines 7-14)
CACHE_TTL = {
    "ai_parsed": 7776000,   # 90 days
    "bag": 86400,           # 24 hours
    "bestemmingsplan": 7776000,
    "dso": 7776000,
    "kadaster": 604800,     # 7 days
    "rce": 2592000,         # 30 days
}
```
New entries must be added here. The `get_cached_or_fetch()` function does `CACHE_TTL[source]` at line 61 — a KeyError if source is absent.

**New entries needed:**
```python
"ep_online": 2592000,    # 30 days (energielabels change infrequently)
"woz": 31536000,         # 365 days (WOZ values set once per year)
"rce_detail": 2592000,   # 30 days (monument descriptions are stable)
# NOTE: "brk" is NOT added — BRK data is never cached (Kadaster Tier 3 terms)
```

### Pattern 4: Rate Limiter Module Extension

**What:** Add new `APIRateLimiter` singleton instances at the bottom of `rate_limiter.py`
**Example (existing pattern):**
```python
# Source: backend/app/government_apis/rate_limiter.py (lines 84-93)
# BRK (Kadaster) is a paid API, use conservative limits
brk_limiter = APIRateLimiter(max_concurrent=2, max_per_hour=200)
```
New limiters are module-level singletons imported by API client modules. The `APIRateLimiter` class is already implemented with semaphore + token bucket — just instantiate it with appropriate limits.

**New limiters needed:**
```python
# EP-Online — requires API key, has documented rate limits
ep_online_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)

# RCE Linked Data — public API, conservative limits
rce_detail_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=300)
```

### Pattern 5: Settings Field Addition

**What:** Add new `str = Field(default="", ...)` entries to the `Settings` class
**Example (existing pattern):**
```python
# Source: backend/app/core/config.py (lines 105-109)
BAG_API_KEY: str = Field(
    default="",
    description="BAG API key for Kadaster Individuele Bevragingen ...",
)
```
New API key settings follow identical pattern. Empty string default means the feature degrades gracefully when unconfigured.

### Anti-Patterns to Avoid

- **Non-None defaults on external API fields:** If EP-Online returns a field with a different name, a non-None default will silently mask the error. Use `| None = Field(default=None, ...)` for everything from external APIs.
- **Mandatory field in PropertyReportResponse:** The 3 new sections must be `| None = Field(default=None)` — existing saved reports do not have these fields, so Pydantic must tolerate absence.
- **Adding BRK to CACHE_TTL:** The BRK Bevragen data is never cached per Kadaster Tier 3 terms. Do not add a "brk" key to CACHE_TTL.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom token bucket | `aiolimiter.AsyncLimiter` + `APIRateLimiter` wrapper | Already implemented and tested |
| Config loading | Custom env parser | `pydantic_settings.BaseSettings` | Already used throughout |
| Schema validation | Custom validators | `pydantic.Field` with constraints | Consistent project pattern |

---

## Common Pitfalls

### Pitfall 1: Completeness Score Denominator — Existing Reports

**What goes wrong:** The completeness score is calculated in `property_aggregator.py` at lines 395-409. The current denominator is `total_sections = 6`. If we change it to 9 immediately, existing saved reports (stored as JSONB with old `completeness_score` values) will appear lower when re-displayed from cache, but this is OK because the score recalculates fresh on each aggregation.

**Why it happens:** The `completeness_score` is stored as a float in the JSONB `report_data` column. When a saved report is loaded and `PropertyReportResponse.model_validate()` is called on the stored dict, it reads the stored completeness_score value — it does NOT recalculate. So saved reports keep their old score.

**How to avoid:** INF-05 says "graceful handling of existing reports." The correct approach: the denominator change in `property_aggregator.py` only affects new aggregations. For existing reports displayed from DB, the stored float is shown as-is. No migration needed. Add a code comment documenting the version change.

**Warning signs:** If a test checks that `completeness_score == 1.0` for a fully-populated mock report using old denominator logic, it will fail after the change.

### Pitfall 2: PropertyReportResponse Schema Backward Compatibility

**What goes wrong:** `ReportSaveRequest.validate_report_data()` in `report.py` calls `PropertyReportResponse.model_validate(v)` on stored JSONB data. If the NEW required sections aren't in the stored dict, this will raise if the fields aren't `Optional`.

**Why it happens:** The Pydantic validator at line 55-57 of `report.py` tries to validate the stored dict against the current schema. Adding `| None = Field(default=None)` for all new sections means the validator will succeed even for old reports.

**How to avoid:** All three new fields (`energy_label`, `woz_data`, `brk_ownership`) MUST have `default=None`. This is the established pattern (see `ai_parsing`, `zoning`, `monuments` which all have `default=None`).

### Pitfall 3: Import Cycles

**What goes wrong:** `property.py` imports from `schemas/energy_label.py`, `schemas/woz.py`, `schemas/brk_ownership.py`. If those new files accidentally import from `property.py`, a circular import occurs.

**Why it happens:** Python circular imports manifest as `ImportError` or partial import.

**How to avoid:** New schema files import only from `pydantic` — no imports from other `app.schemas` modules. Keep them leaf nodes in the import graph.

### Pitfall 4: EP-Online Field Name Uncertainty

**What goes wrong:** The EP-Online V5 API field names cannot be verified without an API key. Community docs and the `overheid.io` energielabel API (which wraps EP-Online) show fields like `energieKlasse`, `registratieDatum`, `geldigTot`. The official EP-Online Swagger is behind authentication.

**Why it happens:** EP-Online V5 went live November 2024, migrating from V4 (July 2024). The exact field name casing (`energieKlasse` vs `energieklasse` vs `EnergieklasseLabel`) may differ from community sources.

**How to avoid:** Design the `EnergyLabel` Pydantic schema with `| None` on every field. Phase 53 will validate against a live API call and may need to rename fields. Schema design in Phase 52 is intentionally provisional for EP-Online and WOZ.

---

## Code Examples

### EnergyLabel Schema (based on EP-Online V5 + overheid.io docs)

```python
# backend/app/schemas/energy_label.py
"""Energy label schema from EP-Online V5 API."""
from __future__ import annotations
from pydantic import BaseModel, Field


class EnergyLabel(BaseModel):
    """Registered energy label from EP-Online V5.

    Fields based on EP-Online V5 API response (public.ep-online.nl/swagger).
    All fields are Optional — EP-Online may return 404 for unregistered VBOs.
    """

    # Core label data
    energieklasse: str | None = Field(
        default=None,
        description="Energy class (A++++, A+++, A++, A+, A, B, C, D, E, F, G)",
    )
    registratie_datum: str | None = Field(
        default=None,
        description="ISO 8601 registration date",
    )
    geldig_tot: str | None = Field(
        default=None,
        description="ISO 8601 expiry date (registration + 10 years)",
    )
    is_geldig: bool | None = Field(
        default=None,
        description="True if label is currently valid (geldigTot > today)",
    )

    # Technical detail
    berekenings_type: str | None = Field(
        default=None,
        description="Calculation methodology (e.g., 'NTA 8800', 'Bouwbesluit 2012')",
    )
    soort_opname: str | None = Field(
        default=None,
        description="Survey type (e.g., 'Basisopname', 'Gedetailleerde opname')",
    )
    opname_datum: str | None = Field(
        default=None,
        description="Date of energy survey",
    )

    # Identifiers
    bag_vbo_id: str | None = Field(
        default=None,
        description="BAG verblijfsobject ID used for lookup",
    )

    # Data quality
    is_geregistreerd: bool = Field(
        default=False,
        description="False when property has no registered label (normal for ~20-30% of properties)",
    )
    niet_geregistreerd_reden: str | None = Field(
        default=None,
        description="Dutch explanation when label is absent (e.g., 'Niet geregistreerd')",
    )
```

### WOZData Schema (based on WOZ Bevragen / waardeloket patterns)

```python
# backend/app/schemas/woz.py
"""WOZ (waardering onroerende zaken) schema."""
from __future__ import annotations
from pydantic import BaseModel, Field


class WOZWaarde(BaseModel):
    """Single WOZ assessment value for one peildatum."""

    vastgestelde_waarde: int | None = Field(
        default=None,
        description="Assessed value in euros (integer — WOZ values are whole euros)",
    )
    peildatum: str | None = Field(
        default=None,
        description="Valuation reference date (ISO 8601, e.g., '2024-01-01')",
    )
    toestandspeildatum: str | None = Field(
        default=None,
        description="Condition reference date for this valuation",
    )


class WOZData(BaseModel):
    """WOZ object data from waardeloket or WOZ Bevragen API."""

    woz_objectnummer: str | None = Field(
        default=None,
        description="WOZ object registration number",
    )
    # Most recent valuation (for display)
    meest_recente_waarde: int | None = Field(
        default=None,
        description="Most recent vastgesteldeWaarde in euros",
    )
    meest_recente_peildatum: str | None = Field(
        default=None,
        description="Peildatum for the most recent value",
    )
    # Historical values (optional)
    waarden: list[WOZWaarde] = Field(
        default_factory=list,
        description="All known WOZ values by peildatum",
    )
    grondoppervlakte: int | None = Field(
        default=None,
        description="Ground surface area in m² from WOZ registration",
    )

    # Data quality
    low_confidence: bool = Field(
        default=False,
        description="True when data comes from unofficial waardeloket scrape (not Kadaster API)",
    )
    low_confidence_reden: str | None = Field(
        default=None,
        description="Dutch explanation of confidence limitation (shown in UI per WOZ-04)",
    )
    bron: str = Field(
        default="WOZ Waardeloket",
        description="Data source attribution",
    )
```

### BRKOwnership Schema (based on BRK Bevragen V2 OpenAPI spec)

```python
# backend/app/schemas/brk_ownership.py
"""BRK Bevragen V2 ownership schema.

CRITICAL: BRK eigendomsdata MUST NEVER be cached or stored (Kadaster Tier 3).
This schema is used for live display only — stripped from report before DB save.
"""
from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field


class ZakelijkGerechtigde(BaseModel):
    """A single rights holder on the cadastral object."""

    # Per BRK-02: show eigenaar type, never show personal names
    eigenaar_type: Literal[
        "natuurlijk_persoon", "rechtspersoon", "overheid", "onbekend"
    ] = Field(
        default="onbekend",
        description="Owner type — personal names/addresses are NEVER returned (AVG)",
    )
    zakelijk_recht_type: str | None = Field(
        default=None,
        description="Right type (e.g., 'Eigendom', 'Opstal', 'Erfpacht', 'Vruchtgebruik')",
    )
    aandeel: str | None = Field(
        default=None,
        description="Ownership share (e.g., '1/2' for half-ownership)",
    )


class BRKOwnership(BaseModel):
    """Ownership and rights data from BRK Bevragen V2.

    CRITICAL: Never cache or store this data.
    Strip from PropertyReportResponse before JSONB save.
    """

    gerechtigden: list[ZakelijkGerechtigde] = Field(
        default_factory=list,
        description="List of rights holders",
    )
    heeft_hypotheek: bool = Field(
        default=False,
        description="True if a mortgage (hypotheek) is registered on this object",
    )
    aantal_eigenaren: int | None = Field(
        default=None,
        description="Total number of rights holders",
    )
    actueel_opgevraagd: str | None = Field(
        default=None,
        description="ISO 8601 timestamp when data was fetched (shown in UI per BRK-06)",
    )

    # Data availability
    is_beschikbaar: bool = Field(
        default=False,
        description="False when BRK is unconfigured (PKIOverheid cert pending)",
    )
    niet_beschikbaar_reden: str | None = Field(
        default=None,
        description="Dutch explanation when BRK is unavailable",
    )
```

### PropertyReportResponse Extension

```python
# backend/app/schemas/property.py (additions to PropertyReportResponse)
from app.schemas.energy_label import EnergyLabel
from app.schemas.woz import WOZData
from app.schemas.brk_ownership import BRKOwnership

class PropertyReportResponse(BaseModel):
    # ... existing fields ...

    # Phase 7 additions (v7.0)
    energy_label: EnergyLabel | None = Field(
        default=None,
        description="Registered energy label from EP-Online V5",
    )
    woz_data: WOZData | None = Field(
        default=None,
        description="WOZ assessed value from waardeloket",
    )
    brk_ownership: BRKOwnership | None = Field(
        default=None,
        description="Property ownership from BRK Bevragen V2 (never stored — live only)",
    )
```

### Config Extension

```python
# backend/app/core/config.py additions

# In CACHE_TTL dict:
CACHE_TTL = {
    # ... existing keys ...
    "ep_online": 2592000,    # 30 days
    "woz": 31536000,         # 365 days
    "rce_detail": 2592000,   # 30 days
    # NOTE: "brk" intentionally absent — never cache BRK data
}

# In Settings class:
EP_ONLINE_API_KEY: str = Field(
    default="",
    description="EP-Online API key (register at public.ep-online.nl)",
)
```

### Rate Limiter Extension

```python
# backend/app/government_apis/rate_limiter.py additions

# EP-Online (RVO) — key-gated API, conservative limits
ep_online_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)

# RCE Linked Data detail — public API, generous but polite limits
rce_detail_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=300)
```

### Completeness Score Update

```python
# backend/app/services/property_aggregator.py
# Lines 395-409 (current):
#   sections_available = 1  # address
#   total_sections = 6
#   completeness_score = sections_available / total_sections

# After Phase 52:
sections_available = 1  # Address always available
if building:
    sections_available += 1
if cadastral_parcels:
    sections_available += 1
if zoning_data:
    sections_available += 1
if monument_status:
    sections_available += 1
if ai_parsing_section and ai_parsing_section.status == "complete":
    sections_available += 1
# New sections (Phase 7):
if energy_label_data and energy_label_data.is_geregistreerd:
    sections_available += 1
if woz_data:
    sections_available += 1
if brk_ownership and brk_ownership.is_beschikbaar:
    sections_available += 1

total_sections = 9  # Changed from 6
completeness_score = sections_available / total_sections
```

**IMPORTANT:** The energy_label, woz_data, and brk_ownership variables don't exist yet in Phase 52 (the aggregator is not wired until Phase 55). In Phase 52, we only update the comment/denominator constant. The variable increments are added in Phase 55.

The Phase 52 task is to change `total_sections = 6` to `total_sections = 9` and add comments for the 3 new sections. This prepares the math for Phase 55 without breaking current behavior (since the 3 new section variables don't yet exist in the if-blocks, the numerator stays the same for now — wait, this would give wrong results). **Correction:** Do NOT change the denominator in Phase 52 — wait for Phase 55 when the new sections are actually wired. INF-05 says "updated" which implies it happens alongside the aggregator wiring. The Phase 52 task is purely schema/config.

---

## External API Field Name Confidence

### EP-Online V5 Fields (MEDIUM confidence)

Source: overheid.io/documentatie/v3/energielabels + EP-Online release notes

| Provisional Field Name | Likely Source Field | Confidence |
|------------------------|--------------------|-----------:|
| `energieklasse` | `energieKlasse` | MEDIUM |
| `registratie_datum` | `registratieDatum` | MEDIUM |
| `geldig_tot` | `geldigTot` | MEDIUM |
| `berekenings_type` | `berekeningType` | MEDIUM |
| `soort_opname` | `soortOpname` | MEDIUM |
| `opname_datum` | `opnameDatum` | MEDIUM |

Note: EP-Online uses camelCase in JSON. Pydantic `alias` or `alias_generator` can map between camelCase and snake_case. The Phase 53 client will handle the mapping.

### WOZ Fields (MEDIUM confidence)

Source: VNG-Realisatie IMWOZ-bevragingen OpenAPI spec + community examples

| Provisional Field Name | Likely Source Field | Confidence |
|------------------------|--------------------|-----------:|
| `woz_objectnummer` | `wozObjectnummer` | MEDIUM |
| `vastgestelde_waarde` | `vastgesteldeWaarde` | MEDIUM |
| `peildatum` | `peildatum` | HIGH |
| `grondoppervlakte` | `grondoppervlakte` | HIGH |

### BRK Bevragen V2 Fields (MEDIUM confidence)

Source: Official BRK Bevragen GitHub (kadaster/BRK-bevragen) + VNG Haal Centraal spec

| Provisional Field Name | Likely API Concept | Confidence |
|------------------------|-------------------|-----------:|
| `zakelijk_recht_type` | ZakelijkGerechtigde.type | MEDIUM |
| `heeft_hypotheek` | derived from Hypotheek presence | MEDIUM |
| `eigenaar_type` | derived from NatuurlijkPersoon/NietNatuurlijkPersoon | HIGH |

### RCE Linked Data Detail Fields (LOW confidence)

Source: api.rijksmonumenten.info Solr API + RCE REST API documentation (incomplete)

The PDOK OGC API (currently used) returns only: `rce_objrijksnr`, `rce_objnaam`, `abc_beschrijving`, `register_url`, `legalfoundationdate`

For **redengevende omschrijving**, **bouwperiode**, and **functie**, Phase 53 must call the RCE Linked Data REST API endpoint:
`https://api.linkeddata.cultureelerfgoed.nl/queries/rce/rest-api-rijksmonumenten/run?rijksmonumentnummer={nr}`

Documented response fields (LOW confidence — RDF/JSON-LD format, field names unverified):
- `rijksmonumentnummer`
- `oorspronkelijkeFunctie`
- `monumentaard`
- `status`
- Address fields (gemeentenaam, postcode, etc.)

Fields NOT confirmed in the REST API:
- `redengevendeOmschrijving` — may be separate endpoint or RDF property
- `bouwperiode` / `bouwjaarVan` / `bouwjaarTot` — api.rijksmonumenten.info Solr has `rce_bouwjaar_van`, `rce_bouwjaar_tot`
- `architect`, `bouwstijl` — Solr API has these; RCE Linked Data API status unknown

**Recommendation for Phase 52 RCE detail schema:**
```python
class RCEMonumentDetail(BaseModel):
    """RCE Linked Data monument detail (Phase 53 will validate field names)."""
    rijksmonumentnummer: str | None = Field(default=None)
    redengevende_omschrijving: str | None = Field(
        default=None,
        description="Detailed architectural/historical description (can be 1,000-5,000 words)",
    )
    oorspronkelijke_functie: str | None = Field(default=None, description="Original function")
    bouwjaar_van: int | None = Field(default=None, description="Construction period start year")
    bouwjaar_tot: int | None = Field(default=None, description="Construction period end year")
    architect: str | None = Field(default=None)
    bouwstijl: str | None = Field(default=None)
    monument_register_url: str | None = Field(default=None, description="URL to official register")
```

This schema is added to `monument.py` (alongside existing `MonumentStatus`), or a new `monument_detail.py` file. The `MonumentStatus.sources[].monument_nummer` is the key used to fetch RCE detail in Phase 53.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PropertyReportResponse had 6 data sections | Will have 9 (EnergyLabel, WOZ, BRK added) | Phase 52-55 | completeness_score denominator 6 → 9 |
| RCE monument = spatial detection only | RCE monument = spatial + linked data detail | Phase 53 | richer monument data |
| BRK client existed but unconnected | BRK wired into aggregator (Phase 54) | Phase 54 | live ownership data |

---

## Open Questions

1. **Where does RCE redengevende omschrijving live?**
   - What we know: PDOK OGC API (current) has `siteprotectionclassification` only. api.rijksmonumenten.info Solr returned 403 in early 2026. The RCE Linked Data REST API is the path forward.
   - What's unclear: Whether `redengevendeOmschrijving` is a direct field in the REST API response or requires a separate SPARQL/Linked Data query.
   - Recommendation: In Phase 52, design the schema to hold a `str | None`. Phase 53 researcher validates the exact endpoint and field.

2. **WOZ waardeloket vs WOZ Bevragen API**
   - What we know: WOZ Bevragen (Kadaster) is municipality-only — SaaS clients will be rejected. WOZ Waardeloket is a public website (wozwaardeloket.nl) with an undocumented scraping endpoint used by the community.
   - What's unclear: The exact HTTP endpoint and whether it accepts BAG VBO ID or requires wozObjectnummer.
   - Recommendation: Phase 52 schema marks `low_confidence: bool = True` as the default for WOZ data; Phase 53 validates the endpoint.

3. **EP-Online API key requirement**
   - What we know: EP-Online V5 requires registration at ep-online.nl and an API key sent as `Authorization: Bearer <key>` header.
   - What's unclear: Rate limits (not publicly documented), whether non-EP-registered properties return 404 or an empty response.
   - Recommendation: Phase 52 adds `EP_ONLINE_API_KEY` with `default=""`. Phase 53 designs the client to return `EnergyLabel(is_geregistreerd=False)` on 404.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — `backend/app/schemas/property.py`, `monument.py`, `zoning.py`, `address.py`, `ai/schemas.py`
- Direct codebase inspection — `backend/app/core/config.py` (CACHE_TTL dict, Settings class)
- Direct codebase inspection — `backend/app/government_apis/rate_limiter.py` (APIRateLimiter pattern)
- Direct codebase inspection — `backend/app/services/property_aggregator.py` (completeness_score at lines 395-409)
- Direct codebase inspection — `backend/app/services/monument_aggregator.py` (MonumentSourceResult fields)
- Direct codebase inspection — `backend/app/government_apis/brk_bevragen.py` (BRK client pattern)

### Secondary (MEDIUM confidence)

- [EP-Online V5 API announcement](https://www.ep-online.nl/Home/ReleaseNotes) — V5 live since November 2024, V4 deprecated July 2025
- [overheid.io energielabels documentation](https://overheid.io/documentatie/v3/energielabels) — field names including `energieKlasse`, `registratieDatum`, `geldigTot`
- [VNG IMWOZ-bevragingen OpenAPI spec](https://github.com/VNG-Realisatie/IMWOZ-bevragingen/blob/main/specificatie/WOZ/openapi.yaml) — WOZ object fields
- [BRK Bevragen getting-started](https://github.com/kadaster/BRK-bevragen/blob/master/docs/getting-started.md) — ZakelijkGerechtigde, Hypotheek resource types
- [RCE REST API documentation](https://linkeddata.cultureelerfgoed.nl/rce/-/stories/Restfull-API) — REST endpoint URL and parameters

### Tertiary (LOW confidence)

- [api.rijksmonumenten.info](https://api.rijksmonumenten.info/) — Solr-based API (returned 403 in 2026); field names `rce_bouwjaar_van`, `rce_bouwjaar_tot` may apply to Linked Data API
- Community Python wrapper patterns for EP-Online field names

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, patterns verified in codebase
- Architecture patterns: HIGH — follows verified existing patterns exactly
- External API field names (EP-Online, WOZ): MEDIUM — documented but not live-validated
- RCE Linked Data detail fields: LOW — REST API returns sparse data, full field set unclear
- Pitfalls: HIGH — backward compat issues verified from direct code reading

**Research date:** 2026-02-24
**Valid until:** 2026-03-10 (stable APIs; RCE field names may need revision after Phase 53 live validation)
