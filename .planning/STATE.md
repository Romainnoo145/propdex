# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v14.0 Fysiek Risicoprofiel -- Phase 90 complete

---

## Current Position

Phase: 90 of 90 (Frontend Fysiek Risicoprofiel)
Plan: 2 of 2 in current phase (COMPLETE)
Status: Phase 90 complete
Last activity: 2026-03-10 -- Completed 90-02-PLAN.md

Progress: [##########] 100% (Phase 90)

## Performance Metrics

**Velocity:**
- Total plans completed: 5 (v14.0)
- Average duration: 4min
- Total execution time: 21min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 87 | 1 | 4min | 4min |
| 88 | 1 | 5min | 5min |
| 89 | 1 | 2min | 2min |
| 90 | 2 | 10min | 5min |

---
| Phase 90 P01 | 5min | 2 tasks | 8 files |
| Phase 90 P02 | 5min | 2 tasks | 6 files |

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

### Key Patterns (carry forward)

- FysiekRisicoprofielSection: extracted standalone component with amber-only badges
- Risk-profile endpoint: asyncio.gather for parallel sub-component fetching
- BuildingData constructed from ParcelCache fields (no gebruiksdoel column)

### Decisions Made

- Bouwjaar-only proxy for tile coloring (full bouwjaar x bodemtype via per-parcel API)
- Amber/slate palette for foundation risk overlay (never red)
- Extract FysiekRisicoprofielSection as separate component (sub-300-line guideline)
- Soil type card informational only (no risk badge)
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

**Last Session:** 2026-03-09T18:50:26Z
**Stopped At:** Completed 90-02-PLAN.md
**Resume File:** None

**Next Action:** v14.0 complete -- tag and archive

---

*State updated: 2026-03-10 -- Phase 90 Plan 02 complete*
