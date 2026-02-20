# Quick Task 3: Commit bekendmaking matching implementation

## Result: COMPLETE

**Commit:** `257041e`
**Date:** 2026-02-20
**Files:** 14 (3 new + 11 modified)

## What was committed

### New files (3)
- `backend/app/services/postcode_extractor.py` — Dutch postcode regex extraction
- `backend/app/services/bekendmaking_matcher.py` — Matching service (parcels, reports, reverse lookup)
- `backend/alembic/versions/c3d4e5f6a7b8_add_postcode_to_change_records.py` — Migration

### Modified files (11)
- `backend/app/models/change_record.py` — Added postcode column
- `backend/app/services/change_detector.py` — Extract postcode during detection
- `backend/app/jobs/change_monitor.py` — Fixed description bug, copy postcode + source_url
- `backend/app/schemas/monitoring.py` — Added MatchedParcel, MatchedReport schemas
- `backend/app/monitoring/router.py` — Enhanced /changes endpoint, new /changes-for-parcel endpoint
- `frontend/src/lib/types/monitoring.ts` — Added match types
- `frontend/src/lib/api.ts` — Added fetchChangesForParcel
- `frontend/src/hooks/useNotifications.ts` — Added useParcelChanges hook
- `frontend/src/components/notifications/ChangeTimeline.tsx` — Match pills + navigation links
- `frontend/src/components/results/ParcelDetailModal.tsx` — Meldingen section
- `frontend/src/routes/_authenticated/resultaten.tsx` — Added highlight search param

## Verification
- `ruff check` — 0 errors
- `npm run check` — 0 errors
- Migration ran successfully
- Only bekendmaking files committed; unrelated changes remain unstaged
