---
phase: 08-brk-fase-2-wire-up
plan: 05
subsystem: frontend-routing + phase-enablement

tags: [brk, m050, s06, lifecycle, frontend, routing, regression-test, def-resolution, schema]

requires:
  - phase: 08-brk-fase-2-wire-up
    plan: 03
    provides: ContactPhaseView component (consumed by $phase route dispatch)
  - phase: 08-brk-fase-2-wire-up
    plan: 02
    provides: useRescorePoll hook (DEF-01 endpoint URL rewired by this plan)
provides:
  - 2-contact lifecycle phase enabled (Phase 8 go-live toggle)
  - $phase route dispatch to ContactPhaseView for 2-contact
  - REGRESSION-CRITICAL phases.test.ts iron-rule pinning enabled state
  - DEF-01 resolution — useRescorePoll wired to real /api/scans/parcels/{id}/scan-data
  - ScanResultItem.cascade_rescored_at field exposed by backend
affects: [08-08 E2E integration tests (polling banner now resolves), all consumers of /opgeslagen/perceel/{id}/2-contact navigation, future M060+ phase-enable toggles]

tech-stack:
  added: []
  patterns:
    - "Iron-rule regression-test pattern (per MEMORY.md): pin enabled-state contract in unit test, document REGRESSION-CRITICAL intent in docstring + per-assertion message — guards against premature M060-M110 toggles"
    - "Backend schema field addition with co-located docstring referencing the DEF-id + the consuming frontend hook — DEF traceability cross-checks survive future scope drift"
    - "Predicate with primary + legacy shape fallback (?? operator on top-level vs nested) — allows endpoint shape to evolve without breaking existing tests, useful for API contract migrations"

key-files:
  created:
    - "frontend/src/lib/lifecycle/__tests__/phases.test.ts (NEW, 6 REGRESSION tests)"
  modified:
    - "frontend/src/lib/lifecycle/phases.ts (2-contact enabled toggle + plannedMilestone string)"
    - "frontend/src/routes/_authenticated/opgeslagen.perceel.$parcelId.$phase.tsx (ContactPhaseView import + dispatch)"
    - "frontend/src/hooks/useRescorePoll.ts (DEF-01 — endpoint URL + dual-shape predicate)"
    - "frontend/src/hooks/__tests__/useRescorePoll.test.ts (URL assertion update + 2 DEF-01 predicate tests; 17→19 green)"
    - "backend/app/scans/schemas.py (ScanResultItem.cascade_rescored_at field)"
    - "backend/app/scans/parcels_service.py (propagate flags.cascade_rescored_at into ScanResultItem)"
    - ".planning/phases/08-brk-fase-2-wire-up/deferred-items.md (DEF-01 marked RESOLVED)"

key-decisions:
  - "DEF-01 resolution required a backend schema field (NOT a single-line frontend fix) — ScanResultItem had no top-level flags dict; only individual extracted typed fields. The original DEF-01 'single-line frontend fix' recommendation was based on incorrect assumption that scan-data returns flags. Cleaner fix: expose cascade_rescored_at as a typed field on ScanResultItem, propagate from ScanResult.flags JSONB"
  - "shouldStopOnSuccess predicate reads top-level cascade_rescored_at FIRST, with legacy flags.cascade_rescored_at as nullish-coalesce fallback — supports both shapes simultaneously so existing tests stay green AND future endpoint shape evolution is decoupled"
  - "REGRESSION test docstring explicitly lists what is broken if any of phases 3-8 are flipped prematurely (sidebar greyed-out icon contract from Phase 6) — failure message points to revert as the correct action, not a 'fix in code'"
  - "Per-assertion error message on the futurePhaseKeys loop (`REGRESSION: phase '\${key}' must remain enabled=false until its milestone ships`) — pinpoints exactly which phase regressed without forcing test author to read the loop"
  - "Backend cascade_rescored_at field uses `str | None` (not datetime) — matches the storage shape in ScanResult.flags JSONB (ISO-8601 string from rescore_cascade_job.py line 111). Pydantic could parse to datetime but that would force re-serialization on the JSON path; keep it lazy"

patterns-established:
  - "Iron-rule REGRESSION test for phase-enablement contracts — pattern: filter LIFECYCLE_PHASES.filter(p => p.enabled) → assert exact length + sort+toEqual on keys. Future plans toggling M060-M110 phases must UPDATE this test (not delete it). Same precedent as M050/S01 retention regression + 08-07 OnderzoekPhaseView.parity test."
  - "DEF-resolution commit format: dedicated fix commit referencing DEF-id in subject + body, updates the deferred-items.md log inline. Allows `git log --grep DEF-01` to find the resolution + audit-trail in one cmd."

requirements-completed: [UX-06]

duration: 35m 40s
completed: 2026-05-19
---

# Phase 08 Plan 05: BRK Fase-2 Wire-up — Phase Enablement + Route Dispatch Summary

**Phase 8 'fase-2 live' go-live toggle: 2-contact lifecycle phase flipped enabled, $phase route dispatches to ContactPhaseView, REGRESSION test pins the enablement contract, AND DEF-01 polling-URL gap resolved with backend ScanResultItem.cascade_rescored_at field. Navigation to /opgeslagen/perceel/{id}/2-contact now renders the BRK fase-2 home with a functional rescore-progress banner that actually resolves in production.**

## Performance

- **Duration:** 35m 40s
- **Started:** 2026-05-19T11:50:40Z
- **Completed:** 2026-05-19T14:26:20Z (effective work time; included reading DEF-01 chain + backend service propagation)
- **Tasks:** 3 + 1 deferred-item resolution (4 commits)
- **Files created:** 1 (phases.test.ts)
- **Files modified:** 6 (phases.ts + $phase route + useRescorePoll + useRescorePoll test + ScanResultItem schema + parcels_service + deferred-items.md)

## Accomplishments

- **2-contact phase enabled (Phase 8 go-live).** `LIFECYCLE_PHASES[1].enabled` flipped `false → true` and `plannedMilestone` updated to `'M050/S06 cont. (Phase 8)'`. The sidebar lifecycle icon for "Contact" is now active (not greyed); navigation to `/opgeslagen/perceel/{id}/2-contact` no longer renders the "Komt later" placeholder.
- **Route dispatcher wired.** `$phase.tsx` imports `ContactPhaseView` from `@/components/lifecycle/ContactPhaseView` (delivered by Plan 08-03) and dispatches to it when `phase === '2-contact'`. Existing `beforeLoad` redirect for `1-onderzoek` preserved verbatim; placeholder fallback for phases 3-8 preserved verbatim.
- **REGRESSION-CRITICAL test shipped.** 6 tests in `frontend/src/lib/lifecycle/__tests__/phases.test.ts` pin the enablement contract: exactly 2 phases enabled (1-onderzoek + 2-contact), 2-contact plannedMilestone === Phase 8 marker, all six future phases (3-bod through 8-exit) `enabled === false`, and total phase count unchanged at 8. Per-assertion error messages name the exact regressing phase. The test's docstring explicitly documents what is broken if any of phases 3-8 flip prematurely (sidebar greyed-out icon contract from Phase 6).
- **DEF-01 resolved end-to-end.** The 08-03 deferred-items.md flagged `useRescorePoll.fetchScanFlags` calling a non-existent `/api/parcels/{id}/scan` endpoint. Resolution required a backend schema change (NOT a single-line frontend fix as originally hypothesized — ScanResultItem had no top-level `flags` dict). Added `cascade_rescored_at: str | None` field to `ScanResultItem`, propagated `flags.get("cascade_rescored_at")` from `ScanResult.flags` JSONB in `parcels_service.get_parcel_scan_data()`. Rewired frontend `fetchScanFlags` to call `/api/scans/parcels/{id}/scan-data`. Extended `shouldStopOnSuccess` predicate with top-level cascade_rescored_at + legacy `flags.cascade_rescored_at` fallback. Updated URL-assertion test + added 2 DEF-01 shape tests (17 → 19 green).
- **All quality gates green.** Frontend `npm run check` returns 94 pre-existing baseline errors (0 new errors introduced — same scope-boundary precedent as Plan 08-02 / 08-03). Backend `ruff check` clean on the two modified files. Combined test run of `phases.test.ts` + `useRescorePoll.test.ts` = 25/25 green.

## Task Commits

1. **Task 1: flip 2-contact phase to enabled** — `0eab6eda` (feat)
2. **Task 2: wire ContactPhaseView into $phase route** — `bf73c674` (feat)
3. **Task 3: REGRESSION-CRITICAL phases.test.ts (6 tests)** — `37108ba3` (test)
4. **DEF-01 resolution: rewire useRescorePoll to real scan-data endpoint** — `15a3b3cb` (fix)

## Files Created / Modified

- `frontend/src/lib/lifecycle/__tests__/phases.test.ts` (NEW, 67 LOC, 6 REGRESSION tests) — iron-rule pin on phase enablement contract.
- `frontend/src/lib/lifecycle/phases.ts` (MOD, 1-line change) — `enabled: false → true` on 2-contact entry + plannedMilestone updated.
- `frontend/src/routes/_authenticated/opgeslagen.perceel.$parcelId.$phase.tsx` (MOD, +5 LOC) — import + dispatch for 2-contact.
- `frontend/src/hooks/useRescorePoll.ts` (MOD, ~10 LOC) — endpoint URL + dual-shape predicate.
- `frontend/src/hooks/__tests__/useRescorePoll.test.ts` (MOD, ~20 LOC) — URL assertion update + 2 DEF-01 predicate tests.
- `backend/app/scans/schemas.py` (MOD, +9 LOC) — `cascade_rescored_at` field on ScanResultItem.
- `backend/app/scans/parcels_service.py` (MOD, +5 LOC) — propagate `flags.get("cascade_rescored_at")` into ScanResultItem.
- `.planning/phases/08-brk-fase-2-wire-up/deferred-items.md` (MOD, +18 LOC) — DEF-01 marked RESOLVED with full audit trail.

## Decisions Made

- **DEF-01 resolution required a backend change, not the recommended frontend single-line fix.** The DEF-01 log claimed "backend ScanResultItem already returns a flags field per existing scan-data contract" — this was incorrect. ScanResultItem exposes individual extracted fields (energielabel, woz_data, building_metrics, etc.) but no top-level `flags` dict and no `cascade_rescored_at`. The cleanest fix was to add a typed `cascade_rescored_at: str | None` field to ScanResultItem and propagate from `ScanResult.flags` JSONB in `parcels_service.get_parcel_scan_data()`. This is small (2 backend files, < 15 LOC total) and within Rule 3 (blocking — without it the polling banner never resolves in production). Cleaner than the alternative (path b in DEF-01: add a thin alias route `GET /api/parcels/{id}/scan` wrapping scan-data) because no new route to test or document.

- **Dual-shape predicate for forward + backward compat.** `shouldStopOnSuccess` now reads top-level `cascade_rescored_at` first, with the legacy `flags.cascade_rescored_at` as nullish-coalesce fallback. This means: (a) existing test cases that used the legacy `{ flags: { cascade_rescored_at } }` shape still pass without rewriting all 5 of them; (b) future endpoint shape evolution (e.g., flattening other flags fields) is decoupled from the predicate; (c) the new DEF-01 test cases exercise the new top-level shape AND the precedence case (top-level wins when both present).

- **REGRESSION-CRITICAL docstring + per-assertion messages.** The test file leads with an extensive docstring explaining what breaks if phases 3-8 are flipped prematurely (sidebar greyed-out icon contract from Phase 6 / M050/S06 cockpit shell). The `test_phases_3_to_8_disabled` loop attaches a per-key error message (`REGRESSION: phase "${key}" must remain enabled=false until its milestone ships`) so a future test failure pinpoints exactly which phase regressed without the engineer having to read the loop. Failure message reads as a directive: revert is the correct action.

- **Backend `cascade_rescored_at: str | None` not `datetime | None`.** `ScanResult.flags` stores ISO-8601 strings (rescore_cascade_job.py line 111 writes `datetime.utcnow().isoformat()`). Typing the new field as `str` keeps the JSON path lazy (no parse → format roundtrip). Pydantic could parse to `datetime` and re-serialize, but that adds CPU for no consumer benefit — frontend just parses with `Date.parse()` anyway.

- **DEF-01 fix committed separately from Tasks 1-3.** Even though it was part of the plan-scope addition, the fix touches different files (backend schemas + hook + hook test) than the core enablement work. Separate `fix(08-05): ...` commit makes `git log --grep DEF-01` an audit-finding affordance + scopes a future revert if needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DEF-01 resolution required backend schema field, not single-line frontend fix**

- **Found during:** Pre-Task-1 reading of scope_addition + DEF-01 chain in deferred-items.md + backend ScanResultItem inspection
- **Issue:** The 08-03 deferred-items.md DEF-01 recommended "path (a) — single-line frontend fix" claiming `ScanResultItem` already returns a `flags` field. Inspection of `backend/app/scans/schemas.py:126-235` (ScanResultItem class) and `backend/app/scans/parcels_service.py:300-376` (get_parcel_scan_data) showed this is FALSE: ScanResultItem exposes individual extracted typed fields (energielabel, woz_data, building_metrics, opportunity_signals, etc.) but has no top-level `flags` dict and no `cascade_rescored_at`. A pure frontend URL rewire would still return data without the timestamp the polling predicate needs.
- **Fix:** Added `cascade_rescored_at: str | None` field to ScanResultItem (backend/app/scans/schemas.py, +9 LOC); propagated `flags.get("cascade_rescored_at")` from ScanResult.flags JSONB in parcels_service.get_parcel_scan_data() (+5 LOC); rewired frontend fetchScanFlags URL; extended shouldStopOnSuccess with dual-shape (top-level + legacy fallback); updated URL test + added 2 DEF-01 predicate tests.
- **Files modified:** backend/app/scans/schemas.py, backend/app/scans/parcels_service.py, frontend/src/hooks/useRescorePoll.ts, frontend/src/hooks/__tests__/useRescorePoll.test.ts, deferred-items.md.
- **Verification:** 19/19 useRescorePoll tests green (was 17 — added top-level shape + precedence tests); 94 pre-existing TS errors unchanged; backend ruff clean.
- **Committed in:** `15a3b3cb` (dedicated DEF-01 fix commit).
- **Why Rule 3 (blocking), not Rule 4 (architectural):** Adding a single typed Pydantic field to an existing schema is correctness-tier (Rule 3 for unblock the user-visible polling banner), not architectural (Rule 4 would be adding a new endpoint, new table, or new service). Scope: 2 backend files, +14 LOC backend, no migration needed (JSONB shape unchanged).

**No other deviations.** Tasks 1-3 executed as written.

---

**Total deviations:** 1 auto-fixed (Rule 3 — backend schema field added to resolve DEF-01).
**Impact on plan:** Zero functional scope change. DEF-01 was explicitly in scope per the orchestrator's `<scope_addition>` block ("DEF-01 MUST resolve in this plan as part of phase active definition"). The deviation was on the resolution PATH (backend field vs. frontend-only), not on whether to resolve.

## Authentication Gates

None — pure frontend + backend schema addition, no env vars / DB migrations / external services.

## Issues Encountered

- Initial DEF-01 schema field added to wrong class (ParcelAtPointResponse instead of ScanResultItem — the two have similarly-worded `building_metrics` field descriptions; my first Edit's anchor matched the second occurrence). Caught immediately via grep on `cascade_rescored_at` location; reverted and re-anchored to the ScanResultItem-specific `building_metrics` description text. No commit pollution.
- Pre-existing 94 TS errors confirmed unchanged after this plan's additions (per scope-boundary policy + Plan 08-02/03 precedent).

## User Setup Required

None.

## Next Phase Readiness

- **Plan 08-06 / 08-07 / 08-08 unblocked.** With 2-contact enabled and routed, the lifecycle sidebar swap (Plan 08-04 — already shipped) now lands users on a real fase-2 page instead of a placeholder.
- **Polling banner functional.** RescoreProgressBanner (Plan 08-03) now resolves cleanly when cascade rescore completes — the success state will be reachable in production. Previously stuck in polling → timeout for the full 60s window.
- **Iron-rule canary armed.** Any future plan toggling M060-M110 phase-enable flags must UPDATE the phases.test.ts contract (not delete it). Failure mode is loud: per-assertion error message names the regressing phase.

## Self-Check: PASSED

**Files:**
- `frontend/src/lib/lifecycle/phases.ts` — MODIFIED (2-contact enabled+milestone)
- `frontend/src/routes/_authenticated/opgeslagen.perceel.$parcelId.$phase.tsx` — MODIFIED (ContactPhaseView dispatch)
- `frontend/src/lib/lifecycle/__tests__/phases.test.ts` — EXISTS (67 LOC, 6 tests)
- `frontend/src/hooks/useRescorePoll.ts` — MODIFIED (DEF-01 URL + dual-shape predicate)
- `frontend/src/hooks/__tests__/useRescorePoll.test.ts` — MODIFIED (URL test + 2 DEF-01 predicate tests)
- `backend/app/scans/schemas.py` — MODIFIED (ScanResultItem.cascade_rescored_at field)
- `backend/app/scans/parcels_service.py` — MODIFIED (propagate cascade_rescored_at)
- `.planning/phases/08-brk-fase-2-wire-up/deferred-items.md` — MODIFIED (DEF-01 RESOLVED block)

**Commits:**
- `0eab6eda` — EXISTS (feat: flip 2-contact phase to enabled)
- `bf73c674` — EXISTS (feat: wire ContactPhaseView into $phase route)
- `37108ba3` — EXISTS (test: REGRESSION-CRITICAL phases.test.ts)
- `15a3b3cb` — EXISTS (fix: DEF-01 resolution — useRescorePoll endpoint rewire + ScanResultItem field)

**Verifications:**
- phases.test.ts: 6/6 green
- useRescorePoll.test.ts: 19/19 green (was 17 — added 2 DEF-01 tests)
- Combined: 25/25 green
- npm run check: 94 pre-existing errors unchanged (0 new)
- ruff check on backend changes: clean
- All Task 1 acceptance criteria greens: `enabled: false` ×6, `enabled: true` ×2, both 2-contact markers present
- All Task 2 acceptance criteria greens: import line + dispatch + render JSX + redirect preservation + placeholder preservation
- All Task 3 acceptance criteria greens: REGRESSION-CRITICAL marker present, 6 test cases, all future phase keys grep-detected
- DEF-01 resolution traceable: `git log --grep "DEF-01"` returns `15a3b3cb`; deferred-items.md marked RESOLVED with cross-reference

---

*Phase: 08-brk-fase-2-wire-up*
*Completed: 2026-05-19*
