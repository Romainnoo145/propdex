---
phase: 26-change-monitoring
plan: 03
subsystem: backend-jobs
tags: [arq, cron, background-jobs, change-monitoring, automation]
dependency_graph:
  requires: [26-01, 26-02]
  provides: [daily-change-detection, automated-monitoring]
  affects: [arq-worker, change-records]
tech_stack:
  added: []
  patterns: [cron-scheduling, batch-processing, per-gemeente-grouping, partial-failure-tolerance]
key_files:
  created:
    - backend/app/jobs/change_monitor.py
  modified:
    - backend/app/jobs/worker.py
decisions: []
metrics:
  duration_seconds: 83
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  commits: 2
  completed_at: "2026-02-15T13:37:34Z"
---

# Phase 26 Plan 03: Change Detection Workers Summary

**One-liner:** ARQ cron job running daily at 03:00 UTC to detect permit and zoning changes across all monitored gemeentes with per-gemeente grouping and partial failure tolerance.

## What Was Built

Created the automated monitoring layer for Phase 26 (Change Monitoring) by implementing the daily change detection background job and registering it with the ARQ worker cron scheduler.

### Key Components

**1. Daily Change Monitor Job (backend/app/jobs/change_monitor.py)**

Background job function `daily_change_monitor_job(ctx: dict)` that:

- **Loads monitored projects**: Queries all projects where `is_monitored=True` and `gemeente_code IS NOT NULL`
- **Groups by gemeente**: Uses `defaultdict` to organize projects by gemeente_code, preventing duplicate API calls per gemeente
- **Resolves gemeente names**: For parent projects (parent_id=NULL), uses project.name. For wijk projects, finds parent project name
- **Determines last_checked**: Queries latest `detected_at` from ChangeRecord per gemeente, falls back to `utcnow() - 2 days` on first run
- **Detects changes per gemeente**:
  - Calls `detect_permit_changes(gemeente_naam, last_checked, client, session)` for SRU Bekendmakingen
  - Calls `detect_zoning_changes(gemeente_code, last_checked, client, session)` for PLU WMS metadata hash
- **Creates ChangeRecord per project**: Each detected change creates one ChangeRecord per project in the gemeente
- **Handles duplicates**: Catches `IntegrityError` from unique constraint on (change_type, external_id, gemeente_naam), logs and continues
- **Partial failure tolerance**: Wraps per-gemeente processing in try/except, commits per gemeente, one failure doesn't stop others
- **Returns summary**: `{"status": "completed", "gemeentes_checked": N, "total_changes": M}`

**Pipeline pattern follows `area_scan_job` conventions:**
- Creates own `create_async_engine` with `pool_size=5`
- Creates `async_sessionmaker` with `expire_on_commit=False`
- Uses `httpx.AsyncClient` with `timeout=30.0`
- Direct `session.add()` / `session.flush()` / `session.commit()` pattern (NOT `async with db.begin()`)
- Always closes http_client and disposes engine in `finally` block

**2. ARQ Worker Registration (backend/app/jobs/worker.py)**

Extended `WorkerSettings` class to include:

- **Import `arq.cron` module**: Added `from arq.cron import cron`
- **Import change monitor job**: Added `from app.jobs.change_monitor import daily_change_monitor_job`
- **Added to functions list**: `functions = [pdf_parsing_job, area_scan_job, daily_change_monitor_job]` (now 3 functions)
- **Added cron_jobs configuration**:
  ```python
  cron_jobs = [
      cron(daily_change_monitor_job, hour=3, minute=0, unique=True)
  ]
  ```
  - Runs at **03:00 UTC** (04:00 or 05:00 CET/CEST, off-peak hours)
  - `unique=True` prevents duplicate scheduling if worker restarts during execution

## Architecture Decisions

**Per-Gemeente Grouping:**
- Single API call per gemeente (not per project)
- SRU permit query and PLU WMS hash check run once per gemeente
- Results duplicated to all projects in that gemeente
- Efficient for municipalities with many wijk projects

**Gemeente Name Resolution:**
- Parent projects (parent_id=NULL) use project.name as gemeente_naam
- Wijk projects inherit gemeente_naam from parent project
- Build `gemeente_naam_map` during grouping phase
- Falls back to "Unknown" if resolution fails (should not happen in normal operation)

**Last Checked Timestamp:**
- Query latest `detected_at` from ChangeRecord per gemeente
- First run uses `utcnow() - timedelta(days=2)` to capture recent history
- Per-gemeente tracking (not global) handles staggered monitoring activation

**Duplicate Handling:**
- Unique constraint enforced at database level: (change_type, external_id, gemeente_naam)
- Catch `IntegrityError` during flush, rollback, log, and continue
- Each project gets separate ChangeRecord for same change (different project_id)
- Skip duplicates within same project silently

**Partial Failure Tolerance:**
- Per-gemeente try/except block
- Commit after each gemeente completes successfully
- One gemeente API failure doesn't affect others
- Log error, continue to next gemeente

**Cron Schedule Rationale:**
- 03:00 UTC = 04:00/05:00 Netherlands time (off-peak)
- Runs after daily data updates from Omgevingsloket (typically 02:00)
- Before business hours (users see updates when they log in)
- `unique=True` prevents overlap if previous run still executing

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification checks passed:

```bash
✓ 1. Change monitor job imports successfully
✓ 2. WorkerSettings has cron_jobs attribute
✓ 3. WorkerSettings.functions has 3 entries
✓ 4. WorkerSettings.cron_jobs has 1 entry
✓ 5. Cron schedule is hour=3, minute=0, unique=True
```

## Task Breakdown

| Task | Description | Commit | Key Files |
|------|-------------|--------|-----------|
| 1 | Create daily change monitor ARQ job | 4726ec7 | change_monitor.py |
| 2 | Register cron job in ARQ worker | c01d80c | worker.py |

## Dependencies Provided

**For subsequent plans in Phase 26:**
- Daily change detection automation ready (Plan 04 can rely on populated ChangeRecord table)
- Monitoring infrastructure complete (frontend can fetch from monitoring API)

**For production deployment:**
- ARQ worker must be running: `arq app.jobs.worker.WorkerSettings`
- Redis must be available (configured via `settings.REDIS_URL`)
- Database must be accessible from worker process

## Technical Notes

**Gemeente Grouping Pattern:**
```python
# Group projects by gemeente_code
gemeente_map: dict[str, list[Project]] = defaultdict(list)
gemeente_naam_map: dict[str, str] = {}

for project in all_projects:
    if project.gemeente_code:
        gemeente_map[project.gemeente_code].append(project)

        # Resolve gemeente_naam
        if project.parent_id is None:
            gemeente_naam_map[project.gemeente_code] = project.name
        elif project.gemeente_code not in gemeente_naam_map:
            # Find parent project
            for p in all_projects:
                if p.gemeente_code == project.gemeente_code and p.parent_id is None:
                    gemeente_naam_map[project.gemeente_code] = p.name
                    break
```

**Last Checked Query:**
```python
# Find latest detected_at for this gemeente
stmt = (
    select(ChangeRecord.detected_at)
    .join(Project, ChangeRecord.project_id == Project.id)
    .where(Project.gemeente_code == gemeente_code)
    .order_by(ChangeRecord.detected_at.desc())
    .limit(1)
)
result = await session.execute(stmt)
last_detected = result.scalar_one_or_none()

if last_detected:
    last_checked = last_detected
else:
    # First run — check last 2 days
    last_checked = datetime.utcnow() - timedelta(days=2)
```

**Duplicate Protection:**
```python
for change in all_changes:
    for project in projects:
        change_copy = ChangeRecord(
            organization_id=project.organization_id,
            project_id=project.id,
            change_type=change.change_type,
            external_id=change.external_id,
            gemeente_naam=change.gemeente_naam,
            # ... other fields
        )
        session.add(change_copy)

        try:
            await session.flush()
            total_changes += 1
        except IntegrityError:
            # Duplicate — skip
            await session.rollback()
            continue
```

**ARQ Cron Syntax:**
```python
from arq.cron import cron

cron_jobs = [
    cron(daily_change_monitor_job, hour=3, minute=0, unique=True)
]
```
- `hour=3, minute=0` = 03:00 UTC daily
- `unique=True` = only one instance runs at a time (prevents overlap)
- No `day`, `month`, `weekday` = runs every day

## Integration with Phase 26 Plans

**From Plan 26-01 (Data Layer):**
- Uses `ChangeRecord` model with unique constraint on (change_type, external_id, gemeente_naam)
- Uses `Project` model hierarchy (parent_id, gemeente_code, wijk_naam, is_monitored)

**From Plan 26-02 (Detection Service):**
- Calls `detect_permit_changes(gemeente_naam, last_checked, client, session)`
- Calls `detect_zoning_changes(gemeente_code, last_checked, client, session)`
- Both return list of ChangeRecord instances WITHOUT project_id (job sets it)

**For Plan 26-04 (Frontend):**
- Populates ChangeRecord table daily at 03:00 UTC
- Frontend monitoring API (`/api/monitoring/changes`, `/api/monitoring/unread`) can fetch from populated table

## Operational Notes

**Starting the ARQ worker:**
```bash
cd backend
arq app.jobs.worker.WorkerSettings
```

**Monitoring job execution:**
- Check Redis for job results: `redis-cli KEYS "arq:result:*"`
- Check logs for "Starting daily change monitor job" and completion summary
- Monitor return dict: `{"status": "completed", "gemeentes_checked": N, "total_changes": M}`

**Manual job invocation (testing):**
```python
from arq import create_pool
from app.jobs.worker import get_redis_settings
from app.jobs.change_monitor import daily_change_monitor_job

pool = await create_pool(get_redis_settings())
job = await pool.enqueue_job("daily_change_monitor_job")
```

**Expected behavior:**
- Runs every day at 03:00 UTC
- Processes all gemeentes with monitored projects
- Creates ChangeRecord entries for new permits and zoning changes
- Silently skips duplicates (logged at debug level)
- Tolerates partial failures (one gemeente error doesn't stop others)

## Self-Check: PASSED

All created files exist:
```bash
✓ backend/app/jobs/change_monitor.py
```

All commits exist:
```bash
✓ 4726ec7: feat(26-03): create daily change monitor job
✓ c01d80c: feat(26-03): register daily change monitor in ARQ worker
```

Worker configuration verified:
```bash
✓ 3 functions registered: pdf_parsing_job, area_scan_job, daily_change_monitor_job
✓ 1 cron job scheduled: daily_change_monitor_job at 03:00 UTC with unique=True
```
