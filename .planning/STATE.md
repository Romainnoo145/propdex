# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v14.0 Fysiek Risicoprofiel -- Phase 89 complete, v14.0 complete

---

## Current Position

Phase: 89 of 90 (Asbestos V2 Refinement)
Plan: 1 of 1 in current phase (COMPLETE)
Status: Phase 89 complete
Last activity: 2026-03-10 -- Completed 89-01-PLAN.md

Progress: [##########] 100% (Phase 89)

## Performance Metrics

**Velocity:**
- Total plans completed: 3 (v14.0)
- Average duration: 3.7min
- Total execution time: 11min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 87 | 1 | 4min | 4min |
| 88 | 1 | 5min | 5min |
| 89 | 1 | 2min | 2min |

---
| Phase 89 P01 | 2min | 2 tasks | 4 files |

## Accumulated Context

### Key Patterns (carry forward)

- Government API client pattern: httpx.AsyncClient, rate limiting, JSONB cache
- BRO Bodemkaart: WMS GetFeatureInfo (NOT bodemdata.nl/WUR) -- PDOK only
- PDOK Funderingsrisicogebieden: WFS GetFeature, PC6-level (NOT parcel-level)
- Foundation heuristic: pure function, bouwjaar x bodemtype, amber badges only
- asbest_indicator.py: bouwjaar + gebruiksdoel-based NEN 2991 risk with additive uplift
- ParcelCache has NO postcode field -- use coordinate-based WMS query or address data
- asyncio.gather for parallel API calls in property_aggregator.py
- Pure synchronous risk engine post-processing after asyncio.gather (foundation_risk_engine.py)
- model_rebuild() pattern for Pydantic circular import resolution (fysiek_risico.py)

### Decisions Made

- Use PDOK BRO Bodemkaart WMS exclusively (not bodemdata.nl or WUR soilphysics)
- Funderingsgebieden is area context only (PC6), never present as parcel-specific
- All risk badges amber/indicative, never red/definitive
- KCAF cost ranges with prominent disclaimers
- Gebruiksdoel is additive only for asbestos (never reduces below bouwjaar baseline)
- WMS GetFeatureInfo with 1km window (500m half-width) for BRO point queries
- Empty dict cached for postcodes without funderingsrisico data
- Completeness score denominator increased from 9 to 11
- TYPE_CHECKING + model_rebuild() for circular import between fysiek_risico.py and property.py
- onbekend risks excluded from worst-of overall calculation
- funderingsrisicogebied accepted but not yet influencing score (PC6 too coarse)
- Case-insensitive BAG gebruiksdoel matching for risk assessment
- onbekend asbestos baseline never uplifted by gebruiksdoel (no false precision)

### Pending Todos

- Phase 81 (Locatie Score Investeringsprofiel) deferred from v12.0
- 268 unanalyzed rulings need AI analysis (~$2 cost)

### Blockers/Concerns

None.

---

## Session Continuity

**Last Session:** 2026-03-09T17:49:15Z
**Stopped At:** Completed 89-01-PLAN.md
**Resume File:** None

**Next Action:** v14.0 complete -- tag and archive

---

*State updated: 2026-03-10 -- Phase 89 Plan 01 complete*
