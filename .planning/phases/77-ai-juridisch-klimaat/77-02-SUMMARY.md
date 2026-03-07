---
phase: 77-ai-juridisch-klimaat
plan: 02
subsystem: ui, api
tags: [react, tanstack-query, polling, ai-analysis, jurisprudence, lucide-react]

# Dependency graph
requires:
  - phase: 77-ai-juridisch-klimaat
    provides: "POST /api/jurisprudence/analyze + GET /api/jurisprudence/analyze/{job_id} endpoints, RulingAnalysis + JuridischAnalysisResult schemas"
provides:
  - "triggerJurisprudenceAnalysis + pollJurisprudenceAnalysis API bindings"
  - "useJurisprudenceAnalysis polling hook + useTriggerAnalysis mutation hook"
  - "RulingAiSummaryBadge collapsible per-ruling AI summary"
  - "JuridischKlimaatCard score card with succeskans progress bar"
  - "Analyseer juridisch klimaat button with loading state"
affects: [frontend-map-panels, wijk-panel]

# Tech tracking
tech-stack:
  added: []
  patterns: [tanstack-query-refetchInterval-polling, derived-state-for-prop-change-reset]

key-files:
  created:
    - frontend/src/components/projects/JuridischKlimaatCard.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useJurisprudence.ts
    - frontend/src/components/projects/JurisprudenceSection.tsx

key-decisions:
  - "JuridischKlimaatCard rendered inside JurisprudenceSection (co-located state) rather than lifted to WijkMapPanel"
  - "Derived state pattern for gemeente change detection — avoids react-hooks/set-state-in-effect lint error"
  - "3-second polling interval for analysis status, stops on complete/failed"

patterns-established:
  - "Derived state pattern: track prop in state, compare in render, setState inline — avoids useEffect setState lint errors"
  - "Collapsible AI badge with e.stopPropagation() for nested interactive elements inside button cards"

requirements-completed: [AI-01, AI-02, AI-03]

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 77 Plan 02: AI Juridisch Klimaat Frontend Summary

**Frontend AI jurisprudence UI: per-ruling collapsible AI summary badges, JuridischKlimaatCard with score + succeskans progress bar, and "Analyseer juridisch klimaat" trigger button with 3s polling**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-07T06:00:39Z
- **Completed:** 2026-03-07T06:05:06Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- RulingAnalysis, JuridischAnalysisResult, JurisprudenceAnalysisResponse TypeScript types matching backend Pydantic schemas
- triggerJurisprudenceAnalysis (POST) and pollJurisprudenceAnalysis (GET) API functions with auth
- useJurisprudenceAnalysis hook with refetchInterval polling (3s, stops on complete/failed)
- useTriggerAnalysis mutation hook for triggering analysis
- RulingAiSummaryBadge showing bezwaargrond, uitkomst (color-coded), relevantie per ruling
- JuridischKlimaatCard with score display, succeskans progress bar, risk factors, mandatory disclaimer
- "Analyseer juridisch klimaat" button with Sparkles icon and Loader2 spinner during analysis
- Stale analysis prevention via derived state pattern on gemeente change

## Task Commits

Each task was committed atomically:

1. **Task 1: Add API bindings + useJurisprudenceAnalysis hook + types** - `b58499f` (feat)
2. **Task 2: Add RulingAiSummaryBadge + JuridischKlimaatCard + wire into JurisprudenceSection** - `a8b95d3` (feat)

## Files Created/Modified
- `frontend/src/lib/api.ts` - Added RulingAnalysis, JuridischAnalysisResult types + trigger/poll API functions
- `frontend/src/hooks/useJurisprudence.ts` - Added useJurisprudenceAnalysis polling hook + useTriggerAnalysis mutation
- `frontend/src/components/projects/JuridischKlimaatCard.tsx` - Score card with klimaat score, succeskans bar, risk factors
- `frontend/src/components/projects/JurisprudenceSection.tsx` - Added RulingAiSummaryBadge, analyse button, klimaat card integration

## Decisions Made
- JuridischKlimaatCard rendered inside JurisprudenceSection above the search input (simpler than lifting state to WijkMapPanel)
- Derived state pattern for gemeente change detection to avoid react-hooks/set-state-in-effect lint error from new eslint-plugin-react-hooks
- 3-second polling interval chosen to balance responsiveness vs server load
- Hardcoded disclaimer text on badges (not from API response) for guaranteed presence

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ESLint react-hooks/set-state-in-effect error**
- **Found during:** Task 2
- **Issue:** `useEffect` with `setAnalysisJobId(null)` triggered new react-hooks/set-state-in-effect lint error
- **Fix:** Replaced useEffect with derived state pattern (track prev gemeente in state, compare during render)
- **Files modified:** frontend/src/components/projects/JurisprudenceSection.tsx
- **Verification:** `npm run check` passes with 0 errors
- **Committed in:** a8b95d3

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor lint fix, idiomatic React pattern used instead. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full AI jurisprudence pipeline complete (backend + frontend)
- Phase 77 is the final phase of v11.0 milestone
- Ready for end-to-end testing with real Rechtspraak data

---
*Phase: 77-ai-juridisch-klimaat*
*Completed: 2026-03-07*
