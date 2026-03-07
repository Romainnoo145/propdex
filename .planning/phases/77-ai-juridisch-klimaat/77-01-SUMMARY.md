---
phase: 77-ai-juridisch-klimaat
plan: 01
subsystem: ai, api
tags: [anthropic, claude, arq, jurisprudence, rechtspraak, pydantic, sqlalchemy]

# Dependency graph
requires:
  - phase: 76-rechtspraak-integratie
    provides: "RechtspraakClient with ECLI validation, search, document fetch"
provides:
  - "JuridischAnalyseJob DB model for tenant-scoped job tracking"
  - "RulingAnalysis + JuridischAnalysisResult Pydantic schemas"
  - "JURIDISCH_ANALYSE_PROMPT for Dutch court ruling analysis"
  - "ClaudeClient.analyze_jurisprudence() method"
  - "jurisprudence_analysis_job ARQ background job"
  - "POST /api/jurisprudence/analyze and GET /api/jurisprudence/analyze/{job_id} endpoints"
affects: [77-02, frontend-jurisprudence-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [arq-job-with-claude-analysis, python-computed-scores-post-llm, ecli-hash-cache-key]

key-files:
  created:
    - backend/app/models/jurisprudence_job.py
    - backend/app/jobs/jurisprudence_analysis.py
    - backend/alembic/versions/2b8c3d4e5f6a_add_juridisch_analyse_jobs_table.py
  modified:
    - backend/app/ai/schemas.py
    - backend/app/ai/prompts.py
    - backend/app/ai/claude_client.py
    - backend/app/api/endpoints/jurisprudence.py
    - backend/app/jobs/worker.py
    - backend/app/core/config.py
    - backend/app/models/__init__.py

key-decisions:
  - "Python-computed vergunnings_succeskans and juridisch_klimaat_score (not LLM-generated) for deterministic scoring"
  - "ECLI list SHA256 hash in cache key for deterministic cache lookups across identical analysis sets"
  - "Manual Alembic migration (DB not running) following existing migration pattern"

patterns-established:
  - "ARQ job with Claude analysis: fetch external data, call Claude, compute scores in Python, cache in CachedAPIResponse"
  - "LLM output post-processing: Claude returns qualitative analysis, Python computes quantitative metrics from it"

requirements-completed: [AI-01, AI-02, AI-03, AI-04]

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 77 Plan 01: AI Juridisch Klimaat Backend Summary

**Complete backend pipeline for AI jurisprudence analysis: ClaudeClient method, ARQ job, JuridischAnalyseJob model, POST/GET endpoints with cache-first pattern and Python-computed vergunnings-succeskans**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-07T05:52:49Z
- **Completed:** 2026-03-07T05:57:46Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- JuridischAnalyseJob model with JSONB ecli_list, composite org+gemeente index, Alembic migration
- RulingAnalysis + JuridischAnalysisResult Pydantic schemas for structured Claude output
- ClaudeClient.analyze_jurisprudence() with text truncation, Python-computed scores
- ARQ background job that fetches ruling texts via RechtspraakClient, calls Claude, caches results
- POST /analyze with cache-first check, ECLI validation, rate limiting (10/min)
- GET /analyze/{job_id} polling with tenant isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create JuridischAnalyseJob model + AI schemas + prompt + migration** - `0a6187c` (feat)
2. **Task 2: Add ClaudeClient.analyze_jurisprudence() + ARQ job + endpoints + worker** - `50f545c` (feat)

## Files Created/Modified
- `backend/app/models/jurisprudence_job.py` - JuridischAnalyseJob DB model with JSONB ecli_list
- `backend/app/ai/schemas.py` - RulingAnalysis + JuridischAnalysisResult Pydantic schemas
- `backend/app/ai/prompts.py` - JURIDISCH_ANALYSE_PROMPT for Dutch court ruling analysis
- `backend/app/ai/claude_client.py` - analyze_jurisprudence() method with Python-computed scores
- `backend/app/jobs/jurisprudence_analysis.py` - ARQ job: fetch rulings, call Claude, cache results
- `backend/app/api/endpoints/jurisprudence.py` - POST /analyze + GET /analyze/{job_id} endpoints
- `backend/app/jobs/worker.py` - Registered jurisprudence_analysis_job in WorkerSettings
- `backend/app/core/config.py` - CACHE_TTL ai_juridisch entry (7 days)
- `backend/app/models/__init__.py` - Registered JuridischAnalyseJob
- `backend/alembic/versions/2b8c3d4e5f6a_add_juridisch_analyse_jobs_table.py` - Migration

## Decisions Made
- Python-computed vergunnings_succeskans (% toegewezen) and juridisch_klimaat_score (100 - % afgewezen) for deterministic scoring rather than asking Claude for numbers
- ECLI list SHA256 hash (first 16 chars) in cache key for deterministic lookups
- Manual Alembic migration because database container was not running; follows existing migration pattern exactly
- Prompt instructs Claude to return ONLY JSON without code fences, and explicitly states not to generate ECLI identifiers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ruff B904 missing `from exc` on raise**
- **Found during:** Task 2 (endpoints)
- **Issue:** `raise HTTPException(...)` in except clause without `from exc`
- **Fix:** Added `from exc` to the raise statement
- **Files modified:** backend/app/api/endpoints/jurisprudence.py
- **Verification:** ruff check passes
- **Committed in:** 50f545c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor lint fix, no scope creep.

## Issues Encountered
- Database container not running, preventing Alembic autogenerate. Resolved by writing migration manually following existing pattern from dedfd360f313.

## User Setup Required
None - no external service configuration required. ANTHROPIC_API_KEY already configured from Phase 62 (bestemmingsplan parsing).

## Next Phase Readiness
- Backend pipeline complete, ready for frontend UI (Phase 77 Plan 02)
- POST /api/jurisprudence/analyze and GET /api/jurisprudence/analyze/{job_id} endpoints available
- Migration needs `alembic upgrade head` on next DB start

---
*Phase: 77-ai-juridisch-klimaat*
*Completed: 2026-03-07*
