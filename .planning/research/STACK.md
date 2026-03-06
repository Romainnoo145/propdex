# Stack Research — v11.0 Open Data Intelligence

**Domain:** Dutch PropTech — CBS Neighborhood Stats, Rechtspraak Jurisprudence, AI Legal Analysis
**Researched:** 2026-03-06
**Confidence:** HIGH (existing stack verified in codebase; new additions verified via live API inspection and official docs)

---

## Context: Subsequent Milestone

This covers ONLY new stack requirements for v11.0. The full existing validated stack is NOT re-documented here.

**Existing base stack (already in `backend/pyproject.toml`):**
FastAPI[standard]>=0.115.0, SQLAlchemy[asyncio]>=2.0.25, asyncpg>=0.29.0, httpx[http2]>=0.27.0, lxml>=5.3.0, anthropic>=0.40.0, aiolimiter>=1.2.0, arq>=0.27.0, redis>=5.0.0, pydantic-settings>=2.1.0, pyproj>=3.7.0, shapely>=2.0.0, GeoAlchemy2>=0.15.0, WeasyPrint>=68.0, jinja2>=3.1.0, fastapi-mail>=1.4.1, PyJWT[crypto]>=2.9.0, pwdlib[argon2]>=0.2.0, openpyxl>=3.1.0

**Existing base stack (already in `frontend/package.json`):**
React 19, Vite 7, TypeScript strict, MapLibre GL JS 5.x, TanStack Query v5, TanStack Router v1, TanStack Table v8, Tailwind v4, react-hook-form ^7.71.1, zod ^4.3.6, sonner ^2.0.7, lucide-react, clsx, class-variance-authority

---

## Final Answer: New Dependencies Required

### Backend — Zero New pip Packages

All three v11.0 features are fully implementable with the existing dependency set.

| Feature | New pip package? | Uses instead |
|---------|-----------------|-------------|
| CBS OData v4 neighborhood scorer | None | httpx + manual OData params |
| Rechtspraak Atom/XML parsing | None | lxml (already >=5.3.0) |
| AI legal analysis structured output | None | anthropic SDK (already >=0.40.0) |
| Rate limiting new APIs | None | aiolimiter (already >=1.2.0) |
| Background AI analysis jobs | None | arq + redis (already installed) |

**`pyproject.toml` changes: none required.**

### Frontend — Zero New npm Packages

| Feature | New npm package? | Uses instead |
|---------|-----------------|-------------|
| Jurisprudence search UI | None | TanStack Query useQuery (existing) |
| Search input + form | None | react-hook-form + zod (existing) |
| AI analysis status polling | None | useQuery + refetchInterval (existing pattern) |
| Results display components | None | Existing card/section component pattern |

**`package.json` changes: none required.**

---

## Integration Points: How Each Feature Fits the Existing Pattern

### 1. CBS OData v4 Client (`app/government_apis/cbs_odata.py`)

The client already exists as a scaffold (confirmed in codebase). The integration pattern is direct:

**API structure (verified against live endpoint `opendata.cbs.nl/ODataApi/OData/85618NED`):**

| Collection | Purpose |
|-----------|---------|
| `WijkenEnBuurten` | Dimension table — resolve gemeente/wijk name to CBS region key |
| `TypedDataSet` | Main data — fetch metrics by region key |
| `DataProperties` | Field metadata — discover column names and descriptions |

**OData v4 query pattern — no library needed:**

```python
# All CBS queries use standard OData $filter, $select, $top params.
# httpx handles URL encoding automatically when passed as dict.
params = {
    "$filter": f"WijkenEnBuurten eq '{region_key}'",
    "$select": "GemiddeldeWOZWaarde_35,MateVanStedelijkheid_112,Omgevingsadressendichtheid_113,AantalInwoners_5",
    "$top": "1",
}
response = await client.get(
    f"{self.dataset_url}/TypedDataSet",
    headers={"Accept": "application/json"},
    params=params,
)
data = response.json()  # CBS returns application/json — standard dict parsing
```

**Why not `cbsodata4` Python library (PyPI: github.com/dennis8/cbsodata4, v0.1.3, released 2025-06-06)?**
It uses synchronous HTTP internally (built on `requests`). Our entire stack is `async`. Using it would require `asyncio.to_thread()` wrapping and break the non-blocking event loop guarantee. The CBS query surface for this feature is 2-3 URL parameters — no library abstraction needed.

**Rate limiter:** Add `cbs_odata_limiter` singleton to `app/government_apis/rate_limiter.py`:

```python
# CBS StatLine OData v4 — public API, no published rate limit
# Use conservative limits matching sru_limiter pattern
cbs_odata_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)
```

**Cache TTL:** CBS dataset 85618NED updates annually. Use 30-day TTL (`2592000` seconds). Store in PostgreSQL JSONB using the existing `get_cached_or_fetch()` pattern.

---

### 2. Rechtspraak XML Parsing (`app/government_apis/rechtspraak.py`)

The client scaffold already exists. One critical fix is needed: migrate XML parsing from stdlib `xml.etree.ElementTree` to `lxml.etree` (which is already in `pyproject.toml` as `lxml>=5.3.0`).

**Why migrate from stdlib to lxml:**

| Concern | stdlib ElementTree | lxml.etree |
|---------|-------------------|-----------|
| XXE protection | None — vulnerable to XML External Entity injection from external court XML | `XMLParser(resolve_entities=False, no_network=True)` — blocks entity resolution |
| Namespace handling | Generates `ns0`/`ns1` prefix artifacts | Preserves declared namespace prefixes |
| XPath support | None — requires `.iter()` + local name string stripping | Full XPath 1.0 — `root.xpath("//psi:procedure", namespaces=ns)` |
| Existing pattern | Not used elsewhere | Matches `sru_bekendmakingen.py` exactly |

The migration is a 2-line change (drop-in compatible):

```python
# Remove:
import xml.etree.ElementTree as ET
root = ET.fromstring(response.text)

# Add:
from lxml import etree
_parser = etree.XMLParser(resolve_entities=False, no_network=True, remove_comments=True)
root = etree.fromstring(response.text.encode("utf-8"), parser=_parser)
```

**Rechtspraak namespace dictionaries (from official technical documentation):**

```python
# For Atom search feed (search endpoint response):
ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}

# For full document content (content endpoint response):
RECHTSPRAAK_CONTENT_NS = {
    "rdf":     "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "dcterms": "http://purl.org/dc/terms/",
    "psi":     "http://psi.rechtspraak.nl/",
    "rdfs":    "http://www.w3.org/2000/01/rdf-schema#",
}
```

**Rate limiter:** Migrate from the `asyncio.Semaphore(5)` currently inline in `rechtspraak.py` to the `APIRateLimiter` pattern. Add to `rate_limiter.py`:

```python
# Rechtspraak Open Data — documented max 10 req/sec; use conservative 5 concurrent
rechtspraak_limiter = APIRateLimiter(max_concurrent=5, max_per_hour=3600)
```

**Cache TTL:** Court rulings are immutable once published. Use 7-day TTL (`604800` seconds) — sufficient freshness without re-fetching stable documents.

---

### 3. AI Legal Analysis (`app/ai/`)

Use the existing `anthropic.AsyncAnthropic` client and `ClaudeClient` class pattern. The feature requires a new method (or a new `LegalAnalysisClient` class if it grows large) plus a new Pydantic schema in the existing `app/ai/schemas.py`.

**Structured outputs — use `messages.parse()` (GA as of early 2026):**

```python
# No beta header needed — structured outputs are now GA for claude-sonnet-4-5-20250929
response = await self.client.messages.parse(
    model=self.MODEL,  # reuse "claude-sonnet-4-5-20250929"
    max_tokens=4096,
    system=[{
        "type": "text",
        "text": LEGAL_ANALYSIS_PROMPT,
        "cache_control": {"type": "ephemeral"},  # cache prompt — same pattern as PDF parsing
    }],
    messages=[{
        "role": "user",
        "content": f"Analyseer deze uitspraak (ECLI: {ecli}):\n\n{ruling_text[:50000]}",
        # Truncate to ~50K chars — dense legal text, stay well within context window
    }],
    output_format=JurisprudenceAnalysis,  # Pydantic model from app/ai/schemas.py
)
result: JurisprudenceAnalysis = response.parsed_output
```

**New Pydantic schema (add to `app/ai/schemas.py`):**

```python
class JurisprudenceAnalysis(BaseModel):
    """AI-extracted analysis of a Dutch court ruling relevant to real estate development."""
    ecli: str = Field(description="ECLI identifier of the analyzed ruling")
    samenvatting: str = Field(description="Dutch summary of the ruling (2-3 sentences)")
    relevantie: Literal["HOOG", "MIDDEL", "LAAG"] = Field(
        description="Relevance to permit applications (HOOG/MIDDEL/LAAG)"
    )
    uitkomst: Literal["VERGUND", "GEWEIGERD", "VERNIETIGD", "ONBEKEND"] = Field(
        description="Outcome: was the permit granted, refused, or annulled?"
    )
    risicofactoren: list[str] = Field(
        default_factory=list,
        description="Risk factors identified (Dutch, max 5 items)",
    )
    vergunningskans_indicatie: Literal["GUNSTIG", "ONZEKER", "ONGUNSTIG"] = Field(
        description="Indicative permit success probability based on this precedent"
    )
    confidence: Literal["HIGH", "MEDIUM", "LOW"] = Field(
        description="Confidence in this analysis"
    )
    disclaimer: str = Field(
        default="AI-geanalyseerd — Geen juridisch advies. Raadpleeg een jurist.",
        description="Mandatory disclaimer",
    )
```

**Background job pattern:** AI analysis takes 10-30s — must not block the HTTP response. Use the existing ARQ pattern (`app/jobs/`) — same approach as `pdf_parsing.py`. Queue the analysis job, return a job ID, poll for completion.

---

### 4. Missing `exceptions.py` Module (`app/government_apis/exceptions.py`)

The `rechtspraak.py` client and `app/api/endpoints/jurisprudence.py` both import from `app.government_apis.exceptions` — but this file does not exist in the codebase. The exceptions live in `base.py`. This needs to be created:

```python
# app/government_apis/exceptions.py
"""Re-exports of government API exceptions for consistent import paths."""
from app.government_apis.base import (
    GovernmentAPIError,
    APINotFoundError,
    APIRateLimitError,
    APITimeoutError,
)

__all__ = [
    "GovernmentAPIError",
    "APINotFoundError",
    "APIRateLimitError",
    "APITimeoutError",
]
```

This is infrastructure cleanup — not a new library, just a missing file that will cause `ImportError` at runtime.

---

## New Configuration Required

```python
# backend/app/core/config.py — add to CACHE_TTL dict:
"cbs_odata": 2592000,        # 30 days — CBS dataset updates annually
"rechtspraak_doc": 604800,   # 7 days — court rulings are immutable once published
"rechtspraak_search": 3600,  # 1 hour — search results may include new rulings
```

No new `Settings` class fields required — CBS and Rechtspraak are public APIs with no auth tokens.

---

## New API Endpoints

```
# CBS neighborhood data:
GET  /area-scans/{scan_id}/neighborhoods   CBS metrics for all wijken in scan (cached)
GET  /neighborhoods/{wijk_id}/cbs          CBS metrics for a specific wijk

# Jurisprudence:
GET  /jurisprudence/search?q=...           Search court rulings (Rechtspraak API)
GET  /jurisprudence/doc/{ecli}             Full court ruling document

# AI analysis (already scaffolded at app/api/endpoints/jurisprudence.py):
POST /jurisprudence/{ecli}/analyze         Queue AI analysis job (returns job_id)
GET  /jurisprudence/{ecli}/analysis        Get AI analysis result (polls job status)
```

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `cbsodata` / `cbsodata4` Python packages | Synchronous HTTP — blocks async event loop | Direct `httpx.AsyncClient` with manual OData v4 params |
| `xml.etree.ElementTree` for Rechtspraak XML | No XXE protection against malicious XML from external APIs | `lxml.etree` with `XMLParser(resolve_entities=False, no_network=True)` |
| `instructor` library for Claude structured output | Extra abstraction; `anthropic` SDK now has native `.parse()` with Pydantic | `anthropic` SDK `messages.parse()` directly |
| `odata-query` / `PyOData` / `python-odata` packages | Heavy SAP-oriented OData clients; overkill for 3-param CBS read-only queries | Manual httpx params dict |
| New frontend data-fetching library | Stack has TanStack Query v5 with all needed patterns | Existing `useQuery` / `useInfiniteQuery` |
| Synchronous AI analysis endpoint | 10-30s Claude calls would block uvicorn worker | ARQ background job + polling (established pattern) |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| CBS OData queries | Manual httpx params | `cbsodata4` v0.1.3 | Synchronous only — incompatible with async stack |
| Rechtspraak XML parsing | `lxml.etree` (already installed) | Keep stdlib `xml.etree.ElementTree` | No XXE protection; stdlib already imported — low-hanging security fix |
| AI structured output | `anthropic` SDK `messages.parse()` (native GA) | `instructor` library | Extra dependency; `instructor` wraps `anthropic` which we already use directly |
| AI result schema | Pydantic in `app/ai/schemas.py` | Separate JSONB field with no schema | Type safety lost; harder to validate AI output |
| Rechtspraak search cache | Per-query JSONB cache (1 hr TTL) | No caching | Rechtspraak imposes 10 req/sec limit; repeated searches for same municipality would hit limits |

---

## Version Compatibility

| Package | Installed | Notes |
|---------|-----------|-------|
| `anthropic` | >=0.40.0 | `messages.parse()` requires >=0.40.0. Structured outputs now GA — no `anthropic-beta` header needed |
| `lxml` | >=5.3.0 | `etree.XMLParser(resolve_entities=False, no_network=True)` API stable since lxml 3.x |
| `aiolimiter` | >=1.2.0 | `AsyncLimiter(max_rate, time_period)` API stable — no version issues |
| `arq` | >=0.27.0 | ARQ 0.27 CLI broken on Python 3.14 (documented in project MEMORY) — use `python -m app.jobs.worker` |

No version upgrades required for any existing package.

---

## Sources

- `backend/pyproject.toml` — verified all existing dependencies (HIGH confidence — direct file read)
- `backend/app/government_apis/sru_bekendmakingen.py` — lxml XXE-safe parser pattern, established in project (HIGH confidence — direct file read)
- `backend/app/government_apis/cbs_odata.py` — existing CBS OData client scaffold, OData v4 query pattern (HIGH confidence — direct file read)
- `backend/app/government_apis/rechtspraak.py` — stdlib XML usage needing migration; semaphore pattern needing migration (HIGH confidence — direct file read)
- `backend/app/ai/claude_client.py` — established Claude integration pattern with prompt caching (HIGH confidence — direct file read)
- `backend/app/government_apis/rate_limiter.py` — existing `APIRateLimiter` pattern, all existing API limiters (HIGH confidence — direct file read)
- Live endpoint `https://opendata.cbs.nl/ODataApi/OData/85618NED` — verified 6 collections: TableInfos, UntypedDataSet, TypedDataSet, DataProperties, CategoryGroups, WijkenEnBuurten (HIGH confidence — live API verification)
- `https://platform.claude.com/docs/en/build-with-claude/structured-outputs` — `messages.parse()` GA, no beta header, Pydantic integration, supported models (HIGH confidence — official Anthropic docs)
- `https://github.com/dennis8/cbsodata4` — v0.1.3 released 2025-06-06, Python package, synchronous internally (HIGH confidence — verified async incompatibility)
- `https://lxml.de/performance.html` — lxml vs ElementTree performance and security comparison (HIGH confidence — official lxml docs)
- `https://www.rechtspraak.nl/SiteCollectionDocuments/Technische-documentatie-Open-Data-van-de-Rechtspraak.pdf` — official Rechtspraak API technical documentation, namespace declarations, Atom feed structure (MEDIUM confidence — referenced from official source, not directly fetched)
- WebSearch: "Rechtspraak Open Data API Atom XML feed ECLI 2025" — confirmed API endpoints, XML format, official docs URL (MEDIUM confidence — search result verification)

---

*Stack research for: Propdex v11.0 Open Data Intelligence (CBS OData v4, Rechtspraak XML, AI Legal Analysis)*
*Researched: 2026-03-06*
