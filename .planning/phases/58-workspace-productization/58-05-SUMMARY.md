# 58-05 Summary — Monitoring + Idempotency Hardening Handoff

**Date:** 2026-02-27  
**Status:** Completed

## Delivered

- Hardened parcel-report idempotency contract in backend:
  - `backend/app/reports/router.py`
  - `backend/app/reports/service.py`
  - `backend/app/schemas/report.py`
  - `POST /api/reports/from-parcel` now returns:
    - `report` payload
    - explicit `created: true|false`
  - Endpoint keeps HTTP semantics:
    - `201` when new report is created
    - `200` when existing parcel-linked report is reused
  - Added race-safe fallback in service layer for concurrent parcel generation calls.

- Extended report schemas with source parcel linkage visibility:
  - `backend/app/schemas/report.py`
  - `frontend/src/lib/types/report.ts`
  - `ReportDetailResponse` / `ReportListItem` now include `source_parcel_id`.

- Aligned frontend parcel report flow with explicit idempotency response:
  - `frontend/src/lib/api.ts`
  - `frontend/src/hooks/useReports.ts`
  - `frontend/src/components/results/ParcelDetailModal.tsx`
  - UI now distinguishes between:
    - new report creation
    - opening existing parcel report

- Added monitoring subscription status richness at gemeente scope:
  - `backend/app/schemas/monitoring.py`
  - `backend/app/monitoring/router.py`
  - New status fields:
    - `monitored_projects`
    - `total_projects`
    - `has_root_project`
  - New status endpoint:
    - `GET /api/monitoring/subscriptions/{gemeente_code}`

- Improved workspace monitoring clarity in frontend:
  - `frontend/src/lib/types/monitoring.ts`
  - `frontend/src/components/projects/ProjectList.tsx`
  - `frontend/src/components/projects/GemeenteDetailView.tsx`
  - Added explicit monitoring state cues and scoped counts in toasts/metrics.
  - Refresh action is now monitoring-aware at gemeente scope.

- Added report-detail UX cue for parcel-linked reports:
  - `frontend/src/components/reports/ReportDetailPage.tsx`
  - `frontend/src/routes/_authenticated/rapport.$id.tsx`
  - Shows parcel-link + duplicate-protection badges when applicable.

- Added/updated integration coverage:
  - `backend/tests/integration/test_reports_router.py`
  - New assertion path validates idempotent from-parcel behavior and one-row guarantee.

## Verification

- `frontend: npm run -s typecheck` ✅
- `backend: DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5434/propdex pytest -q backend/tests/integration/test_reports_router.py -k from_parcel` ✅

## Notes

- Local backend integration tests require a PostGIS-backed database; plain Postgres on `:5432` is insufficient for geometry models.
- Phase 58 handoff is now ready for the next monetization-oriented workspace modules (subsidies, persona-specific outputs, dossier automation).
