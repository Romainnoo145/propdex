---
phase: 04-ai-document-parsing
plan: 01
subsystem: infra
tags: [anthropic, claude, arq, redis, postgresql, ai, pdf, pydantic, sqlalchemy, alembic]

# Dependency graph
requires:
  - phase: 03-zoning-monument-intelligence
    provides: Property report structure, section-level source attribution, force_refresh pattern
  - phase: 02-core-data-pipeline
    provides: PostgreSQL cache pattern, httpx client, cache manager utilities
  - phase: 01-foundation-auth
    provides: TenantMixin, TimestampMixin, database infrastructure, Alembic setup
provides:
  - AI parsing infrastructure (Claude API client, ARQ task queue)
  - PDF storage model with tenant isolation and BYTEA storage
  - Parsing job tracking model for async job lifecycle
  - Structured output schemas for bestemmingsplan parsing with confidence scoring
  - 90-day cache TTL for ai_parsed data
affects: [04-02-claude-client, 04-03-async-worker, 04-04-api-endpoints, property-report-integration]

# Tech tracking
tech-stack:
  added: [anthropic>=0.40.0, arq>=0.27.0]
  patterns: [AI structured output schemas, confidence scoring (HIGH/MEDIUM/LOW), PDF binary storage in PostgreSQL, ARQ job metadata for tenant isolation]

key-files:
  created:
    - backend/app/ai/schemas.py
    - backend/app/models/pdf_document.py
    - backend/app/models/parsing_job.py
    - backend/alembic/versions/dedfd360f313_add_pdf_documents_and_parsing_jobs_.py
  modified:
    - backend/pyproject.toml
    - backend/app/core/config.py
    - backend/app/models/__init__.py

key-decisions:
  - "anthropic>=0.40.0 for native PDF support and structured outputs"
  - "arq>=0.27.0 for async Redis task queue (background PDF parsing jobs)"
  - "90-day cache TTL for ai_parsed data (same as bestemmingsplan - parsed data reused across addresses)"
  - "Confidence scoring mandatory: HIGH/MEDIUM/LOW per rule + overall confidence"
  - "pdf_not_found status with upload_required flag signals frontend to show upload UI"
  - "PDFDocument stores BYTEA with plan_idn for cross-address reuse"
  - "ParsingJob stores ARQ job_id with tenant isolation for secure job status queries"
  - "Composite indexes (organization_id, plan_idn) on both tables for efficient tenant-scoped queries"

patterns-established:
  - "AI structured output schemas with Literal types for controlled vocabularies"
  - "BuildingDimensionsAI nested model for dimension constraints extraction"
  - "AIParsingSection for property report integration with job status tracking"
  - "JobStatusResponse for polling endpoint with progress percentage"
  - "PDF binary storage in PostgreSQL (not filesystem) for multi-tenant isolation"

# Metrics
duration: 2m 40s
completed: 2026-02-07
---

# Phase 04 Plan 01: AI Document Parsing Foundation Summary

**anthropic and arq dependencies installed, Claude structured output schemas with confidence scoring, PostgreSQL models for PDF storage and job tracking with tenant isolation**

## Performance

- **Duration:** 2 min 40 sec
- **Started:** 2026-02-07T09:05:35Z
- **Completed:** 2026-02-07T09:08:15Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added anthropic>=0.40.0 and arq>=0.27.0 dependencies with mypy overrides
- Created AI structured output schemas (BestemmingsplanParsed, BestemmingsregelExtract, BuildingDimensionsAI, AIParsingSection, JobStatusResponse)
- Created PDFDocument model with LargeBinary storage for permanent PDF storage linked to plan_idn
- Created ParsingJob model with ARQ job_id tracking for tenant-isolated job status queries
- Added ANTHROPIC_API_KEY and REDIS_URL to Settings class for Claude API and ARQ task queue
- Generated and applied Alembic migration dedfd360f313 for pdf_documents and parsing_jobs tables
- Established 90-day cache TTL for ai_parsed data (consistent with bestemmingsplan data reuse pattern)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add dependencies, config settings, and AI output schemas** - `465e9c9` (feat)
   - anthropic and arq added to pyproject.toml
   - ANTHROPIC_API_KEY, REDIS_URL added to config.py
   - CACHE_TTL["ai_parsed"] = 7776000 (90 days)
   - app/ai/schemas.py with 6 Pydantic models

2. **Task 2: Create database models and Alembic migration** - `f2ff7d1` (feat)
   - PDFDocument model with LargeBinary, plan_idn, tenant isolation
   - ParsingJob model with job_id unique constraint, tenant isolation
   - Composite indexes on (organization_id, plan_idn)
   - Alembic migration generated and applied

## Files Created/Modified

### Created
- `backend/app/ai/__init__.py` - AI module package marker
- `backend/app/ai/schemas.py` - Pydantic schemas for Claude structured outputs (BestemmingsplanParsed with confidence scoring, AIParsingSection for property report integration, JobStatusResponse for polling endpoint)
- `backend/app/models/pdf_document.py` - SQLAlchemy model for PDF binary storage with plan_idn, file_data (LargeBinary), source_url, is_user_uploaded flag
- `backend/app/models/parsing_job.py` - SQLAlchemy model for ARQ job metadata with job_id (unique), plan_idn, status, error_message
- `backend/alembic/versions/dedfd360f313_add_pdf_documents_and_parsing_jobs_.py` - Migration creating pdf_documents and parsing_jobs tables with foreign keys (ON DELETE CASCADE), composite indexes

### Modified
- `backend/pyproject.toml` - Added anthropic>=0.40.0 and arq>=0.27.0 to dependencies (alphabetical), mypy overrides for both libraries
- `backend/app/core/config.py` - Added ANTHROPIC_API_KEY and REDIS_URL settings, CACHE_TTL["ai_parsed"] = 7776000
- `backend/app/models/__init__.py` - Imported PDFDocument and ParsingJob models for Alembic auto-detection

## Decisions Made

### Dependencies
- **anthropic>=0.40.0:** Claude API client with native PDF support (vision capabilities) and structured outputs (type-safe JSON responses). Version 0.40.0+ required for PDF document message format.
- **arq>=0.27.0:** Async Redis task queue for background PDF parsing jobs. Prevents HTTP timeout issues (Claude parsing can take 10-30 seconds per document).

### Configuration
- **ANTHROPIC_API_KEY setting:** Required for Claude API authentication, loaded from .env via pydantic-settings
- **REDIS_URL setting:** Default redis://localhost:6379/0 for ARQ message broker, configurable per environment
- **ai_parsed cache TTL 90 days:** Same as bestemmingsplan data - parsed plan rules apply to all addresses in that zoning area, so caching parsed output for 90 days enables efficient reuse

### AI Schemas
- **Confidence scoring mandatory:** Every BestemmingsregelExtract has confidence field (HIGH/MEDIUM/LOW), overall BestemmingsplanParsed has overall_confidence. Frontend must display disclaimers for LOW confidence items.
- **pdf_not_found status:** AIParsingSection supports pdf_not_found status with upload_required=True flag. Signals frontend to show upload UI when auto-download fails (per user decision in 04-CONTEXT.md).
- **Dutch disclaimers in schemas:** disclaimer and disclaimers fields contain Dutch warnings for end users. disclaimer_banner provides section-level warning for property reports.
- **BuildingDimensionsAI nested model:** Structured extraction of dimension rules (max_bouwhoogte, max_goothoogte, max_bebouwingspercentage, etc.) with overige dict for uncommon rules.
- **JobStatusResponse for polling:** Frontend polls GET /api/parsing-jobs/{job_id}/status to track progress (queued → in_progress → complete/failed) with progress_pct field.

### Database Models
- **PDF storage in PostgreSQL:** PDFDocument stores PDF bytes in LargeBinary (BYTEA) column, not filesystem. Enables multi-tenant isolation, transactional consistency, and eliminates file path security concerns.
- **plan_idn as reuse key:** Multiple addresses in same bestemmingsplan area share one PDF. PDFDocument keyed by (organization_id, plan_idn) for efficient lookup and storage deduplication.
- **ParsingJob for tenant isolation:** ARQ job_id stored with organization_id in parsing_jobs table. Prevents cross-tenant job status leakage - job status endpoint validates organization ownership.
- **Composite indexes for queries:** ix_pdf_documents_org_plan and ix_parsing_jobs_org_plan optimize tenant-scoped queries (SELECT WHERE organization_id = ? AND plan_idn = ?).
- **job_id unique constraint:** Ensures one ParsingJob record per ARQ job, enables idempotent job creation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all dependencies installed successfully, schemas validated, migration applied cleanly.

## User Setup Required

**External services require manual configuration.** See [04-USER-SETUP.md](./04-USER-SETUP.md) for:

### Anthropic API
- Environment variable: `ANTHROPIC_API_KEY`
- Source: Anthropic Console → API Keys (https://console.anthropic.com/settings/keys)
- Why: Claude API for PDF parsing

### Redis
- Environment variable: `REDIS_URL`
- Source: Local Redis: `redis://localhost:6379/0` — ensure Redis container or service is running
- Why: ARQ task queue message broker

### Verification commands
```bash
# Check Anthropic API key is set
python -c "from app.core.config import settings; assert settings.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY not set'"

# Check Redis is running and accessible
redis-cli ping  # Should return PONG

# Verify ARQ can connect
python -c "from arq import create_pool; import asyncio; asyncio.run(create_pool('redis://localhost:6379/0'))"
```

## Next Phase Readiness

### Ready for Next Plans
- **Plan 04-02 (Claude API client):** Schemas, config, and PDF storage model ready for ClaudeAPIClient implementation
- **Plan 04-03 (ARQ worker):** ParsingJob model and arq dependency ready for worker implementation
- **Plan 04-04 (API endpoints):** AIParsingSection schema ready for property report integration

### Infrastructure Requirements
- **Anthropic API key required:** Get from https://console.anthropic.com/settings/keys before Plan 04-02
- **Redis must be running:** Start Redis container/service before Plan 04-03 (ARQ worker)
- **Database migration applied:** Tables exist, ready for data operations

### Schema Completeness
All Phase 4 schemas defined upfront in 04-01:
- BestemmingsplanParsed: Complete AI output structure
- BestemmingsregelExtract: Individual zoning rule with confidence
- BuildingDimensionsAI: Dimension constraints extraction
- AIParsingSection: Property report integration
- JobStatusResponse: Polling endpoint response

This enables Plans 04-02, 04-03, 04-04 to import from app.ai.schemas without schema iteration.

### Testing Readiness
- **Database tables exist:** Can write integration tests for PDF storage and job tracking
- **Schemas validate:** Can write unit tests for Pydantic model validation
- **Config loads:** Can write tests for ANTHROPIC_API_KEY and REDIS_URL loading

### Blockers
None - foundation complete, no blockers for subsequent plans.

---

## Self-Check: PASSED

**Files created verification:**
```bash
# All key-files.created exist on disk
[FOUND] backend/app/ai/schemas.py
[FOUND] backend/app/models/pdf_document.py
[FOUND] backend/app/models/parsing_job.py
[FOUND] backend/alembic/versions/dedfd360f313_add_pdf_documents_and_parsing_jobs_.py
```

**Commits exist verification:**
```bash
# All task commits exist in git log
[FOUND] 465e9c9 (Task 1: Dependencies, config, schemas)
[FOUND] f2ff7d1 (Task 2: Database models, migration)
```

---
*Phase: 04-ai-document-parsing*
*Completed: 2026-02-07*
