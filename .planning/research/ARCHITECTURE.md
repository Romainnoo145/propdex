# Architecture Patterns

**Domain:** Juridisch Klimaat Intelligence for Propdex
**Researched:** 2026-03-07
**Confidence:** HIGH (based on full codebase analysis of existing jurisprudence stack)

---

## Current State Assessment

The existing jurisprudence stack has three layers that all need modification:

1. **API Client** (`backend/app/government_apis/rechtspraak.py`) -- Searches Rechtspraak.nl via Atom/XML feed. Returns search results and full documents. No ECLI-prefix filtering, no court-region scoping, no gemeente-level targeting. Rate limited at 3 concurrent / 300 per hour.

2. **Backend API + Job** (`backend/app/api/endpoints/jurisprudence.py` + `backend/app/jobs/jurisprudence_analysis.py`) -- Endpoint proxies search to client. Analysis endpoint enqueues ARQ job which fetches documents sequentially from Rechtspraak API, sends to Claude, caches result in `CachedAPIResponse`. Job model: `JuridischAnalyseJob` with status tracking.

3. **Frontend** (`JurisprudenceSection.tsx` + `useJurisprudence.ts`) -- Search input with 500ms debounce, ruling list with collapsible AI summary badges, split-pane document viewer. Hardcoded `omgevingsvergunning ${gemeenteNaam}` default query. `useTriggerAnalysis` mutation + `useJurisprudenceAnalysis` polling (3s interval).

**Core problem:** The current system does a text search for "omgevingsvergunning [gemeente]" and returns whatever Rechtspraak gives back. There is no court-region filtering (ECLI prefix), no document caching for re-analysis, no geo-extraction from ruling text, no doorlooptijd calculation, and no bekendmakingen cross-referencing.

---

## Recommended Architecture

### Component Map (New vs Modified)

```
MODIFY  backend/app/government_apis/rechtspraak.py
          + ECLI prefix filtering (court-region search)
          + Extended metadata extraction from XML (procedure dates)
          + Batch document fetch with concurrency control

NEW     backend/app/government_apis/ecli_registry.py
          + Court code -> region/gemeente mapping table
          + ECLI prefix lookup for gemeente-scoped queries

NEW     backend/app/services/geo_contextualizer.py
          + Regex extraction of postcodes + gemeente names from ruling text
          + PDOK geocoding fallback for ambiguous addresses
          + Confidence scoring for location matches

NEW     backend/app/services/doorlooptijd.py
          + Calculate procedure duration from ruling metadata
          + Aggregate stats per gemeente per vergunningstype

NEW     backend/app/services/ruling_bekendmaking_linker.py
          + Cross-reference rulings with SRU ChangeRecords
          + Match by address, postcode, date range

NEW     backend/app/models/ruling_cache.py
          + Persistent ruling document storage (full text + metadata)
          + Organization-agnostic (public data, ECLI is globally unique)

MODIFY  backend/app/api/endpoints/jurisprudence.py
          + New endpoints: /feed, /explore, /stats
          + Pagination support (offset/limit)
          + Multi-filter query params (type, uitkomst, period)

MODIFY  backend/app/jobs/jurisprudence_analysis.py
          + Read from RulingCache instead of fetching per-job
          + Enhanced prompt with geo context + doorlooptijd

NEW     backend/app/jobs/ruling_ingestion.py
          + Background job: batch fetch + cache rulings for a court region
          + Trigger on first gemeente detail open

NEW     frontend/src/hooks/useJurisprudenceExplorer.ts
          + Multi-filter state management
          + Pagination with useInfiniteQuery

MODIFY  frontend/src/components/projects/JurisprudenceSection.tsx
          + Decompose into feed + explorer tabs
          + Extract JurisprudenceViewer into own file

NEW     frontend/src/components/projects/JurisprudenceExplorer.tsx
          + Filter sidebar (scope, type, uitkomst, period)
          + Results grid with sorting + pagination

NEW     frontend/src/components/projects/JurisprudenceFeed.tsx
          + Chronological gemeente-matched ruling feed
          + Location confidence badges
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `RechtspraakClient` (modified) | HTTP calls to data.rechtspraak.nl, XML parsing, ECLI validation | `ecli_registry`, `rate_limiter` |
| `EcliRegistry` (new) | Maps court codes to regions/gemeenten, provides ECLI prefix lookups | `RechtspraakClient` |
| `RulingCache` model (new) | Persists full ruling text + extracted metadata in PostgreSQL | `RechtspraakClient`, `GeoContextualizer`, `DoorlooptijdService` |
| `GeoContextualizer` (new) | Extracts gemeente/location from ruling body text via regex + PDOK | `RulingCache`, `PDOKLocatieserver` |
| `DoorlooptijdService` (new) | Computes procedure duration from ruling metadata dates | `RulingCache` |
| `RulingBekendmakingLinker` (new) | Cross-references rulings with SRU ChangeRecords by postcode | `RulingCache`, `ChangeRecord` |
| `JurisprudenceEndpoints` (modified) | REST API for feed, explorer, stats, documents | All backend services |
| `JurisprudenceExplorer` (new FE) | Multi-filter explorer UI with pagination | API endpoints |
| `JurisprudenceFeed` (new FE) | Chronological gemeente feed with geo-matched rulings | API endpoints |

---

## Data Flow

### Gemeente Feed Flow (Primary Use Case)

```
User opens gemeente detail
  -> Frontend calls GET /api/jurisprudence/feed?gemeente=Venlo&page=1
  -> Backend:
       1. Look up ECLI court prefix(es) for Venlo via EcliRegistry
          (e.g., Venlo -> RBLIM = Rechtbank Limburg, + RVS always included)
       2. Query RulingCache for cached rulings matching these prefixes
          - If cache cold: enqueue ruling_ingestion_job, return partial results
          - If cache warm: query directly
       3. Filter to rulings with extracted_gemeente matching Venlo
          (or high-confidence geo_match)
       4. Return paginated, chronological feed with metadata
  -> Frontend renders JurisprudenceFeed with AI badges
```

### Explorer Flow

```
User opens Explorer tab, sets filters
  -> Frontend calls GET /api/jurisprudence/explore?gemeente=Venlo
       &type=bouw&uitkomst=afgewezen&period=2024&page=1
  -> Backend:
       1. Query RulingCache with combined SQL filters
       2. Join with geo_context for location matching
       3. Include doorlooptijd stats per result
       4. Return paginated results with facet counts
  -> Frontend renders JurisprudenceExplorer with filter sidebar
```

### Ruling Ingestion Flow (Background)

```
ruling_ingestion_job(gemeente_naam="Venlo")
  -> EcliRegistry: get court codes [RBLIM, RVS]
  -> For each court code:
       Search Rechtspraak API (subject=omgevingsrecht, max=50)
       For each result not in RulingCache:
         Fetch full document
         Store in RulingCache (text + metadata)
         Run GeoContextualizer (extract postcodes, gemeente names)
         Run DoorlooptijdService (compute procedure duration)
  -> Mark ingestion complete for this gemeente
```

### Bekendmakingen Cross-Reference Flow

```
RulingBekendmakingLinker (on-demand or post-ingestion)
  -> For each ruling in RulingCache with extracted postcodes:
       Query ChangeRecord table for matching postcodes
       If match found: store link in ruling_cache.linked_change_ids
  -> Frontend shows "Bekijk bekendmaking" link on matched rulings
  -> Click -> navigate to existing bekendmaking/map view
```

---

## Patterns to Follow

### Pattern 1: RulingCache as Central Store (Organization-Agnostic)

**What:** Store fetched ruling documents permanently instead of re-fetching per analysis job. This is the critical architectural change.

**When:** Every time a ruling is fetched from Rechtspraak API, cache it. Analysis jobs, feeds, and explorer all read from cache.

**Why:** Current system fetches the same documents repeatedly (once per analysis trigger). Caching enables geo-extraction, doorlooptijd calculation, and cross-referencing without additional API calls.

**Critical design decision:** `RulingCache` has NO `organization_id`. ECLI identifiers are globally unique public data. All organizations share the same ruling cache. Only AI analysis results remain tenant-scoped (via existing `CachedAPIResponse` + `JuridischAnalyseJob`).

```python
class RulingCache(Base, TimestampMixin):
    """Cached court ruling -- org-agnostic, ECLI is globally unique."""
    __tablename__ = "ruling_cache"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    ecli: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    instantie: Mapped[str | None] = mapped_column(String(200))
    datum_uitspraak: Mapped[str | None] = mapped_column(String(20))
    full_text: Mapped[str | None] = mapped_column(Text)

    # Extracted by GeoContextualizer
    extracted_gemeente: Mapped[str | None] = mapped_column(String(200), index=True)
    extracted_postcodes: Mapped[dict | None] = mapped_column(JSONB)
    geo_confidence: Mapped[float | None] = mapped_column(Float)

    # Extracted by DoorlooptijdService
    procedure_type: Mapped[str | None] = mapped_column(String(100))
    doorlooptijd_days: Mapped[int | None] = mapped_column(Integer)
    uitkomst: Mapped[str | None] = mapped_column(String(50))

    # Cross-reference with bekendmakingen
    linked_change_ids: Mapped[dict | None] = mapped_column(JSONB)

    # Court code extracted from ECLI (e.g., "RBLIM", "RVS")
    court_code: Mapped[str | None] = mapped_column(String(20), index=True)
```

### Pattern 2: ECLI Court-Region Mapping

**What:** Static mapping of ECLI court codes to geographic regions for gemeente-scoped search.

**When:** Building the gemeente feed. Rechtspraak API has no gemeente filter, but ECLI codes encode the court (e.g., `ECLI:NL:RBLIM:2024:xxx` = Rechtbank Limburg).

**Why:** There are only 11 rechtbanken + 4 gerechtshoven + ABRvS. The mapping is stable (courts do not change jurisdiction often). This is far more reliable than text search.

```python
# ecli_registry.py -- Static mapping, Dutch courts are institutionally stable
RECHTBANK_GEMEENTE_MAP: dict[str, list[str]] = {
    "RBLIM": ["Venlo", "Maastricht", "Roermond", "Heerlen", "Sittard-Geleen", ...],
    "RBGEL": ["Arnhem", "Nijmegen", "Zutphen", "Apeldoorn", ...],
    "RBAMS": ["Amsterdam", "Haarlem", "Zaanstad", ...],
    "RBDHA": ["Den Haag", "Leiden", "Delft", "Gouda", ...],
    "RBMNE": ["Utrecht", "Amersfoort", "Lelystad", ...],
    "RBNHO": ["Alkmaar", "Hoorn", ...],
    "RBOBR": ["Eindhoven", "Tilburg", "Breda", "'s-Hertogenbosch", ...],
    "RBOVE": ["Zwolle", "Almelo", "Enschede", ...],
    "RBROT": ["Rotterdam", "Dordrecht", ...],
    "RBZWB": ["Middelburg", "Bergen op Zoom", "Breda", ...],
    "RBNNE": ["Groningen", "Leeuwarden", "Assen", ...],
}

# Always include these -- they handle appeals nationwide
NATIONAL_COURTS = ["RVS", "HR"]

def get_court_codes_for_gemeente(gemeente_naam: str) -> list[str]:
    """Return ECLI court codes whose jurisdiction covers this gemeente."""
    codes = [
        code for code, gemeenten in RECHTBANK_GEMEENTE_MAP.items()
        if gemeente_naam in gemeenten
    ]
    return codes + NATIONAL_COURTS
```

### Pattern 3: Two-Pass Geo-Contextualization

**What:** First pass uses cheap regex extraction (postcodes, gemeente names from ruling text). Second pass uses PDOK geocoding only when regex extraction is ambiguous. Never use an LLM for geo-extraction.

**Why:** Ruling texts frequently mention locations explicitly ("de gemeente Venlo", "perceel aan de Hoofdstraat 42 te Venlo", "postcode 5911"). Regex catches 70-80% of cases. LLM would be too slow and expensive for batch processing.

```python
import re

_POSTCODE_RE = re.compile(r'\b(\d{4}\s?[A-Z]{2})\b')
_GEMEENTE_RE = re.compile(
    r'(?:gemeente|burgemeester en wethouders van|college van|te)\s+'
    r'([A-Z][a-z]+(?:[\s-][A-Za-z]+)*)',
    re.IGNORECASE,
)

def extract_locations_from_text(text: str) -> dict:
    """Extract location references from ruling body text."""
    postcodes = list(set(_POSTCODE_RE.findall(text)))
    gemeenten = list(set(_GEMEENTE_RE.findall(text)))
    # Filter out common false positives
    gemeenten = [g for g in gemeenten if g not in LEGAL_TERM_EXCLUSIONS]
    confidence = 0.9 if gemeenten else (0.6 if postcodes else 0.1)
    return {
        "postcodes": postcodes,
        "gemeenten": gemeenten,
        "confidence": confidence,
    }
```

### Pattern 4: Reuse Existing Job Infrastructure

**What:** Keep using ARQ + `JuridischAnalyseJob` for AI analysis. Add a separate ARQ job for ruling ingestion.

**Why:** The existing pattern works well -- create job record, enqueue ARQ task, poll for completion. The `jurisprudence_analysis_job` is modified to read from `RulingCache` instead of fetching from API, making it faster and more reliable.

### Pattern 5: Frontend Tab Architecture

**What:** Use two tabs in the Juridisch Klimaat section: "Feed" (gemeente chronological) and "Explorer" (multi-filter search).

**Why:** Memory note from 2026-03-07 explicitly states this is the desired UX. Feed is the default view (passive consumption), Explorer is for active investigation.

```
JurisprudenceSection (container)
  |-- Tab: "Overzicht" (default) -> JurisprudenceFeed
  |     |-- JuridischKlimaatCard (existing, top)
  |     |-- Chronological ruling list (geo-matched to gemeente)
  |     |-- RulingAiSummaryBadge (existing, per ruling)
  |
  |-- Tab: "Explorer" -> JurisprudenceExplorer
        |-- Filter sidebar: scope, vergunningstype, uitkomst, tijdsperiode
        |-- Results grid with sorting + pagination
        |-- Document viewer (shared component)
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Re-fetching Documents Per Analysis

**What:** Current system fetches ruling texts from Rechtspraak API inside `jurisprudence_analysis_job`, every time analysis is triggered.

**Why bad:** Wastes API calls, hits rate limits (300/hour), adds latency (10-25 rulings x 1-2s each = 10-50s just for fetches). Same documents fetched repeatedly across sessions.

**Instead:** Store in `RulingCache` on first access. Analysis job reads from DB.

### Anti-Pattern 2: Text Search as Gemeente Filter

**What:** Current approach uses `omgevingsvergunning ${gemeenteNaam}` as search query, hoping Rechtspraak returns relevant results.

**Why bad:** Returns rulings that *mention* the gemeente name anywhere, not rulings *from* that gemeente. A ruling about Amsterdam policy might mention "unlike in Venlo" and appear in Venlo results. False positive rate is high.

**Instead:** Use ECLI court-code prefix filtering + geo-contextualization of ruling text for accurate gemeente matching.

### Anti-Pattern 3: Monolithic JurisprudenceSection

**What:** Current `JurisprudenceSection.tsx` (350 lines) handles search, results list, document viewer, and AI analysis in one component.

**Why bad:** Adding feed view + explorer view + stats + bekendmakingen links would push this past 800+ lines. Violates the 300-line file limit.

**Instead:** Split into:
- `JurisprudenceFeed.tsx` -- Chronological gemeente feed
- `JurisprudenceExplorer.tsx` -- Multi-filter explorer with grid
- `JurisprudenceViewer.tsx` -- Document viewer (already a sub-component, extract)
- `JuridischKlimaatCard.tsx` -- Already extracted, keep as-is

### Anti-Pattern 4: Organization-Scoped Public Data

**What:** Making `RulingCache` multi-tenant with `organization_id`.

**Why bad:** Court rulings are public data. Every organization would cache the same ECLI documents, wasting storage and causing redundant API calls.

**Instead:** `RulingCache` is org-agnostic (no `organization_id`). Only AI analysis results remain tenant-scoped (via existing `CachedAPIResponse`).

### Anti-Pattern 5: LLM for Geo-Extraction

**What:** Sending ruling text to Claude to extract location information.

**Why bad:** Too slow for batch processing (50+ rulings per gemeente), expensive, and unreliable for structured extraction. Postcodes and gemeente names are machine-readable.

**Instead:** Regex extraction (fast, deterministic) + PDOK geocoding fallback (authoritative).

---

## Scalability Considerations

| Concern | At 1 gemeente | At 50 gemeenten | At 352 gemeenten |
|---------|--------------|-----------------|------------------|
| RulingCache size | ~200 rulings, ~2MB text | ~5,000 rulings, ~50MB | ~20,000 rulings, ~200MB |
| API calls on first load | 50-100 (search + doc fetches) | Amortized (court regions overlap) | Ceiling ~5,000 unique (11 courts covered) |
| Geo-extraction | Inline, < 1s per ruling | Background job per gemeente | Batch ARQ job, total minutes |
| AI analysis | Per-request, cached per org | Cached, invalidated monthly | Cached, no scaling concern |
| Bekendmakingen cross-ref | Scan ChangeRecord by postcode | Indexed query, fast | Index on postcode handles it |

Key insight: Dutch courts are finite (11 rechtbanken). After approximately 100 gemeenten, most court regions are fully cached. The system converges to a steady state where new gemeente lookups are predominantly cache hits.

---

## Integration Points Summary

| Integration | Type | Existing Component | Change |
|-------------|------|-------------------|--------|
| Rechtspraak API | MODIFY | `rechtspraak.py` | Add court-code filtered search, batch document fetch |
| Rate limiter | NONE | `rate_limiter.py` | Existing `rechtspraak_limiter` (3 concurrent, 300/hr) sufficient |
| XML parser | NONE | `_parser` in `rechtspraak.py` | Reuse existing XXE-safe lxml parser |
| ARQ worker | MODIFY | `worker.py` | Register new `ruling_ingestion_job` function |
| CachedAPIResponse | NONE | Model exists | AI results still cached here (tenant-scoped) |
| JuridischAnalyseJob | MODIFY | Model + job exist | Read from RulingCache instead of fetching from API |
| SRU Bekendmakingen | READ | `sru_bekendmakingen.py` | Cross-reference via ChangeRecord, no client modification |
| ChangeRecord | READ | Model exists | Link rulings to changes by postcode match |
| PDOK Locatieserver | READ | `pdok_locatieserver.py` | Geocode extracted addresses (fallback only) |
| Frontend API bindings | MODIFY | `api.ts` | Add feed/explore/stats endpoint functions |
| TanStack Query hooks | ADD + MODIFY | `useJurisprudence.ts` | New explorer hook, modify existing search hook |
| JurisprudenceSection | DECOMPOSE | `JurisprudenceSection.tsx` | Split into Feed + Explorer + Viewer components |
| JuridischKlimaatCard | NONE | Component exists | No changes needed, already self-contained |

---

## Suggested Build Order

Based on dependency analysis:

1. **RulingCache model + Alembic migration** -- Everything depends on persistent storage. No organization_id.
2. **ECLI Registry + RechtspraakClient court-code search** -- Enables gemeente-scoped queries. Modify `search_jurisprudence()` to accept optional `court_code` param.
3. **Ruling ingestion job** -- Background job that populates RulingCache for a gemeente's court regions. Uses existing ARQ pattern.
4. **GeoContextualizer service** -- Extracts locations from cached ruling text. Runs post-ingestion.
5. **DoorlooptijdService** -- Computes procedure duration from cached metadata. Can parallelize with step 4.
6. **Backend feed + explore endpoints** -- Expose cached/enriched data via REST. Depends on steps 1-4.
7. **RulingBekendmakingLinker** -- Cross-reference rulings with SRU data. Can run in background after step 4.
8. **Frontend decomposition** -- Split JurisprudenceSection into Feed + Explorer + Viewer. Depends on step 6 for new endpoints.
9. **AI analysis upgrade** -- Enhanced prompt using geo-context + doorlooptijd data. Depends on steps 4-5.
10. **Tests** -- Cover entire pipeline end-to-end. Depends on all above.

**Hard dependencies:** 1 -> 2 -> 3 -> 4 -> 6 -> 8
**Parallelizable:** 4 + 5 (both read from RulingCache), 7 (independent background task)
**Phase 9** depends on 4 + 5 but not on 8 (frontend-independent)

---

## Sources

- Existing codebase analysis: `rechtspraak.py`, `jurisprudence.py` endpoint, `jurisprudence_analysis.py` job, `JurisprudenceSection.tsx`, `useJurisprudence.ts` (HIGH confidence)
- ECLI format: `ECLI:CC:COURT:YEAR:LOCALID` per EU Council conclusions 2011/C 127/01 (HIGH confidence)
- Dutch court system: 11 rechtbanken, 4 gerechtshoven, ABRvS, CRvB, CBb, Hoge Raad (HIGH confidence -- stable institutional structure)
- Rechtspraak.nl Open Data API: Atom feed search with `subject` filter, content endpoint by ECLI (HIGH confidence -- verified in existing client code)
- Memory note (2026-03-07): "ECLI prefix filtering (e.g., RBLIM = Limburg) is the best option for court-region filtering" and "Two tabs desired: gemeente overview + explorer with filters" (HIGH confidence -- direct user requirement)

---

*Architecture research for: Propdex v13.0 Juridisch Klimaat Intelligence*
*Researched: 2026-03-07*
