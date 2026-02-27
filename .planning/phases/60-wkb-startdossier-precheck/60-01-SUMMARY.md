# 60-01 Summary — Wkb Startdossier Precheck (Layer A + optionele Layer B)

**Date:** 2026-02-27  
**Status:** Completed

## Delivered

- Added Wkb precheck report contract in backend schema:
  - `backend/app/schemas/property.py`
  - New blocks:
    - `WkbPrecheck`
    - `WkbRuleHit`
    - `WkbRefinementInput`
    - `WkbLayerBResult`
  - `PropertyReportResponse` now includes `wkb_precheck`.

- Implemented rule-based evaluator service:
  - `backend/app/services/wkb_precheck.py`
  - Entry point: `evaluate_wkb_precheck(...)`
  - Layer A (automatic) evaluates dossier signals (BAG status, monument context, zoning context, buildability delta).
  - Optional Layer B refinement contract is supported and adjusts score/status/confidence when input is supplied.

- Wired evaluator into report aggregation pipeline:
  - `backend/app/services/property_aggregator.py`
  - `wkb_precheck` now generated on every aggregated report.
  - Added `section_sources` attribution for `wkb_precheck`.

- Added backfill compatibility for existing reports:
  - `backend/app/reports/router.py`
  - v7 backfill now includes `wkb_precheck` key detection.

- Added frontend type support and report rendering:
  - `frontend/src/lib/types/property.ts`
  - `frontend/src/components/reports/ReportDetailPage.tsx`
  - New “Wkb Startdossier” section with status, confidence, rule hits, required documents, missing inputs, and Layer B availability.

- Added targeted unit coverage:
  - `backend/tests/unit/test_wkb_precheck.py`
  - Verifies no-context fallback, Layer A strong-signal path, and Layer B refinement application.

## Verification

- `ruff check backend/app/schemas/property.py backend/app/services/property_aggregator.py backend/app/services/wkb_precheck.py backend/app/reports/router.py backend/tests/unit/test_wkb_precheck.py` ✅
- `python -m py_compile backend/app/schemas/property.py backend/app/services/property_aggregator.py backend/app/services/wkb_precheck.py backend/app/reports/router.py` ✅
- `pytest -q backend/tests/unit/test_wkb_precheck.py` ✅ (3 passed)
- `npm --prefix frontend run typecheck` ✅

## Notes

- Layer A is always present; users are not blocked by a wizard flow.
- Layer B is intentionally optional and represented as a refinement contract in the same payload.
- Output is explicitly framed as decision support (not legal adjudication).
