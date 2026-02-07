---
phase: 02-core-data-pipeline
plan: 02
subsystem: api
tags: [pdok, bag, kadaster, address, pydantic, validation, caching]
requires:
  - phase: 02-core-data-pipeline
    plan: 01
    provides: Shared httpx AsyncClient, cache manager, CachedAPIResponse model
provides:
  - PDOK Locatieserver client (suggest/lookup)
  - BAG API client (address/building/pand lookups)
  - Address resolver service with per-call caching
  - Dutch postcode validation schemas
affects: [02-03, 03-zoning-monument]
tech-stack:
  added: []
  patterns: [Government API client with shared httpx, BAG hierarchy chaining, per-call caching]
key-files:
  created:
    - backend/app/government_apis/base.py
    - backend/app/government_apis/pdok_locatieserver.py
    - backend/app/government_apis/bag_api.py
    - backend/app/schemas/address.py
    - backend/app/services/address_resolver.py
  modified: []
key-decisions:
  - id: 24
    decision: "API clients receive httpx.AsyncClient as parameter"
    rationale: "Ensures connection pooling works correctly; clients don't create their own httpx instances"
  - id: 25
    decision: "BAG API calls cached individually (not aggregated)"
    rationale: "Verblijfsobjecten and panden can be shared across addresses; caching each API call separately enables cross-address reuse"
  - id: 26
    decision: "Graceful partial failure handling in address resolver"
    rationale: "Returns address even if building lookup fails; better UX than complete failure"
  - id: 27
    decision: "Dutch postcode normalized to '1234 AB' format"
    rationale: "Consistent canonical format for storage and API calls; accepts both '1234AB' and '1234 AB' as input"
patterns-established:
  - "API clients receive shared httpx client as parameter (NOT stored on self)"
  - "Each BAG API call cached individually for cross-address reuse"
  - "Pydantic field validators for domain-specific validation (Dutch postcodes)"
  - "Sequential BAG hierarchy chaining: address → verblijfsobject → pand"
duration: 2 minutes
completed: 2026-02-07
---

# Phase 02 Plan 02: Government API Clients Summary

**One-liner:** BAG and PDOK API clients with Dutch postcode validation, hierarchical address resolution, and per-call caching for cross-address reuse.

---

## What Was Built

### Government API Client Layer

**Base Error Handling (`government_apis/base.py`):**
- `GovernmentAPIError` base exception with `source`, `status_code`, `message` attributes
- Typed subclasses: `APINotFoundError` (404), `APIRateLimitError` (429), `APITimeoutError`
- `handle_api_response()` helper for consistent error handling across all API clients

**PDOK Locatieserver Client (`government_apis/pdok_locatieserver.py`):**
- `PDOKLocatieserver` class with methods:
  - `suggest(query, client, rows)` — address autocomplete with `fq=type:adres` filter
  - `lookup(object_id, client)` — full address details by PDOK ID
- No authentication required (free public API)
- Uses shared `httpx.AsyncClient` from `app.state.http_client`

**BAG API Client (`government_apis/bag_api.py`):**
- `BAGAPIClient` class with methods:
  - `get_address(postcode, huisnummer, client, huisletter?, toevoeging?)` — address lookup
  - `get_nummeraanduiding(id, client)` — address identifier details
  - `get_verblijfsobject(id, client)` — residential/commercial unit (oppervlakte, gebruiksdoel)
  - `get_pand(id, client)` — building (bouwjaar, status, geometry)
- X-Api-Key authentication with `settings.BAG_API_KEY`
- Accept-Crs: epsg:28992 (Dutch RD coordinate system)
- All methods log API calls at INFO level

### Address Schemas and Validation

**Request Schema (`schemas/address.py`):**
- `AddressInput` with fields:
  - `postcode` — validated and normalized to "1234 AB" format via `@field_validator`
  - `huisnummer` — positive integer
  - `huisletter` — optional house letter
  - `toevoeging` — optional house number addition
- Postcode validation: regex `^\d{4}\s?[A-Z]{2}$` after uppercasing
- Accepts both "1234AB" and "1234 AB", normalizes to "1234 AB"

**Response Schemas:**
- `BAGAddressResponse` — structured address data (nummeraanduiding_id, verblijfsobject_id, straat, postcode, woonplaats)
- `BuildingData` — building details (pand_id, bouwjaar, status, oppervlakte, gebruiksdoel, geometry)
- `AddressResolution` — complete resolution result (address, building, resolved_at, source)

### Address Resolver Service

**Service (`services/address_resolver.py`):**
- `resolve_address(input, client, organization_id, session)` function
- Chains BAG API calls sequentially:
  1. Get address data (postcode + huisnummer → nummeraanduiding + verblijfsobject ID)
  2. Get verblijfsobject data (oppervlakte, gebruiksdoel, pand references)
  3. Get pand data (bouwjaar, status, geometry)
- **Per-call caching:** Each API call cached separately with `cache_manager.get_cached_or_fetch()`
  - Cache keys: `bag:address:{postcode}:{huisnummer}`, `bag:verblijfsobject:{id}`, `bag:pand:{id}`
  - Enables cross-address reuse (e.g., multiple addresses in same building share cached pand data)
- **Graceful partial failure:** Returns address even if verblijfsobject or pand lookup fails
- Uses `datetime.utcnow().isoformat() + "Z"` for timestamps (naive UTC per Decision 13)

---

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Government API client layer (PDOK + BAG) | 09667c7 | government_apis/{base,pdok_locatieserver,bag_api}.py |
| 2 | Address schemas and resolver service | 5bb3131 | schemas/address.py, services/address_resolver.py |

---

## Decisions Made

### Decision 24: API clients receive httpx.AsyncClient as parameter
**Context:** Need to ensure connection pooling works correctly across all government API calls.

**Decision:** API clients receive shared `httpx.AsyncClient` from `app.state.http_client` as method parameter. Clients do NOT create or store their own httpx instances.

**Rationale:**
- Proper connection pooling (HTTP/2, keepalive)
- Consistent timeout and retry configuration
- Easier testing (mock the client)
- Follows FastAPI lifespan pattern from 02-01

**Impact:** All BAG and PDOK client methods have `client: httpx.AsyncClient` parameter.

### Decision 25: BAG API calls cached individually (not aggregated)
**Context:** Address resolution chains multiple BAG API calls (address → verblijfsobject → pand). Multiple addresses can share same verblijfsobject or pand.

**Decision:** Cache each BAG API call separately using distinct cache keys:
- `bag:address:{postcode}:{huisnummer}`
- `bag:verblijfsobject:{id}`
- `bag:pand:{id}`

**Rationale:**
- Verblijfsobjecten and panden are shared across addresses (e.g., apartment building)
- Caching at call level enables cross-address reuse
- More efficient than caching only the final aggregated result
- TTL applies uniformly (24h) to all BAG data

**Impact:** `resolve_address()` wraps each API call with `get_cached_or_fetch()`. Cache hit rate increases as more addresses are resolved.

### Decision 26: Graceful partial failure handling in address resolver
**Context:** BAG hierarchy chaining can fail at any step (verblijfsobject or pand lookup).

**Decision:** Return partial data on failure:
- If address lookup fails → raise `APINotFoundError` (critical failure)
- If verblijfsobject lookup fails → return address only, `building=None`
- If pand lookup fails → return address + partial building data (oppervlakte, gebruiksdoel)

**Rationale:**
- Better UX than complete failure on partial data unavailability
- Address data is most critical; building data is supplementary
- Allows system to function even with incomplete BAG data
- Logged as warnings for monitoring

**Impact:** All building data lookups wrapped in try/except. Partial failures logged but don't block resolution.

### Decision 27: Dutch postcode normalized to '1234 AB' format
**Context:** Dutch postcodes can be written as "1234AB" (no space) or "1234 AB" (with space). BAG API accepts both.

**Decision:** Accept both formats as input, normalize to "1234 AB" (with space) in `@field_validator`.

**Rationale:**
- Consistent canonical format for storage and display
- Improves readability ("1234 AB" easier to parse visually)
- Still compatible with BAG API (spaces removed in API calls)
- Validation regex accepts both formats

**Impact:** All postcode fields stored and returned in "1234 AB" format. BAG API client removes space before API calls.

---

## Patterns Established

### API Client Pattern
**Pattern:** Government API clients as stateless classes with methods receiving shared `httpx.AsyncClient`.

**Example:**
```python
class BAGAPIClient:
    async def get_address(self, postcode: str, huisnummer: int, client: AsyncClient):
        response = await client.get(url, headers=self._headers)
        return handle_api_response(response, source="bag")
```

**Benefits:**
- No state management in client classes
- Connection pooling via shared client
- Testable (mock client)
- Consistent error handling

### Per-Call Caching Pattern
**Pattern:** Cache individual API calls rather than aggregated results.

**Example:**
```python
# Cache each step separately
address_data = await get_cached_or_fetch("bag:address:1234AB:42", ...)
vbo_data = await get_cached_or_fetch("bag:verblijfsobject:0363...", ...)
pand_data = await get_cached_or_fetch("bag:pand:0363...", ...)
```

**Benefits:**
- Cross-address reuse (shared buildings)
- Granular cache invalidation
- Higher cache hit rate
- Reduces API calls to BAG

### Pydantic Field Validator Pattern
**Pattern:** Use `@field_validator` for domain-specific validation and normalization.

**Example:**
```python
@field_validator("postcode")
@classmethod
def validate_dutch_postcode(cls, value: str) -> str:
    match = re.match(r"^(\d{4})\s?([A-Z]{2})$", value.upper())
    if not match:
        raise ValueError("Invalid Dutch postcode format")
    return f"{match.group(1)} {match.group(2)}"
```

**Benefits:**
- Input validation at API boundary
- Automatic normalization
- Clear error messages
- Type-safe after validation

### Sequential BAG Hierarchy Chaining
**Pattern:** Chain BAG API calls sequentially to traverse hierarchy: address → verblijfsobject → pand.

**Example:**
```python
# Step 1: Address lookup
address_data = await get_address(postcode, huisnummer)
verblijfsobject_id = address_data["adresseerbaarObjectIdentificatie"]

# Step 2: Verblijfsobject lookup
vbo_data = await get_verblijfsobject(verblijfsobject_id)
pand_ids = vbo_data["_embedded"]["pandIdentificaties"]

# Step 3: Pand lookup
pand_data = await get_pand(pand_ids[0])
```

**Benefits:**
- Follows BAG data model (address → unit → building)
- Each step cached for reuse
- Graceful partial failures
- Clear data lineage

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Testing Notes

### Verification Steps Completed

1. **Import verification:** All modules importable without errors
2. **Postcode validation:** "1234ab" normalized to "1234 AB", "invalid" rejected with clear error
3. **API client methods:** All BAG and PDOK methods present with correct signatures
4. **Resolver import:** `resolve_address()` function importable
5. **Ruff check:** All code passes linting with no errors

### Manual Testing Required

**Before deploying to production:**

1. **BAG API authentication:**
   - Register at https://lvbag.github.io/BAG-API/
   - Set `BAG_API_KEY` in `backend/.env`
   - Test real address lookup: `resolve_address(AddressInput(postcode="1012JS", huisnummer=1), ...)`
   - Verify response includes building data (Dam 1, Amsterdam)

2. **PDOK Locatieserver:**
   - Test autocomplete: `pdok.suggest("Dam 1, Amsterdam", client)`
   - Verify returns suggestions with `type:adres` filter

3. **Cache behavior:**
   - Resolve same address twice, verify second call uses cache (is_cached=True)
   - Check database `cached_api_responses` table has entries
   - Verify TTL metadata (ttl_seconds=86400 for BAG)

4. **Error handling:**
   - Test non-existent postcode (should raise APINotFoundError)
   - Test with missing BAG_API_KEY (should raise authentication error)
   - Test invalid postcode format (should raise Pydantic validation error)

---

## Next Phase Readiness

### Ready for Next Plan (02-03: Kadaster API Client)

**Prerequisites met:**
- ✅ Shared httpx client infrastructure (02-01)
- ✅ Cache manager with TTL support (02-01)
- ✅ API client pattern established (02-02)
- ✅ Address resolution service working (02-02)

**Kadaster API integration can:**
- Use same `BAGAPIClient` pattern for Kadaster DKK API
- Share httpx client and cache infrastructure
- Reference `nummeraanduiding_id` from address resolution
- Follow per-call caching pattern

### Blockers

None.

### Concerns

**BAG API Key Required:**
- System cannot resolve addresses without valid `BAG_API_KEY`
- Registration at https://lvbag.github.io/BAG-API/ required
- Plan includes this as `user_setup` step

**Rate Limiting:**
- BAG API has rate limits (exact limits TBD)
- Current implementation has no retry logic
- May need to add exponential backoff in future (not in current plan)

### TODOs for Future Plans

- [ ] Add retry logic with exponential backoff for API calls (if BAG rate limiting becomes issue)
- [ ] Add metrics/logging for cache hit rate monitoring
- [ ] Consider batch address resolution endpoint (resolve multiple addresses in one request)
- [ ] Add geospatial queries (e.g., "find all addresses within 500m of point")

---

## Integration Points

### Upstream Dependencies
- `app.core.http_client.create_government_api_client()` — Shared httpx client factory (02-01)
- `app.services.cache_manager.get_cached_or_fetch()` — Cache with TTL (02-01)
- `app.core.config.settings.BAG_API_KEY` — API authentication (02-01)

### Downstream Consumers (Future)
- **02-03 (Kadaster API):** Will use address resolution to get nummeraanduiding_id for ownership lookups
- **03-xx (Property Intelligence API):** Will chain address resolution with zoning/monument data
- **Frontend:** Will call address resolution endpoint for property search

---

## Self-Check: PASSED

All created files verified:
- ✅ backend/app/government_apis/base.py
- ✅ backend/app/government_apis/pdok_locatieserver.py
- ✅ backend/app/government_apis/bag_api.py
- ✅ backend/app/schemas/address.py
- ✅ backend/app/services/address_resolver.py

All commits verified:
- ✅ 09667c7 (Task 1: PDOK and BAG API clients)
- ✅ 5bb3131 (Task 2: Address schemas and resolver service)
