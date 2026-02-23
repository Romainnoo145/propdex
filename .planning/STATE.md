# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v6.0 Meldingen Intelligence -- Phase 49 Plan 01 COMPLETE, ready for Phase 49 Plan 02

---

## Current Position

Phase: 49 of 51 (Read Tracking)
Plan: 1 of 2 complete
Status: Phase 49 Plan 01 complete — ChangeReadState model + 3 API endpoints
Last activity: 2026-02-23 -- Phase 49 Plan 01: ChangeReadState model, migration, read/unread/read-all endpoints (2 tasks, 5 files)

Progress: [####      ] 37%

---

## Performance Metrics

**v6.0 Read Tracking Phase 49 Plan 01 (Complete: 2026-02-23)**
- Phase 49 Plan 01: 2 min, 2 tasks, 5 files — ChangeReadState model + migration + 3 API endpoints + updated /unread

**v6.0 Parcel Matching Phase 48 Plan 03 (Complete: 2026-02-23)**
- Phase 48 Plan 03: 3 min, 2 tasks, 3 files — retro_match_changes_for_gemeente + area_scan_job wiring (7 new tests)

**v6.0 Parcel Matching Phase 48 Plan 02 (Complete: 2026-02-23)**
- Phase 48 Plan 02: 8 min, 2 tasks, 5 files — matched_parcel_id migration + change_monitor geocoding wiring

**v6.0 Parcel Matching Phase 48 Plan 01 (Complete: 2026-02-23)**
- Phase 48 Plan 01: 3 min, 2 tasks, 4 files — geocode_address() + find_parcel_at_point() TDD (12 new tests)

**v6.0 Address Intelligence Phase 47 Plan 02 (Complete: 2026-02-23)**
- Phase 47 Plan 02: 2 min, 2 tasks, 7 files — category_classifier.py + badge rendering (27 tests)

**v6.0 Address Intelligence Phase 47 Plan 01 (Complete: 2026-02-23)**
- Phase 47 Plan 01: 5 min, 3 commits, 3 files — address_extractor.py TDD (34 tests)

**v5.1 Wijk Detail View (Complete: 2026-02-22)**
- Phase 46 Plan 01: WijkDetailView with scan summary, ChangeTimeline, reports
- Phase 46 Plan 02: Navigation integration -- wijk_id routing, 3-level breadcrumb

**v5.1 URL State + Gemeente Detail View (Complete: 2026-02-22)**
- Phase 45 Plan 01: URL state migration (validateSearch), DrilldownBreadcrumb, counter fix
- Phase 45 Plan 02: GemeenteDetailView with stat bar, ChangeTimeline, WijkCardGrid

**v5.1 Wijk Cards and Drill-Down (Complete: 2026-02-22)**
- Phase 44 Plan 01: 1 min, 2 tasks, 3 files created
- Phase 44 Plan 02: 2 min, 2 tasks, 2 files modified

**v5.1 Gemeente Card Navigation (Complete: 2026-02-22)**
- Phase 43 Plan 01: 2 min, 2 tasks, 3 files created
- Phase 43 Plan 02: 2 min, 1 task, 1 file modified

**v5.1 Theme Consistency (Complete: 2026-02-21)**
- Phase 42 Plan 01: 2 min, 2 tasks, 12 files changed
- Phase 42 Plan 02: 9 min, 2 tasks, 29 files changed

**v5.0 Scan Intelligence (Shipped: 2026-02-20)**
- 5 phases (37-41), 11 plans, 51 commits, 65 files changed (+9,264/-2,326)
- Phase 37: 12 min, Phase 38: 6 min, Phase 39: 8 min, Phase 40: 7 min, Phase 41: 5 min

**v4.0 UX Redesign (Shipped: 2026-02-18)**
- 10 phases (27-36), 31 plans, 129 commits, ~16,234 LOC TypeScript/React

**v3.1 Smart Area Intelligence (Shipped: 2026-02-15)**
- 5 phases (22-26), 22 plans, 97 commits, ~27,200 LOC

---

## Accumulated Context

### Key Patterns (carry forward)

- Direct `db.add()/db.flush()/db.commit()` pattern (NOT `async with db.begin()`)
- parcel_cache.geometry is EPSG:28992; always ST_Transform(geometry, 4326) before GeoJSON
- 404 not 403 for cross-org access (prevents enumeration)
- ProjectEditModal/ProjectCreateModal use intentional light-theme gray-* (white card on dark backdrop)
- CBS WFS already integrated for gemeente/wijk boundaries -- reuse for SVG silhouettes
- ThemeProvider at src/lib/theme/ with localStorage persistence already exists
- **text-on-accent**: all amber/accent-background elements use this utility
- **Defined grey scale**: only 100, 300, 400, 600, 700, 800, 850, 900, 950
- **SET LOCAL f-string (not params)**: asyncpg doesn't support parameterized SET statements
- **Response enrichment pattern**: compute category_label inline during ChangeRecordResponse construction, not in separate pass
- **Absence-based read tracking**: unread = no row in change_read_states for (user_id, change_id)

### Decisions Made

- _parse_rd_point() is module-level (not method) — pure function, no class dependency, easier to import and test
- geocode_address() appends gemeente_naam only when both postcode and city absent — avoids over-constraining queries that already have postcode (pitfall #1 from research)
- ST_Contains(parcel.geometry, point) not ST_Within — parcel-contains-point semantics correct for polygon containment
- Multi-strategy address extraction (5 strategies) instead of single monolithic regex — each handles a subset of SRU formats
- extract_address_from_title() returns structured dict (not raw string) — Phase 48 gets clean field access without re-parsing
- address_components stored in metadata_json, ChangeRecord.address still gets full_address string — no DB migration needed
- _strip_permit_prefix() strips leading keywords before street extraction — solves Formats E, F, I false positives
- classify_bekendmaking checks "buiten behandeling" and "bezwaar" before permit verb patterns — prevents false substring matches
- category_label computed at response-build time, not stored in DB — no migration needed
- category_label: str | None = None (nullable) — pre-existing records degrade gracefully to no badge
- matched_parcel_id uses ondelete=SET NULL — parcel deletion doesn't cascade to change records
- _try_match_parcel helper wraps huisnummer int() in try/except — house numbers may be strings or contain letters
- Geocode call happens outside session.begin_nested() in both pipeline functions — HTTP I/O must not block nested transaction
- Badge uses grey-800/grey-300 to visually separate from amber rapport pills and blue perceel pills
- `--color-on-accent: oklch(0.12 0.005 270)` -- fixed dark color for text on amber, does NOT invert in light mode
- FOUC script placed as very first child of `<head>` before icon/font/stylesheet links
- GemeenteCard is stateless: receives pre-computed svgData and totalUnread as props
- WijkCard mirrors GemeenteCard pattern but omits gemeente_code subtitle
- URL state via TanStack Router validateSearch: gemeente_id/wijk_id in URL search params
- DrilldownBreadcrumb reads from useSearch -- returns null at top level, 2-level for gemeente, 3-level for wijk
- Sequential processing (not asyncio.gather) for retro-match loop — shared AsyncSession write conflicts make concurrent gather unsafe
- asyncio.Semaphore(5) kept even in sequential retro-match loop — throttles HTTP I/O, allows event loop interleaving with DB writes
- LIMIT 200 safety cap on retro-match candidates — prevents runaway queries on first scan of active gemeente
- Retro-match is non-fatal to scan — wrapped in try/except, scan already marked completed before retro-match runs
- Caller (area_scan_job) handles commit after retro-match — function only flushes, separating responsibility
- ChangeReadState has no TimestampMixin — read state is insert/delete only, no updated_at needed
- UniqueConstraint(user_id, change_id) enables ON CONFLICT DO NOTHING for idempotent mark-as-read
- GET /unread uses LEFT JOIN on change_read_states subquery — absence means unread (not timestamp comparison)
- read-all route registered before {change_id}/read — FastAPI matches literal paths first
- read_change_ids returned on GET /changes response — frontend knows per-change read state without extra call

### v6.0 Architecture Notes

- **Phase 48 COMPLETE**: matched_parcel_id populated via 3 paths: (1) initial detection in change_monitor, (2) retro-match after area scan, (3) future on-demand
- **Phase 49 Plan 01 COMPLETE**: ChangeReadState table + read/unread/read-all API endpoints ready for frontend
- **FLOW depends on MATCH**: Fly-to-parcel and map marker need matched_parcel_id on ChangeRecord (Phase 48 now provides this)
- **UX depends on READ+FLOW**: Filter, action states, shared hook, pagination are last
- **UserNotificationState/last_viewed_at**: Deprecated but kept for backward compat, removable in future cleanup

### Ongoing TODOs

- Production deployment: Create app_role (sql/setup_app_role.sql)
- Production deployment: Update Docker container to postgis/postgis:16-3.5
- BAG API key aanvragen (gratis)
- DSO API key aanvragen (gratis)
- Kadaster BRK Bevragen API toegang regelen (betaald)
- PLU WMS change detection live validation (MON-02)

### Blockers/Concerns

None.

---

## Session Continuity

**Last Session:** 2026-02-23
**Stopped At:** Phase 49 Plan 01 complete — ChangeReadState model + 3 read/unread/read-all API endpoints
**Resume File:** None

**Next Action:** `/gsd:execute-phase 49` (Phase 49 Plan 02 — frontend read tracking UI)

---

*State updated: 2026-02-23 -- Phase 49 Plan 01 complete (2 tasks, 5 files: ChangeReadState model, migration, API endpoints)*
