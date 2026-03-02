---
phase: 66-results-table-noise-reduction
verified: 2026-03-02T12:00:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
human_verification:
  - test: "Open /resultaten for a completed Venlo scan"
    expected: "Toggle defaults to ON with 'Top kansen' label, table shows only scored parcels >= 40, count shows 'N van M percelen' format"
    why_human: "Visual UI state and pagination count accuracy require a real scan with data"
  - test: "Toggle 'Top kansen' OFF"
    expected: "Table immediately reloads and shows all parcels including null-score ones, count updates to just 'M percelen'"
    why_human: "React state toggle and re-fetch behavior requires interactive browser verification"
  - test: "Sort ascending by score with filter ON"
    expected: "Null-score parcels do not appear at top — they remain at bottom, qualified parcels sorted low-to-high"
    why_human: "nulls_last() ASC behavior requires live data to confirm PostgreSQL sort output"
  - test: "Open results for a scan where all parcels are below score 40 (if one exists)"
    expected: "Toggle auto-disables with Dutch toast 'Filter uitgeschakeld — geen percelen boven drempel', all parcels become visible"
    why_human: "Auto-disable useEffect depends on real API data returning total=0 and total_unfiltered>0"
---

# Phase 66: Results Table Noise Reduction Verification Report

**Phase Goal:** The results table surfaces genuine development opportunities, not the full undifferentiated parcel list
**Verified:** 2026-03-02T12:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                               | Status     | Evidence                                                                                              |
|----|-----------------------------------------------------------------------------------------------------|------------|-------------------------------------------------------------------------------------------------------|
| 1  | Default results view shows only scored parcels (null-score parcels hidden)                          | VERIFIED   | `showOnlyTop=true` by default in ResultsLayout; injects `exclude_null_scores: true, min_score: 40`   |
| 2  | Results sorted by score descending with null-score parcels at bottom regardless of sort direction   | VERIFIED   | `nulls_last(desc(sort_field))` and `nulls_last(asc(sort_field))` in service.py lines 477-479          |
| 3  | Toggle in results table allows switching between filtered (Top kansen) and all parcels              | VERIFIED   | Toggle button in ResultsFilterPanel wired to `onShowOnlyTopChange` prop from ResultsLayout            |
| 4  | Toggle label shows hidden count in Dutch ("Top kansen (12 verborgen)")                              | VERIFIED   | `Top kansen${hiddenCount > 0 ? \` (${hiddenCount} verborgen)\` : ''}` in ResultsFilterPanel line 202  |
| 5  | Count display shows "N van M percelen" format                                                       | VERIFIED   | `${total} van ${totalUnfiltered} percelen` when `showOnlyTop && totalUnfiltered > total` (line 212)   |
| 6  | When filter results in 0 visible rows, filter auto-disables with Dutch notice                       | VERIFIED   | `useEffect` in ResultsFilterPanel lines 96-103; toast "Filter uitgeschakeld — geen percelen boven drempel" |
| 7  | Map always shows all parcels regardless of table filter state                                       | VERIFIED   | MapView.tsx has zero references to min_score/exclude_null_scores/showOnlyTop — completely independent |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact                                                              | Expected                                              | Status    | Details                                                                    |
|-----------------------------------------------------------------------|-------------------------------------------------------|-----------|----------------------------------------------------------------------------|
| `backend/app/scans/service.py`                                        | min_score/exclude_null_scores + unfiltered count branch | VERIFIED | Parameters at lines 367-368; unfiltered count at lines 450-451; 3-tuple return at line 488 |
| `backend/app/scans/schemas.py`                                        | total_unfiltered field on ScanResultsResponse         | VERIFIED  | Field at line 238-241; confirmed via Python import: `total_unfiltered` present with `ge=0` constraint |
| `backend/app/scans/router.py`                                         | min_score/exclude_null_scores query params            | VERIFIED  | `Query` params at lines 1841-1842; 3-tuple destructuring at line 1897; `total_unfiltered=total_unfiltered` at line 2027 |
| `frontend/src/lib/types/scan.ts`                                      | min_score/exclude_null_scores on ScanResultsFilters, total_unfiltered on ScanResultsResponse | VERIFIED | All three fields present at lines 150-153 and 182-184 |
| `frontend/src/components/results/ResultsFilterPanel.tsx`              | Toggle with "Top kansen" label and hidden count       | VERIFIED  | Toggle at lines 172-207; Dutch labels "Top kansen", "verborgen", "Alle percelen" |
| `frontend/src/components/results/ResultsLayout.tsx`                   | showOnlyTop state, filter injection, totalUnfiltered propagation | VERIFIED | `showOnlyTop` state at line 21; `SCORE_CUTOFF=40` at line 17; `tableFilters` spread at lines 183-185; `onTotalUnfilteredChange={setTotalUnfiltered}` at line 194 |

### Key Link Verification

| From                             | To                              | Via                                              | Status   | Details                                                                              |
|----------------------------------|---------------------------------|--------------------------------------------------|----------|--------------------------------------------------------------------------------------|
| `ResultsLayout.tsx`              | `backend/app/scans/router.py`   | min_score and exclude_null_scores in API call    | WIRED    | `min_score: SCORE_CUTOFF, exclude_null_scores: true` in tableFilters spread; api.ts serializes both params at lines 726-728 |
| `backend/app/scans/router.py`    | `backend/app/scans/service.py`  | 3-tuple destructuring (rows, total, total_unfiltered) | WIRED | `rows, total, total_unfiltered = await service.list_scan_results(...)` at line 1897; export endpoint also updated at line 2246 |
| `ResultsTable.tsx`               | `ResultsLayout.tsx`             | onTotalUnfilteredChange callback propagating total_unfiltered | WIRED | Prop defined at line 27; called in `useEffect` at lines 198-202; `onTotalUnfilteredChange={setTotalUnfiltered}` in ResultsLayout |

### Requirements Coverage

| Requirement  | Source Plan  | Description                                                                                                         | Status    | Evidence                                                                                         |
|--------------|-------------|---------------------------------------------------------------------------------------------------------------------|-----------|--------------------------------------------------------------------------------------------------|
| RES-01       | 66-01-PLAN  | Default results view shows parcels pre-filtered to likely development opportunities, not all parcels                | SATISFIED | `showOnlyTop=true` default + `exclude_null_scores: true, min_score: 40` injected into API call  |
| RES-02       | 66-01-PLAN  | Results sorted by opportunity score descending by default, highest-value parcels at top without user interaction    | SATISFIED | `nulls_last(desc(sort_field))` default; default `sort_by=score`, `sort_order=desc` in router    |

**Note:** REQUIREMENTS.md tracks these as a combined entry `RES-01-02` on line 60 (not separate entries). Both individual requirements from PLAN frontmatter are satisfied. No orphaned requirements found.

### Anti-Patterns Found

| File                        | Line | Pattern                    | Severity | Impact     |
|-----------------------------|------|----------------------------|----------|------------|
| `ResultsFilterPanel.tsx`    | 289  | `placeholder="min"`        | Info     | HTML input placeholder — not an implementation stub |
| `ResultsFilterPanel.tsx`    | 302  | `placeholder="max"`        | Info     | HTML input placeholder — not an implementation stub |

No implementation stubs, empty handlers, or TODO comments found in any of the 8 modified files.

### Warning: Toggle Disable During In-Progress Scans Not Wired

The `scanStatus` prop is defined as optional on `ResultsFilterPanelProps` and the `isToggleDisabled` logic is implemented (`scanStatus !== undefined && scanStatus !== 'completed'`), but `ResultsLayout` does not pass `scanStatus` to `ResultsFilterPanel`. This means the toggle will never be greyed-out during in-progress scans.

**Severity:** Warning (not a blocker)
**Why not a blocker:** The PLAN listed in-progress scan handling under "Claude's discretion" in RESEARCH.md, not as a must-have truth. The core goal — filtering noise from completed scan results — is fully achieved. The toggle still works correctly for completed scans, which is the primary demo scenario.
**Impact:** During an in-progress scan, users can toggle "Top kansen" while scoring is still running. This may show a changing hidden count as parcels get scored. Not harmful, slightly confusing.

### Additional Verification: Export Endpoint Handles 3-Tuple

The export endpoint at `router.py` line 2246 correctly destructures the updated 3-tuple return:
```python
rows, _total, _unfiltered = await service.list_scan_results(...)
```
This was noted in the commit message and confirmed in the code. The PLAN did not explicitly cover the export endpoint, but the executor correctly updated it to prevent a runtime error.

### Human Verification Required

**1. Default filter behavior on real scan data**

Test: Open `/resultaten` for a completed Venlo wijk scan
Expected: Toggle shows "Top kansen (N verborgen)" where N > 0, count shows "M van P percelen", null-score parcels absent from table
Why human: Requires live database data with a mix of scored/unscored parcels to confirm actual filter output

**2. Toggle behavior**

Test: Click the toggle switch from ON to OFF
Expected: API re-fetches, count changes to "P percelen" (full total), null-score parcels appear in table
Why human: React state + TanStack Query cache invalidation requires interactive browser verification

**3. Null placement on ASC sort**

Test: With filter OFF, sort by score ascending
Expected: Null-score parcels remain at the bottom (not promoted to top by PostgreSQL's default ASC NULLS FIRST)
Why human: `nulls_last()` on `asc()` requires PostgreSQL execution to confirm the sort modifier works

**4. Auto-disable with Dutch toast**

Test: Find or create a scan scenario where all parcels have null scores (or score < 40)
Expected: Toggle starts ON, API returns total=0 with total_unfiltered > 0, toggle auto-disables, Dutch toast appears
Why human: This edge case requires specific data conditions to trigger

---

## Code Quality Verification

```
Backend ruff check (service.py, schemas.py, router.py): ALL CHECKS PASSED
Frontend tsc --noEmit: EXIT CODE 0 (no TypeScript errors)
Commits verified: 81a439a (Task 1), 9cba435 (Task 2)
```

---

_Verified: 2026-03-02T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
