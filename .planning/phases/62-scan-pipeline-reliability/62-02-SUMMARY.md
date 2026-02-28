---
phase: 62-scan-pipeline-reliability
plan: "02"
subsystem: infra
tags: [arq, sqlalchemy, cli-tool, scan-orchestrator, dataclass]

# Dependency graph
requires:
  - phase: 62-01
    provides: coverage_ratio, address_resolution_ratio, error_detail fields on AreaScan
provides:
  - WijkOutcome dataclass for tracking per-wijk scan quality after completion
  - reset_scan_for_rescan clears coverage_ratio, address_resolution_ratio, error_detail
  - FORCE MODE deletion log before each wijk reset
  - End-of-run summary table with OK/WARN/FAIL icons and coverage/address percentages
  - --force-all continues on failure; normal mode still stops on first failure
affects: [scan-pipeline, operator-tooling, phase-63]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - WijkOutcome dataclass tracks per-wijk outcomes during batch processing
    - _print_summary() separated as standalone function for testability
    - Force-mode continue-on-failure pattern: check args.force_all/force_failed before break

key-files:
  created: []
  modified:
    - backend/app/scans/service.py
    - backend/app/tools/run_gemeente_wijk_scans.py

key-decisions:
  - "E501 line-too-long errors are pre-existing and ignored by project ruff config (ruff.toml: ignore = ['E501']); verified with project config, all new code passes"
  - "WijkOutcome appended for skipped wijken (status=action e.g. skip_completed) so summary table is always complete"
  - "not_started entries added to summary when batch stops early due to non-force failure"
  - "scan.parcels_total used for parcel_count in WijkOutcome (total discovered, not only with results)"

patterns-established:
  - "Force-mode logging: FORCE MODE prefix on console before any destructive reset operation"
  - "End-of-run summary: always printed via _print_summary() regardless of early exit"

requirements-completed:
  - SCAN-03

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 62 Plan 02: Force-Mode Clean-Slate Rescan + Summary Table Summary

**--force-all flag now performs true clean-slate rescan (clears coverage/address/error fields, logs deletion count) and prints an operator-facing summary table with OK/WARN/FAIL icons, parcel counts, and coverage percentages after all wijken are processed**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-28T12:26:58Z
- **Completed:** 2026-02-28T12:28:47Z
- **Tasks:** 2 (1 implementation + 1 verification)
- **Files modified:** 2

## Accomplishments

- `reset_scan_for_rescan` now clears `coverage_ratio`, `address_resolution_ratio`, and `error_detail` for a true clean slate before re-scanning
- FORCE MODE prominently logs deletion count before each wijk reset (`FORCE MODE: Deleting N existing results for {wijk_naam}`)
- `WijkOutcome` dataclass tracks per-wijk outcome (status, parcel_count, coverage_ratio, address_resolution_ratio) for the summary table
- `_print_summary()` prints a formatted table with OK/WARN/FAIL status icons and coverage/address percentages after all wijken complete
- `--force-all` and `--force-failed` now continue processing on individual wijk failure; normal mode still stops on first failure
- Not-started wijken appear in the summary table when batch stops early

## Task Commits

Each task was committed atomically:

1. **Task 1: Update reset_scan_for_rescan + add end-of-run summary to orchestrator** - `6cc7a9d` (feat)
2. **Task 2: Verify --force-all dry run produces expected output** - verified via `ruff check` + `python -c` import check; no additional files changed

## Files Created/Modified

- `backend/app/scans/service.py` - reset_scan_for_rescan now also clears coverage_ratio, address_resolution_ratio, error_detail
- `backend/app/tools/run_gemeente_wijk_scans.py` - WijkOutcome dataclass, ScanResult/sqla_func imports, FORCE MODE log, outcomes tracking, continue-on-failure for force mode, _print_summary() function

## Decisions Made

- E501 line-too-long errors were flagged by the plan's `--select E,F,W` ruff command but are pre-existing and explicitly ignored by the project's ruff config (`ignore = ["E501"]`). All files pass `ruff check` with project defaults.
- `WijkOutcome` entries are added for skipped wijken (with `status=item.action` e.g. `skip_completed`) so the summary table always accounts for all wijken in the queue, not just those that were actively scanned.
- `scan.parcels_total` is used for `parcel_count` in the outcome (total parcels discovered during scan, not count of ScanResult rows).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Scan orchestrator is now fully operator-ready with clean-slate force mode and end-of-run visibility
- Phase 62 plans 01 and 02 complete; BAG WFS retry + coverage tracking + force-mode rescan + summary table all in place
- Ready to proceed with subsequent phases (Phase 63 and beyond)

---
*Phase: 62-scan-pipeline-reliability*
*Completed: 2026-02-28*
