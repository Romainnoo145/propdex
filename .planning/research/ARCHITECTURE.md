# Architecture Research

**Domain:** PropTech — Open Data Intelligence integration into existing FastAPI/React platform
**Researched:** 2026-03-06
**Confidence:** HIGH — based on direct codebase inspection, not inference

---

## Context: What Already Exists

This is a SUBSEQUENT MILESTONE for an existing, production-hardened system (~46,220 LOC). The integration
components are substantially already built. This document maps what exists, what is missing, and how
the pieces connect.

### Components Already Implemented

| Component | File | Status |
|-----------|------|--------|
| CBSODataClient | `backend/app/government_apis/cbs_odata.py` | Complete — fetches Kerncijfers wijken en buurten dataset 85618NED |
| CBS area_scan integration | `backend/app/jobs/area_scan.py:354-364` | Complete — fetched during scan Phase 2, stored in `AreaScan.neighborhood_metrics` JSONB |
| CBS DB column | `backend/app/models/area_scan.py:76` | Complete — `neighborhood_metrics` JSONB nullable |
| CBS API schema | `backend/app/scans/schemas.py:227` | Complete — `neighborhood_metrics: dict | None` in ScanResultsResponse |
| CBS frontend type | `frontend/src/lib/types/scan.ts:169` | Complete — `neighborhood_metrics?: Record<string, any> | null` |
| Alembic migration | `backend/alembic/versions/1a67b08d7c1b_add_neighborhood_metrics_to_area_scan.py` | EXISTS but may not be applied — run `alembic upgrade head` |
| RechtspraakClient | `backend/app/government_apis/rechtspraak.py` | Complete — Atom feed search + ECLI content fetch |
| Jurisprudence API router | `backend/app/api/endpoints/jurisprudence.py` | Complete — GET /search + GET /doc/{ecli} |
| Jurisprudence router registration | `backend/app/main.py:24` | Complete — imported as `jurisprudence_router` |
| JurisprudenceSection component | `frontend/src/components/projects/JurisprudenceSection.tsx` | Complete — search feed + inline document viewer |
| useJurisprudence hooks | `frontend/src/hooks/useJurisprudence.ts` | Complete — `useJurisprudenceSearch` + `useJurisprudenceDoc` |
| WijkDetailView integration | `frontend/src/components/projects/WijkDetailView.tsx:44-48` | Complete — JurisprudenceSection mounted at wijk level |
| ClaudeClient (existing) | `backend/app/ai/claude_client.py` | Complete — for bestemmingsplan PDF parsing (extend for AI legal analysis) |

### What Is NOT Yet Built

| Component | Purpose | Priority |
|-----------|---------|---------|
| CBS neighborhood metrics display | Show `neighborhood_metrics` data in WijkDetailView | High — data is captured but never rendered |
| `CbsNeighborhoodMetrics` TypeScript type | Narrow `Record<string,any>` to typed interface | High — needed before building display |
| AI legal analysis backend | Extend ClaudeClient + add POST /analyze endpoint | High — core milestone feature |
| AI legal analysis prompts | `JURISPRUDENCE_ANALYSIS_PROMPT` in `prompts.py` | High |
| `JurisprudenceAnalysis` schema | Pydantic structured output for AI analysis | High |
| `useJurisprudenceAnalysis` hook | TanStack Query hook for POST /analyze | Medium |
| AI analysis UI in JurisprudenceSection | "Analyseer selectie" button + results panel | Medium |

---

## System Architecture: Data Flow for v11.0 Features

```
+------------------------------------------------------------------+
|                      FRONTEND (React 19)                         |
|                                                                  |
|  WijkDetailView                                                  |
|  +-- ScanSummarySection                                          |
|  |   +-- [TODO] CbsNeighborhoodCard (renders neighborhood_metrics)|
|  +-- JurisprudenceSection  <- BUILT                             |
|  |   +-- search feed (useJurisprudenceSearch)                   |
|  |   +-- document viewer (useJurisprudenceDoc)                  |
|  |   +-- [TODO] AiRiskPanel (useJurisprudenceAnalysis)          |
|  +-- ReportListSection                                           |
+---------------------------+--------------------------------------+
                            | HTTP (Bearer token, credentials:include)
+---------------------------v--------------------------------------+
|                       BACKEND (FastAPI)                          |
|                                                                  |
|  Routers:                                                        |
|  +-- /api/scans         -> ScanResultsResponse + neighborhood_metrics
|  +-- /api/jurisprudence <- BUILT                                |
|      +-- GET /search    -> RechtspraakClient.search_jurisprudence|
|      +-- GET /doc/{ecli}-> RechtspraakClient.get_jurisprudence_doc
|      +-- [TODO] POST /analyze -> ClaudeClient.analyze_jurisprudence
|                                                                  |
|  ARQ Background Jobs:                                            |
|  +-- area_scan                                                   |
|      +-- Phase 2: BAG + CBS + 3DBAG + bestemmingen              |
|          +-- CBSODataClient.get_neighborhood_data()             |
|              -> AreaScan.neighborhood_metrics (JSONB) [BUILT]   |
+---------------------------+--------------------------------------+
                            |
+---------------------------v--------------------------------------+
|                GOVERNMENT APIs + ANTHROPIC AI                    |
|                                                                  |
|  CBS StatLine OData v4    opendata.cbs.nl/ODataApi/OData        |
|  +-- /85618NED/WijkenEnBuurten  (region key lookup)             |
|  +-- /85618NED/TypedDataSet     (metrics for region key)        |
|                                                                  |
|  Rechtspraak Open Data    data.rechtspraak.nl/uitspraken/       |
|  +-- /zoeken?searchterms=...    (Atom XML feed)                 |
|  +-- /content?id={ecli}        (Open Rechtspraak XML)           |
|                                                                  |
|  Anthropic Claude API     (existing SDK)                         |
|  +-- analyze_jurisprudence(texts[]) -> risk_summary + score     |
+------------------------------------------------------------------+
```

---

## Component Boundaries

### Existing Components — No Changes Required

| Component | Responsibility | Where |
|-----------|----------------|-------|
| `CBSODataClient` | Resolves gemeente/wijk name to CBS region key, fetches Kerncijfers metrics | `government_apis/cbs_odata.py` |
| `area_scan` job | Orchestrates CBS fetch alongside BAG/bestemmingen, writes `neighborhood_metrics` | `jobs/area_scan.py:354-364` |
| `RechtspraakClient` | Atom feed search + ECLI XML document fetching | `government_apis/rechtspraak.py` |
| `jurisprudence.py` router | HTTP endpoints for search and doc fetch | `api/endpoints/jurisprudence.py` |
| `JurisprudenceSection` | React component with search feed + inline viewer | `components/projects/JurisprudenceSection.tsx` |
| `useJurisprudenceSearch` | TanStack Query hook for Rechtspraak search | `hooks/useJurisprudence.ts` |
| `useJurisprudenceDoc` | TanStack Query hook for ECLI document fetch | `hooks/useJurisprudence.ts` |

### Components to Build — New

#### Backend: AI Legal Analysis

**1. `backend/app/ai/schemas.py` — add these types:**

```python
from typing import Literal
from pydantic import BaseModel, Field

class PrecedentInsight(BaseModel):
    ecli: str
    relevantie: str           # Why this ruling matters for the context
    uitkomst: Literal["gunstig", "ongunstig", "neutraal"]

class JurisprudenceAnalysis(BaseModel):
    risk_summary: str         # Dutch prose, 3-5 sentences
    risk_score: int           # 0-10 (0=low risk, 10=high risk)
    vergunnings_succeskans: int  # 0-100 percent
    precedent_insights: list[PrecedentInsight]
    confidence: Literal["HIGH", "MEDIUM", "LOW"]
    disclaimer: str           # Dutch disclaimer: "Dit is geen juridisch advies"
```

**2. `backend/app/ai/prompts.py` — add `JURISPRUDENCE_ANALYSIS_PROMPT`:**

The prompt should instruct Claude to:
- Analyze Dutch court rulings in the context of omgevingsvergunning / property development
- Produce a structured JSON output matching `JurisprudenceAnalysis`
- Rate overall legal risk for a developer pursuing a similar project in this gemeente
- Estimate vergunnings-succeskans based on historical outcomes in the provided rulings
- Write in Dutch

**3. `backend/app/ai/claude_client.py` — add method:**

```python
async def analyze_jurisprudence(
    self,
    ecli_texts: list[dict],  # [{ecli, text, instantie, datum_uitspraak}]
    context: str,            # e.g. "omgevingsvergunning Amsterdam Centrum"
) -> JurisprudenceAnalysis:
    """Analyze court rulings for development risk and permit success probability."""
```

Uses same pattern as `parse_bestemmingsplan()`: structured output from Claude,
validated by Pydantic, raises `AIParsingError` on failure.

**4. `backend/app/api/endpoints/jurisprudence.py` — add endpoint:**

```python
class JurisprudenceAnalyzeRequest(BaseModel):
    eclis: list[str] = Field(min_length=1, max_length=5)
    context: str = Field(description="gemeente + type project context")

@router.post("/analyze")
async def analyze_jurisprudence(
    body: JurisprudenceAnalyzeRequest,
    current_user=Depends(deps.get_current_active_user),
    client: AsyncClient = Depends(deps.get_httpx_client),
):
    # 1. Fetch document text for each ECLI in parallel (asyncio.gather)
    # 2. Filter out ECLIs that returned None (not found)
    # 3. Call ClaudeClient.analyze_jurisprudence(texts, body.context)
    # 4. Return analysis
```

#### Frontend: CBS Display

**`frontend/src/lib/types/scan.ts` — add typed interface:**

```typescript
export interface CbsStedelijkheid {
  klasse: number | null
  omschrijving: string
  omgevingsadressendichtheid: number | null
}

export interface CbsNeighborhoodMetrics {
  bron: string
  dataset: string
  peiljaar: number
  data: {
    gemiddelde_woz_waarde: number | null
    stedelijkheid: CbsStedelijkheid
    demografie: {
      aantal_inwoners: number | null
      percentage_huurwoningen: number | null
      percentage_koopwoningen: number | null
    }
    bouwjaar_distributie: {
      percentage_bouwjaar_voor_2000: number | null
      percentage_bouwjaar_vanaf_2000: number | null
    }
  }
}
```

Update `ScanResultsResponse.neighborhood_metrics` from `Record<string, any> | null`
to `CbsNeighborhoodMetrics | null`.

**`frontend/src/components/projects/CbsNeighborhoodCard.tsx` — new component:**

Props: `{ metrics: CbsNeighborhoodMetrics }`. Renders a card with:
- Stedelijkheidsklasse badge (color-coded 1-5)
- Gemiddelde WOZ waarde
- Bevolkingsdichtheid (OAD/km2)
- Huur/koop verhouding as progress bar
- Bouwjaar distributie (voor/na 2000) as two-bar chart

Mount in `WijkDetailView.tsx` between `ScanSummarySection` and `JurisprudenceSection`
when `neighborhood_metrics` is non-null. Wrap with null guard — CBS fetch is non-fatal
and many small wijken return no data.

#### Frontend: AI Analysis UI

**`frontend/src/lib/api.ts` — add function:**

```typescript
export async function analyzeJurisprudence(
  eclis: string[],
  context: string,
  accessToken: string,
): Promise<JurisprudenceAnalysisResponse>
```

**`frontend/src/hooks/useJurisprudence.ts` — add hook:**

```typescript
export function useJurisprudenceAnalysis(
  eclis: string[],
  context: string,
  enabled: boolean = false,
) {
  // staleTime: 30 * 60 * 1000 (30 min — AI calls are expensive)
  // enabled: enabled && eclis.length >= 1 (caller controls trigger)
}
```

**`frontend/src/components/projects/JurisprudenceSection.tsx` — extend:**

Add "Analyseer juridisch klimaat" button that appears when search results are loaded.
On click, sets `analyzeEnabled = true` and passes all result ECLIs + gemeente context
to `useJurisprudenceAnalysis`. Renders analysis results below the search feed:
- Risk score badge (amber/red scale)
- Vergunnings-succeskans progress bar (0-100%)
- Risk summary prose
- Disclaimer in muted text

---

## Data Flow Details

### Flow 1: CBS Integration (Already Wired — Display Only Missing)

```
User triggers wijk scan
  -> ARQ: area_scan job Phase 2
  -> CBSODataClient.get_neighborhood_data(gemeente_naam, wijk_naam)
     -> CBS OData: WijkenEnBuurten lookup (2 calls)
     -> CBS OData: TypedDataSet fetch (1 call)
  -> scan.neighborhood_metrics = {bron, dataset, peiljaar, data: {...}}
  -> Committed to DB (AreaScan.neighborhood_metrics JSONB)

User navigates to wijk
  -> GET /api/scans/{scan_id}/results
  -> ScanResultsResponse.neighborhood_metrics populated from AreaScan row
  -> [TODO] CbsNeighborhoodCard renders if metrics non-null
```

**Missing link:** Data flows from DB to frontend type but no component renders it.

### Flow 2: Rechtspraak Search + Display (Fully Wired)

```
WijkDetailView mounts JurisprudenceSection(gemeenteNaam, wijkNaam)
  -> Default query: "omgevingsvergunning {gemeenteNaam}"
  -> useJurisprudenceSearch -> GET /api/jurisprudence/search?q=...
  -> RechtspraakClient.search_jurisprudence() -> Atom XML parsed
  -> JurisprudenceSection renders result cards

User clicks result
  -> useJurisprudenceDoc(ecli) -> GET /api/jurisprudence/doc/{ecli}
  -> RechtspraakClient.get_jurisprudence_document() -> Open Rechtspraak XML
  -> JurisprudenceViewer renders inline document text
```

### Flow 3: AI Legal Analysis (To Build)

```
JurisprudenceSection has loaded results
  -> User clicks "Analyseer juridisch klimaat"
  -> analyzeEnabled = true
  -> useJurisprudenceAnalysis(eclis, context) fires
  -> POST /api/jurisprudence/analyze {eclis, context}

Backend endpoint:
  -> asyncio.gather: fetch document text for each ECLI
  -> ClaudeClient.analyze_jurisprudence(ecli_texts, context)
  -> Anthropic API: structured output -> JurisprudenceAnalysis

Response:
  -> {risk_score, vergunnings_succeskans, risk_summary, precedent_insights}
  -> Frontend renders risk badge + success probability + prose
  -> Cached 30 min in TanStack Query
```

---

## Recommended Build Order

Dependencies flow from data layer to API to UI. Each step is independently shippable.

### Step 1: CBS Display (Frontend Only — No Backend Changes)

CBS data is already collected and served. This is purely a frontend rendering task.

1. Add `CbsNeighborhoodMetrics` TypeScript interface to `frontend/src/lib/types/scan.ts`
2. Create `frontend/src/components/projects/CbsNeighborhoodCard.tsx`
3. Mount `CbsNeighborhoodCard` in `frontend/src/components/projects/WijkDetailView.tsx`
4. Optionally: add CBS context banner to `frontend/src/components/results/ResultsTable.tsx`

**Prerequisite check before building:**
Run `alembic upgrade head` in backend. The migration `1a67b08d7c1b` adds `neighborhood_metrics`
column. Inspect actual CBS API response for a real gemeente to verify field names before typing.
The `CBSODataClient` uses dataset `85618NED` — confirm field names match `MateVanStedelijkheid_112`,
`GemiddeldeWOZWaarde_35`, etc.

**Risk (LOW):** CBS returns null for many metrics on small wijken. The component must render
gracefully with partial data. Do not show the card if all key metrics are null.

### Step 2: AI Legal Analysis Backend

Extends existing `ClaudeClient`. No new infrastructure required.

1. Add `PrecedentInsight` + `JurisprudenceAnalysis` to `backend/app/ai/schemas.py`
2. Add `JURISPRUDENCE_ANALYSIS_PROMPT` to `backend/app/ai/prompts.py`
3. Add `analyze_jurisprudence()` method to `backend/app/ai/claude_client.py`
4. Add `POST /analyze` endpoint to `backend/app/api/endpoints/jurisprudence.py`
5. Verify jurisprudence router is mounted at `/api/jurisprudence` in `backend/app/main.py`

**Risk (MEDIUM):** Claude API latency is 10-30s for multi-ECLI analysis. Start with synchronous
endpoint limited to 3 ECLIs. If user feedback shows timeout friction, port to ARQ async job
using the existing `parsing_job` pattern as template.

### Step 3: AI Legal Analysis Frontend

Depends on Step 2.

1. Add `analyzeJurisprudence()` API function to `frontend/src/lib/api.ts`
2. Add `useJurisprudenceAnalysis` hook to `frontend/src/hooks/useJurisprudence.ts`
3. Add analysis trigger + results panel to `frontend/src/components/projects/JurisprudenceSection.tsx`

---

## Architecture Patterns in Use

### Pattern 1: Government API Client Singleton

All government API clients are module-level singletons:

```python
# End of each client module
cbs_client = CBSODataClient()
rechtspraak_client = RechtspraakClient()
```

The shared `httpx.AsyncClient` is passed in at call time — never stored in the instance.
This keeps clients stateless and testable. Both new clients follow this pattern correctly.

### Pattern 2: Fire-and-Forget Non-Fatal Enrichment

CBS fetch in `area_scan.py` uses `try/except Exception` that logs a warning but never aborts the scan.
The pattern for any supplementary enrichment step:

```python
try:
    data = await some_client.fetch(...)
    scan.some_field = data
    if data:
        logger.info(f"Scan {scan_id}: successfully fetched [source]")
except Exception as e:
    logger.warning(f"Scan {scan_id}: [source] fetch failed (non-fatal): {e}")
```

Do NOT apply to BAG WFS (core, abort on failure). DO apply to CBS (already in use),
and any future supplementary enrichment that doesn't change core scan correctness.

### Pattern 3: JSONB for API Payloads with Evolving Schemas

Unstructured or potentially evolving API payloads go into JSONB columns. The frontend narrows
to typed interfaces independently. CBS field names may change between annual dataset releases —
JSONB storage avoids migration requirements when they do.

### Pattern 4: TanStack Query Stale Times by Data Volatility

| Data type | Stale time | Rationale |
|-----------|------------|-----------|
| Search results (Rechtspraak) | 5 min | User may be researching actively |
| Court documents | 60 min | Published rulings never change |
| AI analysis | 30 min | Expensive; new rulings unlikely within session |
| CBS neighborhood metrics | N/A (DB-cached at scan time) | Stored in AreaScan row, not re-fetched |

### Pattern 5: Pydantic Structured Outputs from Claude

The existing `parse_bestemmingsplan()` flow validates Claude JSON response against a Pydantic model.
Apply the same pattern for jurisprudence analysis — no ad-hoc JSON parsing, no try/except for
missing keys. The schema IS the contract.

```python
# In claude_client.py
response_text = message.content[0].text
try:
    parsed = JurisprudenceAnalysis.model_validate_json(response_text)
except ValidationError as e:
    raise AIParsingError(f"Claude response did not match schema: {e}")
return parsed
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Calling Rechtspraak API per-parcel during area scan

**What people do:** Add jurisprudence fetch inside the parcel processing loop.
**Why it's wrong:** Rechtspraak has a 5-concurrent-request semaphore; scanning 500 parcels
would queue for minutes and likely hit the 10 req/s rate limit. Court rulings are
gemeente/wijk-level data, not parcel-level data.
**Do this instead:** Jurisprudence is on-demand at the wijk level only (current architecture is correct).

### Anti-Pattern 2: Blocking HTTP response for multi-ECLI AI analysis

**What people do:** Call `analyze_jurisprudence()` synchronously for 5+ ECLIs.
**Why it's wrong:** 5 ECLI fetches (5 x 15s timeout potential) + Claude API (10-30s) can exceed
HTTP request timeouts. Rechtspraak content endpoint is not always fast.
**Do this instead:** Limit synchronous path to max 3 ECLIs with conservative timeouts. If demand
exceeds this, add ARQ async job with polling — the existing `parsing_job` model is the template.

### Anti-Pattern 3: Storing AI analysis without provenance

**What people do:** Cache analysis result without recording which ECLIs were analyzed and when.
**Why it's wrong:** New court rulings may reverse the risk picture. Without knowing what was analyzed,
users cannot tell if results are current.
**Do this instead:** Include `analyzed_at`, `ecli_count`, and `source_eclis` in the analysis response
even if not persisted to DB. Frontend can display "Gebaseerd op X uitspraken, geanalyseerd op [datum]".

### Anti-Pattern 4: Hardcoding CBS dataset ID without documentation

**What people do:** Hardcode `DATASET_ID = "85618NED"` without noting it is the 2023 dataset.
**Why it's wrong:** CBS publishes new annual Kerncijfers datasets. The 2024 dataset will have a
different ID. Silent failures occur when the old ID returns empty results.
**Do this instead:** Document the ID-to-year mapping in the client's docstring. The current
implementation already logs `peiljaar: 2023` in the response, which is the right signal.
Add a comment noting when this ID should be updated (each new CBS annual release, typically Q2).

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-50 organizations | No changes needed; current monolith handles this trivially |
| 50-500 organizations | CBS returns the same data for any organization scanning the same gemeente — consider a shared organization-agnostic CBS cache to avoid redundant API calls (CBS API has no documented rate limit but redundancy is wasteful) |
| 500+ organizations | AI analysis per-request cost becomes significant. Add request deduplication at the TanStack Query level (same eclis + context = same queryKey = one network call) |

### First Bottleneck: AI Analysis Latency

Claude API is the slowest operation in the new stack (~10-30s for jurisprudence analysis).
The existing ARQ + polling pattern from bestemmingsplan parsing is the proven solution when
synchronous latency becomes a UX problem. Start synchronous, migrate to async if needed.

---

## Integration Test Checklist

**Step 1 — CBS Display:**
- [ ] Run alembic upgrade head; confirm `neighborhood_metrics` column exists
- [ ] Run wijk scan; confirm `neighborhood_metrics` is non-null in AreaScan row via DB query
- [ ] GET /api/scans/{scan_id}/results returns `neighborhood_metrics` in JSON
- [ ] `CbsNeighborhoodCard` renders correctly with full data
- [ ] `CbsNeighborhoodCard` renders gracefully when individual fields are null
- [ ] Card does not render when `neighborhood_metrics` is null (e.g., CBS returned no data)
- [ ] WijkDetailView does not break if scan has no CBS data (rural area, small wijk)

**Step 2 — AI Backend:**
- [ ] POST /api/jurisprudence/analyze returns 200 with valid `JurisprudenceAnalysis` shape
- [ ] `risk_score` is integer 0-10, `vergunnings_succeskans` is integer 0-100
- [ ] Non-existent ECLI in the list is skipped, not crashing the request
- [ ] Empty `eclis` list returns 422 validation error
- [ ] More than 5 ECLIs returns 422 validation error
- [ ] Claude API key missing or invalid returns 500 with clear message
- [ ] Dutch disclaimer text is present in response

**Step 3 — AI Frontend:**
- [ ] "Analyseer juridisch klimaat" button only appears when search results exist
- [ ] Loading state (skeleton) renders during API call
- [ ] Error state renders fallback text, not blank panel
- [ ] Successful response renders risk badge + succeskans bar + summary text
- [ ] Re-clicking button within 30 min does not trigger second API call (TanStack cache)
- [ ] Disclaimer text visible below analysis panel

---

## Sources

- Direct codebase inspection: `backend/app/government_apis/cbs_odata.py`
- Direct codebase inspection: `backend/app/government_apis/rechtspraak.py`
- Direct codebase inspection: `backend/app/jobs/area_scan.py:340-394` (CBS integration)
- Direct codebase inspection: `backend/app/models/area_scan.py` (neighborhood_metrics column)
- Direct codebase inspection: `backend/app/scans/schemas.py:227` (schema field)
- Direct codebase inspection: `backend/app/ai/claude_client.py`, `prompts.py`, `schemas.py`
- Direct codebase inspection: `backend/app/api/endpoints/jurisprudence.py`
- Direct codebase inspection: `backend/app/main.py` (router registration)
- Direct codebase inspection: `frontend/src/components/projects/JurisprudenceSection.tsx`
- Direct codebase inspection: `frontend/src/components/projects/WijkDetailView.tsx`
- Direct codebase inspection: `frontend/src/hooks/useJurisprudence.ts`
- Direct codebase inspection: `frontend/src/lib/types/scan.ts:169`
- Direct codebase inspection: `backend/alembic/versions/1a67b08d7c1b_add_neighborhood_metrics_to_area_scan.py`

---

*Architecture research for: Propdex v11.0 Open Data Intelligence*
*Researched: 2026-03-06*
