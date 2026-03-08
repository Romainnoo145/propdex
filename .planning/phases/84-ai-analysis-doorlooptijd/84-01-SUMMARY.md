---
phase: 84-ai-analysis-doorlooptijd
plan: 01
subsystem: api
tags: [claude-ai, jurisprudence, doorlooptijd, vergunningstype, arq, sqlalchemy]

# Dependency graph
requires:
  - phase: 82-rechtspraak-cache-ecli
    provides: "RulingCache model with ECLI-based court ruling storage"
  - phase: 83-geo-contextualization-feed
    provides: "Geo-contextualised ruling feed with extracted_gemeente"
provides:
  - "Per-ruling AI analysis stored on RulingCache.ai_analysis JSONB"
  - "9-category vergunningstype taxonomy classification"
  - "DoorlooptijdService with filing date extraction and duration stats"
  - "POST /analyze/{gemeente_naam} per-ruling analysis endpoint"
  - "GET /doorlooptijd/{gemeente_naam} aggregated stats endpoint"
affects: [85-explorer-ui, 86-trend-statistics]

# Tech tracking
tech-stack:
  added: []
  patterns: ["per-ruling AI cache on RulingCache (not batch-keyed)", "section extraction for token budget control", "batch-of-5 Claude API calls"]

key-files:
  created:
    - backend/app/services/doorlooptijd.py
    - backend/alembic/versions/aa04a6b0b14c_add_ai_analysis_to_ruling_cache.py
  modified:
    - backend/app/models/ruling_cache.py
    - backend/app/ai/prompts.py
    - backend/app/ai/schemas.py
    - backend/app/ai/claude_client.py
    - backend/app/api/endpoints/jurisprudence.py
    - backend/app/jobs/jurisprudence_analysis.py
    - backend/app/jobs/worker.py

key-decisions:
  - "Per-ruling cache on RulingCache replaces batch-keyed CachedAPIResponse (survives filter changes)"
  - "Section extraction (OVERWEGINGEN/BEOORDELING markers) replaces naive text truncation for better AI analysis quality"
  - "Batch size of 5 rulings per Claude API call for token budget control"
  - "Minimum sample size of 3 for doorlooptijd stats to avoid misleading averages"

patterns-established:
  - "Per-ruling AI analysis: store results directly on RulingCache.ai_analysis JSONB, not in separate cache table"
  - "Section extraction: use legal text markers to find reasoning sections, fallback to last 60%"
  - "Dutch filing date extraction: regex patterns for beroepschrift/bezwaarschrift/ingekomen patterns"

requirements-completed: [AI-01, AI-02, AI-03, AI-04, DOOR-01, DOOR-02, DOOR-03]

# Metrics
duration: 5min
completed: 2026-03-08
---

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
