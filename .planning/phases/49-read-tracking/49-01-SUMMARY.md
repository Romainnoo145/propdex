---
phase: 49-read-tracking
plan: 01
subsystem: api
tags: [read-tracking, change-records, monitoring, sqlalchemy, alembic, fastapi]

# Dependency graph
requires:
  - phase: 48-parcel-matching
    provides: matched_parcel_id on ChangeRecord, change_records table FK basis

provides:
  - ChangeReadState model (change_read_states table) with user_id + change_id FK pair
  - Alembic migration e5f6a7b8c9d0 creating change_read_states table
  - POST /api/monitoring/changes/{id}/read endpoint (mark single change read)
  - DELETE /api/monitoring/changes/{id}/read endpoint (mark single change unread)
  - POST /api/monitoring/changes/read-all endpoint (bulk mark read, optional project_id)
  - Updated GET /unread using ChangeReadState LEFT JOIN (not last_viewed_at timestamp)
  - read_change_ids field on ChangeRecordListResponse for frontend read state

affects:
  - 49-02-PLAN (API model layer, frontend can consume read_change_ids)
  - future cleanup of UserNotificationState/last_viewed_at (deprecated)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - pg_insert ON CONFLICT DO NOTHING for idempotent upserts
    - LEFT JOIN subquery pattern for absence-based filtering (unread = no read state row)
    - Route ordering: literal paths (read-all) before parameterized ({change_id}/read)

key-files:
  created:
    - backend/app/models/change_read_state.py
    - backend/alembic/versions/e5f6a7b8c9d0_create_change_read_states_table.py
  modified:
    - backend/app/models/__init__.py
    - backend/app/schemas/monitoring.py
    - backend/app/monitoring/router.py

key-decisions:
  - "ChangeReadState has no TimestampMixin -- read state is insert/delete only, no updated_at needed"
  - "UniqueConstraint(user_id, change_id) enables ON CONFLICT DO NOTHING for idempotent mark-as-read"
  - "GET /unread now uses LEFT JOIN on change_read_states subquery -- absence means unread"
  - "read-all route registered before {change_id}/read to prevent FastAPI treating 'read-all' as UUID param"
  - "read_change_ids returned on GET /changes response -- frontend knows per-change read state without extra call"

patterns-established:
  - "Absence-based read tracking: unread = no row in change_read_states for (user_id, change_id)"

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 49 Plan 01: Read Tracking Summary

**ChangeReadState table + 3 API endpoints replacing last_viewed_at timestamp with per-change read tracking via SQLAlchemy ON CONFLICT DO NOTHING upserts**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T03:13:30Z
- **Completed:** 2026-02-23T03:15:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- ChangeReadState model with user_id/change_id FK pair and unique constraint, registered in models package
- Alembic migration e5f6a7b8c9d0 creates change_read_states table with proper indexes
- Three new API endpoints for granular read tracking (mark read, mark unread, mark all read)
- GET /unread rewritten to use ChangeReadState LEFT JOIN — a change is unread if no row exists for (user_id, change_id)
- GET /changes now returns read_change_ids so frontend has read state on page load

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ChangeReadState model and Alembic migration** - `fe616ad` (feat)
2. **Task 2: Add per-change read/unread API endpoints and update unread counts** - `8c6b6b7` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/app/models/change_read_state.py` - New model: change_read_states table with user_id + change_id FKs, UniqueConstraint, read_at timestamp
- `backend/alembic/versions/e5f6a7b8c9d0_create_change_read_states_table.py` - Migration creating change_read_states table (down_revision: d4e5f6a7b8c9)
- `backend/app/models/__init__.py` - ChangeReadState registered in __all__
- `backend/app/schemas/monitoring.py` - Added MarkAllReadResponse, read_change_ids on ChangeRecordListResponse
- `backend/app/monitoring/router.py` - 3 new endpoints + updated /unread + updated /changes response

## Decisions Made
- No TimestampMixin on ChangeReadState: read state is insert/delete only, no updated_at semantics needed
- UniqueConstraint(user_id, change_id) chosen over INSERT logic check — constraint enforces idempotency at DB level, pg_insert ON CONFLICT DO NOTHING leverages it
- GET /unread uses LEFT JOIN subquery (not correlated subquery per-project) — one query across all projects instead of N
- read-all route placed before {change_id}/read in router — FastAPI matches literally first, prevents "read-all" being treated as UUID
- read_change_ids added to ChangeRecordListResponse — avoids a separate frontend request to check read state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

The Alembic migration must be run against the production database before the new endpoints are usable:
```bash
cd backend && alembic upgrade head
```

## Next Phase Readiness
- ChangeReadState table and all 3 API endpoints ready for frontend consumption
- GET /changes now returns read_change_ids — frontend can render unread indicators immediately
- GET /unread reflects actual per-change read state (not project-level timestamp)
- UserNotificationState/last_viewed_at remains for backward compat (deprecated, removable in future cleanup)

---
*Phase: 49-read-tracking*
*Completed: 2026-02-23*

## Self-Check: PASSED

- FOUND: backend/app/models/change_read_state.py
- FOUND: backend/alembic/versions/e5f6a7b8c9d0_create_change_read_states_table.py
- FOUND: backend/app/schemas/monitoring.py
- FOUND: backend/app/monitoring/router.py
- FOUND commit fe616ad: feat(49-01): add ChangeReadState model and Alembic migration
- FOUND commit 8c6b6b7: feat(49-01): add per-change read/unread endpoints and update unread counts
