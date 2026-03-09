# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v15.0 Aura -- complete frontend overhaul

---

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-10 -- Milestone v15.0 Aura started

## Accumulated Context

### Key Patterns (carry forward)

- Government API client pattern: httpx.AsyncClient, rate limiting, JSONB cache
- BRO Bodemkaart: WMS GetFeatureInfo (NOT bodemdata.nl/WUR) -- PDOK only
- PDOK Funderingsrisicogebieden: WFS GetFeature, PC6-level (NOT parcel-level)
- Foundation heuristic: pure function, bouwjaar x bodemtype, amber badges only
- asbest_indicator.py: bouwjaar + gebruiksdoel-based NEN 2991 risk with additive uplift
- FysiekRisicoprofielSection: extracted standalone component with amber-only badges
- Risk-profile endpoint: asyncio.gather for parallel sub-component fetching
- model_rebuild() pattern for Pydantic circular import resolution (fysiek_risico.py)

### Pending Todos

- Phase 81 (Locatie Score Investeringsprofiel) deferred from v12.0
- 268 unanalyzed rulings need AI analysis (~$2 cost)

### Blockers/Concerns

None.

---

## Session Continuity

**Last Session:** 2026-03-10
**Stopped At:** v14.0 milestone archived
**Resume File:** None

**Next Action:** `/gsd:new-milestone`

---

*State updated: 2026-03-10 -- v14.0 milestone complete*
