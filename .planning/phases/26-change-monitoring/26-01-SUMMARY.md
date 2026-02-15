---
phase: 26-change-monitoring
plan: 01
subsystem: data-layer
tags: [database, models, schemas, migration, multi-tenant]
dependency_graph:
  requires: []
  provides: [change-monitoring-models, project-hierarchy]
  affects: [database-schema, api-schemas]
tech_stack:
  added: []
  patterns: [hierarchical-models, self-referential-relationships, change-tracking]
key_files:
  created:
    - backend/app/models/change_record.py
    - backend/app/models/user_notification_state.py
    - backend/app/schemas/monitoring.py
    - backend/alembic/versions/089ed9b025cb_add_change_monitoring_tables.py
  modified:
    - backend/app/models/project.py
    - backend/app/models/__init__.py
    - backend/app/schemas/project.py
decisions: []
metrics:
  duration_seconds: 164
  tasks_completed: 2
  files_created: 4
  files_modified: 3
  commits: 2
  completed_at: "2026-02-15T13:27:05Z"
---

# Phase 26 Plan 01: Change Monitoring Data Layer Summary

**One-liner:** Database models and schemas for hierarchical project organization and automated change detection from permit/zoning APIs.

## What Was Built

Created the foundational data layer for Phase 26 (Change Monitoring) by extending the existing Project model and adding two new models to track detected changes and per-user notification state.

### Key Components

**1. Extended Project Model (backend/app/models/project.py)**
- Added hierarchical project grouping via self-referential `parent_id` foreign key
- Added `gemeente_code` (CBS code), `wijk_naam` (neighborhood name) for geographic organization
- Added `is_monitored` boolean flag (defaults to true) for active monitoring control
- Implemented bidirectional relationships (`children` and `parent`) for tree traversal
- Uses `foreign_keys` and `remote_side` parameters for SQLAlchemy self-referential relationships

**2. ChangeRecord Model (backend/app/models/change_record.py)**
- Stores detected changes from external APIs (permits from Omgevingsloket, zoning from Ruimtelijkeplannen.nl)
- `change_type` field: "permit" or "zoning"
- Tracks `detected_at` (when we found it) vs `change_date` (official date from API)
- JSONB `metadata_json` field (mapped to `change_metadata` column) stores raw API response
- Unique constraint on (change_type, external_id, gemeente_naam) prevents duplicates
- Compound index on (project_id, detected_at) optimizes query: "what's new for this project?"

**3. UserNotificationState Model (backend/app/models/user_notification_state.py)**
- Tracks `last_viewed_at` timestamp per user per project
- Enables unread count calculation: `ChangeRecord.detected_at > UserNotificationState.last_viewed_at`
- Unique constraint on (user_id, project_id) ensures single state record per user/project pair
- Updated whenever user views changes for a specific project

**4. Pydantic Schemas (backend/app/schemas/monitoring.py)**
- `ChangeRecordResponse` - individual change record with ISO datetime strings
- `ChangeRecordListResponse` - paginated list wrapper
- `UnreadCountResponse` - summary counts (total unread, projects with changes)
- `UnreadDetailResponse` - per-project unread breakdown

**5. Extended ProjectResponse Schema (backend/app/schemas/project.py)**
- Added `parent_id`, `gemeente_code`, `wijk_naam`, `is_monitored` fields
- Added `unread_count` (computed, not stored) for UI badge display
- Added `children` list for hierarchical tree responses
- Added `ProjectResponse.model_rebuild()` to handle forward reference

**6. Alembic Migration (089ed9b025cb_add_change_monitoring_tables.py)**
- Creates `change_records` table with 5 indexes (change_type, detected_at, organization_id, project_id, compound project_id+detected_at)
- Creates `user_notification_states` table with 2 indexes (organization_id, compound user_id+project_id)
- Adds 4 columns to `projects` table (parent_id, gemeente_code, wijk_naam, is_monitored)
- Creates self-referential foreign key on projects.parent_id
- Includes proper downgrade script

## Multi-Tenant Isolation

All new models use `TenantMixin` for organization_id foreign key:
- ChangeRecord has organization_id (NOT NULL, indexed, CASCADE delete)
- UserNotificationState has organization_id (NOT NULL, indexed, CASCADE delete)
- Project already had organization_id from v1.0

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification checks passed:

```bash
✓ Models import without error
✓ Schemas import without error
✓ Alembic migration applied successfully (089ed9b025cb at head)
✓ Project model has parent_id, gemeente_code, wijk_naam, is_monitored fields
✓ ChangeRecord has unique constraint uq_change_records_type_external_gemeente
✓ UserNotificationState has unique constraint uq_user_notification_states_user_project
```

## Task Breakdown

| Task | Description | Commit | Key Files |
|------|-------------|--------|-----------|
| 1 | Extend Project model + create ChangeRecord and UserNotificationState models | 99f0797 | change_record.py, user_notification_state.py, project.py, __init__.py |
| 2 | Create Pydantic schemas + Alembic migration | 82ce98d | monitoring.py, project.py, 089ed9b025cb_add_change_monitoring_tables.py |

## Dependencies Provided

**For subsequent plans in Phase 26:**
- ChangeRecord model ready for detector jobs (Plan 02)
- UserNotificationState ready for unread count API (Plan 03)
- Project hierarchy ready for gemeente/wijk grouping UI (Plan 04)
- Extended ProjectResponse ready for frontend consumption (Plan 05)

## Technical Notes

**Self-Referential Relationship Pattern:**
```python
parent_id: Mapped[uuid.UUID | None] = mapped_column(
    ForeignKey("projects.id", ondelete="CASCADE"),
    nullable=True,
    index=True,
)

children: Mapped[list["Project"]] = relationship(
    "Project",
    back_populates="parent",
    cascade="all, delete-orphan",
    foreign_keys="[Project.parent_id]",  # Required for self-ref
)

parent: Mapped["Project | None"] = relationship(
    "Project",
    back_populates="children",
    remote_side="[Project.id]",  # Required for self-ref
    foreign_keys="[Project.parent_id]",
)
```

**JSONB Column Name Mapping:**
Used `mapped_column(name="change_metadata")` to avoid collision with SQLAlchemy's `metadata` attribute, while exposing as `metadata_json` in Python code.

**DateTime Convention:**
Followed project convention of naive UTC datetimes (`server_default=text("CURRENT_TIMESTAMP")`), not timezone-aware.

## Self-Check: PASSED

All created files exist:
```bash
✓ backend/app/models/change_record.py
✓ backend/app/models/user_notification_state.py
✓ backend/app/schemas/monitoring.py
✓ backend/alembic/versions/089ed9b025cb_add_change_monitoring_tables.py
```

All commits exist:
```bash
✓ 99f0797: feat(26-01): add change monitoring models
✓ 82ce98d: feat(26-01): add monitoring schemas and migration
```

Database tables created:
```bash
✓ change_records table with 5 indexes
✓ user_notification_states table with 2 indexes
✓ projects table extended with 4 new columns
```
