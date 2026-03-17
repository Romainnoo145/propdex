# Phase 82: Ruling Cache + ECLI Court Mapping - Research

**Researched:** 2026-03-07
**Domain:** Rechtspraak API integration, ECLI court mapping, PostgreSQL caching
**Confidence:** HIGH

## Summary

Phase 82 builds the foundation for all v13.0 Juridisch Klimaat Intelligence work. It creates a dedicated `ruling_cache` PostgreSQL table (org-agnostic, ECLI as primary key) to persistently store court rulings, implements an `EcliRegistry` module that maps 342 Dutch gemeenten to 11 rechtbanken (plus 16 pre-2013 court codes), refactors the `RechtspraakClient` to use ECLI court-code prefix filtering and the `date` parameter for temporal scoping, and adds a background ARQ ingestion job that populates the cache when a gemeente is first viewed.

The existing codebase already has a working `RechtspraakClient` with XML parsing, rate limiting, and document fetching. The current problem is that searches use free-text queries nationally ("omgevingsvergunning Venlo") instead of filtering by court region. The Rechtspraak API's `creator` parameter accepts court URIs from the value list, but live testing confirmed it returns 0 results when combined with `subject=omgevingsrecht`. The confirmed approach is client-side ECLI prefix filtering: search broadly with `subject=omgevingsrecht`, then filter results by ECLI court code (e.g., `ECLI:NL:RBLIM:*` for Limburg).

**Primary recommendation:** Build `EcliRegistry` as a pure Python module with a static dict mapping, create `RulingCache` model without organization_id (public data), refactor `RechtspraakClient.search_jurisprudence()` to accept optional court codes and date range, and add a `ruling_ingestion_job` ARQ function that populates the cache per court region.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PIPE-01 | Dedicated `ruling_cache` PostgreSQL table (org-agnostic, ECLI as PK) | RulingCache model pattern documented below; no organization_id per architecture decision; Alembic migration follows existing project pattern |
| PIPE-02 | EcliRegistry maps 342 gemeenten to 11 rechtbanken + 16 pre-2013 codes | Static dict approach; 11 current rechtbanken + 4 gerechtshoven + RVS confirmed; old codes documented in FEATURES.md; Open Data API does NOT auto-include predecessor courts (section 4.1 of official docs) |
| PIPE-03 | RechtspraakClient uses ECLI court-code prefix filtering | `creator` param unreliable with `subject` combo (confirmed); client-side prefix filtering on search results is the approach; search with `subject=omgevingsrecht&max=100&return=DOC`, filter by ECLI prefix |
| PIPE-04 | Date range filtering via API `date` parameter | Official docs confirm: parameter name is `date` (NOT `sd`/`ed`), format YYYY-MM-DD, 1 value = exact date, 2 values = range "from date1 to date2" |
| PIPE-05 | ARQ background job fetches 50+ results per court region | Existing ARQ pattern in `jurisprudence_analysis.py`; new `ruling_ingestion_job` follows same session factory pattern; batch document fetch with semaphore concurrency |
| PIPE-06 | Per-gemeente caching with 7-day TTL | Cache keyed by gemeente name; TTL check on `fetched_at` column; cold cache triggers ingestion job, warm cache returns instantly |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | 2.x (existing) | RulingCache model with `Mapped[type]` + `mapped_column()` | Already used for all 20+ models in codebase |
| Alembic | existing | Database migration for ruling_cache table | Standard migration tool, used for all schema changes |
| httpx | existing | Rechtspraak API HTTP calls | Already used in RechtspraakClient |
| lxml | existing | XML parsing with XXE protection | Already used in RechtspraakClient |
| ARQ | 0.27 | Background job for ruling ingestion | Already used for 5 other job types |
| aiolimiter | existing | Rate limiting for Rechtspraak API | Already used via `rechtspraak_limiter` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| asyncio.Semaphore | stdlib | Concurrency control for batch document fetches | When fetching 50+ documents in parallel |

**No new dependencies required.** Everything builds on the existing stack.

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
  government_apis/
    rechtspraak.py          # MODIFY: add court-code search + date params
    ecli_registry.py        # NEW: gemeente-to-court mapping
  models/
    ruling_cache.py         # NEW: RulingCache model (no org_id)
  jobs/
    ruling_ingestion.py     # NEW: ARQ background ingestion job
    worker.py               # MODIFY: register ruling_ingestion_job
```

### Pattern 1: RulingCache as Organization-Agnostic Store
**What:** `RulingCache` stores fetched ruling documents permanently with ECLI as unique key. No `organization_id` column -- court rulings are public data shared across all tenants.
**When to use:** Every ruling fetched from Rechtspraak API gets cached here. All downstream features (geo-extraction, AI analysis, feed) read from this table.
**Why:** Eliminates redundant API calls across organizations and sessions. Current system re-fetches the same documents per analysis trigger.

```python
# Source: Architecture research + existing codebase patterns
class RulingCache(Base, TimestampMixin):
    """Cached court ruling -- org-agnostic, ECLI is globally unique public data."""
    __tablename__ = "ruling_cache"

    ecli: Mapped[str] = mapped_column(String(100), primary_key=True)
    court_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    instantie: Mapped[str | None] = mapped_column(String(200))
    datum_uitspraak: Mapped[str | None] = mapped_column(String(20), index=True)
    title: Mapped[str | None] = mapped_column(String(500))
    summary: Mapped[str | None] = mapped_column(Text)
    full_text: Mapped[str | None] = mapped_column(Text)
    # Ingestion metadata
    gemeente_query: Mapped[str | None] = mapped_column(String(200), index=True)
    fetched_at: Mapped[datetime] = mapped_column(nullable=False)
```

**Key design decisions:**
- ECLI as primary key (not UUID) -- ECLI is the natural key, globally unique
- `court_code` extracted from ECLI on insert (e.g., "RBLIM" from "ECLI:NL:RBLIM:2024:1234")
- `gemeente_query` tracks which gemeente triggered the ingestion (for TTL per-gemeente)
- No `organization_id` -- explicit departure from `TenantMixin` pattern used everywhere else
- `full_text` is TEXT not JSONB -- ruling text is 5K-100K characters, not structured data

### Pattern 2: ECLI Court-Code Registry (Static Dict)
**What:** Pure Python module with a dict mapping gemeente names to rechtbank codes, plus old-to-new court code translation.
**When to use:** When looking up which court codes to filter for a given gemeente.

```python
# ecli_registry.py
# Reverse lookup: gemeente -> rechtbank code
GEMEENTE_TO_RECHTBANK: dict[str, str] = {
    "Venlo": "RBLIM",
    "Maastricht": "RBLIM",
    "Amsterdam": "RBAMS",
    # ... 342 entries total
}

# Old court codes that merged in 2013 reorganization
OLD_COURT_CODES: dict[str, str] = {
    "RBMAA": "RBLIM",   # Maastricht -> Limburg
    "RBROE": "RBLIM",   # Roermond -> Limburg
    "RBUTR": "RBMNE",   # Utrecht -> Midden-Nederland
    "RBARN": "RBGEL",   # Arnhem -> Gelderland
    "RBZUT": "RBGEL",   # Zutphen -> Gelderland
    "RBHAA": "RBNHO",   # Haarlem -> Noord-Holland
    "RBALK": "RBNHO",   # Alkmaar -> Noord-Holland
    "RBBRE": "RBZWB",   # Breda -> Zeeland-West-Brabant
    "RBMID": "RBZWB",   # Middelburg -> Zeeland-West-Brabant
    "RBASS": "RBNNE",   # Assen -> Noord-Nederland
    "RBGRO": "RBNNE",   # Groningen -> Noord-Nederland
    "RBLEE": "RBNNE",   # Leeuwarden -> Noord-Nederland
    "RBSGR": "RBDHA",   # 's-Gravenhage -> Den Haag
    "RBSHE": "RBOBR",   # 's-Hertogenbosch -> Oost-Brabant
    "RBZLY": "RBOVE",   # Zwolle-Lelystad -> Overijssel
    "RBDOR": "RBROT",   # Dordrecht -> Rotterdam
}

def get_court_codes_for_gemeente(gemeente_naam: str) -> list[str]:
    """Return all ECLI court codes for a gemeente (current + old + RVS)."""
    current = GEMEENTE_TO_RECHTBANK.get(gemeente_naam)
    if not current:
        return []
    # Include old codes that merged into this rechtbank
    old_codes = [old for old, new in OLD_COURT_CODES.items() if new == current]
    return [current] + old_codes

def extract_court_code(ecli: str) -> str | None:
    """Extract court code from ECLI string (e.g., 'RBLIM' from 'ECLI:NL:RBLIM:2024:1234')."""
    parts = ecli.split(":")
    if len(parts) >= 4:
        return parts[2]
    return None
```

### Pattern 3: Client-Side ECLI Prefix Filtering
**What:** Search Rechtspraak API broadly with `subject=omgevingsrecht`, then filter results client-side by ECLI court code prefix.
**When to use:** Always -- the `creator` API parameter does not work reliably with `subject`.
**Why:** The Rechtspraak `creator` parameter accepts court URIs but returned 0 results when combined with `subject=omgevingsrecht` in live testing. Client-side filtering is the only confirmed working approach.

```python
# In refactored RechtspraakClient
async def search_by_court(
    self,
    court_codes: list[str],
    client: httpx.AsyncClient,
    max_results: int = 100,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[dict]:
    """Search omgevingsrecht rulings filtered by court code(s)."""
    params: dict[str, str | int] = {
        "subject": OMGEVINGSRECHT_URI,
        "max": max_results,
        "sort": "DESC",
        "return": "DOC",
    }
    # Date range: official API uses 'date' param, 2 values = range
    if date_from and date_to:
        # Multiple date params create a range
        # URL: &date=2020-01-01&date=2026-01-01
        pass  # httpx handles list values for same param key
    elif date_from:
        params["date"] = date_from

    # Fetch from API
    results = await self._fetch_search(params, client)

    # Client-side filter by court code
    filtered = [
        r for r in results
        if extract_court_code(r["ecli"]) in court_codes
    ]
    return filtered
```

### Pattern 4: ARQ Ingestion Job (Existing Pattern)
**What:** Background job that populates RulingCache for a gemeente's court region.
**When to use:** Triggered when a gemeente detail view is opened and cache is cold or expired (>7 days).

```python
# Follows existing pattern from jurisprudence_analysis.py
async def ruling_ingestion_job(
    ctx: dict,
    gemeente_naam: str,
) -> dict:
    """Background job: fetch + cache rulings for a gemeente's court region."""
    engine = create_async_engine(settings.DATABASE_URL, pool_size=5)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, ...)

    try:
        court_codes = get_court_codes_for_gemeente(gemeente_naam)
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            results = await rechtspraak_client.search_by_court(
                court_codes=court_codes,
                client=http_client,
                max_results=100,
            )
            # Batch fetch full documents (with semaphore for concurrency)
            sem = asyncio.Semaphore(5)
            async def fetch_one(ecli: str) -> dict | None:
                async with sem:
                    return await rechtspraak_client.get_jurisprudence_document(
                        ecli=ecli, client=http_client
                    )
            # ... store in RulingCache via session
    finally:
        await engine.dispose()
```

### Pattern 5: Per-Gemeente TTL Check
**What:** Track when each gemeente's rulings were last ingested. Return cached results if within 7-day TTL, otherwise trigger background re-ingestion.
**When to use:** On every gemeente feed request.

The simplest approach: query `ruling_cache` for the most recent `fetched_at` WHERE `gemeente_query = gemeente_naam`. If `fetched_at` > 7 days ago or no rows exist, enqueue ingestion job.

### Anti-Patterns to Avoid
- **Using `creator` API parameter for court filtering:** Returns 0 results when combined with `subject=omgevingsrecht`. Use client-side ECLI prefix filtering instead.
- **Adding `organization_id` to RulingCache:** Court rulings are public data. Adding tenant isolation wastes storage and causes redundant API calls.
- **Re-fetching documents per analysis job:** Current `jurisprudence_analysis.py` fetches from API every time. After Phase 82, it should read from `ruling_cache` instead.
- **Using `async with db.begin()` in job:** Project uses direct `db.add()/db.flush()/db.commit()` pattern. Using `begin()` causes "transaction already begun" errors.
- **Naive `datetime.now(timezone.utc)`:** Project uses `datetime.utcnow()` (naive UTC) to match TIMESTAMP WITHOUT TIME ZONE columns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XML parsing | Custom XML parser | Existing lxml `_parser` singleton in `rechtspraak.py` | XXE-safe, already configured with `no_network=True` |
| Rate limiting | Custom rate limiter | Existing `rechtspraak_limiter` (3 concurrent, 300/hr) | Already configured and tested |
| Retry logic | Custom retry | Existing `retry_with_backoff()` from `base.py` | Handles 429 + backoff already |
| ECLI validation | Custom regex | Existing `validate_ecli()` in `rechtspraak.py` | Already validates format |
| Job infrastructure | Custom queue | Existing ARQ setup in `worker.py` | Session factory + status tracking pattern established |

**Key insight:** Phase 82 is primarily about data flow redesign, not new infrastructure. The building blocks (HTTP client, XML parser, rate limiter, job queue, database models) all exist.

## Common Pitfalls

### Pitfall 1: Rechtspraak API Does NOT Include Predecessor Courts
**What goes wrong:** Searching for `creator=Rechtbank Limburg` only returns RBLIM rulings. Pre-2013 rulings from Rechtbank Maastricht (RBMAA) and Rechtbank Roermond (RBROE) are NOT included.
**Why it happens:** Official docs section 4.1 explicitly states: "Open Data van de Rechtspraak is hiervan afgeweken. Een verzoek voor uitspraken van de Rechtbank Noord-Nederland geeft als resultaat alleen die uitspraken die daadwerkelijk door de Rechtbank Noord-Nederland zijn gedaan."
**How to avoid:** `EcliRegistry` must include old court codes. `get_court_codes_for_gemeente("Venlo")` must return `["RBLIM", "RBMAA", "RBROE"]` so client-side filtering catches both old and new ECLIs.
**Warning signs:** Very few results for searches going back 10+ years.

### Pitfall 2: Date Parameter Format
**What goes wrong:** Using `sd`/`ed` parameters (from community libraries) instead of the official `date` parameter.
**Why it happens:** Third-party libraries (rechtspraak-extractor, wetsuite) document `sd`/`ed` but the official API v1.15 uses `date` with cardinality 0, 1, or 2. One value = exact date, two values = range.
**How to avoid:** Use `date` parameter with format `YYYY-MM-DD`. For a range, pass two `date` params.
**Warning signs:** 400 Bad Request responses from the API.

### Pitfall 3: Max Results Default is 1000 (Not Unlimited)
**What goes wrong:** Assuming all results are returned in one request.
**Why it happens:** Default `max` is 1000 and that is also the maximum. For large result sets, pagination via `from` parameter is required.
**How to avoid:** For initial implementation, `max=100` is sufficient for one court region + omgevingsrecht. If more needed, use `from` parameter for pagination.
**Warning signs:** Subtitle element in Atom feed says "Aantal gevonden ECLI's: N" where N > max.

### Pitfall 4: Sort Order is by Wijzigingsdatum, Not Uitspraakdatum
**What goes wrong:** Expecting results sorted by ruling date when they are actually sorted by modification/publication date.
**Why it happens:** Official docs state: "Standaard worden resultaten gesorteerd op wijzigingsdatum" (modification date).
**How to avoid:** Accept this limitation. After fetching, sort by `datum_uitspraak` in the database for chronological display.
**Warning signs:** Recently published old rulings appearing at the top of results.

### Pitfall 5: Engine-Per-Invocation in ARQ Jobs
**What goes wrong:** Creating a new SQLAlchemy engine inside each job invocation (current pattern in `jurisprudence_analysis.py`).
**Why it happens:** ARQ jobs run in a worker process without access to the app's engine.
**How to avoid:** Follow the existing pattern (it works, just be aware of `await engine.dispose()` in finally block). The ingestion job should follow the same pattern as `jurisprudence_analysis_job`.

## Code Examples

### Rechtspraak API Date Range Query (Official Docs)
```python
# Source: Rechtspraak Open Data v1.15, section 4.3.3 + 4.3.11
# Single date: exact match
# https://data.rechtspraak.nl/uitspraken/zoeken?date=2024-01-15
# Two dates: range (from date1 to date2 inclusive)
# https://data.rechtspraak.nl/uitspraken/zoeken?type=conclusie&date=2011-05-01&date=2011-05-30

# In httpx, pass list for same param key:
params = {
    "subject": OMGEVINGSRECHT_URI,
    "max": 100,
    "sort": "DESC",
    "return": "DOC",
}
# For date range, use list of tuples or repeated keys
date_params = [("date", "2024-01-01"), ("date", "2026-03-07")]
# httpx supports this via params= for simple cases,
# or by manually constructing the URL query string
```

### Alembic Migration Pattern (From Existing Codebase)
```python
# Source: existing migration 1a67b08d7c1b
# ruling_cache table -- note: no organization_id column
def upgrade() -> None:
    op.create_table(
        "ruling_cache",
        sa.Column("ecli", sa.String(100), primary_key=True),
        sa.Column("court_code", sa.String(20), nullable=False, index=True),
        sa.Column("instantie", sa.String(200), nullable=True),
        sa.Column("datum_uitspraak", sa.String(20), nullable=True),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("full_text", sa.Text(), nullable=True),
        sa.Column("gemeente_query", sa.String(200), nullable=True),
        sa.Column("fetched_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index("ix_ruling_cache_datum_uitspraak", "ruling_cache", ["datum_uitspraak"])
    op.create_index("ix_ruling_cache_gemeente_query", "ruling_cache", ["gemeente_query"])
```

### Worker Registration Pattern
```python
# Source: existing worker.py
# Add to worker.py functions list:
from app.jobs.ruling_ingestion import ruling_ingestion_job

class WorkerSettings:
    functions = [
        pdf_parsing_job,
        area_scan_job,
        daily_change_monitor_job,
        funda_snapshot_job,
        jurisprudence_analysis_job,
        ruling_ingestion_job,  # NEW
    ]
```

### httpx Multiple Same-Name Params
```python
# Source: httpx documentation
# For Rechtspraak date range (two 'date' params):
# Option 1: Use list of tuples
params = [
    ("subject", OMGEVINGSRECHT_URI),
    ("max", "100"),
    ("sort", "DESC"),
    ("return", "DOC"),
    ("date", "2024-01-01"),
    ("date", "2026-03-07"),
]
response = await client.get(SEARCH_URL, params=params)
# Produces: ?subject=...&max=100&sort=DESC&return=DOC&date=2024-01-01&date=2026-03-07
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Free-text "omgevingsvergunning Venlo" | ECLI court-code prefix filtering | Phase 82 | Eliminates false positives from national search |
| 10 results max | 100 results per court region | Phase 82 | Statistical significance for klimaat scoring |
| No date filtering | `date` param range filtering | Phase 82 | Temporal relevance (last 2/5/10 years) |
| Re-fetch docs per analysis job | Persistent ruling_cache table | Phase 82 | Eliminates redundant API calls |
| CachedAPIResponse (tenant-scoped) | RulingCache (org-agnostic) | Phase 82 | Public data shared across organizations |

**Key Rechtspraak API facts (from official docs v1.15, dated 2019-03-20):**
- Rate limit: "not more than 10 requests per second" (we use 3 concurrent / 300 per hour -- well within limits)
- Max results: 1000 per request (default and maximum)
- Pagination: `from` parameter (0-based offset)
- Date param: `date` (not `sd`/`ed`), YYYY-MM-DD format, 1=exact, 2=range
- Creator param: `creator`, takes URI from value list (but unreliable with subject filter)
- Section 4.1: Open Data does NOT follow opvolgingsrelaties (predecessor courts not included)

## Open Questions

1. **httpx handling of duplicate query params**
   - What we know: Rechtspraak API expects `&date=X&date=Y` for date ranges. httpx supports list-of-tuples for params.
   - What's unclear: Whether the existing `retry_with_backoff` wrapper handles list-of-tuples params correctly (it passes params through to `client.get()`).
   - Recommendation: Test with list-of-tuples in implementation. Should work since httpx passes through to urllib.

2. **Gemeente-to-rechtbank mapping completeness**
   - What we know: 342 gemeenten (2024 count), 11 rechtbanken. Sources available at dutchcivillaw.com and rechtspraak.nl.
   - What's unclear: Exact mapping for all 342 gemeenten -- need to compile from source.
   - Recommendation: Build the mapping incrementally. Start with the gemeenten already in the Propdex database (from area_scans), expand as needed. Include a fallback that returns empty list for unknown gemeenten (log warning, don't crash).

3. **Per-gemeente vs per-court-region caching granularity**
   - What we know: Multiple gemeenten share the same rechtbank (e.g., all Limburg gemeenten share RBLIM).
   - What's unclear: Should we cache per-gemeente (redundant storage but simple TTL) or per-court-region (shared cache but complex TTL)?
   - Recommendation: Store rulings per-court-region in `ruling_cache` (ECLI is unique, no duplication). Track per-gemeente ingestion timestamp separately (e.g., `gemeente_query` + `fetched_at` on the ruling rows, or a separate lightweight tracking table/query).

## Sources

### Primary (HIGH confidence)
- Rechtspraak Open Data v1.15 official PDF (2019-03-20) -- API parameters confirmed: `date` (not sd/ed), `creator`, `max` (default/max=1000), `from`, `sort`, `return=DOC`. Section 4.1 confirms no opvolgingsrelaties in Open Data.
- Existing Propdex codebase -- `rechtspraak.py` (267 lines), `jurisprudence.py` endpoint (228 lines), `jurisprudence_analysis.py` job (224 lines), `worker.py`, `base.py` models, `rate_limiter.py`
- Project MEMORY notes (2026-03-07) -- `creator` param unreliability confirmed via live testing, ECLI prefix filtering confirmed as approach

### Secondary (MEDIUM confidence)
- `.planning/research/FEATURES.md` -- 16 old court codes documented with merger targets
- `.planning/research/ARCHITECTURE.md` -- Component map and data flow verified against codebase
- `.planning/research/SUMMARY.md` -- Synthesis of 4 research files

### Tertiary (LOW confidence)
- dutchcivillaw.com gemeente-rechtbank mapping -- completeness unverified, needs cross-reference during implementation
- wetsuite/rechtspraak-extractor docs -- referenced `sd`/`ed` params that are NOT the official param names (official is `date`)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all existing libraries verified in codebase
- Architecture: HIGH -- RulingCache design validated against existing models, ARQ job pattern established
- Pitfalls: HIGH -- API parameter issues verified against official v1.15 PDF, predecessor court gotcha confirmed in section 4.1

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (30 days -- Rechtspraak API is stable, last doc update was 2019)