# Phase 55: Aggregator Integration - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire EP-Online, WOZ, and RCE detail API clients into the property aggregator's parallel data-gathering pipeline. Restructure into Step 2a/2b stages, implement two-step monument enrichment, and update completeness scoring. Frontend display is Phase 56.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation areas delegated to Claude — phase is straightforward backend wiring of existing clients into established patterns.

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

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow patterns established in Phase 54 (BRK wiring).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 55-aggregator-integration*
*Context gathered: 2026-02-24*
