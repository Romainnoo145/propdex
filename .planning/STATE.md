# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v14.0 Fysiek Risicoprofiel

---

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-09 — Milestone v14.0 started

---

## Accumulated Context

### Key Patterns (carry forward)

- Direct `db.add()/db.flush()/db.commit()` pattern (NOT `async with db.begin()`)
- ARQ job pattern: session factory in context, background ingestion with polling
- Government API client pattern: httpx.AsyncClient, rate limiting, JSONB cache
- Existing asbest_indicator.py: bouwjaar-based NEN 2991 risk bands (hoog/middel/geen/onbekend)
- Existing bodemloket integration: ArcGIS REST pattern for soil contamination
- 3D BAG integration: building height, footprint, bouwlagen per pand
- BAG data: bouwjaar, address, pand geometry already in ParcelCache/ScanResult
- PDOK WFS/WMS pattern: used for parcels, bestemmingsplan, CBS boundaries

### Research Findings (v14.0)

- **bodemdata.nl**: Free API for soil profiles per coordinate — primary new data source
- **PDOK Funderingsrisicogebieden**: WFS at PC6 level, gives percvoor1970 + fgr (soil category) + legenda (risk classification)
- **BRO Grondwater**: ~380 wells nationwide (~10km apart) — too sparse for per-parcel use, PARKED
- **FunderMaps/KCAF**: Open source code but proprietary data, no free API — NOT integrating
- **Foundation heuristic**: bouwjaar < 1970 + klei/veen = "waarschijnlijk houten palen" (HOOG risico)
- **Archieven.nl**: Only Amsterdam has bouwdossier API — NOT worth building for single city
- **RCE monument detail**: Redengevende omschrijving available as prose, AI extraction possible but DEFERRED

### Decisions Made

- BRO grondwatermonitoring deferred (network too sparse for per-parcel assessment)
- FunderMaps partnership not pursued (commercial, no free API)
- Amsterdam-only bouwdossiers not pursued (too narrow scope)
- Monument AI verrijking deferred (not compelling enough for this milestone)
- Foundation risk via heuristic (bouwjaar × bodemtype) not ML model

### Pending Todos

- Phase 81 (Locatie Score Investeringsprofiel) deferred from v12.0
- Production deployment: Create app_role (sql/setup_app_role.sql)
- 268 unanalyzed rulings need AI analysis (~$2 cost)

### Blockers/Concerns

None.

---

## Session Continuity

**Last Session:** 2026-03-09
**Stopped At:** Defining v14.0 requirements
**Resume File:** None

**Next Action:** Define requirements → create roadmap

---

*State updated: 2026-03-09 — Milestone v14.0 started*
