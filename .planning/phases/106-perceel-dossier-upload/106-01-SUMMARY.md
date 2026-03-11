---
phase: 106-perceel-dossier-upload
plan: 01
subsystem: api
tags: [fastapi, sqlalchemy, file-upload, postgresql, largebinary, rls]

# Dependency graph
requires: []
provides:
  - "ParcelDocument SQLAlchemy model with tenant isolation"
  - "CRUD endpoints at /api/documents/{parcel_id}/documents"
  - "File upload validation (25MB max, PDF/image/DOCX/XLSX)"
  - "RLS policy on parcel_documents table"
affects: [106-02-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: ["LargeBinary document storage matching PDFDocument pattern", "defer() on file_data for list queries"]

key-files:
  created:
    - backend/app/models/parcel_document.py
    - backend/app/documents/__init__.py
    - backend/app/documents/router.py
    - backend/app/documents/schemas.py
    - backend/alembic/versions/3882c5c83b07_create_parcel_documents_table.py
  modified:
    - backend/app/models/__init__.py
    - backend/app/main.py

key-decisions:
  - "String(50) for document_type instead of PG ENUM for easy category evolution"
  - "validation_alias on DocumentResponse to map created_at to uploaded_at in API"
  - "20 valid document_type keys matching BronnenLayer card categories"

patterns-established:
  - "Document upload pattern: read bytes, validate size/type, store as LargeBinary"
  - "defer(file_data) on list queries to avoid memory bloat"

requirements-completed: [DOC-01, DOC-02, DOC-03, DOC-05]

# Metrics
duration: 4min
completed: 2026-03-12
---

# Phase 106 Plan 01: Backend Document Storage Summary

**Per-parcel document CRUD API with LargeBinary PostgreSQL storage, 25MB/6-type validation, and RLS tenant isolation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T17:36:28Z
- **Completed:** 2026-03-11T17:40:28Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- ParcelDocument model with TenantMixin, TimestampMixin, composite indexes, and RLS policy
- 4 CRUD endpoints (upload, list, download, delete) at /api/documents/{parcel_id}/documents
- File validation: 25MB max size, 6 allowed MIME types, 20 valid document categories
- Multi-tenant isolation on every query via organization_id filter + RLS

## Task Commits

Each task was committed atomically:

1. **Task 1: ParcelDocument model + Alembic migration** - `b8bd777` (feat)
2. **Task 2: Documents CRUD router + schemas + registration** - `b701961` (feat)

## Files Created/Modified
- `backend/app/models/parcel_document.py` - ParcelDocument model with LargeBinary storage
- `backend/app/documents/router.py` - Upload, list, download, delete endpoints
- `backend/app/documents/schemas.py` - DocumentResponse, DocumentListResponse Pydantic models
- `backend/app/documents/__init__.py` - Package init
- `backend/alembic/versions/3882c5c83b07_create_parcel_documents_table.py` - Migration with RLS
- `backend/app/models/__init__.py` - Registered ParcelDocument import
- `backend/app/main.py` - Registered documents_router

## Decisions Made
- Used String(50) for document_type instead of PostgreSQL ENUM to allow category evolution without migrations
- Added validation_alias on DocumentResponse to expose created_at as uploaded_at in API responses
- 20 document_type keys directly matching BronnenLayer card categories for frontend consistency

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Backend CRUD API ready for frontend integration (Plan 106-02)
- All endpoints enforce authentication and tenant isolation
- File size and type validation prevents abuse

---
*Phase: 106-perceel-dossier-upload*
*Completed: 2026-03-12*
