---
phase: 05
plan: 01
subsystem: report-storage
tags: [database, sqlalchemy, pydantic, alembic, jsonb, multi-tenant]
requires:
  - 04-04 # PropertyReportResponse schema for JSONB storage
  - 01-01 # Base, TenantMixin, TimestampMixin patterns
provides:
  - saved_reports table with JSONB storage and soft-delete
  - projects table for report folder organization
  - Report and Project Pydantic schemas for CRUD operations
  - GIN trigram index for fast address search
affects:
  - 05-02 # CRUD endpoints will use these models and schemas
  - 05-03 # PDF export will read from saved_reports table
tech-stack:
  added: []
  patterns:
    - JSONB storage for PropertyReportResponse snapshots
    - Denormalized fields (postcode, city) for efficient filtering
    - Soft-delete pattern with deleted_at timestamp
    - GIN trigram indexes for full-text search on addresses
    - Optional foreign key with SET NULL for project organization
key-files:
  created:
    - backend/app/models/report.py
    - backend/app/models/project.py
    - backend/app/schemas/report.py
    - backend/app/schemas/project.py
    - backend/alembic/versions/010b8bb88094_add_saved_reports_and_projects_tables.py
  modified:
    - backend/app/models/__init__.py
key-decisions:
  - id: 83
    decision: "JSONB storage for full PropertyReportResponse"
    rationale: "Enables complete report snapshots with all sections (address, building, parcels, zoning, monuments, AI parsing) for historical comparison and PDF export"
  - id: 84
    decision: "Denormalized postcode and city fields"
    rationale: "Enables efficient filtering and searching without JSONB queries; composite indexes (org, city) and (org, postcode) support common query patterns"
  - id: 85
    decision: "Soft-delete with deleted_at column"
    rationale: "Recoverable deletion provides safety net for accidental deletions; indexed for efficient 'WHERE deleted_at IS NULL' queries"
  - id: 86
    decision: "GIN trigram index on report_name"
    rationale: "Enables fast ILIKE '%address%' searches for finding reports by partial address; pg_trgm extension provides trigram matching"
  - id: 87
    decision: "Optional project_id with SET NULL"
    rationale: "Reports can exist without projects; deleting project doesn't delete reports (folder organization, not ownership)"
  - id: 88
    decision: "Auto-generated report_name from address"
    rationale: "Consistent naming convention; report_name not user-editable (locked decision from plan)"
  - id: 89
    decision: "Composite indexes with organization_id first"
    rationale: "Follows project decision #6; PostgreSQL query planner can efficiently use indexes for tenant-filtered queries"
duration: "3m 6s"
completed: "2026-02-07"
---

# Phase 05 Plan 01: Report Storage Foundation Summary

**One-liner:** JSONB storage for PropertyReportResponse with denormalized filtering, soft-delete, GIN trigram search, and optional project folders

## Performance

| Metric | Value |
|--------|-------|
| **Duration** | 3 minutes 6 seconds |
| **Started** | 2026-02-07T10:37:41Z |
| **Completed** | 2026-02-07T10:40:47Z |
| **Tasks** | 3/3 completed |
| **Commits** | 3 atomic commits |
| **Files Created** | 5 files |
| **Files Modified** | 1 file |

## What Was Accomplished

### Task 1: Create SavedReport and Project Database Models
- **SavedReport model** with JSONB report_data column for full PropertyReportResponse snapshots
- **Denormalized fields**: postcode (String(7)), city (String(100)) for efficient filtering
- **Soft-delete**: deleted_at timestamp for recoverable deletion
- **project_id FK**: Optional reference to projects.id with SET NULL on delete
- **Composite indexes** with organization_id first: (org, created_at), (org, updated_at), (org, city), (org, project)
- **GIN trigram index**: ix_saved_reports_name_gin on report_name using gin_trgm_ops
- **Project model** with name (String(100)), description (Text), composite index (org, name)
- Both inherit Base, TenantMixin, TimestampMixin following established patterns

### Task 2: Create Alembic Migration
- **pg_trgm extension**: Enabled via CREATE EXTENSION IF NOT EXISTS for trigram search
- **Migration**: Creates projects table before saved_reports (FK dependency order)
- **9 indexes created**: All composite indexes, GIN trigram index, soft-delete index
- **Downgrade**: Drops tables in reverse order (saved_reports first, then projects)
- **Model imports**: Added Project and SavedReport to app/models/__init__.py for Alembic detection
- **Migration ran cleanly**: alembic upgrade head succeeded, alembic check shows no drift

### Task 3: Create Pydantic Schemas
- **Project schemas**: ProjectCreate, ProjectUpdate, ProjectResponse (with report_count), ProjectListResponse
- **Report save**: ReportSaveRequest with validator for PropertyReportResponse compatibility
- **Report updates**: ReportUpdateNotes (for notes field), ReportAssignProject (for project_id)
- **Report list**: ReportListItem (lightweight, no JSONB) with completeness_score
- **Report detail**: ReportDetailResponse (includes full report_data JSONB)
- **Freshness check**: ReportFreshnessResponse for "Update available" notifications
- **Sort types**: SortField and SortOrder Literal types for list filtering
- **All schemas** use ConfigDict(from_attributes=True) for ORM mapping

## Task Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 922187c | feat(05-01): create SavedReport and Project database models |
| 2 | 98bf446 | feat(05-01): add Alembic migration for saved_reports and projects tables |
| 3 | a037007 | feat(05-01): create Pydantic schemas for reports and projects |

## Files Created

1. **backend/app/models/report.py** (84 lines)
   - SavedReport model with JSONB, soft-delete, denormalized fields
   - Composite indexes (org, created/updated/city/project)
   - GIN trigram index on report_name

2. **backend/app/models/project.py** (40 lines)
   - Project model for report folder organization
   - Composite index (org, name)

3. **backend/app/schemas/report.py** (178 lines)
   - 7 schemas for report CRUD operations
   - PropertyReportResponse validation on save
   - Literal types for sort parameters

4. **backend/app/schemas/project.py** (78 lines)
   - 4 schemas for project CRUD operations
   - report_count field for displaying folder size

5. **backend/alembic/versions/010b8bb88094_add_saved_reports_and_projects_tables.py** (77 lines)
   - Migration creating both tables with all indexes
   - pg_trgm extension enablement

## Files Modified

1. **backend/app/models/__init__.py**
   - Added imports for Project and SavedReport
   - Required for Alembic autogenerate detection

## Decisions Made

### Decision 83: JSONB Storage for Full PropertyReportResponse
**Context:** SavedReport needs to store complete property intelligence reports for historical comparison and PDF export.

**Decision:** Store entire PropertyReportResponse dict in report_data JSONB column.

**Rationale:**
- Captures complete snapshot including all sections (address, building, parcels, zoning, monuments, AI parsing)
- Enables historical comparison ("what changed since last save?")
- Supports PDF export without re-querying APIs
- PostgreSQL JSONB provides efficient storage and querying
- No need to normalize individual fields (denormalized postcode/city sufficient for filtering)

**Impact:** Report saves preserve complete state at save time, enabling freshness checks and accurate PDF generation.

---

### Decision 84: Denormalized Postcode and City Fields
**Context:** Reports need to be filterable by location without complex JSONB queries.

**Decision:** Store postcode and city as separate String columns alongside JSONB report_data.

**Rationale:**
- Enables efficient composite indexes: (organization_id, city), (organization_id, postcode)
- Supports "List all reports in Amsterdam" without JSONB extraction
- PostgreSQL b-tree indexes faster than JSONB GIN indexes for exact matches
- Data duplication minimal (14 bytes per report)

**Impact:** Report list queries can filter by location using standard indexes, avoiding JSONB query overhead.

---

### Decision 85: Soft-Delete with deleted_at Column
**Context:** Users may accidentally delete reports; hard deletes are unrecoverable.

**Decision:** Use deleted_at timestamp for soft-delete with ix_saved_reports_deleted index.

**Rationale:**
- Provides recovery mechanism for accidental deletions
- Enables "undo" functionality in frontend
- Audit trail for compliance (who deleted what when)
- Index on deleted_at makes "WHERE deleted_at IS NULL" queries efficient
- Can be hard-deleted later via background job if needed

**Impact:** All report queries must filter WHERE deleted_at IS NULL; deleted reports recoverable for MVP.

---

### Decision 86: GIN Trigram Index on report_name
**Context:** Users need to search reports by partial address (e.g., "Kalver" finds "Kalverstraat 123").

**Decision:** Create GIN index using pg_trgm extension: ix_saved_reports_name_gin with gin_trgm_ops.

**Rationale:**
- Enables fast ILIKE '%address%' queries for autocomplete and search
- Trigram matching handles typos and partial matches
- PostgreSQL pg_trgm native extension, no external dependencies
- GIN index size reasonable for expected report volume (< 100K reports per org)

**Impact:** Address search requires pg_trgm extension (added in migration); ILIKE queries efficient even with thousands of reports.

---

### Decision 87: Optional project_id with SET NULL
**Context:** Projects provide folder organization but reports can exist independently.

**Decision:** project_id is nullable ForeignKey with ondelete="SET NULL".

**Rationale:**
- Reports don't require project assignment (flat list is valid)
- Deleting project shouldn't delete reports (folder organization, not ownership)
- SET NULL preserves reports when project deleted
- Users can move reports between projects or remove from projects

**Impact:** Project deletion safe (doesn't cascade to reports); reports can be organized flexibly.

---

### Decision 88: Auto-Generated report_name from Address
**Context:** Plan specifies report_name is "auto-generated from address (locked decision: not user-editable)".

**Decision:** report_name generated from address.straatnaam, huisnummer, postcode (format TBD in 05-02).

**Rationale:**
- Consistent naming convention across all reports
- Prevents naming conflicts and confusion
- Simplifies save logic (no user input required)
- Supports search and filtering via GIN index

**Impact:** Report creation must extract address components; naming format locked for consistency.

---

### Decision 89: Composite Indexes with organization_id First
**Context:** All queries filtered by organization_id (multi-tenant isolation).

**Decision:** All composite indexes place organization_id first: (org, created_at), (org, updated_at), (org, city), (org, project).

**Rationale:**
- Follows project decision #6
- PostgreSQL query planner can use index for tenant-filtered queries
- Prevents full table scans on multi-tenant queries
- Standard pattern across all CRM Plus models

**Impact:** Query performance optimal for tenant-scoped operations; indexes structured identically to other models.

## Deviations from Plan

None - plan executed exactly as written. All specified models, schemas, and indexes created according to plan requirements.

## Issues Encountered

### Issue 1: Alembic Autogenerate Initially Failed
**Problem:** First migration autogenerate produced empty upgrade/downgrade functions.

**Root Cause:** New models (Project, SavedReport) not imported in app/models/__init__.py, so Alembic couldn't detect them.

**Resolution:** Added imports to __init__.py, deleted empty migration, regenerated successfully. Standard Alembic pattern.

**Prevention:** Always update models/__init__.py when adding new models (documented in models/base.py).

## Next Phase Readiness

### Ready for 05-02 (CRUD Endpoints)
- ✓ SavedReport and Project models available for ORM operations
- ✓ All Pydantic schemas ready for request/response validation
- ✓ Database tables and indexes created
- ✓ Soft-delete pattern established (WHERE deleted_at IS NULL)
- ✓ Multi-tenant isolation via organization_id on all queries

### Ready for 05-03 (PDF Export)
- ✓ report_data JSONB contains complete PropertyReportResponse
- ✓ ReportDetailResponse schema for reading saved reports
- ✓ All sections available (address, building, parcels, zoning, monuments, AI parsing)

### Blockers
None - all dependencies satisfied, database schema ready for CRUD operations.

### Recommendations for 05-02
1. **report_name generation**: Extract from report_data['address'] fields, format as "{straatnaam} {huisnummer}, {postcode} {woonplaats}"
2. **completeness_score extraction**: Read from report_data['completeness_score'] for ReportListItem
3. **Soft-delete queries**: All list endpoints must filter `WHERE deleted_at IS NULL`
4. **GIN search syntax**: Use `WHERE report_name ILIKE '%query%'` for address search (trigram index optimized)
5. **Project report_count**: Use COUNT subquery or aggregate when fetching ProjectResponse

## Self-Check: PASSED

✓ All created files exist:
- backend/app/models/report.py
- backend/app/models/project.py
- backend/app/schemas/report.py
- backend/app/schemas/project.py
- backend/alembic/versions/010b8bb88094_add_saved_reports_and_projects_tables.py

✓ All commits exist:
- 922187c
- 98bf446
- a037007

✓ Database verification:
- Tables created: projects, saved_reports
- Indexes created: 9 indexes (composite + GIN + soft-delete)
- pg_trgm extension enabled

✓ Code quality:
- All models import without errors
- All schemas import without errors
- Alembic check shows no model drift
- Ruff check passes on all files
