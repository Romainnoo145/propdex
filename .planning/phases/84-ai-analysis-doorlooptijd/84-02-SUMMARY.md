---
phase: 84-ai-analysis-doorlooptijd
plan: 02
subsystem: ui
tags: [react, tanstack-query, jurisprudence, doorlooptijd, vergunningstype, auto-analysis]

# Dependency graph
requires:
  - phase: 84-ai-analysis-doorlooptijd
    provides: "Per-ruling AI analysis endpoints + doorlooptijd stats API"
provides:
  - "Auto-triggering analysis on feed load (no manual button)"
  - "Vergunningstype badges on ruling cards in feed"
  - "Doorlooptijd statistics section in JuridischKlimaatCard"
  - "useGemeenteAnalysis hook with auto-trigger + polling"
  - "useDoorlooptijdStats hook with 10-min cache"
affects: [85-explorer-ui, 86-trend-statistics]

# Tech tracking
tech-stack:
  added: []
  patterns: ["auto-triggering mutation via useEffect + ref guard", "unified response type for trigger + poll endpoints"]

key-files:
  created: []
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useJurisprudence.ts
    - frontend/src/components/projects/JurisprudenceSection.tsx
    - frontend/src/components/projects/JuridischKlimaatCard.tsx

key-decisions:
  - "Unified AnalyzeGemeenteResponse type for both trigger and poll endpoints (optional job_id/analyzed_at)"
  - "Auto-trigger via useEffect with ref guard to prevent duplicate calls"
  - "Doorlooptijd color coding: green <= 180 days, amber 181-365, red > 365"
  - "Risk factors derived from afgewezen rulings' bezwaargronden on frontend"

patterns-established:
  - "Auto-triggering analysis: useEffect + hasTriggeredRef pattern to fire mutation once per gemeente"
  - "Doorlooptijd display: color-coded per vergunningstype with graceful degradation"

requirements-completed: [AI-01, AI-02, AI-03, DOOR-02, DOOR-03]

# Metrics
duration: 9min
completed: 2026-03-08
---

# Phase 84 Plan 02: Frontend AI Analysis + Doorlooptijd UI Summary

**Auto-triggering per-ruling analysis with vergunningstype badges and color-coded doorlooptijd statistics per vergunningstype**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-08T04:09:15Z
- **Completed:** 2026-03-08T04:18:07Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Replaced manual "Analyseer juridisch klimaat" button with auto-triggering useGemeenteAnalysis hook
- Added vergunningstype badges (blue pills) on each ruling card in the feed
- Added doorlooptijd statistics section to JuridischKlimaatCard with color-coded averages and graceful degradation

## Task Commits

Each task was committed atomically:

1. **Task 1: Update API types + hooks for per-ruling analysis and doorlooptijd** - `bfa16e3` (feat)
2. **Task 2: Auto-analysis in JurisprudenceSection + vergunningstype badges + doorlooptijd in JuridischKlimaatCard** - `41bcc54` (feat)

## Files Created/Modified
- `frontend/src/lib/api.ts` - Added vergunningstype to types, DoorlooptijdStats interface, analyzeGemeenteRulings/pollRulingAnalysis/getDoorlooptijdStats API functions
- `frontend/src/hooks/useJurisprudence.ts` - Added useGemeenteAnalysis (auto-trigger + polling) and useDoorlooptijdStats hooks
- `frontend/src/components/projects/JurisprudenceSection.tsx` - Replaced manual button with auto-analysis, added vergunningstype badges on ruling cards
- `frontend/src/components/projects/JuridischKlimaatCard.tsx` - Added doorlooptijd section with per-type stats, color coding, and graceful degradation

## Decisions Made
- Unified AnalyzeGemeenteResponse type with optional job_id/analyzed_at for both trigger and poll endpoints
- Auto-trigger via useEffect with hasTriggeredRef guard to prevent duplicate mutation calls
- Doorlooptijd color coding: green <= 180 days, amber 181-365, red > 365
- Risk factors derived from afgewezen rulings' bezwaargronden directly on frontend (no separate backend endpoint)
- Deprecated old triggerJurisprudenceAnalysis/pollJurisprudenceAnalysis but kept for backward compat

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PollRulingAnalysisResponse type incompatibility**
- **Found during:** Task 2 (verification)
- **Issue:** PollRulingAnalysisResponse lacked job_id/analyzed_at fields, causing type error when assigning to AnalyzeGemeenteResponse
- **Fix:** Merged PollRulingAnalysisResponse into AnalyzeGemeenteResponse with optional fields and added 'in_progress'/'not_found' to status union
- **Files modified:** frontend/src/lib/api.ts, frontend/src/hooks/useJurisprudence.ts
- **Committed in:** 41bcc54

---

**Total deviations:** 1 auto-fixed (type compatibility)
**Impact on plan:** Necessary for type safety. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 84 (AI Analysis + Doorlooptijd) fully complete -- backend + frontend
- Phase 85 (Explorer UI) can build on existing jurisprudence hooks and analysis infrastructure
- Phase 86 (Trend Statistics) can leverage doorlooptijd data and analysis results

## Self-Check: PASSED

All 4 files verified present. Both commit hashes (bfa16e3, 41bcc54) verified in git log.

---
*Phase: 84-ai-analysis-doorlooptijd*
*Completed: 2026-03-08*
