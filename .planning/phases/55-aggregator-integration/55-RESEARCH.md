# Phase 55: Aggregator Integration - Research

**Researched:** 2026-02-24
**Domain:** Python async aggregation, asyncio.gather, Pydantic schema wiring, government API integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All implementation areas are delegated to Claude — phase is straightforward backend wiring of existing clients into established patterns.

**Degradation behavior:**
- When individual APIs fail or timeout, report still generates with available data
- Failed sections show appropriate status (unavailable/error) rather than silent omission
- Follows existing graceful degradation pattern from BRK (Phase 54)

**Completeness scoring:**
- Denominator updates from 6 to 9 to reflect new data sources
- Unconfigured services (e.g., BRK without PKIOverheid cert) don't penalize score
- Existing saved reports retain their original scores — no retroactive recalculation

**Monument enrichment flow:**
- Auto-fetch RCE detail for every detected monument — no gating
- Runs as part of the parallel gather alongside other new sources
- Graceful degradation if RCE API is slow or unavailable

**Parallel gathering structure:**
- Step 2a: existing parallel sources + new sources (EP-Online, WOZ, RCE detail)
- Step 2b: BRK after cadastral data available (established in Phase 54)
- Maximize concurrency via asyncio.gather

### Claude's Discretion

All implementation details delegated. Follow patterns established in Phase 54 (BRK wiring).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AGG-01 | property_aggregator restructured into Step 2a (existing) / Step 2b (BRK after cadastral) | Already implemented in Phase 54: Step 2b exists. Phase 55 adds new Step 2a sources. |
| AGG-02 | EP-Online, WOZ, and RCE detail fetched in parallel via asyncio.gather | Three client singletons exist (ep_online_client, woz_waardeloket_client, rce_linked_data_client). Add three new inner async functions to Step 2a gather. |
| AGG-03 | BRK ownership stripped from PropertyReportResponse before JSONB save in reports/service.py | Already implemented in Phase 54 (save_report + update_report_data both pop brk_ownership). No change needed — verify test coverage passes. |
| AGG-04 | Monument aggregator extended with two-step enrichment (PDOK spatial → RCE Linked Data) | monument_aggregator.fetch_monument_status() currently returns MonumentStatus. Extend to call rce_linked_data_client when a monument is detected (monument_nummer available). MonumentStatus.rce_detail field already defined in schema. |
</phase_requirements>

---

## Summary

Phase 55 is a pure backend wiring phase with no new schemas, no new files, and no new dependencies. All five clients (EP-Online, WOZ Waardeloket, RCE Linked Data, BRK Bevragen, RCE spatial monuments) were built in Phases 52-54. The task is to connect three new clients (EP-Online, WOZ, RCE detail) into the property aggregator's Step 2a `asyncio.gather` block, extend the monument aggregator with two-step enrichment, and update the completeness denominator from 6 to 9.

The Step 2a/Step 2b restructuring is already in place from Phase 54. The aggregator currently runs three parallel tasks (cadastral parcels, zoning, monuments) in Step 2a, then BRK sequentially in Step 2b. Phase 55 adds three more parallel tasks to Step 2a: `fetch_energy_label`, `fetch_woz_data`, and the monument enrichment is handled inside the monument aggregator itself.

The completeness scoring logic must be updated to count 9 sections total, but "unavailable" sections (unconfigured APIs returning None) must not count as fails — only sections that could have returned data but didn't. The existing pattern uses `if building: sections_available += 1` — the same `if value: sections_available += 1` pattern applies to the new sections, but the denominator must reflect the maximum achievable for a fully-configured system (9).

**Primary recommendation:** Wire the three new fetch functions directly into the existing `asyncio.gather` call in `aggregate_property_data()`, mirroring the existing fetch_cadastral_parcels/fetch_zoning/fetch_monuments pattern. Update the monument aggregator to call `rce_linked_data_client.get_detail_by_monument_number()` when `monument_nummer` is available. Update completeness denominator to 9.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| asyncio | stdlib | Parallel API fetching via gather | Already used throughout aggregator |
| httpx | ~0.27 | Async HTTP client shared across requests | Module-level singleton pattern |
| Pydantic v2 | ~2.x | Schema validation and serialization | Already `model_dump(mode='json')` everywhere |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| aiolimiter | ~1.x | Rate limiting via APIRateLimiter context managers | Already used by all three new clients |
| GovernmentAPIError | internal | Structured exception for API errors | Already used in all client three-state contracts |

### Alternatives Considered
None — all libraries are already in use. This phase introduces no new dependencies.

**Installation:**
```bash
# No new packages required
```

---

## Architecture Patterns

### Current Aggregator Structure (After Phase 54)

```
aggregate_property_data()
├── STEP 1 (sequential): resolve_address() — BAG lookup, must succeed
├── STEP 2a (parallel asyncio.gather):
│   ├── fetch_cadastral_parcels()   -> list[CadastralParcel]
│   ├── fetch_zoning()              -> ZoningData | None
│   └── fetch_monuments()           -> MonumentStatus | None
└── STEP 2b (sequential): fetch_brk_ownership(cadastral_parcels) -> BRKOwnership
└── STEP 3 (sequential): AI parsing trigger
```

### Target Aggregator Structure (Phase 55)

```
aggregate_property_data()
├── STEP 1 (sequential): resolve_address() — BAG lookup
├── STEP 2a (parallel asyncio.gather, 6 tasks):
│   ├── fetch_cadastral_parcels()   -> list[CadastralParcel]   [existing]
│   ├── fetch_zoning()              -> ZoningData | None        [existing]
│   ├── fetch_monuments()           -> MonumentStatus | None    [existing, now calls RCE detail internally]
│   ├── fetch_energy_label()        -> EnergyLabel | None       [NEW]
│   ├── fetch_woz_data()            -> WOZData | None           [NEW]
│   └── (monument enrichment handled inside fetch_monument_status())
└── STEP 2b (sequential): fetch_brk_ownership(cadastral_parcels) [existing, unchanged]
└── STEP 3 (sequential): AI parsing trigger [existing, unchanged]
```

### Pattern 1: Inner Async Function for Step 2a Tasks

All existing Step 2a tasks follow the same pattern — define a closure over outer-scope variables, catch all exceptions, append to `errors` list, return None on failure.

```python
# Source: existing property_aggregator.py fetch_monuments() pattern
async def fetch_energy_label() -> EnergyLabel | None:
    """Fetch EP-Online energy label if VBO ID available."""
    vbo_id = address.verblijfsobject_id
    if not vbo_id:
        return None
    cache_key = f"ep_online:label:{vbo_id}"
    try:
        cache_result = await get_cached_or_fetch(
            cache_key=cache_key,
            source="ep_online",
            organization_id=organization_id,
            fetch_fn=lambda: ep_online_client.get_by_vbo_id(vbo_id, client),
            session=session,
            force_refresh=force_refresh,
        )
        # ep_online_client.get_by_vbo_id returns EnergyLabel | None (not dict)
        # Cannot use get_cached_or_fetch directly — client returns Pydantic model
        # Must call client directly, handle caching manually (see Pitfall 1)
    except Exception as e:
        logger.warning(f"Failed to fetch energy label: {e}")
        errors.append(f"Energielabel niet beschikbaar: {str(e)}")
        return None
```

**CRITICAL NOTE ON EP-ONLINE AND WOZ:** The existing `get_cached_or_fetch` helper expects `fetch_fn` to return a `dict`. But `ep_online_client.get_by_vbo_id()` returns `EnergyLabel | None` and `woz_waardeloket_client.get_by_nummeraanduiding_id()` returns `WOZData | None`. Two approaches:

**Option A (Recommended):** Call clients directly (no cache layer in Phase 55) — EP-Online and WOZ have their own rate limiters and the cache TTL entries already exist in `CACHE_TTL`. Use `get_cached_or_fetch` with a lambda that calls the client and returns `model.model_dump()` (or `{}` for None), then reconstruct the Pydantic model from the cache result dict.

**Option B:** Call the clients directly without `get_cached_or_fetch` in Phase 55, accepting that the 30-day and 365-day TTLs aren't applied in this phase. This violates INF-03 which requires cache TTL entries — but INF-03 is Phase 52's requirement, not Phase 55's.

**Resolution:** Looking at the existing code, `get_cached_or_fetch` requires `fetch_fn: Callable[[], Awaitable[dict]]` — it returns `CacheResult.data: dict`. The correct approach is:

1. For EP-Online: wrap `ep_online_client.get_by_vbo_id(vbo_id, client)` in a lambda that calls `.model_dump()` or returns `{}` for None, then reconstruct `EnergyLabel.model_validate(cache_result.data)` if the dict is non-empty.
2. For WOZ: same pattern with `WOZData`.

However, since both clients return `None` to signal "not found/not configured", the fetch_fn wrapper must handle this:
```python
async def _ep_online_fetch() -> dict:
    label = await ep_online_client.get_by_vbo_id(vbo_id, client)
    return label.model_dump() if label is not None else {}
```
Then after `get_cached_or_fetch`:
```python
data = cache_result.data
energy_label = EnergyLabel.model_validate(data) if data else None
```

### Pattern 2: Monument Two-Step Enrichment

The `_fetch_rce` function in `monument_aggregator.py` currently returns a `MonumentSourceResult` with `monument_nummer` (from `data.get("rce_objrijksnr")`). After the parallel gather completes and a monument is confirmed, `fetch_monument_status` can call `rce_linked_data_client.get_detail_by_monument_number()`.

**Where to enrich:** Inside `fetch_monument_status()`, after consensus_status is determined. If `consensus_status in ("rijksmonument",)` and the RCE source result has a `monument_nummer`, call `rce_linked_data_client`. Store the result in `MonumentStatus.rce_detail`.

```python
# In monument_aggregator.py, after building monument_status
rce_detail = None
if consensus_status == "rijksmonument":
    # Find monument_nummer from RCE source result
    rce_source = next((s for s in sources if s.source == "RCE" and s.monument_nummer), None)
    if rce_source and rce_source.monument_nummer:
        try:
            rce_detail = await rce_linked_data_client.get_detail_by_monument_number(
                rce_source.monument_nummer, client
            )
        except GovernmentAPIError as e:
            logger.warning("RCE detail fetch failed: %s", e.message)
        except Exception as e:
            logger.warning("RCE detail fetch unexpected error: %s", str(e))

monument_status = MonumentStatus(
    sources=sources,
    has_conflict=has_conflict,
    conflict_note=conflict_note,
    consensus_status=consensus_status,
    restrictions_summary=restrictions_summary,
    rce_detail=rce_detail,  # NEW
)
```

**Note:** `fetch_monument_status` currently does NOT receive the `client` parameter — it only accepts `x, y, pand_id, verblijfsobject_id, client, organization_id, session, force_refresh`. It does receive `client` already. But `_fetch_rce` also receives `client`. The `fetch_monument_status` signature already passes `client: httpx.AsyncClient` to `_fetch_rce`. The RCE Linked Data client call can use the same `client` parameter.

**Cache for RCE detail:** The enrichment call should go through `get_cached_or_fetch` with source `"rce_detail"` (TTL: 30 days). The cache key should be `f"rce_detail:monument:{rijksmonumentnummer}"`.

### Pattern 3: Completeness Score Update

Current logic (denominator = 6):
```python
sections_available = 1  # Address always available
if building: sections_available += 1
if cadastral_parcels: sections_available += 1
if zoning_data: sections_available += 1
if monument_status: sections_available += 1
if ai_parsing_section and ai_parsing_section.status == "complete": sections_available += 1
total_sections = 6
```

Target logic (denominator = 9):
```python
sections_available = 1  # Address always available
if building: sections_available += 1
if cadastral_parcels: sections_available += 1
if zoning_data: sections_available += 1
if monument_status: sections_available += 1
if ai_parsing_section and ai_parsing_section.status == "complete": sections_available += 1
# New sections — only count if data was returned (None = unconfigured or not applicable)
if energy_label is not None: sections_available += 1
if woz_data is not None: sections_available += 1
if brk_ownership.status == "available": sections_available += 1
total_sections = 9
```

**Key constraint:** "Unconfigured services don't penalize score." The denominator is fixed at 9 regardless of configuration. An unconfigured EP-Online returns `None` (client not configured) and `None` does not increment `sections_available`. A property with no registered energy label returns `EnergyLabel(is_geregistreerd=False)` — this is a valid response and SHOULD count toward score (label was checked, result is "not registered"). A property with no WOZ record returns `None` from the client — this is also a valid "not applicable" result and arguably should or should not count. Based on user decision: "Unconfigured services don't penalize score" — `None` means unconfigured/not-applicable and does not increment. `EnergyLabel(is_geregistreerd=False)` is a non-None result and does increment.

### Pattern 4: asyncio.gather Result Processing

The current code processes 3 results from `asyncio.gather`. After Phase 55 it processes 5 results (cadastral, zoning, monuments, energy_label, woz_data). Follow exact same pattern:

```python
results = await asyncio.gather(
    fetch_cadastral_parcels(),
    fetch_zoning(),
    fetch_monuments(),
    fetch_energy_label(),   # NEW
    fetch_woz_data(),       # NEW
    return_exceptions=True,
)

# Process results
cadastral_result, zoning_result, monument_result, energy_label_result, woz_result = results

energy_label: EnergyLabel | None = None
if isinstance(energy_label_result, Exception):
    logger.error(f"Energy label fetch failed: {energy_label_result}")
    errors.append(f"Energielabel fetch failed: {str(energy_label_result)}")
else:
    energy_label = energy_label_result

woz_data: WOZData | None = None
if isinstance(woz_result, Exception):
    logger.error(f"WOZ fetch failed: {woz_result}")
    errors.append(f"WOZ data fetch failed: {str(woz_result)}")
else:
    woz_data = woz_result
```

### Anti-Patterns to Avoid

- **Calling `get_cached_or_fetch` with a `fetch_fn` that returns a Pydantic model directly:** The helper expects `dict`. Wrap with `.model_dump()` and reconstruct after.
- **Gating RCE detail on something other than `monument_nummer` being available:** Enrich for all detected monuments. No gating beyond "was a monument found?"
- **Changing BRK strip-before-save in reports/service.py:** AGG-03 says "verify it's there" — Phase 54 already implemented this. No new code needed.
- **Adding a new `never_cache` check in the save layer:** The `pop('brk_ownership', None)` in `save_report` and `update_report_data` already covers this. Do not generalize to other fields.
- **Using `asyncio.gather` for monument RCE detail enrichment:** The two-step enrichment runs sequentially inside `fetch_monument_status()` after the parallel spatial check. There is no second outer gather.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom semaphore logic | `ep_online_limiter`, `woz_waardeloket_limiter`, `rce_detail_limiter` | Already defined in `rate_limiter.py`, already used by all three clients |
| Caching | Custom dict/Redis cache | `get_cached_or_fetch()` from `cache_manager` | TTL-based upsert already handles all three new sources (ep_online, woz, rce_detail in CACHE_TTL) |
| Error handling | Custom try/except hierarchies | `GovernmentAPIError` three-state pattern | Already established; each client raises GovernmentAPIError on error, returns None when unconfigured |
| Model validation | Manual dict traversal | `EnergyLabel.model_validate(data)`, `WOZData.model_validate(data)` | Pydantic v2 model_validate provides typed access |

**Key insight:** Every infrastructure piece needed for Phase 55 was built in Phases 52-54. Phase 55 is purely wiring.

---

## Common Pitfalls

### Pitfall 1: `get_cached_or_fetch` fetch_fn Must Return `dict`
**What goes wrong:** `ep_online_client.get_by_vbo_id()` returns `EnergyLabel | None`, not `dict`. Passing it directly as `fetch_fn` fails at type level and causes runtime error when the cache manager calls `fresh_data = await fetch_fn()` and then stores `response_data=fresh_data` in the JSONB column — which expects a dict.
**Why it happens:** The cache manager was designed around dict-returning fetch functions (all prior clients returned raw JSON dicts). The new Phase 52 clients return Pydantic models.
**How to avoid:** Wrap in a lambda that calls `.model_dump()` for non-None results and returns `{}` for None. Reconstruct the Pydantic model from the cache result dict.
**Warning signs:** `ValidationError` or `AttributeError` on `CachedAPIResponse.response_data = EnergyLabel(...)`.

### Pitfall 2: `monument_nummer` Field Type is `str | None`
**What goes wrong:** `MonumentSourceResult.monument_nummer` is populated from `data.get("rce_objrijksnr")`, which is an integer in the PDOK/RCE Solr response. The RCE Linked Data client's `get_detail_by_monument_number` takes a `str`. If the Solr response returns an integer (e.g., `12340`), the conversion must be explicit.
**Why it happens:** `rce_objrijksnr` is stored as numeric in PDOK's Solr index; Python's `dict.get()` preserves the original type.
**How to avoid:** When extracting the monument number for the RCE detail call, always convert to `str`: `str(rce_source.monument_nummer)`.
**Warning signs:** RCE Linked Data API returning 404 for what appears to be a valid monument number.

### Pitfall 3: `verblijfsobject_id` Can Be `None`
**What goes wrong:** `BAGAddressResponse.verblijfsobject_id: str | None`. EP-Online requires a VBO ID. If `verblijfsobject_id` is None, the energy label fetch must be skipped, not error.
**Why it happens:** Some BAG nummeraanduidingen (e.g., garages, car parks, industrial buildings without registered units) don't have a verblijfsobject.
**How to avoid:** Check `address.verblijfsobject_id` before attempting EP-Online call; return `None` immediately if not available (same pattern as `if not coordinates: return None` in `fetch_cadastral_parcels`).
**Warning signs:** `ep_online_client.get_by_vbo_id(None, client)` being called — the client would construct URL with `None`, triggering a bad API call.

### Pitfall 4: `nummeraanduiding_id` for WOZ (Not `verblijfsobject_id`)
**What goes wrong:** WOZ Waardeloket requires `nummeraanduiding_id`, NOT `verblijfsobject_id`. These are different BAG identifiers. Using the wrong ID results in 404 responses that look like "no WOZ record" but are actually wrong-ID errors.
**Why it happens:** Easy to confuse since both are on `BAGAddressResponse`. EP-Online uses VBO ID; WOZ uses nummeraanduiding ID.
**How to avoid:** Use `address.nummeraanduiding_id` for WOZ (always present on `BAGAddressResponse`, no None check needed). Use `address.verblijfsobject_id` for EP-Online (check for None).
**Warning signs:** WOZ returning None for all addresses during testing — check which ID field is being passed.

### Pitfall 5: RCE Detail Must Go Through `rce_detail_limiter`
**What goes wrong:** `rce_linked_data_client.get_detail_by_monument_number()` already uses `rce_detail_limiter` internally (the `async with rce_detail_limiter:` is inside `get_detail_by_monument_number`). Do NOT add another rate limiter in the monument aggregator — double-limiting will cause a deadlock.
**Why it happens:** The limiter is designed to be transparent to callers — callers should just call the method, the limiter is internal.
**How to avoid:** Call `rce_linked_data_client.get_detail_by_monument_number(...)` directly. Do not wrap with any additional limiter.
**Warning signs:** Tests hanging indefinitely, or `asyncio.TimeoutError` in tests.

### Pitfall 6: Cache Key Collision Between `rce` (spatial) and `rce_detail` (linked data)
**What goes wrong:** Existing `_fetch_rce` in monument_aggregator uses cache key `f"rce:monument:{x}:{y}"` with source `"rce"`. The new RCE detail call should use source `"rce_detail"` with key `f"rce_detail:monument:{monument_nummer}"` — not `"rce"`. Using the wrong source key causes `CACHE_TTL["rce_detail"]` lookup to fail (KeyError).
**Why it happens:** Two different RCE calls with separate cache entries. Spatial lookup is keyed by coordinate; detail lookup is keyed by monument number.
**How to avoid:** Verify source string matches exactly what's in `CACHE_TTL` dict. Currently: `"rce"` (30d spatial) and `"rce_detail"` (30d detail).
**Warning signs:** `KeyError: 'rce'` or missing keys if the wrong source string is used.

### Pitfall 7: `PropertyReportResponse` Constructor Missing New Fields
**What goes wrong:** The `return PropertyReportResponse(...)` at the bottom of `aggregate_property_data()` currently doesn't pass `energy_label` or `woz_data`. These fields are already defined in the schema (`energy_label: EnergyLabel | None = Field(default=None, ...)` and `woz_data: WOZData | None = Field(default=None, ...)`). If not explicitly passed, they default to `None` — which is correct behavior if the fetch returned None, but incorrect if `energy_label` or `woz_data` were fetched successfully.
**Why it happens:** The return statement is built once at the end; it's easy to add new variables but forget to wire them into the constructor call.
**How to avoid:** After adding `energy_label` and `woz_data` variables, immediately update the `PropertyReportResponse(...)` constructor call to include `energy_label=energy_label, woz_data=woz_data`.

---

## Code Examples

Verified patterns from the existing codebase:

### Existing Inner Fetch Pattern (fetch_monuments in property_aggregator.py)
```python
async def fetch_monuments() -> MonumentStatus | None:
    """Fetch monument status if coordinates available."""
    if not coordinates:
        return None
    x, y = coordinates
    pand_id = building.pand_id if building else None
    vo_id = address.verblijfsobject_id
    try:
        return await fetch_monument_status(
            x=x, y=y, pand_id=pand_id, verblijfsobject_id=vo_id,
            client=client, organization_id=organization_id,
            session=session, force_refresh=force_refresh,
        )
    except Exception as e:
        logger.warning(f"Failed to fetch monument data: {e}")
        errors.append(f"Monument data niet beschikbaar: {str(e)}")
        return None
```

### Cache Wrapping for Pydantic-Returning Client
```python
async def fetch_energy_label() -> EnergyLabel | None:
    """Fetch EP-Online energy label if VBO ID available."""
    vbo_id = address.verblijfsobject_id
    if not vbo_id:
        return None
    cache_key = f"ep_online:label:{vbo_id}"
    try:
        async def _fetch() -> dict:
            label = await ep_online_client.get_by_vbo_id(vbo_id, client)
            return label.model_dump() if label is not None else {}

        cache_result = await get_cached_or_fetch(
            cache_key=cache_key,
            source="ep_online",
            organization_id=organization_id,
            fetch_fn=_fetch,
            session=session,
            force_refresh=force_refresh,
        )
        data = cache_result.data
        return EnergyLabel.model_validate(data) if data else None
    except Exception as e:
        logger.warning(f"Failed to fetch energy label: {e}")
        errors.append(f"Energielabel niet beschikbaar: {str(e)}")
        return None
```

### RCE Detail Enrichment Inside fetch_monument_status
```python
# After building sources list and consensus_status, before constructing MonumentStatus:
rce_detail = None
if consensus_status == "rijksmonument":
    rce_source = next(
        (s for s in sources if s.source == "RCE" and s.monument_nummer is not None), None
    )
    if rce_source:
        monument_nr_str = str(rce_source.monument_nummer)
        cache_key = f"rce_detail:monument:{monument_nr_str}"
        try:
            async def _fetch_detail() -> dict:
                detail = await rce_linked_data_client.get_detail_by_monument_number(
                    monument_nr_str, client
                )
                return detail.model_dump() if detail is not None else {}

            detail_cache = await get_cached_or_fetch(
                cache_key=cache_key,
                source="rce_detail",
                organization_id=organization_id,
                fetch_fn=_fetch_detail,
                session=session,
                force_refresh=force_refresh,
            )
            if detail_cache.data:
                rce_detail = RCEMonumentDetail.model_validate(detail_cache.data)
        except GovernmentAPIError as e:
            logger.warning("RCE detail fetch failed: %s", e.message)
        except Exception as e:
            logger.warning("RCE detail fetch unexpected error: %s", str(e))
```

### Updated Completeness Score (Denominator 9)
```python
# Sections: address(1) + building(0/1) + parcels(0/1) + zoning(0/1) + monuments(0/1)
#         + ai_parsing(0/1) + energy_label(0/1) + woz_data(0/1) + brk_ownership(0/1)
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
if energy_label is not None:
    sections_available += 1
if woz_data is not None:
    sections_available += 1
if brk_ownership.status == "available":
    sections_available += 1

total_sections = 9  # Updated from 6
completeness_score = sections_available / total_sections
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat boolean monument status | Three-source MonumentStatus with conflict detection | Phase 3 | Now enrichable with RCE detail |
| 3 parallel Step 2a tasks | 5 parallel Step 2a tasks | Phase 55 | EP-Online + WOZ added |
| Denominator 6 | Denominator 9 | Phase 55 | Scores drop slightly for unconfigured systems |
| No BRK in aggregator | BRK as Step 2b sequential | Phase 54 | Uses cadastral identificatie |
| No RCE detail | RCE detail as two-step enrichment | Phase 55 | Rich monument descriptions available |

---

## Open Questions

1. **Should `EnergyLabel(is_geregistreerd=False)` increment `sections_available`?**
   - What we know: An `is_geregistreerd=False` label means the property was checked and no label was found — a valid API response. The API call succeeded.
   - What's unclear: User decision says "unconfigured services don't penalize score" — but this is a configured service that returned a "not found" result, not an unconfigured service.
   - Recommendation: YES, increment — `is_geregistreerd=False` is a non-None result, meaning EP-Online was configured and responded. The check succeeded. This is consistent with existing pattern where `MonumentStatus` with `consensus_status="geen_monument"` still increments the count.

2. **Should `WOZData` with only `None` values increment `sections_available`?**
   - What we know: WOZ Waardeloket returns `None` from the client for 404 (no WOZ object). For a 200 response, it returns `WOZData` even if most fields are None (all LOW confidence).
   - Recommendation: `None` from client = property has no WOZ registration (doesn't increment). `WOZData(...)` from client = WOZ was fetched (increments). This matches `if woz_data is not None`.

3. **`fetch_monument_status` needs `session` and `organization_id` for RCE detail cache — are they available?**
   - What we know: `fetch_monument_status` signature is `(x, y, pand_id, verblijfsobject_id, client, organization_id, session, force_refresh)` — YES, all three parameters (`client`, `organization_id`, `session`) are already passed.
   - Resolution: No signature change needed. `rce_linked_data_client` and `get_cached_or_fetch` can be called directly.

4. **Is there a risk of the `get_cached_or_fetch` pattern with a nested async def lambda causing closure issues?**
   - What we know: Python closures in async inner functions can capture variables by reference. In the `fetch_energy_label` inner function, `vbo_id` is a local variable in the outer closure — it's safe since it's captured at definition time in the inner `_fetch()` function.
   - Recommendation: Define `_fetch` as a named inner async function (not lambda) for clarity; use a local variable `_vbo = vbo_id` to make closure explicit.

---

## Files to Modify

This phase modifies exactly 2 files:

| File | Change |
|------|--------|
| `backend/app/services/property_aggregator.py` | Add `fetch_energy_label()` and `fetch_woz_data()` inner functions; add to `asyncio.gather`; process 2 new results; update completeness denominator 6→9; add `energy_label=energy_label, woz_data=woz_data` to `PropertyReportResponse(...)` constructor; add imports for `ep_online_client`, `woz_waardeloket_client`, `EnergyLabel`, `WOZData` |
| `backend/app/services/monument_aggregator.py` | Add RCE detail two-step enrichment after consensus_status determination; pass `rce_detail` to `MonumentStatus(...)` constructor; add imports for `rce_linked_data_client`, `RCEMonumentDetail`, `get_cached_or_fetch` |

**AGG-03 check:** `reports/service.py` already has `report_data_json.pop("brk_ownership", None)` in both `save_report()` and `update_report_data()`. This was completed in Phase 54. Phase 55 only needs to verify these still pass — no code changes.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `backend/app/services/property_aggregator.py` (full file)
- Direct code inspection of `backend/app/services/monument_aggregator.py` (full file)
- Direct code inspection of `backend/app/government_apis/ep_online.py` (full file)
- Direct code inspection of `backend/app/government_apis/woz_waardeloket.py` (full file)
- Direct code inspection of `backend/app/government_apis/rce_linked_data.py` (full file)
- Direct code inspection of `backend/app/schemas/monument.py`, `property.py`, `energy_label.py`, `woz.py`, `brk_ownership.py`
- Direct code inspection of `backend/app/services/cache_manager.py` — `get_cached_or_fetch` signature
- Direct code inspection of `backend/app/core/config.py` — `CACHE_TTL` dict
- Direct code inspection of `backend/app/reports/service.py` — AGG-03 existing implementation
- Phase 54 summaries (54-01-SUMMARY.md, 54-02-SUMMARY.md) — confirmed BRK wiring complete
- REQUIREMENTS.md — AGG-01 through AGG-04 definitions
- STATE.md — accumulated context and decisions

### Secondary (MEDIUM confidence)
- `backend/app/government_apis/rate_limiter.py` — confirmed `ep_online_limiter`, `rce_detail_limiter`, `woz_waardeloket_limiter` all defined
- `backend/tests/integration/test_brk_wiring.py` — confirmed test pattern for aggregator integration tests

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in codebase, no new dependencies
- Architecture: HIGH — based on direct inspection of all relevant files, patterns are unambiguous
- Pitfalls: HIGH — derived from reading actual client implementations and existing patterns; cache dict requirement is directly verified from `get_cached_or_fetch` signature

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (30 days — codebase is under active development, re-verify if phases 52-54 are revised)
