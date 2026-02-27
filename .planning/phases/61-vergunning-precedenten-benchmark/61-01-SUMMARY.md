# 61-01 Summary — Vergunning Precedenten Benchmark

**Date:** 2026-02-27  
**Status:** Completed

## Delivered

- Added permit benchmark contract to report schema:
  - `backend/app/schemas/property.py`
  - New blocks:
    - `PermitPrecedentBenchmark`
    - `PermitPrecedentReference`
  - `PropertyReportResponse` now includes `permit_precedents`.

- Implemented municipality-scoped benchmark service:
  - `backend/app/services/permit_precedent_benchmark.py`
  - Entry point: `build_permit_precedent_benchmark(...)`
  - v1 logic includes:
    - gemeente scope resolution from report address hints + monitoring history
    - comparable-type derivation for permits
    - sample size + lookback window
    - outcome distribution (`granted/rejected/withdrawn/requested/other`)
    - median + p75 processing-days estimate from aanvraag→uitkomst trajectories
    - recent reference cases with source links
    - low-sample warning guardrail

- Wired benchmark into report aggregation pipeline:
  - `backend/app/services/property_aggregator.py`
  - `permit_precedents` now generated during report aggregation and included in payload.
  - Added `section_sources` attribution for `permit_precedents`.

- Added report backfill key coverage:
  - `backend/app/reports/router.py`
  - Existing saved reports are now eligible for refresh when `permit_precedents` is missing.

- Added frontend typing + report UI section:
  - `frontend/src/lib/types/property.ts`
  - `frontend/src/components/reports/ReportDetailPage.tsx`
  - New “Vergunning Precedenten” section with:
    - gemeente/type/sample overview
    - median/p75 duration cards
    - outcome distribution chips
    - recent reference list + source links
    - low-sample caveat banner

- Added targeted unit tests for benchmark helpers:
  - `backend/tests/unit/test_permit_precedent_benchmark.py`

## Verification

- `ruff check backend/app/schemas/property.py backend/app/services/property_aggregator.py backend/app/services/permit_precedent_benchmark.py backend/app/services/wkb_precheck.py backend/app/reports/router.py backend/tests/unit/test_wkb_precheck.py backend/tests/unit/test_permit_precedent_benchmark.py` ✅
- `python -m py_compile backend/app/schemas/property.py backend/app/services/property_aggregator.py backend/app/services/permit_precedent_benchmark.py backend/app/services/wkb_precheck.py backend/app/reports/router.py` ✅
- `pytest -q backend/tests/unit/test_wkb_precheck.py backend/tests/unit/test_permit_precedent_benchmark.py` ✅ (9 passed)
- `npm --prefix frontend run typecheck` ✅

## Notes

- This is a pragmatic v1 benchmark built on monitored permit history (`change_records`) and title/category inference.
- Processing-time estimates are trajectory-based proxies (aanvraag→uitkomst) and include explicit caveats via sample-size warnings.
