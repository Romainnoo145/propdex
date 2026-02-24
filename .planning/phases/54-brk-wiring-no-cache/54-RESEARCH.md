# Phase 54: BRK Wiring & No-Cache Enforcement — Research

**Researched:** 2026-02-24
**Domain:** Python async aggregator wiring, Pydantic schema stripping, BRK mTLS client integration
**Confidence:** HIGH — all findings are from direct codebase inspection of files known to exist

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Degradation behavior**
- Return explicit unavailable status with structured response: `{ status: 'unavailable', reason: '...' }` — not null or omitted
- Distinguish between two failure states: `'unavailable'` (BRK not configured / no cert) vs `'error'` (cert exists but API call failed)
- BRK counts as missing in completeness score even when unconfigured — motivates setup
- Show admin-facing hint in unavailable state: indicate PKIOverheid certificate requirement so admins know what action to take

**No-cache enforcement**
- Never log BRK response payloads — only log request metadata (endpoint called, HTTP status code, latency)
- Add explicit `never_cache` marker on BRKOwnership schema — save layer actively checks and strips fields with this marker
- BRK data may appear in user-facing exports (PDFs) — the constraint is about server-side persistence, not user output

**BRK trigger and sequencing**
- Skip BRK silently when no perceel ID available from Step 2a (cadastral/PDOK) — report shows eigendom as unavailable with reason
- BRK runs as Step 2b, strictly after Step 2a completes (needs cadastral identificatie)
- Other enrichments (EP-Online, WOZ, RCE detail) run in parallel during Step 2a — BRK is the only sequential dependency
- Same timeout as other government APIs — no special treatment
- Fetch ownership for ALL matching percelen (not just primary) — important for apartment complexes and multi-perceel properties

**Report section structure**
- `brk_ownership` always present in API response with status field: `{ status: 'available'|'unavailable'|'error', data: [...]|null, reason?: '...', fetched_at?: datetime }`
- When viewing a saved/cached report (where BRK was stripped before DB save), re-fetch BRK data live — ensures "actueel opgevraagd" is always real-time
- `fetched_at` timestamp reflects exact moment BRK was queried, not when report page was loaded
- Ownership data structured as array (one entry per perceel) preserving full per-perceel detail

### Claude's Discretion
- Redis cache policy for BRK — Claude interprets Kadaster Tier 3 terms for short-lived cache layers
- Exact `never_cache` marker implementation (field on schema, decorator, or class attribute)
- Error message wording for different failure states

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BRK-01 | Report fetches ownership data from BRK Bevragen V2 (existing client, needs wiring) | BRKBevragenClient singleton exists at `brk_bevragen.py:215`. `get_eigendom()` accepts identificatie + httpx client. Aggregator must call it after Step 2a cadastral fetch. |
| BRK-04 | BRK data is NEVER cached or stored — stripped from report before DB save (Kadaster Tier 3) | `reports/service.py:save_report()` calls `validated_report.model_dump(mode="json")` before storing. Strip point is the `model_dump` call — exclude `brk_ownership` field OR null it before dumping. `never_cache` class-level marker needed on schema. |
| BRK-05 | Graceful degradation when BRK is unconfigured (PKIOverheid cert pending) | `brk_bevragen.py:86-94` already sets `self._configured = False` and logs warning when config is empty. Aggregator must detect `_configured=False` and produce structured `BRKOwnership(status='unavailable', ...)` without raising. |
</phase_requirements>

---

## Summary

Phase 54 is a backend-only wiring phase. The BRK Bevragen client (`brk_bevragen.py`) is fully implemented with mTLS, rate limiting, graceful degradation, and unit tests (Phase 53). What needs building in Phase 54 is the integration layer: (1) wiring the client into `property_aggregator.py` as Step 2b, (2) enforcing the never-cache constraint by stripping `brk_ownership` from the JSONB payload before DB save in `reports/service.py`, and (3) evolving `BRKOwnership` schema to the three-state structured response the frontend (Phase 56) will consume.

The no-cache enforcement is the highest-risk part of this phase. The save path in `reports/service.py` uses `validated_report.model_dump(mode="json")` and stores the entire dict. BRK data MUST be stripped at this point — never stored, never logged. The `never_cache` marker must cause the save layer to actively exclude the field, not silently allow it. The re-fetch-on-view requirement means the GET report endpoint must detect absence of `brk_ownership` in stored data and trigger a live BRK call when serving the report to the frontend.

The BRK integration follows the same async pattern as the other v7.0 API clients (EP-Online, WOZ) but with a critical difference: it is sequential (depends on cadastral identificatie from Step 2a) and never cached. The aggregator currently uses `asyncio.gather` for Step 2 parallelism; BRK must run after `gather` completes and must use the perceel identificatie from the cadastral result.

**Primary recommendation:** Evolve `BRKOwnership` schema to a three-state structured response, wire `fetch_brk_ownership()` in the aggregator as Step 2b, and implement the strip in `save_report()` plus the re-fetch detection in the GET report handler.

---

## Standard Stack

### Core (all already present — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| httpx | `>=0.27.0` | Async HTTP with mTLS (`verify=ssl_context`) | Already used; BRK client calls `brk_client.create_client()` to get mTLS-configured client |
| pydantic | via `fastapi[standard]` | Schema definition and `model_dump` | `BRKOwnership` is Pydantic — strip via `model_dump(exclude={"brk_ownership"})` or field exclusion |
| asyncio | stdlib | `asyncio.gather` for Step 2a parallel fetch | Property aggregator already uses gather |
| aiolimiter | `>=1.2.0` | Token bucket rate limiting | `brk_limiter` (2 concurrent, 200/hour) already declared in `rate_limiter.py:93` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ssl (stdlib) | — | mTLS context creation | Already handled in `_create_brk_ssl_context()` |
| datetime (stdlib) | — | `fetched_at` timestamp | Use `datetime.utcnow().isoformat() + "Z"` per project pattern |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Structure

The changes touch these existing files only — no new files needed:

```
backend/app/
├── schemas/brk_ownership.py      # Evolve to three-state structured response + never_cache marker
├── schemas/property.py           # BRKOwnershipSection replaces BRKOwnership | None (if schema renamed)
├── services/property_aggregator.py  # Add Step 2b: fetch_brk_ownership() after gather
├── reports/service.py            # Strip brk_ownership before JSONB save
├── reports/router.py             # GET /{report_id} re-fetch BRK when stored data lacks it
tests/
├── unit/test_brk_bevragen.py     # Already exists — no new file needed
├── integration/test_property_aggregator.py  # Add BRK wiring tests
```

### Pattern 1: Three-State BRK Schema

The existing `BRKOwnership` schema uses `is_beschikbaar: bool` and `niet_beschikbaar_reden`. The decision requires a `status` field with literal values `'available' | 'unavailable' | 'error'`. The schema needs to evolve:

```python
# app/schemas/brk_ownership.py — updated schema
from typing import Literal

class BRKOwnership(BaseModel):
    """CRITICAL: never_cache = True — strip from report before JSONB save.

    Kadaster Tier 3 terms prohibit caching or storing eigendomsdata.
    This field MUST be excluded from model_dump() before DB persist.
    """
    # Class-level never_cache marker — checked by save layer
    never_cache: ClassVar[bool] = True  # Claude's discretion: ClassVar on Pydantic model

    status: Literal["available", "unavailable", "error"] = Field(
        description="'available'=BRK data fetched; 'unavailable'=not configured/no cert; 'error'=cert present but API failed"
    )
    data: list[PerceelOwnership] | None = Field(
        default=None,
        description="Per-perceel ownership records (None when status != 'available')"
    )
    reason: str | None = Field(
        default=None,
        description="Dutch-language reason (populated when status='unavailable' or 'error')"
    )
    fetched_at: str | None = Field(
        default=None,
        description="ISO 8601 UTC timestamp of live BRK query"
    )
    admin_hint: str | None = Field(
        default=None,
        description="Admin-facing hint shown when status='unavailable'"
    )
```

Note: The existing `ZakelijkGerechtigde` and `BRKOwnership` will be refactored. The per-perceel array becomes `list[PerceelOwnership]` where each entry wraps `list[ZakelijkGerechtigde]` + perceel identificatie.

### Pattern 2: Step 2b Sequencing in Aggregator

The current aggregator structure:

```python
# STEP 1: resolve_address (sequential, must succeed)
# STEP 2 (parallel): get_cached_or_fetch (cadastral), fetch_zoning(), fetch_monuments()
results = await asyncio.gather(
    fetch_cadastral_parcels(),
    fetch_zoning(),
    fetch_monuments(),
    return_exceptions=True,
)
# STEP 3: AI parsing
```

BRK must be Step 2b — after gather, using cadastral results:

```python
# STEP 2a (parallel): cadastral, zoning, monuments, ep_online, woz (Phase 55 adds ep_online/woz)
results = await asyncio.gather(
    fetch_cadastral_parcels(),
    fetch_zoning(),
    fetch_monuments(),
    return_exceptions=True,
)
# Process cadastral result first
...

# STEP 2b (sequential): BRK — requires cadastral identificatie from Step 2a
brk_ownership = await fetch_brk_ownership(cadastral_parcels)
```

The `fetch_brk_ownership()` function signature:

```python
async def fetch_brk_ownership(
    cadastral_parcels: list[CadastralParcel],
) -> BRKOwnership:
    """Always returns BRKOwnership — never raises, never None."""
```

### Pattern 3: Never-Cache Enforcement — Strip in save_report()

The save path in `reports/service.py`:

```python
# Current (line 81):
report_data_json = validated_report.model_dump(mode="json")

# Required (Phase 54 change):
report_data_json = validated_report.model_dump(mode="json")
# Strip BRK data before JSONB persist (Kadaster Tier 3 never-store terms)
report_data_json.pop("brk_ownership", None)
# OR: report_data_json["brk_ownership"] = None  — preserves key but clears data
```

The decision specifies the `never_cache` marker on the schema class is what the save layer checks. Implementation options for Claude's discretion:

**Option A: `ClassVar[bool]` on schema** — Pydantic ignores ClassVar fields in serialization. The save layer uses `hasattr(PropertyReportResponse.model_fields["brk_ownership"].annotation, "never_cache")` or checks schema docstring.

**Option B: Explicit pop in `save_report()`** — Simpler and more direct. After `model_dump`, pop `brk_ownership` before store. The `never_cache` marker serves as documentation, and `save_report()` has explicit stripping logic.

**Recommendation: Option B** — explicit pop in `save_report()`. ClassVar-based runtime reflection is fragile (requires navigating Pydantic's type annotation chain). A comment referencing the marker is sufficient documentation; the pop is the enforceable constraint.

### Pattern 4: Re-Fetch on View in GET Report Handler

The decision: when serving a saved report (where BRK was stripped), detect absence and re-fetch live:

```python
# In reports/router.py GET /{report_id}
report = await service.get_report(...)
report_data = dict(report.report_data)  # copy of stored JSONB

# BRK was stripped before save — re-fetch live
if report_data.get("brk_ownership") is None:
    brk_section = await fetch_brk_ownership_for_report(report_data)
    report_data["brk_ownership"] = brk_section.model_dump(mode="json")

return ReportDetailResponse(..., report_data=report_data)
```

This re-fetch needs the perceel identificatie from `report_data["cadastral_parcels"]`. The stored `CadastralParcel` data will need to include `identificatie` (PDOK raw field `identificatie` from feature properties).

**Critical gap identified:** `CadastralParcel` schema currently does NOT store the PDOK `identificatie` field (only `kadastrale_aanduiding`, `perceelnummer`, `sectie`, `oppervlakte`, `geometry`). Phase 54 must add `identificatie: str | None` to `CadastralParcel` AND ensure the aggregator populates it from the PDOK feature properties.

The PDOK Cadastral OGC API feature structure: `feature["properties"]["identificatie"]` is the kadastraalOnroerendeZaakIdentificatie (format: `NL.IMKAD.KadastraalObject.XXXXXXXX`). The BRK client's `get_eigendom()` requires exactly this string. The aggregator parses features at `property_aggregator.py:168-189` — add `props.get("identificatie")` there.

### Anti-Patterns to Avoid

- **Log BRK response payload:** Never `logger.info(f"BRK response: {response_data}")` — log only `"BRK fetch: endpoint={url}, status={status_code}, latency={ms}ms"`.
- **Cache BRK data in Redis or cache_manager:** `get_cached_or_fetch()` must NEVER be called for BRK. The `CACHE_TTL` dict already omits `"brk"` — enforce this by not calling cache manager in the BRK fetch path.
- **Raise from `fetch_brk_ownership()`:** This function must always return `BRKOwnership` — catches all exceptions internally and returns `status="error"` or `status="unavailable"` appropriately.
- **Return `None` for `brk_ownership`:** The decision requires `brk_ownership` always present with a status. The existing `PropertyReportResponse.brk_ownership: BRKOwnership | None` field needs to change to `brk_ownership: BRKOwnership` (always present).
- **Block all parallel fetches waiting for BRK:** BRK is Step 2b (sequential after cadastral), but EP-Online, WOZ, and monument fetches in Step 2a can run in parallel. (Phase 55 handles EP-Online/WOZ wiring; Phase 54 focuses solely on BRK.)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| mTLS authentication | Custom SSL/cert loading | `_create_brk_ssl_context()` in `brk_bevragen.py` | Already implemented and tested |
| Rate limiting | Custom semaphore | `brk_limiter` (2 concurrent, 200/hour) already declared | Already integrated in `get_eigendom()` |
| Retry on 429 | Custom retry loop | `retry_with_backoff()` from `base.py` | Already handles 429-aware backoff |
| Error categorization | Custom exception hierarchy | `GovernmentAPIError`, `APINotFoundError` from `base.py` | Already used by BRK client |
| Three-state client degradation | Custom `_configured` check | Pattern already in `BRKBevragenClient.__init__` | `self._configured` already set in constructor |

---

## Common Pitfalls

### Pitfall 1: Storing BRK Data Due to Incomplete Strip

**What goes wrong:** BRK data is stripped from the top-level `brk_ownership` field but still stored if it appears nested (e.g., in errors list, section_sources, or if `brk_ownership` is included in `model_dump` before the strip).

**Why it happens:** `validated_report.model_dump(mode="json")` serializes all fields including `brk_ownership`. If the `pop()` call is missed or placed after the `session.add()` call, BRK data gets committed.

**How to avoid:** Strip immediately after `model_dump`, before any DB operation. Add assertion in tests: stored report_data must not contain non-None `brk_ownership` data.

**Warning signs:** `report.report_data["brk_ownership"]["data"]` is not None/empty after save.

### Pitfall 2: BRK Logging Leaking Eigendom Data

**What goes wrong:** `logger.info(f"BRK result: {brk_data}")` or `logger.debug(...)` logs the `data` field containing gerechtigden (rights holder info), violating the no-log-payload requirement.

**Why it happens:** Standard pattern is to log API responses for debugging. BRK is an exception — only request metadata is permitted.

**How to avoid:** Log only: endpoint path, HTTP status code, and latency. Never log `brk_data`, `response.json()`, or any field from BRK response body.

### Pitfall 3: Missing `identificatie` in CadastralParcel Breaks Re-Fetch

**What goes wrong:** The GET report handler tries to re-fetch BRK using `report_data["cadastral_parcels"][0]["identificatie"]` but the field is `None` for all parcels because the aggregator never populated it.

**Why it happens:** `CadastralParcel` schema doesn't currently have `identificatie` field. PDOK features DO contain it as `feature["properties"]["identificatie"]` but the aggregator doesn't extract it.

**How to avoid:** Phase 54 must (1) add `identificatie: str | None` to `CadastralParcel`, (2) populate it in the aggregator from `props.get("identificatie")`, and (3) ensure it is NOT stripped from report_data on save (only `brk_ownership` is stripped, not `cadastral_parcels`).

### Pitfall 4: BRK create_client() Returns a New Client Per-Call

**What goes wrong:** Calling `brk_client.create_client()` inside a loop (once per perceel) creates N independent mTLS clients, each requiring SSL handshake.

**Why it happens:** `create_client()` returns a new `httpx.AsyncClient` per call.

**How to avoid:** Create ONE client for the entire BRK fetch call using `async with brk_client.create_client() as client:` and pass it to all `get_eigendom()` calls.

### Pitfall 5: Re-Fetch on View Breaks for Unconfigured BRK

**What goes wrong:** The GET report handler detects `brk_ownership is None` in stored data and calls BRK re-fetch, but BRK is not configured — re-fetch returns `status="unavailable"`. This is correct behavior but must not raise.

**Why it happens:** The re-fetch path must handle the unavailable case gracefully, same as the aggregator path.

**How to avoid:** The `fetch_brk_ownership_for_report()` helper must handle `_configured=False` and return `BRKOwnership(status="unavailable", ...)` silently — same as aggregator.

### Pitfall 6: `BRKOwnership` Field `never_cache` With ClassVar vs Instance

**What goes wrong:** Using `never_cache: bool = True` as a Pydantic instance field causes the field to appear in `model_dump()` output and be serialized to JSON, polluting the response schema.

**Why it happens:** Standard Pydantic fields are serialized. `ClassVar` is excluded from Pydantic serialization.

**How to avoid:** If implementing as class-level marker, use `from typing import ClassVar` and declare `never_cache: ClassVar[bool] = True`. The save layer then reads `BRKOwnership.never_cache` (class attribute access). OR use Option B (explicit pop in save_report) which avoids the ClassVar complexity entirely.

---

## Code Examples

### Step 2b Wiring Pattern

```python
# In property_aggregator.py — after asyncio.gather completes

async def fetch_brk_ownership(
    cadastral_parcels: list[CadastralParcel],
) -> BRKOwnership:
    """Fetch BRK ownership for all matching percelen. Always returns, never raises."""
    from app.government_apis.brk_bevragen import brk_client
    from datetime import datetime

    # Check configuration before attempting fetch
    if not brk_client._configured:
        return BRKOwnership(
            status="unavailable",
            reason="BRK Bevragen niet geconfigureerd",
            admin_hint="Configureer PKIOverheid mTLS-certificaat (BRK_CLIENT_CERT_PATH, BRK_CLIENT_KEY_PATH, BRK_CA_BUNDLE_PATH) om eigendomsdata op te vragen.",
        )

    # No perceel identificatie — skip silently
    perceel_ids = [
        p.identificatie for p in cadastral_parcels
        if p.identificatie is not None
    ]
    if not perceel_ids:
        return BRKOwnership(
            status="unavailable",
            reason="Geen kadastraal perceel gevonden voor dit adres",
        )

    # Fetch ownership for ALL percelen
    fetched_at = datetime.utcnow().isoformat() + "Z"
    try:
        async with brk_client.create_client() as client:
            perceel_results = []
            for perceel_id in perceel_ids:
                # CRITICAL: log request metadata only — never log response payload
                logger.info(
                    "BRK fetch: endpoint=zakelijkegerechtigden, perceel=%s",
                    perceel_id,
                )
                raw = await brk_client.get_eigendom(perceel_id, client)
                perceel_results.append(_parse_perceel_ownership(raw, perceel_id))

        return BRKOwnership(
            status="available",
            data=perceel_results,
            fetched_at=fetched_at,
        )
    except GovernmentAPIError as e:
        logger.warning("BRK fetch failed: %s", e.message)
        return BRKOwnership(
            status="error",
            reason=f"BRK Bevragen fout: {e.message}",
        )
```

### Strip Pattern in save_report()

```python
# In reports/service.py — save_report()
report_data_json = validated_report.model_dump(mode="json")

# BRK eigendomsdata MUST be stripped before JSONB persist (Kadaster Tier 3 never-store terms).
# brk_ownership.never_cache = True — see app/schemas/brk_ownership.py
report_data_json.pop("brk_ownership", None)

report = SavedReport(
    ...
    report_data=report_data_json,
    ...
)
```

### Re-Fetch on View Pattern in GET Report

```python
# In reports/router.py — get_report()
report = await service.get_report(report_id=report_id, ...)
report_data = dict(report.report_data)

# BRK is stripped before save — re-fetch live for each view
# (Kadaster Tier 3: data must be "actueel opgevraagd")
if report_data.get("brk_ownership") is None:
    # Extract cadastral identificaties from stored parcel data
    stored_parcels = [
        CadastralParcel.model_validate(p)
        for p in report_data.get("cadastral_parcels", [])
    ]
    brk_section = await fetch_brk_ownership(stored_parcels)
    report_data["brk_ownership"] = brk_section.model_dump(mode="json")

return ReportDetailResponse(
    id=report.id,
    ...
    report_data=report_data,
)
```

### CadastralParcel Schema Addition

```python
# In app/schemas/property.py — CadastralParcel
class CadastralParcel(BaseModel):
    """Cadastral parcel data from PDOK Cadastral API."""

    identificatie: str | None = Field(
        default=None,
        description="PDOK/BRK kadastraalOnroerendeZaakIdentificatie (NL.IMKAD.KadastraalObject.XXXXXXXX) — used for BRK Bevragen V2 ownership lookup",
    )
    kadastrale_aanduiding: str | None = ...  # existing
    # ... rest unchanged
```

And in `property_aggregator.py` parcel parsing loop (line ~183):

```python
parcel = CadastralParcel(
    identificatie=props.get("identificatie"),   # ADD THIS
    kadastrale_aanduiding=kadastrale_aanduiding,
    perceelnummer=perceelnr_str,
    sectie=sectie,
    oppervlakte=props.get("kadastrale_grootte_waarde"),
    geometry=geometry,
)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `BRKOwnership(is_beschikbaar=False)` | `BRKOwnership(status='unavailable')` | Phase 54 | Better frontend consumption — explicit status literal |
| `brk_ownership: BRKOwnership | None` on `PropertyReportResponse` | `brk_ownership: BRKOwnership` (always present) | Phase 54 | Eliminates None checks in frontend; status field conveys availability |
| `CadastralParcel` without `identificatie` | `CadastralParcel` with `identificatie: str | None` | Phase 54 | Enables BRK lookup and re-fetch on view |

**Deprecated/outdated:**
- `BRKOwnership.is_beschikbaar`: Replaced by `status: Literal["available","unavailable","error"]`
- `BRKOwnership.niet_beschikbaar_reden`: Folded into `reason: str | None`
- `BRKOwnership.actueel_opgevraagd: str | None`: Renamed to `fetched_at: str | None`
- `BRKOwnership.gerechtigden: list[ZakelijkGerechtigde]`: Moves inside `PerceelOwnership` (per-perceel wrapper)

---

## Open Questions

1. **Redis short-lived cache for BRK (Claude's discretion)**
   - What we know: Kadaster Tier 3 terms prohibit caching/storing eigendomsdata. The CONTEXT.md notes "Redis cache policy for BRK — Claude interprets Kadaster Tier 3 terms for short-lived cache layers."
   - What's unclear: Whether a 30-second in-memory/Redis cache for the duration of a single request session would be permissible under Tier 3. The no-store constraint appears to be about DB persistence, not ephemeral request-scoped state.
   - Recommendation: Do NOT introduce any Redis caching for BRK in Phase 54. The re-fetch on view is already real-time. A 30-second cache adds complexity without meaningful benefit. This is also the safest interpretation of Tier 3 terms.

2. **`PerceelOwnership` wrapper naming**
   - What we know: CONTEXT.md says "Ownership data structured as array (one entry per perceel)."
   - What's unclear: Whether to use a new `PerceelOwnership` class or a dict structure.
   - Recommendation: Create `PerceelOwnership(BaseModel)` with `perceel_identificatie: str` + `gerechtigden: list[ZakelijkGerechtigde]` + `heeft_hypotheek: bool`. Clean typing, testable, serializable.

3. **`_configured` property access from aggregator**
   - What we know: `BRKBevragenClient._configured` is a private instance attribute (not a property). The aggregator must import `brk_client` (module singleton) and check `brk_client._configured`.
   - What's unclear: Whether to add a public `.is_configured()` method to `BRKBevragenClient` (like `EPOnlineClient._is_configured()`).
   - Recommendation: Add `@property def is_configured(self) -> bool: return self._configured` to `BRKBevragenClient`. Consistent with EPOnlineClient pattern. The aggregator uses `brk_client.is_configured` (public) instead of `brk_client._configured` (private).

4. **Whether `reports/router.py GET handler re-fetch` needs httpx client**
   - What we know: `brk_client.create_client()` creates its own httpx client internally with mTLS SSL context. The GET handler currently doesn't receive an httpx client.
   - What's unclear: The router has access to `request.app.state.http_client` (shared client) but BRK needs its own mTLS client.
   - Recommendation: `fetch_brk_ownership()` should call `brk_client.create_client()` internally (as shown in code example above), not accept an external client. This is already the BRK client design.

---

## Sources

### Primary (HIGH confidence)
- Direct inspection of `backend/app/government_apis/brk_bevragen.py` — client API, create_client(), get_eigendom(), _configured attribute
- Direct inspection of `backend/app/services/property_aggregator.py` — Step 1/2/3 structure, asyncio.gather pattern, parcel parsing loop
- Direct inspection of `backend/app/reports/service.py` — save_report(), model_dump(), strip point
- Direct inspection of `backend/app/reports/router.py` — GET /{report_id} handler structure
- Direct inspection of `backend/app/schemas/brk_ownership.py` — current BRKOwnership schema
- Direct inspection of `backend/app/schemas/property.py` — PropertyReportResponse, CadastralParcel (no identificatie field)
- Direct inspection of `backend/app/core/config.py` — CACHE_TTL (BRK intentionally absent), BRK_* settings
- Direct inspection of `backend/app/government_apis/rate_limiter.py` — brk_limiter (2/200) already declared
- Direct inspection of `backend/tests/unit/test_brk_bevragen.py` — existing test patterns

### Secondary (MEDIUM confidence)
- PDOK Cadastral OGC API feature property `"identificatie"` for kadastraalOnroerendeZaakIdentificatie — inferred from BRK client test using `"NL.IMKAD.KadastraalObject.12345"` format and PDOK OGC API documentation patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, no new dependencies
- Architecture: HIGH — patterns are directly derived from existing code in the repo
- Pitfalls: HIGH — identified from actual code paths, not speculation
- Schema evolution: HIGH — BRKOwnership content verified, gap in CadastralParcel identified

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable — pure internal code changes)
