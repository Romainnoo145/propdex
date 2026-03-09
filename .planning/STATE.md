# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v14.0 Fysiek Risicoprofiel -- Phase 87 (Soil Data Integration)

---

## Current Position

Phase: 87 of 90 (Soil Data Integration)
Plan: 1 of 1 in current phase (COMPLETE)
Status: Phase 87 complete
Last activity: 2026-03-09 -- Completed 87-01-PLAN.md

Progress: [##########] 100% (Phase 87)

## Performance Metrics

**Velocity:**
- Total plans completed: 1 (v14.0)
- Average duration: 4min
- Total execution time: 4min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 87 | 1 | 4min | 4min |

---

## Accumulated Context

### Key Patterns (carry forward)

- Government API client pattern: httpx.AsyncClient, rate limiting, JSONB cache
- BRO Bodemkaart: WMS GetFeatureInfo (NOT bodemdata.nl/WUR) -- PDOK only
- PDOK Funderingsrisicogebieden: WFS GetFeature, PC6-level (NOT parcel-level)
- Foundation heuristic: pure function, bouwjaar x bodemtype, amber badges only
- Existing asbest_indicator.py: bouwjaar-based NEN 2991 risk bands
- ParcelCache has NO postcode field -- use coordinate-based WMS query or address data
- asyncio.gather for parallel API calls in property_aggregator.py

### Decisions Made

- Use PDOK BRO Bodemkaart WMS exclusively (not bodemdata.nl or WUR soilphysics)
- Funderingsgebieden is area context only (PC6), never present as parcel-specific
- All risk badges amber/indicative, never red/definitive
- KCAF cost ranges with prominent disclaimers
- Gebruiksdoel is additive only for asbestos (never reduces below bouwjaar baseline)
- WMS GetFeatureInfo with 1km window (500m half-width) for BRO point queries
- Empty dict cached for postcodes without funderingsrisico data
- Completeness score denominator increased from 9 to 11

### Pending Todos

- Phase 81 (Locatie Score Investeringsprofiel) deferred from v12.0
- 268 unanalyzed rulings need AI analysis (~$2 cost)

### Blockers/Concerns

None.

---

## Session Continuity

**Last Session:** 2026-03-09
**Stopped At:** Completed 87-01-PLAN.md (Soil Data Integration)
**Resume File:** None

**Next Action:** `/gsd:plan-phase 88`

---

*State updated: 2026-03-09 -- Phase 87 Plan 01 complete*
