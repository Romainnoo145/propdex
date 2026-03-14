---
phase: 108-score-customization
plan: 04
subsystem: ui
tags: [scoring, score-v3, custom-weights, badge, frontend, api]

# Dependency graph
requires:
  - phase: 108-02
    provides: GET /api/users/org/score-weights endpoint with is_custom flag, score_weights JSONB on Organization model

provides:
  - useOrgScoreWeights TanStack Query hook (GET /api/users/org/score-weights)
  - useSaveScoreWeights mutation hook (PUT /api/users/org/score-weights)
  - useRescoreJobStatus polling hook (GET /api/users/org/score-weights/job/{jobId})
  - scoreWeights.ts types file with ScoreWeightsConfig, ScoreWeightsResponse, DEFAULT_WEIGHTS, PRESETS
  - Custom profiel pill badge in ParcelBentoOverview (shown when is_custom === true)
  - uses_custom_weights bool in ParcelAtPointResponse (derived at read time from org.score_weights)

affects:
  - 108-03 (weight presets UI can use useSaveScoreWeights hook)
  - Any component that needs to know if org uses custom weights

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Custom profiel badge derived client-side via useOrgScoreWeights().data?.is_custom — NOT from per-parcel API"
    - "uses_custom_weights derived at read time in parcel-at-point endpoint — NOT stored per scan_result"
    - "Backfill tool uses compute_score_v3() directly — no formula or threshold duplication"

key-files:
  created:
    - frontend/src/hooks/useScoreWeights.ts
    - frontend/src/lib/types/scoreWeights.ts
  modified:
    - frontend/src/components/map/panels/parcel/ParcelBentoOverview.tsx
    - backend/app/scans/schemas.py
    - backend/app/scans/router.py

key-decisions:
  - "Badge uses client-side useOrgScoreWeights hook (not per-parcel API field) for badge display — avoids storing weight state per scan_result"
  - "uses_custom_weights derived at read time: SELECT Organization.score_weights WHERE id = organization_id — IS NOT NULL check"
  - "Backfill tool verified correct: delegates fully to compute_score_v3(), thresholds (>60 Hoog / >30 Gemiddeld) already set in score_v3.py Plan 01 — no backfill changes needed"

requirements-completed: [SC-10]

# Metrics
duration: 5min
completed: 2026-03-14
---

# Phase 108 Plan 04: Custom Profiel Badge and Backfill Tool Verification Summary

**Custom profiel pill badge in parcel detail (reads org is_custom at runtime) with uses_custom_weights in parcel-at-point API and verified backfill tool correctness**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-14T05:30:42Z
- **Completed:** 2026-03-14T05:35:42Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- Created `useScoreWeights.ts` with three hooks: `useOrgScoreWeights` (GET weights), `useSaveScoreWeights` (PUT weights), `useRescoreJobStatus` (poll job)
- Created `scoreWeights.ts` types file with full TypeScript interfaces mirroring backend schema plus DEFAULT_WEIGHTS and PRESETS constants
- Added "Custom profiel" pill badge to `ParcelBentoOverview` — renders conditionally below the score card using `weightsData?.is_custom`
- Added `uses_custom_weights: bool` field to `ParcelAtPointResponse` schema with read-time derivation in router
- Verified backfill tool delegates to `compute_score_v3()` — no independent formula or threshold duplication

## Task Commits

1. **Task 1: Custom profiel badge + backfill tool formula update** - `e48eb19` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/hooks/useScoreWeights.ts` — Three hooks: useOrgScoreWeights, useSaveScoreWeights, useRescoreJobStatus
- `frontend/src/lib/types/scoreWeights.ts` — TypeScript interfaces + DEFAULT_WEIGHTS + PRESETS constants
- `frontend/src/components/map/panels/parcel/ParcelBentoOverview.tsx` — Custom profiel badge below score card
- `backend/app/scans/schemas.py` — uses_custom_weights field in ParcelAtPointResponse
- `backend/app/scans/router.py` — Organization import + read-time uses_custom_weights derivation in get_parcel_at_point

## Decisions Made

- Badge uses client-side `useOrgScoreWeights` hook (not the per-parcel `uses_custom_weights` API field) — keeps weight state decoupled from scan_result storage
- `uses_custom_weights` in API is derived at read time (one SELECT on organizations table) — not stored per scan_result, consistent with anti-pattern documented in RESEARCH.md
- Backfill tool needed no formula changes — it already delegates entirely to `compute_score_v3()`, and category thresholds (`>60 Hoog / >30 Gemiddeld`) were set in Plan 01

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Created useScoreWeights hook (referenced but non-existent)**
- **Found during:** Task 1 — plan referenced `useOrgScoreWeights` from `@/hooks/useScoreWeights`, but hook file didn't exist
- **Issue:** Hook not created by earlier plans; Plan 04 depended on it for badge display
- **Fix:** Created `useScoreWeights.ts` with three hooks (get, save, poll) following useSettings.ts pattern
- **Files modified:** `frontend/src/hooks/useScoreWeights.ts` (new), `frontend/src/lib/types/scoreWeights.ts` (new)
- **Committed in:** e48eb19

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing dependency)
**Impact on plan:** Required fix — without the hook file the badge import would fail TypeScript compilation. No scope creep.

## Issues Encountered

None beyond the missing hook file above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 108 complete: Score v3.0 engine (01), weight storage/API (02), presets API (03), badge/backfill (04)
- `useOrgScoreWeights` and `useSaveScoreWeights` hooks ready for any weight settings UI in future phases
- `uses_custom_weights` in parcel-at-point response available to frontend if needed for future UX signals

## Self-Check: PASSED

All created files confirmed on disk. Task commit e48eb19 verified in git history.

---
*Phase: 108-score-customization*
*Completed: 2026-03-14*
