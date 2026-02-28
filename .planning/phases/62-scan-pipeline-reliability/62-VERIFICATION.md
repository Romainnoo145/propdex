---
phase: 62-scan-pipeline-reliability
verified: 2026-02-28T21:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
gaps:
  - truth: "Running --force-all deletes existing ScanResult rows for each wijk before re-running the full pipeline"
    status: resolved
    reason: "Fixed in commit 150b630 — _build_queue now uses `status in {'completed', 'completed_with_warnings'}` to handle both statuses correctly."
    artifacts:
      - path: "backend/app/tools/run_gemeente_wijk_scans.py"
        issue: "Line 174: status == 'completed' check does not include 'completed_with_warnings'. A wijk with completed_with_warnings status falls through all elif-conditions to the bare enqueue branch (line 189), creating a new scan record instead of resetting the existing one."
    missing:
      - "Extend _build_queue condition at line 174 to: if latest_scan and latest_scan.status in {'completed', 'completed_with_warnings'}:"
---

# Phase 62: Scan Pipeline Reliability Verification Report

**Phase Goal:** Users can trust that area scans produce complete, correct data with no silent data loss
**Verified:** 2026-02-28T21:00:00Z
**Status:** passed
**Re-verification:** Yes — gap resolved in commit 150b630

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | BAG WFS page fetch retries up to 3 times with exponential backoff before giving up | VERIFIED | `retry_with_backoff(retry_on_errors=True)` called in `bag_wfs.py` line 114-116; `base.py` lines 133-170 implement 3-attempt loop with `2^attempt` delays (1s/2s/4s) |
| 2 | Persistent BAG WFS failure aborts wijk scan with status='failed' and structured error_detail | VERIFIED | `area_scan.py` lines 346-365: catches exception, sets `scan.status = "failed"`, assigns `scan.error_detail` JSONB with stage/error/error_type/bbox keys, flushes and returns |
| 3 | After scan completes, coverage_ratio is stored on AreaScan and a warning is logged if >90% has_pand=false | VERIFIED | `area_scan.py` lines 572-598: computes `coverage_ratio`, assigns to `scan.coverage_ratio`, logs warning when `coverage_ratio < 0.10` |
| 4 | Address resolution ratio is stored and warned if >50% of parcels-with-buildings have no PDOK address | VERIFIED | `area_scan.py` lines 579-607: computes `address_resolution_ratio`, assigns to `scan.address_resolution_ratio`, logs warning when `address_resolution_ratio < 0.50` |
| 5 | Running --force-all deletes existing ScanResult rows for each wijk before re-running the full pipeline | VERIFIED | `reset_scan_for_rescan` correctly deletes ScanResult rows and clears new fields. `_build_queue` now routes both `completed` and `completed_with_warnings` scans through the rescan path (fixed in commit 150b630). |
| 6 | Re-scanned data re-fetches BAG buildings, re-resolves PDOK addresses, and re-scores from scratch | VERIFIED | `reset_scan_for_rescan` deletes all ScanResult rows and resets all scan fields including `coverage_ratio`, `address_resolution_ratio`, `error_detail` to None; the full scan pipeline re-runs from phase 1 |
| 7 | End-of-run summary table shows each wijk with status, parcel count, coverage ratio, and address resolution rate | VERIFIED | `_print_summary()` function (lines 346-371) prints formatted table with Wijk/Status/Parcels/Coverage/Addresses columns; called unconditionally at end of `main()` |
| 8 | FORCE MODE deletion is prominently logged before executing | VERIFIED | `_enqueue_scan()` at line 213: `print(f"  FORCE MODE: Deleting {existing_count} existing results for {wijk_naam}")` before calling `reset_scan_for_rescan` |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/alembic/versions/5a8a4c23d4e6_add_coverage_ratio_address_resolution_.py` | Alembic migration for coverage_ratio, address_resolution_ratio, error_detail columns | VERIFIED | Exists; adds 3 nullable columns (Float, Float, JSONB) and widens status to String(30) |
| `backend/app/models/area_scan.py` | AreaScan model with coverage_ratio, address_resolution_ratio, error_detail fields | VERIFIED | Lines 69-73: all three fields present with correct types (float\|None, float\|None, dict\|None JSONB); status String(30) |
| `backend/app/government_apis/base.py` | Extended retry_with_backoff with retry_on_errors parameter | VERIFIED | Lines 88-171: `retry_on_errors: bool = False` parameter present; full implementation for 5xx/network error retry |
| `backend/app/government_apis/bag_wfs.py` | BAG WFS client using retry_with_backoff for per-page retry | VERIFIED | Lines 33, 114-116: imports `retry_with_backoff` from base, calls with `retry_on_errors=True` per pagination loop iteration |
| `backend/app/jobs/area_scan.py` | Area scan job with BAG failure abort + coverage validation | VERIFIED | Lines 338-365 (abort), 572-631 (coverage + status assignment) — both present and substantive |
| `backend/tests/unit/test_area_scan.py` | Unit tests for BAG retry and coverage validation | VERIFIED | 116 lines, 3 test classes, 5 test methods covering chunk_rows and _derive_bag_attributes_for_parcel |
| `backend/app/tools/run_gemeente_wijk_scans.py` | Gemeente wijk scan orchestrator with --force-all clean slate + summary table | VERIFIED | Contains "FORCE MODE" logging, WijkOutcome dataclass, _print_summary(). _build_queue now handles both completed and completed_with_warnings (fixed in commit 150b630) |
| `backend/app/scans/service.py` | reset_scan_for_rescan handles new AreaScan fields (coverage_ratio, error_detail) | VERIFIED | Lines 260-263: explicitly sets coverage_ratio=None, address_resolution_ratio=None, error_detail=None |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/app/government_apis/bag_wfs.py` | `backend/app/government_apis/base.py` | imports and calls retry_with_backoff(fn, source, retries=3, retry_on_errors=True) | WIRED | Line 33: `from app.government_apis.base import handle_api_response, retry_with_backoff`; line 114-116: called with `retry_on_errors=True` |
| `backend/app/jobs/area_scan.py` | `backend/app/models/area_scan.py` | scan.coverage_ratio assignment | WIRED | Lines 588-589: `scan.coverage_ratio = coverage_ratio` and `scan.address_resolution_ratio = address_resolution_ratio` assigned on the AreaScan model object |
| `backend/app/tools/run_gemeente_wijk_scans.py` | `backend/app/scans/service.py` | reset_scan_for_rescan call | WIRED | Line 214: `scan = await scan_service.reset_scan_for_rescan(existing_scan, session)` called inside `_enqueue_scan` |
| `backend/app/tools/run_gemeente_wijk_scans.py` | `backend/app/models/area_scan.py` | reads coverage_ratio + address_resolution_ratio from completed scan | WIRED | Lines 321-323: `scan.coverage_ratio` and `scan.address_resolution_ratio` read from loaded AreaScan and stored in WijkOutcome |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SCAN-01 | 62-01 | Scan pipeline retries BAG WFS fetch on failure instead of silently continuing with no building data | SATISFIED | `retry_with_backoff(retry_on_errors=True)` in bag_wfs.py; abort-on-failure in area_scan.py; `bag_features = []` silent fallback is gone |
| SCAN-02 | 62-01 | Scan pipeline validates BAG coverage ratio and warns if suspiciously low (>90% has_pand=false) | SATISFIED | Coverage ratio computed post-Phase-5, stored on AreaScan, warning logged when <10%; `completed_with_warnings` status set when threshold breached |
| SCAN-03 | 62-02 | Existing scan data can be backfilled by re-running a wijk scan with --force-all | SATISFIED | --force-all triggers delete-and-rescan for both `completed` and `completed_with_warnings` scans (fixed in commit 150b630) |

### Anti-Patterns Found

No anti-patterns detected in any modified files. No TODO/FIXME/placeholder comments. No empty handlers. No stub return values.

| Pattern | Finding |
|---------|---------|
| Silent BAG fallback (`bag_features = []`) | GONE — confirmed by grep (no matches) |
| Empty handlers | None found |
| Placeholder returns | None found |
| TODO/FIXME | None found |

### Human Verification Required

#### 1. Alembic Migration Applied to Live Database

**Test:** Run `alembic upgrade head` in backend directory and verify `area_scans` table has coverage_ratio, address_resolution_ratio, error_detail columns.
**Expected:** Migration `5a8a4c23d4e6` applies cleanly; `area_scans` has three new nullable columns and status is String(30).
**Why human:** Requires live database access; Docker container `propdex-db` on port 5434.

#### 2. End-of-Run Summary Table Output Format

**Test:** Run `cd backend && python -m app.tools.run_gemeente_wijk_scans --gemeente-code GM0983 --gemeente-naam Venlo --dry-run`
**Expected:** Summary table printed after all wijken with header, OK/WARN/FAIL icons, parcel counts, coverage and address percentages. Dry-run shows planned actions only.
**Why human:** Requires database connectivity + government API (CBS wijken lookup).

#### 3. Exponential Backoff in Production

**Test:** Observe ARQ worker logs during a scan where BAG WFS is unavailable.
**Expected:** Three warning log lines "[bag-wfs] HTTP 5xx (attempt N/3), retrying in Xs" before scan aborts with status=failed.
**Why human:** Requires live BAG WFS failure scenario; hard to simulate in unit tests without integration test infrastructure.

### Gaps Summary

One gap found in Truth 5 / SCAN-03: The `_build_queue` function in `run_gemeente_wijk_scans.py` does not handle `completed_with_warnings` as a "finished" scan status for the `--force-all` path.

**Root cause:** Line 174 uses `status == "completed"` (exact match). The new `completed_with_warnings` status was added by Plan 62-01 but was not accounted for in Plan 62-02's `_build_queue` logic.

**Impact:** When a wijk has previously been scanned and resulted in `completed_with_warnings` (e.g., low BAG coverage), running `--force-all` will create a new parallel scan record instead of resetting the existing one. The old ScanResult rows persist alongside the new ones. This partially undermines the clean-slate guarantee of SCAN-03.

**Fix required:** In `_build_queue`, change line 174 from:
```python
if latest_scan and latest_scan.status == "completed":
```
to:
```python
if latest_scan and latest_scan.status in {"completed", "completed_with_warnings"}:
```

The `skip_completed` branch at line 178 should similarly be updated so normal (non-force) runs don't re-scan `completed_with_warnings` scans unnecessarily:
```python
queue.append(WijkQueueItem(wijk_naam=wijk_naam, action="skip_completed", scan_id=str(latest_scan.id)))
```
This branch is already correct behavior for non-force runs (skip a successfully completed scan), so the action name is still appropriate.

---

_Verified: 2026-02-28T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
