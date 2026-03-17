---
id: S04
parent: M001
milestone: M001
provides:
  - "rechtsgronden JSONB column with GIN index on ruling_cache"
  - "GET /api/jurisprudence/explorer with cross-faceted counts and pagination"
  - "Extended AI prompt with 5 rechtsgronden taxonomy"
  - "rechtsgrond_backfill_job for existing analyzed rulings"
  - "/jurisprudentie route with faceted filter sidebar and infinite scroll"
  - "ExplorerFilterSidebar with 6 dimensions and live facet counts"
  - "RulingCard with expand/collapse, color-coded badges, rechtsgrond tags"
  - "BroadenSuggestion for sparse result UX"
  - "useExplorerResults hook with useInfiniteQuery"
  - "Scale icon in SideRailNav for Jurisprudentie"
requires: []
affects: []
key_files: []
key_decisions:
  - "Cross-faceted counts via build_where_clauses(exclude_dimension) helper -- each facet dimension excludes its own filter"
  - "Lightweight rechtsgrond-only backfill prompt instead of full re-analysis for existing rulings"
  - "JSONB @> containment for rechtsgrond filtering, jsonb_array_elements_text for facet grouping"
  - "Rechtbank niveau derived via CASE/ILIKE from instantie column (no new column)"
  - "URL search params for all 6 filter dimensions (bookmarkable/shareable)"
  - "IntersectionObserver sentinel for infinite scroll (no scroll event listeners)"
  - "Checkbox single-select per dimension (matching backend single-value query params)"
  - "Mobile sidebar as fixed overlay with backdrop dismiss"
patterns_established:
  - "Cross-faceted search: _build_explorer_filters with exclude_dimension param"
  - "Backfill job pattern: lightweight prompt targeting specific field without full re-analysis"
  - "Faceted filter sidebar: dimension label + checkbox/radio/select with count badges"
  - "Infinite scroll sentinel: IntersectionObserver on empty div at bottom of results"
  - "URL-persisted filters via TanStack Router validateSearch + navigate replace"
observability_surfaces: []
drill_down_paths: []
duration: 4min
verification_result: passed
completed_at: 2026-03-09
blocker_discovered: false
---
# S04: Explorer Ui

**# Phase 85 Plan 01: Explorer Backend Summary**

## What Happened

# Phase 85 Plan 01: Explorer Backend Summary

**Rechtsgronden JSONB classification + faceted explorer endpoint with cross-filter counts and offset pagination**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T02:37:01Z
- **Completed:** 2026-03-09T02:41:26Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added rechtsgronden JSONB column with GIN index to ruling_cache, extending AI prompt with 5 juridische gronden taxonomy
- Built GET /api/jurisprudence/explorer with cross-faceted counts for 5 filter dimensions (gemeente, vergunningstype, uitkomst, rechtsgrond, rechtbank_niveau)
- Created rechtsgrond_backfill_job for classifying existing analyzed rulings without full re-analysis

## Task Commits

Each task was committed atomically:

1. **Task 1: Rechtsgronden migration + AI classifier extension** - `e7b37c8` (feat)
2. **Task 2: Explorer endpoint with faceted counts and pagination** - `2dcae76` (feat)

## Files Created/Modified
- `backend/app/models/ruling_cache.py` - Added rechtsgronden JSONB column
- `backend/alembic/versions/c7e2f1a3b9d5_add_rechtsgronden_to_ruling_cache.py` - Migration with GIN index
- `backend/app/ai/prompts.py` - Extended V2 prompt + added RECHTSGROND_CLASSIFICATIE_PROMPT
- `backend/app/ai/schemas.py` - Added rechtsgronden field to RulingAnalysis
- `backend/app/jobs/jurisprudence_analysis.py` - Store rechtsgronden in analysis job + backfill job
- `backend/app/jobs/worker.py` - Registered rechtsgrond_backfill_job
- `backend/app/api/endpoints/jurisprudence.py` - Explorer endpoint with cross-faceted filtering

## Decisions Made
- Cross-faceted counts via `_build_explorer_filters(exclude_dimension=...)` helper -- each facet dimension excludes its own filter for accurate counts
- Lightweight rechtsgrond-only backfill prompt instead of full re-analysis for existing rulings (cost-effective)
- JSONB `@>` containment operator for rechtsgrond filtering, `jsonb_array_elements_text` for facet grouping
- Rechtbank niveau derived via CASE/ILIKE from instantie column -- no new column needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Explorer backend complete, ready for frontend explorer page (85-02)
- Backfill job can be triggered manually or added to cron schedule
- All 5 facet dimensions operational for frontend integration

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 85-explorer-ui*
*Completed: 2026-03-09*

# Phase 85 Plan 02: Explorer Frontend Summary

**Jurisprudentie Explorer page with faceted filter sidebar, ruling cards with expand/collapse badges, infinite scroll pagination, and broaden-search suggestions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T02:44:41Z
- **Completed:** 2026-03-09T02:49:35Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Full /jurisprudentie page accessible from Scale icon in side rail nav
- Filter sidebar with 6 dimensions (gemeente dropdown, vergunningstype/uitkomst/rechtsgrond/rechtbank-niveau checkboxes, tijdsperiode radio) all showing live facet counts
- Ruling cards with ECLI, instantie, datum, color-coded uitkomst badges, vergunningstype pills, rechtsgrond tags, doorlooptijd, expand/collapse for AI analysis details
- Infinite scroll via IntersectionObserver sentinel and useInfiniteQuery
- Broaden suggestions when < 3 results with actionable filter removal links
- All filters persisted in URL search params (bookmarkable)
- Mobile responsive: sidebar as slide-over overlay

## Task Commits

Each task was committed atomically:

1. **Task 1: API types, explorer hook, and SideRailNav link** - `7903bd9` (feat)
2. **Task 2: Explorer page with filter sidebar, ruling cards, and broaden suggestions** - `5f0a786` (feat)

## Files Created/Modified
- `frontend/src/lib/api.ts` - ExplorerRuling, ExplorerFilters, ExplorerResponse types + fetchExplorerResults API function
- `frontend/src/hooks/useExplorer.ts` - useExplorerResults hook with useInfiniteQuery pagination
- `frontend/src/components/layout/SideRailNav.tsx` - Scale icon link for /jurisprudentie
- `frontend/src/routes/_authenticated/jurisprudentie.tsx` - TanStack Router page with validateSearch, infinite scroll, filter sidebar integration
- `frontend/src/components/jurisprudentie/ExplorerFilterSidebar.tsx` - 6-dimension filter sidebar with facet counts
- `frontend/src/components/jurisprudentie/RulingCard.tsx` - Ruling result card with expand/collapse, badges, tags
- `frontend/src/components/jurisprudentie/BroadenSuggestion.tsx` - Sparse result suggestions with filter removal actions
- `frontend/src/routeTree.gen.ts` - Auto-generated route tree update

## Decisions Made
- URL search params for all 6 filter dimensions (bookmarkable/shareable)
- IntersectionObserver sentinel for infinite scroll (no scroll event listeners)
- Checkbox single-select per dimension matching backend single-value query params
- Mobile sidebar as fixed overlay with backdrop dismiss

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript strict type errors for TanStack Router**
- **Found during:** Task 2 (verification)
- **Issue:** TanStack Router requires explicit search params with `| undefined` in navigate calls; IntersectionObserver entries[0] possibly undefined
- **Fix:** Spread explicit keys in navigate search object, added optional chaining on entries[0]
- **Files modified:** frontend/src/routes/_authenticated/jurisprudentie.tsx, frontend/src/components/layout/SideRailNav.tsx
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 5f0a786 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Standard TypeScript strict mode fix. No scope creep.

## Issues Encountered
- Pre-existing lint error (unused Badge import in ParcelDetailModal.tsx) -- out of scope, not related to this plan

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Explorer UI complete, ready for Phase 86 Trend analysis
- Backend explorer endpoint (85-01) provides the data; frontend now consumes it fully

---
*Phase: 85-explorer-ui*
*Completed: 2026-03-09*
