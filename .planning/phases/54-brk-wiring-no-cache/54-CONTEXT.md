# Phase 54: BRK Wiring & No-Cache Enforcement - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the existing BRK Bevragen client into the property aggregator as Step 2b (sequential after cadastral data), enforce Kadaster Tier 3 never-cache/never-store constraint, strip BRK ownership from report before DB save, and provide graceful degradation when PKIOverheid certificate is not configured. This phase does NOT include frontend display (Phase 56) or aggregator restructuring (Phase 55) — it prepares the BRK wiring and enforcement layer.

</domain>

<decisions>
## Implementation Decisions

### Degradation behavior
- Return explicit unavailable status with structured response: `{ status: 'unavailable', reason: '...' }` — not null or omitted
- Distinguish between two failure states: `'unavailable'` (BRK not configured / no cert) vs `'error'` (cert exists but API call failed)
- BRK counts as missing in completeness score even when unconfigured — motivates setup
- Show admin-facing hint in unavailable state: indicate PKIOverheid certificate requirement so admins know what action to take

### No-cache enforcement
- Never log BRK response payloads — only log request metadata (endpoint called, HTTP status code, latency)
- Add explicit `never_cache` marker on BRKOwnership schema — save layer actively checks and strips fields with this marker
- BRK data may appear in user-facing exports (PDFs) — the constraint is about server-side persistence, not user output

### BRK trigger & sequencing
- Skip BRK silently when no perceel ID available from Step 2a (cadastral/PDOK) — report shows eigendom as unavailable with reason
- BRK runs as Step 2b, strictly after Step 2a completes (needs cadastral identificatie)
- Other enrichments (EP-Online, WOZ, RCE detail) run in parallel during Step 2a — BRK is the only sequential dependency
- Same timeout as other government APIs — no special treatment
- Fetch ownership for ALL matching percelen (not just primary) — important for apartment complexes and multi-perceel properties

### Report section structure
- `brk_ownership` always present in API response with status field: `{ status: 'available'|'unavailable'|'error', data: [...]|null, reason?: '...', fetched_at?: datetime }`
- When viewing a saved/cached report (where BRK was stripped before DB save), re-fetch BRK data live — ensures "actueel opgevraagd" is always real-time
- `fetched_at` timestamp reflects exact moment BRK was queried, not when report page was loaded
- Ownership data structured as array (one entry per perceel) preserving full per-perceel detail

### Claude's Discretion
- Redis cache policy for BRK — Claude interprets Kadaster Tier 3 terms for short-lived cache layers
- Exact `never_cache` marker implementation (field on schema, decorator, or class attribute)
- Error message wording for different failure states

</decisions>

<specifics>
## Specific Ideas

- Re-fetch on view means the report endpoint must detect that BRK was stripped and trigger a live BRK call when serving the report
- The `fetched_at` timestamp serves as proof of real-time query for Kadaster compliance ("actueel opgevraagd")
- All percelen approach means the BRKOwnership schema needs to support a list of ownership records, each tied to a perceel

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 54-brk-wiring-no-cache*
*Context gathered: 2026-02-24*
