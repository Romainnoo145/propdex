---
phase: 106-perceel-dossier-upload
plan: 02
subsystem: ui
tags: [react, tanstack-query, file-upload, typescript, framer-motion]

# Dependency graph
requires:
  - phase: 106-01
    provides: "CRUD endpoints at /api/documents/{parcel_id}/documents"
provides:
  - "ParcelDocumentMeta TypeScript interface"
  - "useParcelDocuments, useUploadDocument, useDeleteDocument React Query hooks"
  - "BronnenLayer dossier cards with upload/download/delete actions"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["Blob download with auth header for binary file access", "mergeDocuments pattern to overlay user docs onto static card pages"]

key-files:
  created:
    - frontend/src/lib/types/document.ts
    - frontend/src/hooks/useDocuments.ts
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/map/panels/parcel/layers/BronnenLayer.tsx

key-decisions:
  - "Upload uses raw fetch (not apiFetch) to avoid Content-Type: application/json override on multipart FormData"
  - "Download uses authenticated blob fetch with temporary anchor click pattern (same as fetchAerialCrop)"
  - "Record<string, ParcelDocumentMeta[]> grouping instead of Map<> due to tsconfig noUncheckedIndexedAccess compatibility"
  - "Non-null assertion on pages[page] since pages always has 5 entries from buildPages"

patterns-established:
  - "mergeDocuments: overlay user documents onto static DossierCard pages by document_type key"
  - "CardDocumentSection: upload/download/delete actions per dossier card with loading state"

requirements-completed: [DOC-04]

# Metrics
duration: 7min
completed: 2026-03-12
---

# Phase 106 Plan 02: Frontend Document Upload UI Summary

**React Query hooks and BronnenLayer dossier card integration with upload/download/delete per card category**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-11T17:41:44Z
- **Completed:** 2026-03-11T17:48:36Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- ParcelDocumentMeta type + API functions for fetch/upload/delete documents
- React Query hooks (useParcelDocuments, useUploadDocument, useDeleteDocument) with cache invalidation
- BronnenLayer cards show upload button when empty, filename list with download/delete when documents exist
- Hero filledCount reflects both system data and user-uploaded documents

## Task Commits

Each task was committed atomically:

1. **Task 1: Document types, API functions, and React Query hooks** - `bb97c05` (feat)
2. **Task 2: BronnenLayer upload/download/delete UI per card** - `11134a9` (feat)

## Files Created/Modified
- `frontend/src/lib/types/document.ts` - ParcelDocumentMeta and list response interfaces
- `frontend/src/hooks/useDocuments.ts` - useParcelDocuments, useUploadDocument, useDeleteDocument hooks
- `frontend/src/lib/api.ts` - fetchParcelDocuments, uploadParcelDocument, deleteParcelDocument, getDocumentDownloadUrl
- `frontend/src/components/map/panels/parcel/layers/BronnenLayer.tsx` - Full upload/download/delete UI per dossier card

## Decisions Made
- Upload uses raw fetch (not apiFetch) because apiFetch auto-sets Content-Type to application/json which breaks multipart/form-data
- Download fetches blob with auth header then triggers download via temporary anchor element (same pattern as fetchAerialCrop)
- Used Record<string, ParcelDocumentMeta[]> instead of Map<> for document grouping due to tsconfig noUncheckedIndexedAccess compatibility
- Non-null assertion on pages[page] since buildPages always returns exactly 5 pages

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed energielabel access path**
- **Found during:** Task 2 (BronnenLayer integration)
- **Issue:** Plan referenced `enrichment_data.energielabel` but energielabel is a top-level field on ParcelEnrichmentResponse, not nested in enrichment_data
- **Fix:** Changed to `enrichment.data?.energielabel?.energieklasse`
- **Files modified:** frontend/src/components/map/panels/parcel/layers/BronnenLayer.tsx
- **Verification:** TypeScript compiles clean
- **Committed in:** 11134a9

**2. [Rule 3 - Blocking] Fixed noUncheckedIndexedAccess strictness on pages[page]**
- **Found during:** Task 2 (BronnenLayer integration)
- **Issue:** tsconfig.app.json has noUncheckedIndexedAccess: true, making pages[page] return DossierPage | undefined
- **Fix:** Added fallback + non-null assertion with safety comment (pages always has 5 entries)
- **Files modified:** frontend/src/components/map/panels/parcel/layers/BronnenLayer.tsx
- **Verification:** npm run check passes with 0 errors
- **Committed in:** 11134a9

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes required for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full document upload pipeline operational (backend + frontend)
- Each of 20 dossier card categories supports file upload
- Ready for next phase execution

---
*Phase: 106-perceel-dossier-upload*
*Completed: 2026-03-12*
