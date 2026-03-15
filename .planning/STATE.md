# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v17.0 Projecten Portfolio -- Phase 109: Backend Foundation

---

## Current Position

Phase: 109 of 113 (Backend Foundation)
Plan: 2/2 in current phase
Status: Phase Complete
Last activity: 2026-03-15 -- 109-02 complete (Favorites CRUD router + portfolio endpoint)

Progress: [░░░░░░░░░░] 0% (v17.0)

---

## Performance Metrics

**Velocity:**
- Total plans completed: 21 (12 v15.0 + 9 v16.0)
- Average duration: 4min
- Total execution time: 71min

**By Phase (recent):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 106 | 2 | 11min | 5.5min |
| 105 | 2 | 7min | 3.5min |
| 104 | 2 | 6min | 3min |
| 107 | 3 | 24min | 8min |
| 108 | 4 | 14min | 3.5min |
| 97 | 1 | 3min | 3min |
| 109 P01 | 1 | 8min | 8min |
| 109 P02 | 1 | 2min | 2min |
| Phase 110 P02 | 4 | 2 tasks | 5 files |

## Accumulated Context

### Decisions

- [Phase 108-01]: Discount model: overall = potentie × (1 - risico_discount), max 50% cap, 70/30 default balance
- [Phase 108-01]: DEFAULT_WEIGHTS exported from score_v3.py as module-level dict -- single source of truth
- [Phase 106]: String(50) document_type instead of PG ENUM -- avoids ALTER TYPE migrations
- [Phase 106]: Upload uses raw fetch (not apiFetch) for FormData multipart compatibility
- [Phase 99]: Flags-first lookup: endpoints check scan_results.flags before external API calls
- [v17.0]: ParcelFavorite uses separate table (not Project model) -- Project model = scan folder only
- [v17.0]: Store both Kadaster string parcel_id (stable) and nullable parcel_cache_id UUID FK (geometry joins)
- [v17.0]: PipelineStage as VARCHAR Enum (native_enum=False) -- no ALTER TYPE on stage additions
- [v17.0]: BRK data never stored in outreach templates -- placeholders only (AVG compliance)
- [Phase 109-01]: wijk_naam stored instead of wijk_code — no wijk_code exists in codebase (BACK-01 substitution per RESEARCH.md)
- [Phase 109-01]: PipelineStage Literal type produces 422 for invalid values — semantically correct per Pydantic v2 conventions
- [Phase 109-02]: Idempotent POST uses JSONResponse(status_code=200) for existing favorites — JSONResponse overrides FastAPI decorator default cleanly
- [Phase 109-02]: Two-router module pattern — favorites/router.py exports both `router` and `portfolio_router`, registered separately in main.py
- [Phase 110-02]: Uses parcel.parcel_code (Kadaster string) for favorites API calls — FavoriteResponse.parcel_id stores Kadaster string, so parcel_code is the correct comparison key throughout
- [Phase 110-02]: ParcelPanelShell headerActions prop slot: optional ReactNode renders left of close button in flex container — backward compatible, clean separation of concerns

### Key Patterns (carry forward)

- Aura glass ONLY on 3 surfaces: SideRailNav, search bar, bottom sheet containers
- Inner pods: solid bg-white/40 WITHOUT backdrop-blur
- Palette: Morning Mist #F2F6F3, Warm Amber #F9A826, Deep Obsidian #0E1111, Sage Mint #D1E2D8
- Font: Plus Jakarta Sans via Google Fonts CDN
- TanStack Query mutations: useMutation + onMutate (optimistic) + onError (rollback) pattern
- Transactions: direct db.add()/db.flush()/db.commit() -- NOT async with db.begin()

### Pending Todos

- Phase 81 (Locatie Score Investeringsprofiel) deferred from v12.0
- 268 unanalyzed rulings need AI analysis (~$2 cost)

### Blockers/Concerns

None.

---

## Session Continuity

**Last Session:** 2026-03-15T17:21:10.041Z
**Stopped At:** Completed 110-02-PLAN.md — Heart button + useFavorites hook
**Next Action:** Phase 109 complete — run `/gsd:plan-phase 110` for frontend heart button

---

*State updated: 2026-03-15 -- v17.0 roadmap written, Phase 109 ready to plan*
