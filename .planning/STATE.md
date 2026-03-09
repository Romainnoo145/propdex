# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v14.0 Fysiek Risicoprofiel -- Phase 87 (Soil Data Integration)

---

## Current Position

Phase: 87 of 90 (Soil Data Integration)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-09 -- Roadmap created for v14.0

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (v14.0)
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

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

### Pending Todos

- Phase 81 (Locatie Score Investeringsprofiel) deferred from v12.0
- 268 unanalyzed rulings need AI analysis (~$2 cost)

### Blockers/Concerns

None.

---

## Session Continuity

**Last Session:** 2026-03-09
**Stopped At:** Roadmap created for v14.0 Fysiek Risicoprofiel
**Resume File:** None

**Next Action:** `/gsd:plan-phase 87`

---

*State updated: 2026-03-09 -- v14.0 roadmap created*
