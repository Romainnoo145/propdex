# Pitfalls Research

**Domain:** Dutch PropTech — adding CBS OData v4, Rechtspraak REST API, and AI legal analysis to existing platform
**Researched:** 2026-03-06
**Confidence:** HIGH (confirmed by actual failed first attempt + official API docs)

---

## Critical Pitfalls

### Pitfall 1: Wrong CBS API Base URL (OData v3 vs v4)

**What goes wrong:**
Code uses `https://opendata.cbs.nl/ODataApi/OData` (OData v3) instead of `https://datasets.cbs.nl/odata/v1/CBS/` (OData v4). Requests may return data for a time but the v3 endpoint is deprecated and uses a fundamentally different data model. The v3 endpoint returns `TypedDataSet` and `UntypedDataSet` entities; v4 uses `Observations` and `WijkenEnBuurtenCodes`.

**Why it happens:**
Old blog posts and StackOverflow answers reference the v3 URL. The v3 endpoint still responds for legacy datasets, so you don't get an immediate 404 — you get silently wrong data. The existing `cbs_odata.py` in the codebase uses the v3 URL (`opendata.cbs.nl/ODataApi/OData`) with a v4-adjacent field layout, creating a hybrid that fails at runtime.

**How to avoid:**
Always use `https://datasets.cbs.nl/odata/v1/CBS/{DATASET_ID}` as base. Confirm by fetching the root endpoint and checking that `Observations` and `WijkenEnBuurtenCodes` entity sets are present. Never use `TypedDataSet` — that entity does not exist in v4.

**Warning signs:**
- `TypedDataSet` in any URL path
- `opendata.cbs.nl` as the base URL
- `substringof()` in any filter query (v3-only function)
- HTTP 200 with an empty `value` array on what should be populated regions

**Phase to address:** CBS integration phase (Phase 1 of milestone)

---

### Pitfall 2: OData v3 Filter Syntax in v4 Queries (substringof vs contains)

**What goes wrong:**
`substringof('Centrum', Title)` is OData v3 syntax. The OData v4 spec uses `contains(Title, 'Centrum')`. Using `substringof` against a v4 endpoint returns HTTP 400 or silently returns empty results depending on the CBS server implementation.

**Why it happens:**
The function name difference is non-obvious. Developers reading old CBS examples or generic OData tutorials find `substringof` and copy it without checking the version.

**How to avoid:**
For OData v4 filter queries against CBS, use:
- Equality: `$filter=WijkenEnBuurten eq 'GM0363'`
- String contains: `$filter=contains(Title, 'Centrum')` (not `substringof`)
- Logical: `$filter=WijkenEnBuurten eq 'GM0363' and Measure eq 'T001036'`

CBS v4 documentation only demonstrates `eq` and `and` as the primary patterns. String searching on the CBS dimension tables is better done by fetching the full `WijkenEnBuurtenCodes` list and filtering in Python, because the CBS API does not guarantee full OData 4.0 string function support.

**Warning signs:**
- `substringof(` in any filter string
- HTTP 400 responses from CBS on filter queries
- Empty results when querying by name

**Phase to address:** CBS integration phase (Phase 1 of milestone)

---

### Pitfall 3: Importing from Non-Existent Modules

**What goes wrong:**
The failed first attempt imported from `app.government_apis.exceptions` (does not exist — exceptions live in `app.government_apis.base`) and `app.api.deps` (does not exist — the project has no `deps.py` module). Code that imports from non-existent modules fails immediately on startup with `ImportError`.

**Why it happens:**
Coding agents pattern-match to common FastAPI conventions (`app.api.deps` is standard in FastAPI boilerplate) and invent module paths that don't exist in this specific codebase. The codebase uses `app.government_apis.base` for all exception classes and has no `deps.py` dependency injection file.

**How to avoid:**
Before writing any import, verify the module exists. In this codebase:
- All API exception classes: `from app.government_apis.base import GovernmentAPIError, APINotFoundError, APIRateLimitError, APITimeoutError`
- Auth dependencies: check `app/api/` directory for the actual auth middleware pattern used
- Never assume FastAPI boilerplate conventions match this codebase structure

**Warning signs:**
- `from app.government_apis.exceptions import` — wrong module
- `from app.api.deps import` — module does not exist
- `from app.api import deps` — module does not exist (as seen in `jurisprudence.py` endpoint)

**Phase to address:** All phases — verify imports on every new file

---

### Pitfall 4: Wrong APITimeoutError Constructor Signature

**What goes wrong:**
`APITimeoutError` takes two required positional arguments: `source` (str) and optionally `message` (str). Calling `raise APITimeoutError(f"message string")` with only one argument raises `TypeError: __init__() missing 1 required positional argument: 'message'` — a different error than the original error, obscuring the real failure.

**Why it happens:**
`GovernmentAPIError.__init__(self, source: str, message: str, ...)` requires both `source` and `message`. Subclasses inherit this. The `rechtspraak.py` first attempt called `APITimeoutError(f"Rechtspraak connection error: {e}")`, passing a formatted message as `source` with no `message` argument. This means even the error handling path is broken.

**How to avoid:**
Always call exception classes with the correct signature:
```python
raise APITimeoutError("rechtspraak", f"Connection error: {e}") from e
raise GovernmentAPIError("cbs", f"HTTP {status}: {url}", status_code=status) from e
```

**Warning signs:**
- `APITimeoutError(f"...")` with a single f-string argument
- `GovernmentAPIError(f"...")` with a single f-string argument
- Any exception instantiation that doesn't pass a `source` string as first arg

**Phase to address:** All phases — verify all raise statements

---

### Pitfall 5: CBS Wijk Lookup Ignores Gemeente (Ambiguous Name Matching)

**What goes wrong:**
The CBS `WijkenEnBuurtenCodes` entity contains wijk names from all ~342 Dutch gemeenten. Common names like "Centrum", "Noord", "Zuid", "Oost", "West" appear in dozens of municipalities. Querying by wijk name alone returns the first match — which could be from a completely different gemeente than the one being scanned.

**Why it happens:**
The failed implementation filtered only by `Type == "Wijk"` without checking that the wijk belongs to the target gemeente. "Centrum" matches ~80+ records nationally. The first result is returned silently — neighborhood metrics from Amsterdam Centrum get applied to a Centrum wijk in Venlo, poisoning the scan data.

**How to avoid:**
CBS wijk codes are structured: wijk code `WK036300` where `0363` is the gemeente code. The lookup must:
1. First resolve the gemeente code from `gemeente_naam` (or pass `gemeente_code` directly — it's already available in `AreaScan.gemeente_code`)
2. Filter `WijkenEnBuurtenCodes` where `Identifier` starts with `WK{gemeente_code}` using `$filter=startswith(Identifier, 'WK0363')`
3. Then find the wijk by name within that constrained set

Better: since `AreaScan` already has `gemeente_code`, pass it directly to the CBS client and construct the wijk code filter: `startswith(Identifier, 'WK{gemeente_code}')`.

**Warning signs:**
- CBS lookup function only accepts `gemeente_naam` and `wijk_naam` without `gemeente_code`
- No prefix filter on CBS region code lookup
- `wijk_candidates[0]` without any gemeente filtering

**Phase to address:** CBS integration phase (Phase 1 of milestone)

---

### Pitfall 6: Hardcoded Dataset ID and Peiljaar Without Version Management

**What goes wrong:**
Hardcoding `DATASET_ID = "85618NED"` (2023 data) means the system silently serves stale neighborhood statistics as CBS publishes new annual datasets. As of 2026-03-06, the 2025 dataset `86165NED` already exists. In two years, the hardcoded 2023 ID will be three versions stale, with no indication to users that the data is old.

**Why it happens:**
Developers test against the latest dataset at the time of writing and hardcode it for simplicity. CBS releases new `Kerncijfers wijken en buurten` datasets annually with new IDs — there is no "latest" alias. Annual series IDs so far: 2022=`85318NED`, 2023=`85618NED`, 2024=`85984NED`, 2025=`86165NED`.

**How to avoid:**
Two strategies, in order of preference:
1. Store the dataset ID in app config (`settings.CBS_DATASET_ID`) defaulting to current latest, allowing override without code deployment.
2. Implement a catalog lookup that queries `https://datasets.cbs.nl/odata/v1/CBS` to find datasets matching "Kerncijfers wijken en buurten" and select the most recent by publication date.

Always store and surface the `peiljaar` (reference year) in the response schema and in the database, so users know how fresh the data is. The `neighborhood_metrics` JSONB already exists on `AreaScan` — include `peiljaar` in the stored payload.

**Warning signs:**
- `DATASET_ID = "85618NED"` or any hardcoded dataset ID as a class constant
- `"peiljaar": 2023` hardcoded in the response builder rather than derived from dataset metadata
- No config entry for the CBS dataset ID

**Phase to address:** CBS integration phase (Phase 1 of milestone)

---

### Pitfall 7: CBS OData v4 Entity Structure — Observations vs WijkenEnBuurtenCodes

**What goes wrong:**
The v3 API had a `WijkenEnBuurten` dimension table directly. The v4 API replaced this with two distinct entities: `WijkenEnBuurtenCodes` (the lookup table for region identifiers) and `Observations` (the long-format cell data). Querying `WijkenEnBuurten` directly in v4 returns 404. Querying `TypedDataSet` in v4 returns 404.

**Why it happens:**
The v4 architecture is fundamentally different: data is in "cell form" (long format), with one row per measure-region combination in `Observations`. To get neighborhood stats for a region, you must:
1. Fetch `WijkenEnBuurtenCodes` to map region name to code
2. Fetch `Observations` filtered by `WijkenEnBuurten eq 'WK036300'` and the measure codes you want
3. Join with `MeasureCodes` to get human-readable measure names

The existing codebase queries `TypedDataSet` (v3 entity) which will silently 404.

**How to avoid:**
For v4, the correct query pattern is:
```
GET /Observations?$filter=WijkenEnBuurten eq 'WK036300'&$select=Measure,Value,ValueAttribute
```
Then map `Measure` codes to field names using `MeasureCodes`. Use `$filter=ValueAttribute eq ''` to exclude missing/unreliable values (where `ValueAttribute` being empty means the value is reliable). Responses are paginated at 100,000 cells — for single-region queries this is not an issue.

**Warning signs:**
- Any URL containing `/TypedDataSet`
- Any URL containing `/WijkenEnBuurten` as a direct entity (not as a filter field)
- Not handling `@odata.nextLink` pagination

**Phase to address:** CBS integration phase (Phase 1 of milestone)

---

### Pitfall 8: Rechtspraak XML Returns Error Dict Instead of Raising

**What goes wrong:**
In `get_jurisprudence_document()`, when XML parsing fails the `ParseError` except block returns `{"ecli": ecli, "text": "XML Parsing Failed.", "error": str(e)}` instead of raising an exception. This leaks internal error details (exception string) to the API caller and causes the endpoint to return HTTP 200 with an error payload that the frontend cannot reliably detect as an error.

**Why it happens:**
Defensive coding that conflates "return gracefully" with "return error data as if it were success data." The endpoint checks `if not doc: raise 404` but a dict with an `error` key is truthy — so the 404 never fires and the frontend gets an HTTP 200 with `{"status": "success", "document": {"error": "..."}}`.

**How to avoid:**
Parsing failures should raise, not return:
```python
except ParseError as e:
    logger.error("Rechtspraak XML parse error for %s: %s", ecli, e)
    raise GovernmentAPIError("rechtspraak", f"XML parse error: {e}") from e
```
The endpoint's `except GovernmentAPIError` handler then returns HTTP 502 with a clean error message, and the frontend sees a non-200 response it can handle uniformly.

**Warning signs:**
- `return {"ecli": ..., "error": str(e)}` in an exception handler
- `except ParseError as e: return None` or returning sentinel values from exception handlers
- Endpoint returning HTTP 200 when underlying API call failed

**Phase to address:** Rechtspraak integration phase

---

### Pitfall 9: No ECLI Format Validation (URL Injection Risk)

**What goes wrong:**
The `get_jurisprudence_doc` endpoint receives `ecli` as a path parameter and passes it directly to `f"{RECHTSPRAAK_CONTENT_URL}?id={ecli}"` without validation. A valid ECLI has the form `ECLI:NL:RVS:2023:1234`. An attacker can inject arbitrary query parameters by passing `ECLI:NL:RVS:2023:1234&other=value` or path traversal patterns.

**Why it happens:**
FastAPI path parameters accept any string value. Without explicit ECLI format validation, any string reaches the downstream URL construction.

**How to avoid:**
Validate the ECLI format before use:
```python
import re
ECLI_PATTERN = re.compile(r'^ECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:\d+$')

def validate_ecli(ecli: str) -> str:
    if not ECLI_PATTERN.match(ecli):
        raise HTTPException(status_code=400, detail="Invalid ECLI format")
    return ecli
```
Use `urllib.parse.urlencode` or `httpx` params dict (not f-string URL construction) to pass ECLI as a query parameter, which handles encoding automatically.

**Warning signs:**
- `f"{URL}?id={ecli}"` without prior validation
- No regex or format check before using user-supplied identifiers in URLs
- Path parameter accepted as raw string without Pydantic constraint

**Phase to address:** Rechtspraak integration phase

---

### Pitfall 10: Rechtspraak Search API is NOT Full-Text Search

**What goes wrong:**
The Rechtspraak `data.rechtspraak.nl/uitspraken/zoeken` API is described as a "search API" but is actually primarily designed for range/filter queries (date ranges, court filters, legal domains). Free-text search via `searchterms=` parameter is extremely limited compared to what the web interface at rechtspraak.nl offers. Queries like "omgevingsvergunning Amsterdam" may return zero or near-zero results even though the web interface returns hundreds.

**Why it happens:**
The official API documentation describes the search endpoint as supporting `searchterms` parameter without clearly communicating that full-text indexing is sparse. Developers assume API parity with the website.

**How to avoid:**
Use structured filter parameters instead of free text: `type=Uitspraak`, `rechtsgebied=Bestuursrecht` (administrative law), `date` range parameters. Combine with gemeente name as a searchterm. Accept that coverage will be incomplete and design the UI to show "X results found, may not be exhaustive." The undocumented API at `uitspraken.rechtspraak.nl/api/zoek` offers better text search but has no official support guarantees — do not rely on it for production.

**Warning signs:**
- Expecting rich full-text search results comparable to the rechtspraak.nl website
- No fallback for zero-result searches
- Not using `rechtsgebied` or `type` parameters to narrow results to relevant domain (Bestuursrecht for omgevingsrecht)

**Phase to address:** Rechtspraak integration phase

---

### Pitfall 11: Rechtspraak XML Parsing — Invalid Data and Missing Bodies

**What goes wrong:**
The Rechtspraak data is described by its own documentation as having "no schema other than an incomplete PDF in natural language" with "many RDF fields being invalid." Specific issues: (1) some ECLIs appear in search results but their documents have no body (`<uitspraak>` element absent); (2) some URIs contain spaces and line feeds violating URI spec; (3) RDF namespace declarations are sometimes malformed; (4) nonsensical parameters like `date=2022-02-30` return non-XML instead of an error, causing XML parse exceptions.

**Why it happens:**
The dataset is generated from a legacy judicial system with inconsistent document formatting across different courts, years, and case types. No automated quality enforcement exists at the source.

**How to avoid:**
- Always check for the absence of `<uitspraak>` or `<conclusie>` nodes and return a structured "document not available" response rather than crashing
- Wrap all `ET.fromstring()` calls in try/except for both `ParseError` and `UnicodeDecodeError`
- Use `.itertext()` defensively — some nodes may have `None` text
- Normalize empty strings: `(elem.text or "").strip()`
- Log the ECLI identifier for any parsing failure to enable debugging
- Validate date parameters before sending to avoid malformed-parameter responses

**Warning signs:**
- `uitspraak_node.itertext()` without None guard on text elements
- Using `elem.text` directly without `or ""` fallback
- No check for empty `content_text` after itertext extraction
- "Content format not recognized or document empty" fallback returning this as a success response

**Phase to address:** Rechtspraak integration phase

---

### Pitfall 12: AI Legal Analysis — Hallucinated Case Citations

**What goes wrong:**
Claude (and all LLMs) can fabricate court ruling citations that do not exist. In a PropTech context, presenting a developer with a hallucinated precedent like "ECLI:NL:RVS:2022:4521 ruled that..." when that ECLI either does not exist or says something different is a serious trust and liability issue. Anthropic's own legal team discovered this problem in May 2025.

**Why it happens:**
LLMs cannot distinguish between "I know this ECLI exists" and "this ECLI pattern looks plausible." When asked to summarize legal precedents, the model may invent specific case references to make the analysis appear more authoritative.

**How to avoid:**
- Never ask Claude to generate ECLI identifiers or specific case references — only feed it actual ECLIs retrieved from Rechtspraak and ask it to summarize the content of those specific documents
- Prompt must explicitly state: "Do not invent or extrapolate case references not present in the documents provided"
- Store the Claude analysis result alongside the ECLIs used as input — this creates an audit trail
- Display the source ECLIs in the UI adjacent to the AI summary, enabling users to verify the underlying rulings
- Use temperature=0 or near-0 for legal analysis to minimize creative extrapolation

**Warning signs:**
- Prompting Claude to "find relevant precedents" without providing actual document text
- No ECLI source attribution alongside AI-generated summaries
- Not storing which documents were used as input for a given AI analysis

**Phase to address:** AI legal analysis phase

---

### Pitfall 13: AI Analysis on Oversized Rechtspraak Documents

**What goes wrong:**
Dutch court rulings in Bestuursrecht cases (administrative law, omgevingsrecht) can be extremely long — Raad van State rulings on complex omgevingsvergunning cases routinely exceed 20,000-50,000 words. Sending a full ruling to Claude without chunking or truncation can exceed context limits, cause extremely high latency (10-60+ seconds), and generate very high API costs per analysis.

**Why it happens:**
`"".join(uitspraak_node.itertext())` extracts the full text of the ruling with no length limit. A Raad van State ruling on a major development project could be 80,000+ tokens.

**How to avoid:**
- Implement a token budget: extract first N characters of ruling text (e.g., targeting 8,000-12,000 tokens for analysis)
- For very long rulings, extract: the header/parties section, the decisive considerations (`Overwegingen`), and the operative part (`Uitspraak`) — the middle sections are often procedural boilerplate
- Always run analysis as an ARQ background job, never as a synchronous HTTP response
- Store the AI analysis result in the database (JSONB on the project or in a new table) and cache it — never re-analyze the same ECLI twice
- Show "Gebaseerd op de eerste X woorden van de uitspraak" if truncation is applied

**Warning signs:**
- No length/token limit on extracted document text before sending to Claude
- Rechtspraak document fetch + Claude API call in a single synchronous request handler
- No caching of AI analysis results

**Phase to address:** AI legal analysis phase

---

### Pitfall 14: Missing Rate Limiting on CBS and Rechtspraak Clients

**What goes wrong:**
The existing codebase has a production-quality `APIRateLimiter` in `app.government_apis.rate_limiter` with semaphore + token bucket pattern. The new `CBSODataClient` and `RechtspraakClient` do not use it — they use a bare `asyncio.Semaphore(5)` in Rechtspraak and nothing at all in CBS. This means concurrent area scans (common in production) can hammer both APIs simultaneously without throttling.

Rechtspraak explicitly states: "maximum 10 requests/second." CBS is a government API shared by all Dutch developers — aggressive scraping is antisocial and will get the IP blocked.

**Why it happens:**
The `rate_limiter.py` module-level singletons (`bag_wfs_limiter`, `sru_limiter`, etc.) are the established pattern. New API clients need a corresponding entry added. It's easy to forget this step or use an ad-hoc semaphore instead.

**How to avoid:**
Add rate limiter singletons to `rate_limiter.py`:
```python
# CBS OData (public, polite limits)
cbs_odata_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)
# Rechtspraak (10 req/s hard limit)
rechtspraak_limiter = APIRateLimiter(max_concurrent=8, max_per_hour=3000)
```
Replace the bare `asyncio.Semaphore` in `RechtspraakClient` with the proper `APIRateLimiter`. Remove the module-level `api_semaphore = asyncio.Semaphore(5)` from `rechtspraak.py`.

**Warning signs:**
- `asyncio.Semaphore` directly in an API client module (not using `APIRateLimiter`)
- No entry in `rate_limiter.py` for a new API
- No `async with limiter:` wrapper in API client methods
- No timeout on httpx requests (both CBS and Rechtspraak need explicit timeouts)

**Phase to address:** Both CBS and Rechtspraak integration phases

---

### Pitfall 15: No HTTP Timeouts on CBS Client

**What goes wrong:**
The `CBSODataClient` makes HTTP requests with no timeout set. CBS StatLine is a Dutch government API that can be slow under load (government servers, not CDN-backed). A single hung request blocks the ARQ worker slot indefinitely, preventing other jobs from running. The CBS lookup is called during area scan jobs, so a hung CBS request freezes the entire scan.

**Why it happens:**
httpx requests without explicit timeout have no timeout by default when using a bare `client.get()` call. The existing pattern in other API clients uses explicit timeouts (e.g., Rechtspraak uses `timeout=15.0`). CBS client was written without following this pattern.

**How to avoid:**
Add timeouts to all CBS requests: `await client.get(url, headers=self._headers, params=params, timeout=10.0)`. Use `retry_with_backoff()` from `app.government_apis.base` with `retry_on_errors=True` for network resilience. CBS failure should be non-fatal for the area scan — log the warning and continue with `neighborhood_metrics=None`.

**Warning signs:**
- `await client.get(url, headers=..., params=...)` without `timeout=` argument
- No error handling that allows the area scan to continue when CBS fails
- CBS fetch not wrapped in try/except

**Phase to address:** CBS integration phase (Phase 1 of milestone)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode CBS dataset ID as class constant | No config management needed | Serves stale data annually, requires code deploy to update | Never — put in settings with documented update procedure |
| Return error dict from XML parse failures | Avoids exception handling in caller | Frontend gets HTTP 200 with error payload, trust violation | Never in production |
| Use bare `asyncio.Semaphore` instead of `APIRateLimiter` | Faster to write | No time-based throttling, inconsistent with codebase pattern | Never — takes 5 minutes to add a proper limiter |
| Sync HTTP call in area scan job for CBS | Simpler control flow | Hung request blocks entire ARQ worker slot | Never — use timeout + non-fatal error handling |
| No ECLI validation in path parameter | Less code | URL injection vector, leaks internal URL structure | Never |
| Send full ruling text to Claude without chunking | Simpler prompt | Unpredictable latency, high cost, potential context overflow | MVP only with explicit length guard and user-facing disclaimer |
| Cache AI analysis in memory only | Simpler state | Re-runs cost money on every page load | Never — persist in DB from day one |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| CBS OData v4 | Use v3 URL (`opendata.cbs.nl`) | Use `datasets.cbs.nl/odata/v1/CBS/` |
| CBS OData v4 | Query `TypedDataSet` entity | Query `Observations` entity with `WijkenEnBuurtenCodes` lookup |
| CBS OData v4 | Use `substringof()` filter | Use `eq` with known codes, or `contains()` for v4 text search |
| CBS OData v4 | Look up wijk by name only | Filter by gemeentecode prefix: `startswith(Identifier, 'WK{code}')` |
| CBS OData v4 | Hardcode dataset ID | Store in config, note new annual release cycle |
| Rechtspraak | Pass ECLI directly in URL f-string | Use httpx `params={"id": ecli}` with ECLI validation |
| Rechtspraak | Expect full-text search | Use structured filters (rechtsgebied, type, date range) |
| Rechtspraak | Parse XML without namespace handling | Use `elem.tag.split('}', 1)[-1]` for local name extraction |
| Rechtspraak | Trust all search result ECLIs have document bodies | Check for `<uitspraak>` presence before extraction |
| Claude legal analysis | Ask Claude to find or invent cases | Only feed Claude actual retrieved Rechtspraak document text |
| Claude legal analysis | Run synchronously in request handler | Always run as ARQ background job, poll for results |
| All new APIs | Skip adding to `rate_limiter.py` | Every new API client needs a registered `APIRateLimiter` singleton |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| CBS fetch inside ARQ area scan job with no timeout | Worker hangs on CBS call, scan never completes | Explicit timeout=10s, CBS failure is non-fatal | First slow CBS response (~day 1 of production use) |
| Rechtspraak document fetch + Claude analysis per ruling, synchronously | HTTP requests time out in UI (> 30s) | ARQ background job for analysis; frontend polls | Immediately on first real-world ruling (often 20+ KB text) |
| No CBS `WijkenEnBuurtenCodes` caching | CBS API called on every area scan | Cache the codes list in Redis/DB; rarely changes (annual) | At scale with multiple concurrent scans |
| `@odata.nextLink` pagination ignored | Partial data silently returned as complete | Implement nextLink follow-through for large dimension fetches | Larger gemeenten with many wijken |
| Fetching full `Observations` without measure filter | Returns all ~140 measures per region unnecessarily | Always `$select=Measure,Value` with `$filter` on specific measures | With many concurrent area scans |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No ECLI format validation | URL parameter injection; malicious redirect to attacker-controlled URL via crafted ECLI | Validate against `^ECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:\d+$` before any URL construction |
| Returning exception detail strings in API responses | Leaks internal architecture (module names, stack traces) | All exception handlers must return generic messages; log details server-side only |
| AI analysis stored without organization_id scoping | Cross-tenant AI result access | Any new table storing AI analysis must follow TenantMixin pattern (organization_id NOT NULL, indexed) |
| Caching Rechtspraak documents at app level without expiry | Old/updated/withdrawn rulings served forever | Set TTL on cached documents; Rechtspraak can update pseudonymization |
| Unvalidated `query` parameter passed to Rechtspraak search | Potential for search query injection (low risk but non-zero) | Sanitize/limit query string length; Rechtspraak URL-encodes server-side |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| AI legal summary with no source attribution | Developer cannot verify claims; trust erodes on first wrong summary | Always show the ECLIs used as input alongside the AI summary |
| Showing "0 results" from Rechtspraak without explanation | User thinks there are no relevant cases when the search API is just limited | Show "Beperkte zoekresultaten — de API ondersteunt geen volledige tekstzoekfunctie. Probeer rechtspraak.nl voor uitgebreidere resultaten." |
| CBS metrics shown without peiljaar | User does not know if they are seeing 2020 or 2024 data | Always display "Bron: CBS StatLine, peiljaar [year]" |
| Long-running AI analysis with no progress indication | User thinks the button is broken; clicks it again | ARQ job + polling with "Analyse wordt gegenereerd..." skeleton |
| Displaying raw CBS measure codes like "GemiddeldeWOZWaarde_35" | Confusing to non-technical users | Map to human-readable NL labels in a display mapping constant |

---

## "Looks Done But Isn't" Checklist

- [ ] **CBS client URL**: Uses `datasets.cbs.nl/odata/v1/CBS/` (not `opendata.cbs.nl`) — verify by checking `CBSODataClient.BASE_URL`
- [ ] **CBS entity path**: Queries `Observations` and `WijkenEnBuurtenCodes` (not `TypedDataSet`, not `WijkenEnBuurten` as entity) — grep for these strings
- [ ] **CBS filter syntax**: Uses `eq` and `contains()` (not `substringof`) — grep for `substringof` (should return zero results)
- [ ] **CBS wijk lookup**: Filters candidates by gemeentecode prefix `startswith(Identifier, 'WK{gemeente_code}')` — not just by name
- [ ] **CBS dataset ID**: In settings/config, not hardcoded as class constant — check `settings.CBS_DATASET_ID` exists
- [ ] **Rate limiters registered**: `cbs_odata_limiter` and `rechtspraak_limiter` present in `rate_limiter.py`
- [ ] **Rate limiters used**: Both clients use `async with limiter:` (not bare `asyncio.Semaphore`) — grep for `api_semaphore` in client files
- [ ] **HTTP timeouts**: All CBS and Rechtspraak requests have `timeout=` argument
- [ ] **ECLI validation**: `validate_ecli()` called before any URL construction in endpoint
- [ ] **Exception class signatures**: All `raise` statements pass `source` as first arg (`APITimeoutError("rechtspraak", ...)`)
- [ ] **Import paths**: No imports from `app.government_apis.exceptions` or `app.api.deps` — these do not exist
- [ ] **AI input only from retrieved docs**: Claude prompt does not ask it to find or invent cases; only summarize provided text
- [ ] **AI analysis cached**: Result stored in DB (JSONB field or new table) with organization_id and source ECLI list
- [ ] **Peiljaar surfaced**: `neighborhood_metrics` JSONB contains `peiljaar` field; displayed in frontend
- [ ] **XML parse errors raise**: No `return {"error": ...}` pattern in exception handlers — all errors raise

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong CBS URL/entity (v3 vs v4) | MEDIUM | Rewrite CBSODataClient: update BASE_URL, switch TypedDataSet to Observations, update response mapper; 2-4 hours |
| Stale hardcoded dataset ID | LOW | Add CBS_DATASET_ID to settings; update default value; no DB migration needed |
| Wrong exception constructor signatures | LOW | Grep for `APITimeoutError(f"` and `GovernmentAPIError(f"` patterns; fix signatures; 30 minutes |
| Missing rate limiters | LOW | Add two entries to rate_limiter.py; update both client classes to use them; 1 hour |
| ECLI validation missing | LOW | Add regex validator; update endpoint signature; write test; 1 hour |
| AI hallucinated citations in stored data | HIGH | Delete cached AI analyses; re-generate with corrected prompts; communicate to users; 1-2 days |
| XML error dict leaking | LOW | Change except blocks to raise; update endpoint error handling; 1 hour |
| Ambiguous wijk lookup poisoning scan data | MEDIUM | Fix lookup to use gemeentecode prefix; backfill neighborhood_metrics for existing scans; 4-8 hours |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Wrong CBS API URL (v3 vs v4) | CBS OData integration | Integration test: fetch `WijkenEnBuurtenCodes` for GM0363, verify returns data |
| OData v3 filter syntax (substringof) | CBS OData integration | `grep -r substringof backend/` must return zero results |
| Non-existent module imports | All phases | `python -c "from app.government_apis.cbs_odata import cbs_client"` must succeed |
| Wrong exception constructor signature | All phases | mypy strict type check must pass |
| Ambiguous wijk name lookup | CBS OData integration | Unit test: lookup "Centrum" for GM0363 returns WK036300, not another gemeente's Centrum |
| Hardcoded dataset ID | CBS OData integration | Assert no `DATASET_ID = "8...NED"` class constant; setting in `settings.py` |
| CBS entity structure (Observations vs TypedDataSet) | CBS OData integration | Integration test: verify `Observations` endpoint returns `Value` column |
| XML error dict leaking | Rechtspraak integration | Unit test: `ParseError` in `get_jurisprudence_document` raises `GovernmentAPIError`, does not return dict |
| ECLI validation missing | Rechtspraak integration | Test: `GET /jurisprudence/doc/INVALID` returns 400, not 502 |
| Rechtspraak not full-text search | Rechtspraak integration | Manual test: search "omgevingsvergunning Venlo" — handle zero results gracefully |
| Rechtspraak XML quirks | Rechtspraak integration | Test with real ECLIs that have no body; test with ECLIs from different courts |
| AI hallucinated citations | AI analysis phase | Prompt audit: verify prompt only asks Claude to summarize provided text, not find cases |
| AI analysis without ARQ | AI analysis phase | Verify analysis endpoint returns 202 Accepted + job_id, not 200 with content |
| Missing rate limiters | CBS + Rechtspraak phases | Assert `rate_limiter.py` contains `cbs_odata_limiter` and `rechtspraak_limiter` entries |
| No HTTP timeouts | CBS + Rechtspraak phases | Code review: no `client.get()` call without `timeout=` argument |

---

## Sources

- Failed first attempt code in `backend/app/government_apis/cbs_odata.py` and `backend/app/government_apis/rechtspraak.py` — direct analysis of what went wrong
- CBS OData v4 official documentation: [Snelstartgids OData v4](https://www.cbs.nl/nl-nl/onze-diensten/open-data/statline-als-open-data/snelstartgids-odata-v4)
- CBS OData v4 filters: [Filters OData v4](https://www.cbs.nl/nl-nl/onze-diensten/open-data/statline-als-open-data/filters-odata-v4)
- CBS v3 to v4 migration guide: [Handleiding overstap OData v3 naar v4](https://www.cbs.nl/-/media/statline/documenten/odata4-overstappen-odata3.pdf)
- CBS dataset series: [Kerncijfers wijken en buurten 2004-2025](https://www.cbs.nl/nl-nl/reeksen/publicatie/kerncijfers-wijken-en-buurten) — confirms annual new dataset IDs (2022=85318NED, 2023=85618NED, 2024=85984NED, 2025=86165NED)
- CBS OData v4 dataset endpoint: `https://datasets.cbs.nl/odata/v1/CBS/85984NED` — entity sets confirmed via direct fetch
- Rechtspraak Open Data: [Open Data van de Rechtspraak](https://www.rechtspraak.nl/Uitspraken/Paginas/Open-Data.aspx) — rate limit 10 req/s confirmed
- Rechtspraak API quirks: [wetsuite.datacollect.rechtspraaknl](https://wetsuite.knobs-dials.com/apidocs/wetsuite.datacollect.rechtspraaknl.html) — invalid XML, missing bodies, search limitations
- AI legal hallucination: multiple sources confirm LLM citation hallucination is a real risk; Anthropic's own legal team cited hallucinated citations in May 2025 per [Terms.Law analysis](https://terms.law/2025/03/02/why-lawyers-havent-embraced-ai-yet-evidence-from-four-million-claude-conversations/)
- Existing codebase patterns: `app/government_apis/base.py`, `app/government_apis/rate_limiter.py`

---

*Pitfalls research for: CBS OData v4 + Rechtspraak API + AI legal analysis integration into Propdex*
*Researched: 2026-03-06*
