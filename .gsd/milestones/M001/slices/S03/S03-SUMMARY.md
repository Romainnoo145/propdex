---
id: S03
parent: M001
milestone: M001
provides:
  - "Per-ruling AI analysis stored on RulingCache.ai_analysis JSONB"
  - "9-category vergunningstype taxonomy classification"
  - "DoorlooptijdService with filing date extraction and duration stats"
  - "POST /analyze/{gemeente_naam} per-ruling analysis endpoint"
  - "GET /doorlooptijd/{gemeente_naam} aggregated stats endpoint"
  - "Auto-triggering analysis on feed load (no manual button)"
  - "Vergunningstype badges on ruling cards in feed"
  - "Doorlooptijd statistics section in JuridischKlimaatCard"
  - "useGemeenteAnalysis hook with auto-trigger + polling"
  - "useDoorlooptijdStats hook with 10-min cache"
requires: []
affects: []
key_files: []
key_decisions:
  - "Per-ruling cache on RulingCache replaces batch-keyed CachedAPIResponse (survives filter changes)"
  - "Section extraction (OVERWEGINGEN/BEOORDELING markers) replaces naive text truncation for better AI analysis quality"
  - "Batch size of 5 rulings per Claude API call for token budget control"
  - "Minimum sample size of 3 for doorlooptijd stats to avoid misleading averages"
  - "Unified AnalyzeGemeenteResponse type for both trigger and poll endpoints (optional job_id/analyzed_at)"
  - "Auto-trigger via useEffect with ref guard to prevent duplicate calls"
  - "Doorlooptijd color coding: green <= 180 days, amber 181-365, red > 365"
  - "Risk factors derived from afgewezen rulings' bezwaargronden on frontend"
patterns_established:
  - "Per-ruling AI analysis: store results directly on RulingCache.ai_analysis JSONB, not in separate cache table"
  - "Section extraction: use legal text markers to find reasoning sections, fallback to last 60%"
  - "Dutch filing date extraction: regex patterns for beroepschrift/bezwaarschrift/ingekomen patterns"
  - "Auto-triggering analysis: useEffect + hasTriggeredRef pattern to fire mutation once per gemeente"
  - "Doorlooptijd display: color-coded per vergunningstype with graceful degradation"
observability_surfaces: []
drill_down_paths: []
duration: 9min
verification_result: passed
completed_at: 2026-03-08
blocker_discovered: false
---
# S03: Ai Analysis Doorlooptijd

**# Phase 84 Plan 01: AI Analysis + Doorlooptijd Backend Summary**

## What Happened

# Phase 84 Plan 01: AI Analysis + Doorlooptijd Backend Summary

**Per-ruling AI analysis with 9-category vergunningstype taxonomy, intelligent section extraction, and doorlooptijd computation stored on RulingCache**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-08T03:59:10Z
- **Completed:** 2026-03-08T04:04:25Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Extended RulingCache with 5 new columns (ai_analysis JSONB, vergunningstype, datum_indiening, doorlooptijd_dagen, ai_analyzed_at) for per-ruling AI caching
- Created DoorlooptijdService with Dutch legal text filing date extraction, procedure duration computation, section extraction, and aggregated statistics
- Upgraded AI prompt to V2 with 9-category vergunningstype taxonomy (nieuwbouw, verbouw, dakopbouw, etc.)
- Replaced batch-keyed analysis endpoint with per-ruling POST /analyze/{gemeente_naam} that only sends un-analyzed rulings to Claude
- Added GET /doorlooptijd/{gemeente_naam} endpoint and inline doorlooptijd stats in rulings response

## Task Commits

Each task was committed atomically:

1. **Task 1: RulingCache model extension + migration + DoorlooptijdService + prompt/schema** - `60dc0e9` (feat)
2. **Task 2: Per-ruling analysis endpoint + refactored ARQ job + doorlooptijd stats** - `5b526f3` (feat)

## Files Created/Modified
- `backend/app/models/ruling_cache.py` - Extended with 5 AI analysis columns
- `backend/alembic/versions/aa04a6b0b14c_add_ai_analysis_to_ruling_cache.py` - Migration for new columns + vergunningstype index
- `backend/app/services/doorlooptijd.py` - Filing date extraction, duration computation, section extraction, stats aggregation
- `backend/app/ai/prompts.py` - V2 prompt with vergunningstype taxonomy
- `backend/app/ai/schemas.py` - Added vergunningstype to RulingAnalysis, DoorlooptijdStats model
- `backend/app/ai/claude_client.py` - V2 prompt + section extraction instead of naive truncation
- `backend/app/api/endpoints/jurisprudence.py` - Per-ruling analysis + doorlooptijd endpoints
- `backend/app/jobs/jurisprudence_analysis.py` - Refactored to ruling_analysis_job with batch-of-5
- `backend/app/jobs/worker.py` - Updated job registration

## Decisions Made
- Per-ruling AI cache on RulingCache replaces batch-keyed CachedAPIResponse -- survives date filter changes without re-analysis
- Section extraction using OVERWEGINGEN/BEOORDELING markers replaces naive truncation for better AI analysis quality
- Batch size of 5 rulings per Claude API call for token budget control
- Minimum sample size of 3 for doorlooptijd stats to avoid misleading single-ruling averages
- Removed dependency on CachedAPIResponse and JuridischAnalyseJob for analysis flow

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused import in doorlooptijd.py**
- **Found during:** Task 1 (DoorlooptijdService creation)
- **Issue:** `datetime` imported but unused (only `date` needed)
- **Fix:** Removed unused import
- **Files modified:** backend/app/services/doorlooptijd.py
- **Committed in:** 60dc0e9

**2. [Rule 1 - Bug] Unused import in jurisprudence_analysis.py**
- **Found during:** Task 2 (ARQ job refactor)
- **Issue:** `extract_relevant_sections` imported but not used (handled by ClaudeClient)
- **Fix:** Removed unused import
- **Files modified:** backend/app/jobs/jurisprudence_analysis.py
- **Committed in:** 5b526f3

**3. [Rule 3 - Blocking] Alembic migration contained PostGIS tiger table drops**
- **Found during:** Task 1 (Alembic migration generation)
- **Issue:** Autogenerate detected PostGIS tiger geocoder tables as "removed" and included drop statements
- **Fix:** Manually rewrote migration to only include the 5 new columns and vergunningstype index
- **Files modified:** backend/alembic/versions/aa04a6b0b14c_add_ai_analysis_to_ruling_cache.py
- **Committed in:** 60dc0e9

---

**Total deviations:** 3 auto-fixed (2 unused imports, 1 migration cleanup)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend AI analysis + doorlooptijd infrastructure complete
- Phase 84-02 (frontend) can consume new endpoints: POST /analyze/{gemeente_naam}, GET /doorlooptijd/{gemeente_naam}
- Per-ruling analysis data available in GET /rulings/{gemeente_naam} response (vergunningstype + doorlooptijd inline)

## Self-Check: PASSED

All 8 files verified present. Both commit hashes (60dc0e9, 5b526f3) verified in git log.

---
*Phase: 84-ai-analysis-doorlooptijd*
*Completed: 2026-03-08*

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
