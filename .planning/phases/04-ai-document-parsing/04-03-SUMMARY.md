---
phase: 04-ai-document-parsing
plan: 03
subsystem: background-jobs
tags: [arq, redis, claude-ai, postgresql, async, multi-tenant]

# Dependency graph
requires:
  - phase: 04-01
    provides: AI infrastructure (anthropic, arq, schemas, models)
  - phase: 04-02
    provides: ClaudeClient, PDF downloader, AIParsingError
provides:
  - ARQ worker for background PDF parsing with tenant isolation
  - Plan aggregator service with cache-first strategy
  - Job enqueueing with PostgreSQL tracking
  - pdf_not_found status for upload fallback
affects: [04-04-api-endpoints, property-report-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [arq-worker-process, cache-first-orchestration, reusable-job-enqueue]

key-files:
  created:
    - backend/app/jobs/__init__.py
    - backend/app/jobs/worker.py
    - backend/app/jobs/pdf_parsing.py
    - backend/app/services/plan_aggregator.py
  modified: []

key-decisions:
  - "Worker creates own DB session (runs outside FastAPI lifecycle)"
  - "Upsert pattern for CachedAPIResponse (update if exists, create if not)"
  - "Cache-first strategy: check cache → active jobs → download failures → enqueue"
  - "Download failures return pdf_not_found + upload_required for user upload UI"
  - "enqueue_parsing_job reusable from both get_or_parse_plan and upload endpoint"
  - "max_tries=1 (no auto-retry per user decision)"
  - "Job status polling validates tenant ownership (organization_id)"

patterns-established:
  - "ARQ jobs create independent database sessions with engine lifecycle management"
  - "Cache key format: ai_parsed:{plan_idn} for 90-day TTL"
  - "Job failure captures error type (PDFDownloadError vs AIParsingError)"
  - "Plan aggregator detects prior download failures via error_message content"

# Metrics
duration: 2min 19s
completed: 2026-02-07
---

# Phase 04 Plan 03: ARQ Worker & Plan Aggregator Summary

**ARQ background worker processes Claude PDF parsing jobs with cache-first orchestration and tenant-isolated job tracking**

## Performance

- **Duration:** 2 minutes 19 seconds
- **Started:** 2026-02-07T09:21:40Z
- **Completed:** 2026-02-07T09:23:59Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- ARQ worker launchable via `arq app.jobs.worker.WorkerSettings` with max_tries=1, 5-minute timeout
- pdf_parsing_job downloads PDF → parses with Claude → stores in cache → updates job status
- Plan aggregator implements cache-first strategy: instant cache hit, or check active jobs, or detect download failures, or enqueue new job
- Tenant isolation enforced on all job queries (organization_id validation)
- Reusable enqueue_parsing_job callable from both orchestrator and upload endpoint

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ARQ worker and PDF parsing job function** - `70b55e2` (feat)
2. **Task 2: Create plan aggregator service (cache-first + job orchestration)** - `26bfa28` (feat)

## Files Created/Modified
- `backend/app/jobs/__init__.py` - Package marker for jobs module
- `backend/app/jobs/worker.py` - ARQ WorkerSettings with Redis config and job list
- `backend/app/jobs/pdf_parsing.py` - Background job: download → parse → cache → update status
- `backend/app/services/plan_aggregator.py` - Cache-first orchestration with job enqueueing

## Decisions Made

**1. Worker creates own DB session**
- ARQ worker runs outside FastAPI lifecycle
- Must create engine from settings.DATABASE_URL
- Session lifecycle managed per job execution
- Engine disposed in finally block

**2. Upsert pattern for cache storage**
- Check if CachedAPIResponse exists by (organization_id, cache_key)
- Update if exists, create if not
- Prevents duplicate entries while allowing cache refresh

**3. Cache-first strategy in plan aggregator**
- Step 1: Check cache by plan_idn (90-day TTL)
- Step 2: Check for active jobs (queued/in_progress)
- Step 3: Check for prior download failures (return pdf_not_found)
- Step 4: Enqueue new job via reusable function
- Makes repeated lookups instant, reduces Claude API costs

**4. Download failures return pdf_not_found status**
- Plan aggregator detects "PDFDownloadError" or "download" in error_message
- Returns AIParsingSection with status="pdf_not_found", upload_required=True
- Frontend can show upload UI per user decision from 04-CONTEXT

**5. Reusable enqueue_parsing_job function**
- Creates ParsingJob record + ARQ job in single transaction
- Callable from both get_or_parse_plan and future upload endpoint (04-04)
- Avoids duplication of job creation logic

**6. max_tries=1 (no auto-retry)**
- User decision from 04-CONTEXT: "User retries manually after fixing issue"
- Prevents repeated API failures from consuming rate limit

**7. Tenant isolation on job status polling**
- get_job_status validates organization_id matches job ownership
- Prevents cross-tenant job status leakage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all implementation proceeded as planned.

## User Setup Required

None - no external service configuration required. Worker uses existing REDIS_URL and ANTHROPIC_API_KEY from 04-01.

## Next Phase Readiness

**Ready for Plan 04-04 (API Endpoints):**
- ARQ worker ready to process jobs: `arq app.jobs.worker.WorkerSettings`
- Plan aggregator ready for endpoint integration: `get_or_parse_plan(plan_idn, org_id, session, arq_pool)`
- Job status polling ready: `get_job_status(job_id, org_id, session, arq_pool)`
- Reusable job enqueue ready for upload endpoint: `enqueue_parsing_job(plan_idn, org_id, session, arq_pool)`

**Integration pattern for 04-04:**
1. Extract plan_idn from zoning data via `get_primary_plan_idn(zoning_data)`
2. Call `get_or_parse_plan(plan_idn, org_id, session, arq_pool)` for AI section
3. Include AIParsingSection in PropertyReportResponse
4. Upload endpoint calls `enqueue_parsing_job()` after storing uploaded PDF

**Blockers:** None

**Concerns:**
- Redis must be running on localhost:6379 before worker can start
- Worker should be started in separate process from FastAPI server
- Real bestemmingsplan PDFs needed for integration testing

---
*Phase: 04-ai-document-parsing*
*Completed: 2026-02-07*

## Self-Check: PASSED
