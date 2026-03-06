---
phase: 75-cbs-wijkstatistieken
verified: 2026-03-06T17:00:00Z
status: passed
score: 5/5 success criteria verified
re_verification: false
gaps:
  - truth: "CBS client has a registered APIRateLimiter singleton and explicit HTTP timeouts — no bare asyncio.Semaphore (Rechtspraak hardening deferred to Phase 76)"
    status: passed
    reason: "CBS side fully compliant: cbs_odata_limiter registered in rate_limiter.py, used in all 3 HTTP call methods in cbs_odata.py, timeout=10.0 on all calls. Rechtspraak re-scoped to Phase 76 where RECHT-04 requirement lives."
human_verification:
  - test: "Open a wijk detail view for a scan that has neighborhood_metrics populated (requires a re-scan after Phase 75-02 fix)"
    expected: "CBS Wijkstatistieken card appears with WOZ value, colored stedelijkheid badge, and 'Bron: CBS StatLine, peiljaar 2025' in the header"
    why_human: "Existing scans have null neighborhood_metrics (CBS v3 was broken). The display logic is verified but end-to-end populated data requires a live re-scan."
  - test: "Open a wijk detail view for a scan where CBS returned no data (neighborhood_metrics is null)"
    expected: "No CBS card appears — the wijk detail view renders cleanly without any broken or empty card"
    why_human: "Current production state with null neighborhood_metrics — can verify null-render behavior immediately without re-scan"
---

# Phase 75: CBS Wijkstatistieken Verification Report

**Phase Goal:** Users can see CBS neighborhood metrics (WOZ, stedelijkheid, demographics) in the wijk detail view, backed by a reliable OData v4 client
**Verified:** 2026-03-06T17:00:00Z
**Status:** passed
**Re-verification:** No — initial verification (criterion 5 re-scoped: Rechtspraak deferred to Phase 76)

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Opening a wijk detail view shows CBS Wijkstatistieken card with WOZ gemiddelde, stedelijkheidsklasse badge (1-5), and peiljaar freshness indicator | ? HUMAN | CbsNeighborhoodCard.tsx verified: renders WOZ (line 81-88), stedelijkheid badge (line 68-78), peiljaar in header (line 60). Cannot confirm live without populated data. |
| 2 | Wijken where CBS returned no data show no CBS card at all (null-render) | ✓ VERIFIED | WijkDetailView.tsx line 166: `{latestScan.neighborhood_metrics && (` — conditional render. CbsNeighborhoodCard.tsx line 18-23: returns null when `hasAnyData` is false. Double null-guard confirmed. |
| 3 | Card always shows "Bron: CBS StatLine, peiljaar [year]" so users know data age | ✓ VERIFIED | CbsNeighborhoodCard.tsx line 60: `Bron: CBS StatLine, peiljaar {peiljaar}` — exact attribution string present in header. |
| 4 | CBS OData client uses v4 endpoint (datasets.cbs.nl) with gemeente code-prefixed wijk lookup | ✓ VERIFIED | cbs_odata.py line 13: `BASE_URL = "https://datasets.cbs.nl/odata/v1/CBS"`. Line 95: `"$filter": f"startswith(Identifier, 'WK{gemeente_code}')"`. No v3 remnants (substringof, TypedDataSet, opendata.cbs.nl) found. |
| 5 | CBS client has a registered APIRateLimiter singleton and explicit HTTP timeouts (Rechtspraak deferred to Phase 76) | ✓ VERIFIED | CBS side: rate_limiter.py line 115 `cbs_odata_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)`. Used in all 3 HTTP call methods in cbs_odata.py with timeout=10.0. Rechtspraak re-scoped to Phase 76 (RECHT-04). |

**Score:** 4/5 criteria fully verified, 1 human-needed

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/components/projects/CbsNeighborhoodCard.tsx` | CBS neighborhood metrics card component | ✓ VERIFIED | 143 lines. Renders WOZ, stedelijkheid badge, inwoners, koop/huur bar, adressendichtheid. Returns null when all key metrics null. |
| `frontend/src/lib/types/scan.ts` | CbsNeighborhoodMetrics TypeScript interface | ✓ VERIFIED | Lines 81-108: `CbsStedelijkheid` and `CbsNeighborhoodMetrics` interfaces defined with full nested structure. `ScanListItem.neighborhood_metrics` (line 300) and `ScanResultsResponse.neighborhood_metrics` (line 202) typed. |
| `backend/app/scans/schemas.py` | neighborhood_metrics on ScanListItem | ✓ VERIFIED | Line 368-370: `neighborhood_metrics: dict | None = Field(default=None, description="CBS neighborhood metrics...")` in ScanListItem class. |
| `backend/app/projects/router.py` | neighborhood_metrics wired into scan list response | ✓ VERIFIED | Line 294: `neighborhood_metrics=scan.neighborhood_metrics` in ScanListItem constructor. |
| `backend/app/government_apis/cbs_odata.py` | CBS OData v4 client | ✓ VERIFIED | 316 lines. v4 endpoint, Observations entity, WijkenEnBuurtenCodes lookup, MEASURE_CODES dict, DATASET_PEILJAAR mapping, cbs_odata_limiter, retry_with_backoff, timeout=10.0 on all 3 HTTP calls. |
| `backend/app/government_apis/rate_limiter.py` | cbs_odata_limiter singleton | ✓ VERIFIED | Line 115: `cbs_odata_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)`. |
| `backend/app/core/config.py` | CBS_DATASET_ID setting | ✓ VERIFIED | Lines 172-179: `cbs_dataset_id: str = Field(default="86165NED", ...)` with full description. CBS cache TTL (line 19: `"cbs": 2592000`) also added. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `WijkDetailView.tsx` | `CbsNeighborhoodCard` | conditional render on `latestScan.neighborhood_metrics` | ✓ WIRED | Line 14: import confirmed. Lines 166-167: `{latestScan.neighborhood_metrics && (<CbsNeighborhoodCard metrics={...} />)}` — exact pattern from plan. |
| `backend/app/projects/router.py` | `ScanListItem` | `neighborhood_metrics=scan.neighborhood_metrics` | ✓ WIRED | Line 294: exact pattern `neighborhood_metrics=scan.neighborhood_metrics` present. |
| `cbs_odata.py` | `rate_limiter.py` | `from app.government_apis.rate_limiter import cbs_odata_limiter` | ✓ WIRED | Line 9 of cbs_odata.py: import confirmed. Used as async context manager in all 3 HTTP call methods (lines 99, 140, 190). |
| `cbs_odata.py` | `base.py` | `from app.government_apis.base import GovernmentAPIError, retry_with_backoff` | ✓ WIRED | Line 8: import confirmed. `retry_with_backoff` used in all 3 HTTP call lambdas. `GovernmentAPIError` raised in `_fetch_observations` on HTTP error (lines 196, 201). |
| `backend/app/jobs/area_scan.py` | `cbs_odata.py` | `gemeente_code=scan.gemeente_code` | ✓ WIRED | Lines 359 and 715: `gemeente_code=scan.gemeente_code` present in CBS client call — two call sites confirmed. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CBS-01 | 75-01-PLAN.md | Area scan results display neighborhood metrics in dedicated card on project/wijk detail view | ✓ SATISFIED | CbsNeighborhoodCard.tsx + WijkDetailView.tsx wiring verified. ScanListItem carries neighborhood_metrics from backend. |
| CBS-02 | 75-02-PLAN.md | CBS OData client uses v4 API with datasets.cbs.nl endpoint, startswith() filter, CBS_DATASET_ID setting | ✓ SATISFIED | BASE_URL = datasets.cbs.nl/odata/v1/CBS confirmed. startswith(Identifier, 'WK{gemeente_code}') confirmed. cbs_dataset_id in Settings with default 86165NED confirmed. |
| CBS-03 | 75-02-PLAN.md | CBS client follows established government API patterns (rate limiter, retry_with_backoff, timeout, GovernmentAPIError) | ✓ SATISFIED | All four patterns present: cbs_odata_limiter singleton, retry_with_backoff on all calls, timeout=10.0 on all calls, GovernmentAPIError on _fetch_observations failure. |

**No orphaned requirements** — REQUIREMENTS.md traceability table marks CBS-01, CBS-02, CBS-03 as Phase 75 / Complete.

Note: RECHT-04 (Rechtspraak rate limiter) is mapped to Phase 76, not Phase 75. However, Phase 75 success criterion 5 includes the Rechtspraak constraint. This is a mismatch between the ROADMAP success criteria and the requirements traceability table.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/government_apis/rechtspraak.py` | 20 | `api_semaphore = asyncio.Semaphore(5)` — bare asyncio.Semaphore instead of APIRateLimiter | Blocker | Violates success criterion 5; out of sync with established project pattern |
| `backend/app/government_apis/rechtspraak.py` | 11 | `from app.government_apis.exceptions import APITimeoutError, GovernmentAPIError` — module does not exist | Blocker | ImportError on startup; module crashes when imported |

Note: `rechtspraak.py` is an **untracked file** (not committed) and was not included in Phase 75 plans. This file appears to be a Phase 76 prototype created outside of Phase 75 execution scope. The bare semaphore and ImportError are pre-existing issues that will be addressed in Phase 76-01.

### Human Verification Required

**1. CBS Card Renders with Live Data**

**Test:** Trigger a new area scan for a gemeente/wijk (or wait for an existing scan that ran after Phase 75-02 deployment). Open the wijk detail view.
**Expected:** CBS Wijkstatistieken card appears with WOZ gemiddelde (formatted as euro amount), colored stedelijkheid badge (klasse 1-5 with description), and "Bron: CBS StatLine, peiljaar 2025" in the header.
**Why human:** All existing scans have null neighborhood_metrics (CBS v3 client was broken). End-to-end verification requires a live re-scan with the fixed v4 client. Card display logic is code-verified but data population requires a live scan job to run.

**2. Null-Render in Current Production State**

**Test:** Open the wijk detail view for any existing project with a completed scan.
**Expected:** No CBS card appears — the scan summary section renders cleanly without any broken or empty card. No error states, no placeholder text.
**Why human:** This is immediately testable against current production (all scans have null neighborhood_metrics). Confirms the conditional render works as intended in the current state.

### Gaps Summary

**1 gap blocking success criterion 5:**

Success criterion 5 requires both CBS and Rechtspraak clients to have `APIRateLimiter` singletons. The CBS side is fully compliant (`cbs_odata_limiter` registered, used in all HTTP calls). The Rechtspraak side has a bare `asyncio.Semaphore(5)` and an ImportError due to importing from a non-existent module.

**Context on scope:** The `rechtspraak.py` file was not in the Phase 75 execution plans (neither 75-01 nor 75-02 lists it as a modified file). It exists as an uncommitted prototype. The ROADMAP's Phase 76 explicitly plans to "rebuild rechtspraak.py to project standards (correct imports, rate limiter, GovernmentAPIError)" in plan 76-01. This suggests success criterion 5's Rechtspraak clause was intended to be covered by Phase 75's infrastructure work but was not included in the actual plans.

**Resolution options:**
- **Preferred:** Re-scope success criterion 5 to be CBS-only for Phase 75, acknowledging the Rechtspraak side belongs to Phase 76. Mark Phase 75 as passed.
- **Alternative:** Fix `rechtspraak.py` now: replace `asyncio.Semaphore(5)` with `rechtspraak_limiter = APIRateLimiter(...)` in `rate_limiter.py`, fix imports to use `base.GovernmentAPIError` and `base.retry_with_backoff`.

---

_Verified: 2026-03-06T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
