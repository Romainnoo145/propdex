# Phase 62: Scan Pipeline Reliability - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the silent BAG WFS failure in area_scan.py that causes scans to produce garbage data (no bouwjaar, unresolved addresses, wrong scoring). Add retry logic, coverage validation, and a --force-all backfill mode to re-populate existing scan data. This is a backend pipeline reliability phase — no frontend changes.

</domain>

<decisions>
## Implementation Decisions

### Retry & failure behavior
- Retry BAG WFS fetches with exponential backoff: 3 attempts at 1s → 2s → 4s (matches existing retry_with_backoff helper pattern)
- Retry granularity is per-page (BAG WFS paginates ~1000 features/page) — if page 3/5 fails, retry page 3 only, don't restart from page 1
- On persistent failure after all retries: abort the wijk scan entirely, do NOT continue with empty building data
- Mark failed wijk scans as AreaScan status='failed', automatically re-runnable on next gemeente scan orchestrator run

### Coverage validation
- Fixed 90% threshold: warn if >90% of parcels have has_pand=false after BAG cross-reference
- Warn only — do not block the scan. Save results and let operator review
- Store coverage_ratio as a field on the AreaScan model (numeric, queryable)
- Also validate address resolution rate: warn if >50% of parcels-with-buildings have no resolved PDOK address
- Warnings go to structured logging (logger.warning with scan_id, wijk_name, stats)

### Backfill mode (--force-all)
- --force-all flag on the gemeente scan orchestrator deletes existing ScanResult rows for the wijk, then re-runs the full pipeline fresh (clean slate)
- Full API re-fetch: re-fetch BAG buildings, re-resolve PDOK addresses, re-score — fixes root cause, not just symptoms
- Wijk-level granularity only — no single-parcel re-fetch
- No interactive confirmation required (it's an operator CLI tool, the flag name is the confirmation)
- Log prominently before deletion: "FORCE MODE: Deleting N existing results for wijk X"

### Failure visibility
- Structured logging with scan_id, wijk_name, failure reason, coverage stats at appropriate log levels
- AreaScan model gets new status values: 'failed', 'completed_with_warnings' alongside existing statuses
- Add nullable JSONB error_detail field on AreaScan to store structured failure context (API URL, HTTP status, retry count)
- Gemeente scan orchestrator prints end-of-run summary table: each wijk, status, parcel count, coverage ratio, address resolution rate
- No external notifications (manual demo prep, not unattended production)

### Claude's Discretion
- Exact Alembic migration strategy for new AreaScan fields
- Whether to add coverage_ratio + error_detail as separate migration or combined
- Log formatting details and log level choices
- How to integrate retry into existing BAG WFS pagination loop

</decisions>

<specifics>
## Specific Ideas

- The existing retry_with_backoff helper in base.py should be reused for BAG WFS retry — don't reinvent
- The current ON CONFLICT DO NOTHING behavior in scan results is what --force-all needs to override (by deleting first)
- End summary table should look like a CLI dashboard: wijk name, status icon, numbers — easy to scan visually

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 62-scan-pipeline-reliability*
*Context gathered: 2026-02-28*
