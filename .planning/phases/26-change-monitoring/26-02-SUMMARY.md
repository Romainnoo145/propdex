---
phase: 26-change-monitoring
plan: 02
subsystem: backend-services
tags: [change-detection, monitoring-api, government-apis, rest-endpoints]
dependency_graph:
  requires: [26-01]
  provides: [change-detection-service, monitoring-endpoints]
  affects: [api-routes, government-api-clients]
tech_stack:
  added: []
  patterns: [delta-detection, pagination-handling, efficient-queries, upsert-pattern]
key_files:
  created:
    - backend/app/services/change_detector.py
    - backend/app/monitoring/__init__.py
    - backend/app/monitoring/router.py
  modified:
    - backend/app/main.py
decisions: []
metrics:
  duration_seconds: 250
  tasks_completed: 2
  files_created: 3
  files_modified: 1
  commits: 3
  completed_at: "2026-02-15T13:33:32Z"
---

# Phase 26 Plan 02: Change Detection Service & Monitoring API Summary

**One-liner:** Delta detection service for permits and zoning changes with REST API for change history and notification management.

## What Was Built

Created the backend intelligence layer for Phase 26 (Change Monitoring) by implementing change detection logic and REST API endpoints for frontend consumption.

### Key Components

**1. Change Detection Service (backend/app/services/change_detector.py)**

Three core functions for detecting changes from government APIs:

- **`detect_permit_changes(gemeente_naam, last_checked, client, session)`**
  - Queries SRU Bekendmakingen API for new omgevingsvergunningen
  - Handles pagination automatically when total_count > max_records (100)
  - Filters records by date using `parse_api_date()` helper
  - Deduplicates against existing ChangeRecord entries via DB query
  - Returns list of ChangeRecord instances (caller adds to session)

- **`detect_zoning_changes(gemeente_code, last_checked, client, session)`**
  - Fetches PDOK PLU WMS GetCapabilities XML metadata
  - Computes SHA256 hash of response content
  - Compares against stored hash in CachedAPIResponse model
  - Creates ChangeRecord if hash changed (coarse-grained change detection)
  - Updates cached hash for next comparison

- **`parse_api_date(date_str)`**
  - Parses ISO date strings from SRU API (may or may not include time)
  - Assumes Europe/Amsterdam timezone if naive
  - Converts to naive UTC datetime per project convention
  - Handles both "2026-02-15" and "2026-02-15T10:30:00" formats

**2. Monitoring Router (backend/app/monitoring/router.py)**

Four REST endpoints with authentication, rate limiting, and tenant isolation:

- **GET /api/monitoring/changes**
  - Returns paginated change history for specific project
  - Query params: `project_id` (required), `limit` (default 50), `offset` (default 0)
  - Ordered by `detected_at DESC` (newest first)
  - Side effect: Auto-updates `UserNotificationState.last_viewed_at` (clears unread badge)
  - Rate limit: 60/minute

- **GET /api/monitoring/unread**
  - Returns total unread count + per-project breakdown for current user
  - Uses single efficient query with subquery and CASE expression
  - Logic: Count ChangeRecords where `detected_at > last_viewed_at` (or all if never viewed)
  - NO N+1 queries (optimized after initial implementation)
  - Rate limit: 120/minute (polled frequently from frontend)

- **POST /api/monitoring/viewed/{project_id}**
  - Upserts UserNotificationState for current user + project
  - Sets `last_viewed_at` to `datetime.utcnow()`
  - Clears unread badge for this project
  - Rate limit: 60/minute

- **GET /api/monitoring/projects**
  - Returns hierarchical project list where `is_monitored=True`
  - Each project includes computed `unread_count` for current user
  - Uses same efficient query pattern as /unread endpoint
  - Rate limit: 60/minute

**3. Router Registration (backend/app/main.py)**

- Imported `monitoring_router` from `app.monitoring.router`
- Added `app.include_router(monitoring_router)` alongside existing routers
- All 4 endpoints now accessible via `/api/monitoring/*` prefix

## Architecture Decisions

**Delta Detection Pattern:**
- Service returns list of ChangeRecord instances WITHOUT adding to session
- Caller (future ARQ job) handles transaction management and project mapping
- Clean separation: detection logic doesn't need to know about projects

**Pagination Handling:**
- SRU API limits responses to 100 records per request
- Automatic pagination loop until `len(all_records) >= total_count`
- Uses `start_record` parameter to fetch subsequent pages
- Prevents data loss for municipalities with >100 permits

**Efficient Unread Queries:**
- Single query with LEFT JOIN and subquery (not N+1 per project)
- CASE expression handles "never viewed" vs "new changes" logic
- Reduces DB roundtrips from N to 1 for /unread endpoint

**Timezone Handling:**
- SRU API returns dates in Europe/Amsterdam timezone
- Convert to naive UTC using `zoneinfo.ZoneInfo`
- Follows project convention: `datetime.utcnow()` for all stored timestamps

**Upsert Pattern:**
- Query for existing UserNotificationState
- Create new if None, update existing otherwise
- Handles first-time viewers and repeat viewers with same code path

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Optimized unread endpoint to use single query**
- **Found during:** Task 2 verification
- **Issue:** Initial implementation used N+1 queries (loop per project with individual count queries)
- **Fix:** Replaced with single efficient query using subquery, LEFT JOIN, and CASE expression
- **Files modified:** `backend/app/monitoring/router.py`
- **Commit:** 177d067

Plan required: "Use single efficient query with subquery, NOT N+1 per-project queries"

Initial implementation had:
```python
for project in projects:
    # Query notification state for this project
    # Query count for this project
```

Optimized to:
```python
# Single query with LEFT JOIN on notification_subquery
# CASE expression handles "never viewed" vs "new changes"
# GROUP BY project_id
```

## Verification Results

All verification checks passed:

```bash
✓ 1. Change detector service imports successfully
✓ 2. Monitoring router imports successfully
✓ 3. Monitoring router registered in main.py (4 routes found)
✓ 4. All endpoints require auth (get_current_active_user, get_current_organization_id)
✓ 5. All endpoints filter by organization_id (tenant isolation)
✓ 6. Unread endpoint uses efficient query (single DB roundtrip)
✓ 7. Changes endpoint auto-updates last_viewed_at (side effect confirmed)
```

## Task Breakdown

| Task | Description | Commit | Key Files |
|------|-------------|--------|-----------|
| 1 | Create change detection service | 02984f4 | change_detector.py |
| 2 | Create monitoring router with 4 endpoints | 5877ddd | monitoring/__init__.py, monitoring/router.py, main.py |
| - | Optimize unread endpoint query (auto-fix) | 177d067 | monitoring/router.py |

## Dependencies Provided

**For subsequent plans in Phase 26:**
- Change detection service ready for ARQ cron jobs (Plan 03)
- Monitoring endpoints ready for frontend integration (Plan 04)
- Unread count API ready for notification badges (Plan 05)

## Technical Notes

**SRU Pagination Example:**
```python
# First page
records, total_count = await sru_client.query_by_municipality(
    gemeente="Amsterdam", record_type="Omgevingsvergunning",
    max_records=100, start_record=1
)

# If total_count > 100, fetch next page
if total_count > 100:
    records, _ = await sru_client.query_by_municipality(
        gemeente="Amsterdam", record_type="Omgevingsvergunning",
        max_records=100, start_record=101
    )
```

**PLU WMS Hash Comparison:**
```python
# Fetch GetCapabilities XML
response = await client.get(plu_wms_url, params={"SERVICE": "WMS", "REQUEST": "GetCapabilities"})

# Compute hash
content_hash = hashlib.sha256(response.content).hexdigest()

# Compare against stored hash in CachedAPIResponse
if content_hash != stored_hash:
    # Create ChangeRecord for zoning update
```

**Efficient Unread Count Query Pattern:**
```python
# Subquery: last_viewed_at per project
notification_subquery = select(
    UserNotificationState.project_id,
    UserNotificationState.last_viewed_at,
).where(UserNotificationState.user_id == current_user.id).subquery()

# Main query with LEFT JOIN and CASE
unread_count_expr = func.count(
    case(
        (notification_subquery.c.last_viewed_at.is_(None), ChangeRecord.id),  # Never viewed
        (ChangeRecord.detected_at > notification_subquery.c.last_viewed_at, ChangeRecord.id),  # New changes
        else_=None,
    )
)

query = (
    select(Project.id, unread_count_expr.label("unread_count"))
    .select_from(Project)
    .outerjoin(ChangeRecord, ChangeRecord.project_id == Project.id)
    .outerjoin(notification_subquery, notification_subquery.c.project_id == Project.id)
    .where(Project.is_monitored == True)
    .group_by(Project.id)
)
```

## Multi-Tenant Isolation

All endpoints enforce multi-tenant isolation:
- `get_current_organization_id` dependency provides tenant context
- All queries filter by `organization_id`
- UserNotificationState includes `organization_id` (CASCADE delete)
- ChangeRecord includes `organization_id` (CASCADE delete)

## Rate Limiting

| Endpoint | Limit | Rationale |
|----------|-------|-----------|
| GET /changes | 60/minute | Standard read rate |
| GET /unread | 120/minute | Polled frequently from frontend |
| POST /viewed | 60/minute | Standard write rate |
| GET /projects | 60/minute | Standard read rate |

## Self-Check: PASSED

All created files exist:
```bash
✓ backend/app/services/change_detector.py
✓ backend/app/monitoring/__init__.py
✓ backend/app/monitoring/router.py
```

All commits exist:
```bash
✓ 02984f4: feat(26-02): create change detection service
✓ 5877ddd: feat(26-02): create monitoring router with 4 endpoints
✓ 177d067: fix(26-02): optimize unread endpoint to use single query
```

Monitoring router registered:
```bash
✓ 4 routes found: /api/monitoring/changes, /unread, /viewed/{project_id}, /projects
```
