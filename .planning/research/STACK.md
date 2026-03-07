# Technology Stack

**Project:** Propdex v13.0 Juridisch Klimaat Intelligence
**Researched:** 2026-03-07
**Confidence:** HIGH (Rechtspraak API verified via live calls + official PDF v1.15, ECLI structure verified via Waardelijst endpoints)

---

## Context: Subsequent Milestone

This covers ONLY new stack requirements for v13.0 Juridisch Klimaat Intelligence. Existing validated capabilities are NOT re-documented.

**Existing infrastructure reused without changes:**
- `httpx[http2]>=0.27.0` -- HTTP client for Rechtspraak API
- `lxml>=5.3.0` -- XML parsing (XXE-safe, already used in `rechtspraak.py`)
- `aiolimiter>=1.2.0` -- rate limiting via `APIRateLimiter`
- `anthropic>=0.40.0` -- Claude API for AI analysis
- `arq>=0.27.0` -- background jobs for AI analysis
- `government_apis/base.py` -- `GovernmentAPIError`, `retry_with_backoff`, `APITimeoutError`
- `government_apis/rate_limiter.py` -- `rechtspraak_limiter` (3 concurrent, 300/hour)
- `government_apis/rechtspraak.py` -- `RechtspraakClient` with search + document endpoints
- `government_apis/sru_bekendmakingen.py` -- `SRUBekendmakingenClient` for bekendmakingen linking
- PostgreSQL JSONB cache with source-specific TTLs

---

## Final Answer: Zero New Dependencies Required

All v13.0 features build on the existing stack. No new pip packages, no new npm packages. The Rechtspraak API is already integrated; this milestone extends it with deeper filtering, caching, and analysis.

| Feature | New pip package? | Uses instead |
|---------|-----------------|-------------|
| ECLI court filtering | None | Python string parsing + static court-to-region mapping dict |
| Date range search | None | Rechtspraak API `date` parameter (already supported, not yet used) |
| Court-specific search | None | Rechtspraak API `creator` parameter (identifier URI from Waardelijst) |
| XML metadata extraction | None | `lxml` (already installed) + namespace-aware XPath |
| Geo-contextualization | None | Python `re` module for location extraction from ruling text |
| Doorlooptijd analysis | None | `datetime` stdlib for date arithmetic on `dcterms:issued` + `dcterms:date` |
| Bekendmakingen linking | None | Existing `SRUBekendmakingenClient` + text matching |
| AI analysis upgrade | None | Existing `anthropic` client + `arq` worker pattern |
| Ruling cache | None | PostgreSQL JSONB (existing cache pattern) |

**`pyproject.toml` changes: none required.**
**`package.json` changes: none required.**

---

## Rechtspraak API: Complete Parameter Reference

Verified from official documentation (v1.15, 20-3-2019) and live API testing.

### Search Endpoint (ECLI-Index)

**URL:** `https://data.rechtspraak.nl/uitspraken/zoeken`
**Response format:** Atom XML feed

| Parameter | Name | Type | Cardinality | Values | Notes |
|-----------|------|------|-------------|--------|-------|
| `creator` | Instantie | URI string | 0+ | Identifier URI from Waardelijst/Instanties | Multiple values = OR. **CRITICAL: must use exact identifier URI, NOT abbreviation** |
| `type` | Type | string | 0-1 | `"Uitspraak"` or `"Conclusie"` | |
| `date` | Uitspraakdatum | date | 0-2 | `YYYY-MM-DD` | 1 value = exact date; 2 values = range [from, to] inclusive |
| `subject` | Rechtsgebied | URI | 0+ | Identifier URI from Waardelijst/Rechtsgebieden | Multiple = OR; different param types = AND |
| `modified` | Wijzigingsdatum | datetime | 0-2 | `YYYY-MM-DDTHH:MM:SS` | 1 = since that datetime; 2 = range |
| `return` | Return | string | 0-1 | `"DOC"` | Only return ECLIs with available documents |
| `replaces` | Vervangen | URI | 0+ | Old LJN number | Returns ECLI that replaced given LJN |
| `max` | Max | int | 0-1 | 1-1000 | Default 1000, also maximum |
| `from` | From | int | 0-1 | 0+ | Pagination offset (0-based) |
| `sort` | Sorteren | string | 0-1 | `"ASC"` or `"DESC"` | Default: ASC (oldest first by modified date) |
| `searchterms` | Zoektermen | string | 0-1 | Free text | Full-text search within ruling content |

**Parameter combination rules:**
- Multiple params of same type = OR operator
- Different param types = AND operator
- Example: `creator=RBLIM&creator=RBOBR` = (Limburg OR Oost-Brabant)
- Example: `creator=RBLIM&subject=omgevingsrecht` = (Limburg AND omgevingsrecht)

### Content Endpoint (Document)

**URL:** `https://data.rechtspraak.nl/uitspraken/content`

| Parameter | Name | Values |
|-----------|------|--------|
| `id` | Identifier | ECLI string (e.g., `ECLI:NL:RVS:2023:1234`) |
| `return` | Return | `"META"` (metadata only) or omit for full document |

### Waardelijst Endpoints (Reference Data)

| Endpoint | URL | Purpose |
|----------|-----|---------|
| Instanties | `https://data.rechtspraak.nl/Waardelijst/Instanties` | Court codes, names, types, date ranges |
| Rechtsgebieden | `https://data.rechtspraak.nl/Waardelijst/Rechtsgebieden` | Legal domain hierarchy with URIs |
| Proceduresoorten | `https://data.rechtspraak.nl/Waardelijst/Proceduresoorten` | Procedure type classification |

---

## ECLI Court Code System

### Current Active Rechtbanken (post-2013 Herziening Gerechtelijke Kaart)

Verified from `https://data.rechtspraak.nl/Waardelijst/Instanties`:

| Afkorting | Naam | Geographic Region | Gemeenten (examples) |
|-----------|------|-------------------|----------------------|
| `RBAMS` | Rechtbank Amsterdam | Amsterdam region | Amsterdam, Amstelveen, Haarlemmermeer |
| `RBDHA` | Rechtbank Den Haag | South Holland | Den Haag, Leiden, Delft, Gouda |
| `RBGEL` | Rechtbank Gelderland | Gelderland | Arnhem, Nijmegen, Apeldoorn |
| `RBLIM` | Rechtbank Limburg | Limburg | Maastricht, Venlo, Roermond, Heerlen |
| `RBMNE` | Rechtbank Midden-Nederland | Utrecht + Flevoland | Utrecht, Amersfoort, Almere, Lelystad |
| `RBNHO` | Rechtbank Noord-Holland | North Holland (excl. Amsterdam) | Haarlem, Alkmaar, Zaanstad |
| `RBNNE` | Rechtbank Noord-Nederland | Groningen, Friesland, Drenthe | Groningen, Leeuwarden, Assen |
| `RBOBR` | Rechtbank Oost-Brabant | East Brabant | Eindhoven, 's-Hertogenbosch, Helmond |
| `RBOVE` | Rechtbank Overijssel | Overijssel | Zwolle, Enschede, Almelo |
| `RBROT` | Rechtbank Rotterdam | Rotterdam region | Rotterdam, Dordrecht, Brielle |
| `RBZWB` | Rechtbank Zeeland-West-Brabant | Zeeland + West Brabant | Breda, Tilburg, Middelburg |

### Higher Courts (relevant for omgevingsrecht appeals)

| Afkorting | Naam | Role |
|-----------|------|------|
| `RVS` | Raad van State | **Primary appeal court for omgevingsrecht** -- highest administrative court |
| `GHAMS` | Gerechtshof Amsterdam | Civil/criminal appeals |
| `GHDHA` | Gerechtshof Den Haag | Civil/criminal appeals |
| `GHARL` | Gerechtshof Arnhem-Leeuwarden | Civil/criminal appeals |
| `GHSHE` | Gerechtshof 's-Hertogenbosch | Civil/criminal appeals |
| `CBB` | College van Beroep voor het bedrijfsleven | Economic administrative law |

### ECLI-Based Court Filtering Strategy

**CRITICAL FINDING:** The `creator` parameter accepts identifier URIs (e.g., `http://psi.rechtspraak.nl/rblim`), but live testing returned 0 results for `creator=http://psi.rechtspraak.nl/rblim` combined with `subject=omgevingsrecht`. The API documentation does not clarify whether `creator` is case-sensitive or uses a different URI format per court.

**Recommended approach: ECLI prefix filtering** (parse court code from ECLI string client-side):

```python
# ECLI format: ECLI:NL:{COURT_CODE}:{YEAR}:{NUMBER}
# Extract court: ecli.split(":")[2]  -> "RBLIM", "RVS", "RBDHA"

def extract_court_code(ecli: str) -> str:
    """Extract court abbreviation from ECLI identifier."""
    parts = ecli.split(":")
    return parts[2] if len(parts) >= 4 else ""
```

**Why client-side filtering over API `creator` parameter:**
1. API `creator` with combined `subject` filter returned 0 results in testing -- unreliable
2. ECLI prefix is deterministic and documented (court code is always element 3)
3. Client-side filter on 100-1000 results is negligible overhead
4. Decouples from Waardelijst URI format changes

**Two-phase approach for gemeente-level filtering:**

```
Phase 1: API search with subject=omgevingsrecht + searchterms={gemeente_naam}
Phase 2: Client-side ECLI prefix filter to restrict to relevant court district
```

This is the core of the geo-contextualization: map each gemeente to its Rechtbank using a static lookup dict, then filter results to that Rechtbank's ECLI prefix.

---

## Gemeente-to-Rechtbank Mapping

Static mapping needed (11 current Rechtbanken covering all 342 gemeenten). Build as a Python dict:

```python
# Map each gemeente to its Rechtbank ECLI code
# Source: https://www.rechtspraak.nl/Organisatie-en-contact/Organisatie/Rechtbanken
GEMEENTE_TO_RECHTBANK: dict[str, str] = {
    "Venlo": "RBLIM",
    "Maastricht": "RBLIM",
    "Amsterdam": "RBAMS",
    "Den Haag": "RBDHA",
    # ... 342 entries total
}
```

**Implementation strategy:** Bootstrap from CBS gemeente list (already available in the app) crossed with Rechtbank jurisdiction data. Can be generated once and stored as a JSON file or Python dict. The mapping changes only when gemeenten merge (rare, ~once per year).

---

## Geo-Contextualization: Location Extraction from Ruling Text

### Strategy: Regex-Based Dutch Location Extraction

No NLP library needed. Court ruling texts consistently mention locations in structured patterns:

```python
import re

# Dutch address patterns in legal texts
LOCATION_PATTERNS = [
    # Postcode pattern: "1234 AB" or "1234AB"
    re.compile(r'\b(\d{4})\s?([A-Z]{2})\b'),
    # Gemeente name after "gemeente" keyword
    re.compile(r'\bgemeente\s+([A-Z][a-z]+(?:\s+[a-z]+)*)', re.IGNORECASE),
    # "te {plaatsnaam}" pattern (common in rulings)
    re.compile(r'\bte\s+([A-Z][a-z]+(?:[\s-][A-Za-z]+)*)', re.IGNORECASE),
    # "gelegen aan/te/in {locatie}" pattern
    re.compile(r'\bgelegen\s+(?:aan|te|in)\s+(?:de\s+)?([A-Z][a-z]+(?:[\s-][A-Za-z]+)*)', re.IGNORECASE),
]
```

**Why NOT use spaCy or other NLP:**
1. Court rulings use highly structured Dutch legal language -- patterns are predictable
2. spaCy Dutch model (`nl_core_news_lg`) is 500MB+ -- massive dependency for simple pattern matching
3. False positives are acceptable (we match against known gemeente names list as validation)
4. The existing `sru_bekendmakingen.py` already uses regex for address extraction successfully
5. Performance: regex is orders of magnitude faster than NER for known patterns

**Validation approach:** Extract candidate locations with regex, then validate against the known list of 342 Dutch gemeentenamen (already available in the app from CBS data).

---

## Doorlooptijd (Processing Time) Analysis

### Data Source: Document Metadata XML

Each Rechtspraak document contains:
- `dcterms:date` -- date of ruling (uitspraakdatum)
- `dcterms:issued` -- publication date
- `dcterms:temporal` -- temporal scope with `start` and `end` elements

**For doorlooptijd calculation:**
```python
from datetime import date

def calculate_doorlooptijd(datum_uitspraak: str, datum_indiening: str | None) -> int | None:
    """Calculate processing time in days.

    datum_uitspraak: from dcterms:date or dcterms:issued
    datum_indiening: from dcterms:temporal/start (if available)
    """
    if not datum_indiening:
        return None
    uitspraak = date.fromisoformat(datum_uitspraak)
    indiening = date.fromisoformat(datum_indiening)
    return (uitspraak - indiening).days
```

**Limitation:** Not all rulings have `dcterms:temporal` with start date. For aggregate doorlooptijd stats, only rulings with both dates contribute. This is a known data gap -- flag in UI as "gebaseerd op N uitspraken met volledige tijdsinformatie."

---

## Bekendmakingen Linking

### Strategy: Match Ruling Text to SRU Records

Link court rulings to official government announcements (bekendmakingen) by:

1. **Extract case identifiers** from ruling text (zaaknummer, permit number)
2. **Search SRU** with extracted identifiers via existing `SRUBekendmakingenClient`
3. **Store link** as ECLI <-> bekendmaking_identifier pair

```python
# Extract zaaknummer from ruling metadata
# dcterms:identifier contains the case number
# psi:zaaknummer contains the court case number

# Match against SRU bekendmakingen by:
# - Title substring match (permit address)
# - Date proximity (bekendmaking date near ruling date)
# - Gemeente match (SRU creator == ruling gemeente)
```

**No new dependencies needed.** The existing `SRUBekendmakingenClient.query_by_municipality()` handles the SRU search. Text matching uses Python string operations.

---

## Caching Strategy for Court Rulings

### Why Cache Rulings in PostgreSQL

Court rulings are **immutable after publication** -- they never change. This makes aggressive caching safe and desirable:

| Data | Cache Location | TTL | Rationale |
|------|---------------|-----|-----------|
| Search results (ECLI list) | PostgreSQL JSONB | 24 hours | New rulings appear daily; refresh search periodically |
| Full ruling documents | PostgreSQL JSONB | 365 days | Immutable once published; avoid repeat API calls |
| AI analysis results | PostgreSQL JSONB | 30 days | Recompute monthly to capture new rulings |
| Gemeente doorlooptijd stats | PostgreSQL JSONB | 7 days | Derived from cached rulings; recompute weekly |
| Court-region mapping | Python dict (static) | Forever | Only changes with gemeente mergers |

**Schema approach:** Extend existing JSONB cache or add a dedicated `rechtspraak_cache` table:

```python
class RechtspraakCache(Base):
    __tablename__ = "rechtspraak_cache"

    ecli: Mapped[str] = mapped_column(String, primary_key=True)
    document_xml: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata: Mapped[dict] = mapped_column(JSONB, default=dict)
    gemeente_naam: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    court_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    datum_uitspraak: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
```

**Why dedicated table over JSONB cache:**
- Enables SQL queries (e.g., `SELECT * FROM rechtspraak_cache WHERE gemeente_naam = 'Venlo' ORDER BY datum_uitspraak DESC`)
- Supports doorlooptijd aggregation queries
- Enables bekendmakingen linking via JOIN
- Index on `court_code` + `datum_uitspraak` for efficient time-range queries

---

## Enhanced RechtspraakClient: Methods to Add

```python
class RechtspraakClient:
    # EXISTING
    async def search_jurisprudence(self, query, client, max_results, sort) -> list[dict]: ...
    async def get_jurisprudence_document(self, ecli, client) -> dict | None: ...

    # NEW: search with all API parameters
    async def search_by_criteria(
        self,
        client: httpx.AsyncClient,
        *,
        subject: str = OMGEVINGSRECHT_URI,
        creator: str | None = None,      # Court identifier URI
        date_from: str | None = None,     # YYYY-MM-DD
        date_to: str | None = None,       # YYYY-MM-DD
        search_terms: str | None = None,  # Free text
        doc_type: str = "Uitspraak",      # "Uitspraak" or "Conclusie"
        max_results: int = 100,
        offset: int = 0,
        sort: str = "DESC",
    ) -> tuple[list[dict], int]:
        """Search with full parameter support. Returns (results, total_count)."""
        ...

    # NEW: extract full metadata from document XML
    async def get_document_with_metadata(
        self,
        ecli: str,
        client: httpx.AsyncClient,
    ) -> dict | None:
        """Fetch document with extended metadata including:
        - text, instantie, datum_uitspraak (existing)
        - zaaknummer, procedure_type, temporal (start/end dates)
        - spatial (location references), relations (related ECLIs)
        """
        ...

    # NEW: extract geo-references from ruling text
    def extract_locations(self, ruling_text: str) -> list[str]:
        """Extract gemeente/plaatsnaam references from ruling text."""
        ...

    # NEW: filter results by court district
    def filter_by_court(self, results: list[dict], court_codes: list[str]) -> list[dict]:
        """Client-side ECLI prefix filter for court district."""
        ...
```

---

## AI Analysis Upgrade

### Enhanced Prompt Strategy

The existing AI analysis (v11.0) sends all ruling texts to Claude in one prompt. For v13.0:

| Aspect | v11.0 (Current) | v13.0 (New) |
|--------|-----------------|-------------|
| Input filtering | All search results | Pre-filtered by court district + date range |
| Analysis scope | Per-ruling + aggregate | Per-ruling + aggregate + doorlooptijd + trend |
| Claude model | Same (anthropic client) | Same (anthropic client) |
| Output schema | bezwaargrond, uitkomst, relevantie | + vergunningstype, doorlooptijd_indicatie, locatie_match |

**No new library needed.** The `anthropic` client and `arq` worker pattern remain unchanged. Only the prompt template and response schema evolve.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Court filtering | ECLI prefix parsing (client-side) | API `creator` parameter | `creator` combined with `subject` returned 0 results in live testing -- unreliable |
| Geo-contextualization | Regex patterns + gemeente validation | spaCy NER (`nl_core_news_lg`) | 500MB dependency for simple pattern matching; court texts are structured |
| Geo-contextualization | Regex patterns + gemeente validation | `stanza` NLP | Heavy dependency, GPU-optimized, overkill for known patterns |
| Location validation | Static gemeente list (CBS) | PDOK geocoding API | Adds latency; we already have the gemeente list in-app |
| Ruling cache | Dedicated PostgreSQL table | Redis | Rulings are immutable, long-lived -- Redis in-memory waste; SQL queries needed for aggregation |
| Ruling cache | Dedicated PostgreSQL table | JSONB cache (existing pattern) | Need indexed columns for court_code + date range queries; JSONB lacks that |
| Date parsing | `datetime.date.fromisoformat()` | `dateutil.parser.parse()` | Rechtspraak uses ISO format consistently; no need for fuzzy parsing |
| Doorlooptijd stats | Pure Python aggregation | pandas | Simple mean/median on date diffs; stdlib `statistics` suffices |

---

## What NOT to Add

| Technology | Why Not |
|------------|---------|
| `spaCy` / `stanza` / `transformers` | NLP overkill -- court texts use structured Dutch legal language with predictable location patterns |
| `pandas` / `numpy` | Heavy dependencies for simple date arithmetic and aggregation |
| `beautifulsoup4` | Already using `lxml` which is faster and more capable for XML |
| `elasticsearch` / `typesense` | Full-text search on cached rulings unnecessary -- Rechtspraak API handles search |
| `celery` | Already using `arq` for background jobs |
| `redis` for caching | Rulings are immutable, long-lived data -- PostgreSQL is better suited |
| `dateutil` | Rechtspraak dates are strict ISO format |
| `openrechtspraak` PyPI | Wrapper around same API; adds dependency for no value over direct httpx |
| `rechtspraak-extractor` PyPI | CLI tool, not a library; sync-only; last updated 2023 |

---

## New Code Modules Required

| Module | Purpose | Based on |
|--------|---------|----------|
| `government_apis/rechtspraak.py` (extend) | Add `search_by_criteria()`, `get_document_with_metadata()`, `extract_locations()`, `filter_by_court()` | Existing `RechtspraakClient` |
| `data/court_mapping.py` (new) | Static gemeente-to-Rechtbank mapping dict + ECLI prefix utilities | Static data from Rechtspraak.nl |
| `services/juridisch_klimaat.py` (new) | Doorlooptijd aggregation, trend analysis, bekendmakingen linking logic | Pure Python |
| `models/rechtspraak_cache.py` (new) | SQLAlchemy model for cached rulings with indexed columns | Existing model patterns |

**NOT separate modules** (fold into existing):
- Bekendmakingen linking -- add method to existing `SRUBekendmakingenClient` or `juridisch_klimaat.py` service
- AI analysis upgrade -- update prompt template in existing analysis job, not a new module

### New Rate Limiter Adjustments

The existing `rechtspraak_limiter` (3 concurrent, 300/hour) is appropriate. The API documentation says "don't hammer the server" but specifies no hard limits. Consider reducing `max_per_hour` to 200 if batch-fetching many documents for caching:

```python
# In rate_limiter.py -- NO CHANGE needed, existing limits are fine
rechtspraak_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=300)
```

### Alembic Migration

One migration needed for `rechtspraak_cache` table:

```python
# New table: rechtspraak_cache
op.create_table(
    "rechtspraak_cache",
    sa.Column("ecli", sa.String, primary_key=True),
    sa.Column("document_text", sa.Text, nullable=True),
    sa.Column("metadata", JSONB, server_default="{}"),
    sa.Column("gemeente_naam", sa.String, nullable=True, index=True),
    sa.Column("court_code", sa.String(10), nullable=False, index=True),
    sa.Column("datum_uitspraak", sa.Date, nullable=True, index=True),
    sa.Column("doorlooptijd_dagen", sa.Integer, nullable=True),
    sa.Column("fetched_at", sa.DateTime, server_default=sa.func.now()),
)
```

**Note:** No `organization_id` needed on this table -- court rulings are public data, not tenant-specific. The cache is shared across all organizations.

---

## Frontend: No New Dependencies

All frontend features use existing libraries:

| Feature | Implementation | Library |
|---------|---------------|---------|
| Gemeente jurisprudentie feed | TanStack Query with new endpoint | Existing |
| Explorer filters (scope, type, uitkomst, period) | React state + URL search params | Existing (TanStack Router) |
| Doorlooptijd visualization | CSS bar/progress component | Tailwind (existing) |
| Timeline chart | CSS-only or simple SVG | No chart library needed |
| Bekendmakingen link badges | Clickable badges linking to map | Existing MapLibre integration |
| Tab navigation (Overzicht / Explorer) | React state or URL hash | Existing patterns |

**Why no chart library:**
- Doorlooptijd is a single aggregate number (median days) per gemeente -- a progress bar suffices
- Trend over time is at most 10-20 data points -- simple CSS bars or inline SVG
- Adding `recharts` or `chart.js` for one chart is unjustifiable bloat

---

## Sources

- Rechtspraak Open Data v1.15 official documentation (PDF): https://www.rechtspraak.nl/SiteCollectionDocuments/Technische-documentatie-Open-Data-van-de-Rechtspraak.pdf (HIGH confidence -- official spec)
- Rechtspraak Waardelijst/Instanties endpoint: verified live via `https://data.rechtspraak.nl/Waardelijst/Instanties` -- all 11 current Rechtbank codes confirmed (HIGH confidence)
- Rechtspraak Waardelijst/Rechtsgebieden endpoint: verified live via `https://data.rechtspraak.nl/Waardelijst/Rechtsgebieden` -- omgevingsrecht URI confirmed (HIGH confidence)
- Rechtspraak search endpoint: verified live via `https://data.rechtspraak.nl/uitspraken/zoeken?subject=...&max=3&return=DOC&sort=DESC` -- 20,984 omgevingsrecht rulings confirmed (HIGH confidence)
- ECLI structure: https://e-justice.europa.eu/topics/legislation-and-case-law/european-case-law-identifier-ecli/nl_en (HIGH confidence)
- `creator` parameter unreliability: verified by live API call returning 0 results with `creator=http://psi.rechtspraak.nl/rblim&subject=omgevingsrecht` (HIGH confidence)
- Wetsuite rechtspraak collector docs: https://wetsuite.knobs-dials.com/apidocs/wetsuite.datacollect.rechtspraaknl.html (MEDIUM confidence -- third party)
- Existing codebase: `rechtspraak.py`, `sru_bekendmakingen.py`, `base.py`, `rate_limiter.py` (HIGH confidence -- direct code review)

---

*Stack research for: Propdex v13.0 Juridisch Klimaat Intelligence*
*Researched: 2026-03-07*
