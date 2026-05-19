---
phase: 08-brk-fase-2-wire-up
plan: 01
subsystem: api

tags: [brk, m050, s06, kadaster, multi-tenant, avg, fastapi, sqlalchemy, pydantic, regression-iron-rule]

requires:
  - phase: 01-brk-datamodel-retention
    provides: BrkOwnershipRecord model + soft_delete + retention infra
  - phase: 02-brk-fetch-persist-endpoint
    provides: brk_fetch_service.get_latest_for_parcel pattern + brk_router POST handler
  - phase: 03-scoring-factoren-cascade
    provides: BRKRecordDict / scoring_pipeline read pattern (AD2 multi-tenant lessons)
provides:
  - GET /api/parcels/{parcel_id}/brk read-only endpoint (M050/S06 read-path)
  - brk_read_service.read_for_parcel (org_id + parcel_id + soft_deleted_at filter)
  - Latest fetch-cycle semantics (MAX(fetched_at) anchor; multi-owner ALL-row return)
  - REGRESSION-CRITICAL iron-rule test pinning cross-org silent isolation
  - Signature-drift guard on read_for_parcel kwarg-only params
affects: [08-02 frontend-hooks, 08-03 wire-up, future M050+ read consumers]

tech-stack:
  added: []
  patterns:
    - "brk_read_service split from brk_fetch_service — D10 import direction: persist channel imports nothing from read channel"
    - "Cross-org silent isolation (returns [], never 403/404) — AD2 existence-leak guard"
    - "REGRESSION-CRITICAL drift-detection harness: WHERE-clause SQL inspection + endpoint integration"

key-files:
  created:
    - "backend/app/services/brk_read_service.py (50 LOC; read_for_parcel)"
    - "backend/tests/unit/services/test_brk_read_service.py (5 unit tests)"
    - "backend/tests/unit/scans/test_brk_router_get.py (4 unit tests)"
    - "backend/tests/unit/scans/__init__.py (new test sub-namespace)"
    - "backend/tests/regression/test_multi_tenant_brk_isolation.py (5 REGRESSION-CRITICAL tests)"
  modified:
    - "backend/app/scans/brk_router.py (+ GET handler after existing POST; POST untouched)"

key-decisions:
  - "read_for_parcel takes kwarg-only params (* forced) — signature-drift guard pins it; prevents accidental positional misuse that could swap organization_id with parcel_id"
  - "Multi-owner same-MAX(fetched_at) test uses mocked AsyncSession — DB UNIQUE constraint uq_brk_org_parcel_fetched blocks ORM inserts at identical timestamps; mock-DB pattern exercises the MAX-anchor branch defensively"
  - "Test 4 (query_includes_org_filter) slices WHERE clause text specifically — SELECT clause references all columns including organization_id, so substring match on full SQL would false-positive even with filter removed"
  - "Cross-org endpoint test asserts 200 + [] (NIET 403, NIET 404) — silent isolation prevents existence leak per ENG-PLAN AD2"

patterns-established:
  - "Service-layer split by channel: brk_fetch_service (writes + Kadaster) vs brk_read_service (reads only) — single-responsibility separation; D10 import direction holds"
  - "REGRESSION-CRITICAL test files document drift-detection procedure inline in module docstring — reviewer can replicate without external instructions"
  - "Drift-detection verified end-to-end during execution: temporary filter removal → test fails with AVG-breach assertion → restore filter → 14/14 green"

requirements-completed: [WIRE-04, TEST-09]

duration: 9m 54s
completed: 2026-05-19
---

# Phase 08 Plan 01: BRK Read-path Backend Foundation Summary

**GET /api/parcels/{parcel_id}/brk + brk_read_service with multi-tenant iron-rule regression test (14/14 green, drift-detection verified)**

## Performance

- **Duration:** 9m 54s
- **Started:** 2026-05-19T11:01:24Z
- **Completed:** 2026-05-19T11:11:18Z
- **Tasks:** 3
- **Files created:** 5
- **Files modified:** 1

## Accomplishments

- New GET /api/parcels/{parcel_id}/brk endpoint added after existing POST persist handler — Phase 105 + S02 untouched (zero risk of regression to live persist channel).
- New brk_read_service (50 LOC, ≤80 LOC target) with `read_for_parcel(*, db, organization_id, parcel_id)`: kwarg-only signature pinned by Test 3 signature-drift guard.
- Latest fetch-cycle semantics: anchor on MAX(fetched_at), return ALL rows sharing that timestamp — defensive multi-owner support verified via mocked-DB unit test.
- 5 REGRESSION-CRITICAL tests pin AD2 cross-org silent isolation iron-rule at endpoint + SQL-WHERE-clause + signature layers.
- Drift-detection executed end-to-end: filter temporarily removed → 2 tests fail with `AVG breach: org_a saw 1 rows belonging to org_b` and `WHERE clause no longer filters by organization_id` → filter restored → 14/14 green.
- Frontend Plan 08-02 read-path unblocked.

## Task Commits

1. **Task 1: brk_read_service + GET handler** — `249b3a2c` (feat)
2. **Task 2: 9 unit tests (5 service + 4 router)** — `d0c548e8` (test)
3. **Task 3: 5 REGRESSION-CRITICAL multi-tenant tests** — `4762e74e` (test)

## Files Created/Modified

- `backend/app/services/brk_read_service.py` (NEW) — 50 LOC, `read_for_parcel` reads from BrkOwnershipRecord with org_id + parcel_id + soft_deleted_at filter; returns latest fetch-cycle.
- `backend/app/scans/brk_router.py` (MOD) — added GET handler after line 119; existing POST handler unchanged.
- `backend/tests/unit/services/test_brk_read_service.py` (NEW) — 5 unit tests covering empty / multi-owner-same-timestamp (mocked-DB) / soft-deleted / latest-cycle / cross-org filter.
- `backend/tests/unit/scans/__init__.py` (NEW) — new test sub-namespace for scan-router unit tests.
- `backend/tests/unit/scans/test_brk_router_get.py` (NEW) — 4 router-layer unit tests (200+[], records present, org_id forwarded, 401 on missing auth).
- `backend/tests/regression/test_multi_tenant_brk_isolation.py` (NEW) — 5 REGRESSION-CRITICAL tests; module docstring documents drift-detection procedure.

## Decisions Made

- **Kwarg-only signature on read_for_parcel.** The leading `*` in the signature is load-bearing — prevents accidental positional misuse that could swap organization_id with parcel_id (both are uuid-stringable). Pinned by Test 3 (`test_signature_drift_guard`).
- **Multi-owner same-timestamp branch exercised via mocked AsyncSession.** The DB UNIQUE constraint `uq_brk_org_parcel_fetched` (org, parcel, fetched_at) blocks ORM inserts at identical timestamps. Production code (`persist_record`) relies on microsecond-distinct `datetime.utcnow()` per row. The function's MAX-anchor "return all matching" branch is still defensively correct (clock granularity, raw SQL backfills, future constraint relaxation) — mocked-DB exercises it precisely without DB pollution.
- **Test 4 slices WHERE-clause text, not full compiled SQL.** `select(BrkOwnershipRecord)` references all columns including organization_id in the SELECT clause, so a substring match on full SQL would false-positive even with the WHERE filter removed. WHERE-only slice provides true drift detection.
- **Cross-org endpoint returns 200 + [] (NIET 403, NIET 404).** Silent isolation per ENG-PLAN AD2 — 403 or 404 would leak existence ("this parcel exists elsewhere"). The empty list is indistinguishable from a parcel that never had BRK data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Multi-owner same-fetched_at test approach incompatible with DB UNIQUE constraint**
- **Found during:** Task 2 (unit tests run; first failure on `test_returns_multi_owner_when_same_fetched_at`)
- **Issue:** Plan behavior #2 specifies "insert 2 rows org=A parcel=X fetched_at=T1, assert len=2". The DB UNIQUE constraint `uq_brk_org_parcel_fetched` (org_id, parcel_id, fetched_at) blocks this via both INSERT and UPDATE — `duplicate key value violates unique constraint`. Production persistence relies on microsecond-distinct utcnow() per row, so two rows literally cannot share a fetched_at in the live system.
- **Fix:** Retained the function logic that defensively returns all rows matching MAX(fetched_at). Rewrote the test to mock AsyncSession.execute so it returns two synthetic ORM rows sharing a fetched_at — exercises the MAX-anchor branch precisely without DB pollution. Added docstring note explaining why the mock-DB approach is the right choice given the constraint.
- **Files modified:** `backend/tests/unit/services/test_brk_read_service.py`
- **Verification:** Test passes; function-level multi-owner support proven; production constraint behavior preserved.
- **Committed in:** `d0c548e8` (Task 2 commit)

**2. [Rule 1 - Bug] Test 4 (query_includes_org_filter) initial substring check too loose**
- **Found during:** Task 3 drift-detection phase (filter removed → Test 1 failed as expected but Test 4 false-passed)
- **Issue:** Initial Test 4 asserted `"organization_id" in compiled_sql`. Because SQLAlchemy's `select(BrkOwnershipRecord)` emits all column names in the SELECT clause — including `organization_id` — the substring match passed even when the WHERE clause no longer contained the filter. False-negative on drift detection.
- **Fix:** Narrowed Test 4 to slice the compiled SQL string from the first `WHERE` keyword onwards, then asserted substring match on the WHERE-clause-only segment. Re-ran drift-detection: filter removal now correctly fails Test 4 with `WHERE clause no longer filters by organization_id`.
- **Files modified:** `backend/tests/regression/test_multi_tenant_brk_isolation.py`
- **Verification:** Drift-detection: removed filter → Test 1 + Test 4 both fail with iron-rule assertions → restored filter → 14/14 green.
- **Committed in:** `4762e74e` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — test-correctness bugs caught during execution)
**Impact on plan:** Both fixes necessary for correctness. No scope creep — functional contract from plan unchanged; only test mechanics adapted to DB reality (UNIQUE constraint) and tightened drift detection (WHERE-clause slice).

## Issues Encountered

- pytest UNIQUE constraint violation in initial multi-owner test (resolved via mock-DB pattern — see Deviation #1).
- Initial drift-detection false-pass on Test 4 (resolved via WHERE-clause slice — see Deviation #2).

## User Setup Required

None — pure backend addition, no env vars / external services / DB migrations.

## Next Phase Readiness

- **Plan 08-02 unblocked:** Frontend hooks (`useBRKEigendom`, `useBRKPersist`) can now consume GET /api/parcels/{parcel_id}/brk against this stable contract.
- **REGRESSION-CRITICAL guarantee:** Future refactors of `brk_read_service.read_for_parcel` will fail loudly via `test_signature_drift_guard` and `test_query_includes_org_filter` before any cross-tenant test could trigger.
- **No blockers** for Plan 08-03+ wire-up tasks.

## Self-Check: PASSED

- backend/app/services/brk_read_service.py — EXISTS (50 LOC)
- backend/app/scans/brk_router.py — MODIFIED (GET handler line 121+, POST untouched)
- backend/tests/unit/services/test_brk_read_service.py — EXISTS (5 tests)
- backend/tests/unit/scans/test_brk_router_get.py — EXISTS (4 tests)
- backend/tests/regression/test_multi_tenant_brk_isolation.py — EXISTS (5 tests)
- Commit 249b3a2c — EXISTS (feat: brk_read_service + GET handler)
- Commit d0c548e8 — EXISTS (test: 9 unit tests)
- Commit 4762e74e — EXISTS (test: 5 REGRESSION-CRITICAL multi-tenant tests)
- Full test suite 14/14 green; ruff clean on all new/modified files.

---

*Phase: 08-brk-fase-2-wire-up*
*Completed: 2026-05-19*
