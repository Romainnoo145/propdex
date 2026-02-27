# 59-01 Summary — Bouwruimte Delta Contract + UI Integration

**Date:** 2026-02-27  
**Status:** Completed

## Delivered

- Added normalized backend schema for buildability envelope:
  - `backend/app/schemas/property.py`
  - New `BuildabilityDelta` block in `PropertyReportResponse`.

- Implemented deterministic buildability delta derivation in aggregator:
  - `backend/app/services/property_aggregator.py`
  - Calculates parcel area, current built proxy, TAR/FAR headroom, confidence, missing fields, and notes.

- Wired backfill detection so older reports get refreshed with phase-59 fields:
  - `backend/app/reports/router.py`
  - `buildability_delta` added to v7-backfill key set.

- Extended frontend report contract and UI:
  - `frontend/src/lib/types/property.ts`
  - `frontend/src/components/reports/ReportDetailPage.tsx`
  - New “Bouwruimte Delta” section in report detail.

- Extended map inspector quick view with same buildability contract:
  - `frontend/src/components/layout/InspectorPanel.tsx`
  - Condensed buildability information shown in panel context.

## Verification

- `ruff check backend/app/schemas/property.py backend/app/services/property_aggregator.py backend/app/reports/router.py` ✅
- `python -m py_compile backend/app/schemas/property.py backend/app/services/property_aggregator.py backend/app/reports/router.py` ✅
- `npm --prefix frontend run typecheck` ✅

## Notes

- Buildability v1 intentionally uses BAG gebruiksoppervlakte as current built-area proxy.
- Missing dimensional limits are surfaced explicitly (`missing_fields`) instead of hidden defaults.
- Report and map now share the same buildability payload contract.
