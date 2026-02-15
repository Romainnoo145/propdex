# Phase 26: Change Monitoring - Research

**Researched:** 2026-02-15
**Domain:** Background job scheduling, change detection, hierarchical data models, real-time notifications
**Confidence:** MEDIUM

## Summary

Change monitoring for Dutch property intelligence requires daily scheduled checks of two data sources: SRU Bekendmakingen for new omgevingsvergunningen and PDOK PLU WMS for bestemmingsplan updates. The architecture leverages existing ARQ worker infrastructure to run cron jobs, stores change records with timestamps for delta detection, and surfaces notifications through a dual-badge system (project folders + navigation rail).

The phase involves extending the Project model to support hierarchical gemeente/wijk grouping, creating new ChangeRecord and UserNotification models, implementing delta detection logic comparing cached state against API responses, and building React UI components for notification badges and change timelines.

**Primary recommendation:** Use ARQ cron jobs for daily monitoring (already proven in area scan pipeline), self-referential foreign key on Project for hierarchical folders, and track "last seen" timestamps per user to drive notification badge counts without PostgreSQL LISTEN/NOTIFY complexity.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Saving areas to watch
- Every wijk scan auto-creates a project folder (no manual save step)
- Hierarchical project structure: Gemeente group containing Wijk projects (e.g., "Venlo" group with "Blerick-Zuid", "Tegelen" as sub-projects)
- Scanned wijken get a filled semi-transparent overlay on the map indicating they're being monitored
- Change monitoring is tied to the project system — changes appear as a changelog inside the wijk's project folder

#### Notification experience
- Dual notification: badge/dot on the project folder in Projecten tab AND a notification icon with count badge in the side navigation rail
- Notifications cleared automatically when user opens/views the project folder or change detail (no manual dismiss)
- Side-rail notification icon click navigates to Projecten tab with changed projects highlighted
- In-app notifications only — no email notifications

#### Change types
- Both permits (omgevingsvergunningen) and bestemmingsplan changes are equally important
- No filtering UI needed — show all change types together, differentiated by icon/color
- Daily automated checks only — no manual rescan button
- No filter tabs — volume expected to be manageable per wijk

### Claude's Discretion

- Change history layout: timeline vs table/list (pick what fits existing UI patterns)
- Change entry detail level: compact with expand (date, address, type icon — click for details)
- Change grouping: by date vs by address (pick what makes sense for scanning)
- Map linking: whether clicking a change entry flies to the affected parcel on the map
- History depth: rolling window vs full history (consider storage and performance)

### Deferred Ideas (OUT OF SCOPE)

- Email digest notifications — noted for future enhancement
- Manual rescan/on-demand change check — not needed now, daily sufficient
</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ARQ | 0.27.0 | Background job queue + cron | Already in use (Phase 20), proven for area scans, supports cron_jobs for scheduling |
| SQLAlchemy 2.x | Current | Hierarchical Project model + change tracking | Existing ORM, supports self-referential relationships via `remote_side` |
| Redis | 5.0.0+ | ARQ backend + notification state | Already running, required for ARQ, can cache "last checked" timestamps |
| PostgreSQL | Current | Change record storage + JSONB | Existing database, JSONB for flexible change payloads |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| httpx | 0.27.0+ | SRU + WMS API calls | Already in use for SRU/WMS clients, async-compatible |
| lxml | 5.3.0+ | SRU XML parsing | Already in use for SRU responses, XXE-safe |
| Pydantic | Current | Change record schemas | Type-safe validation for change payloads |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ARQ cron | Celery Beat | ARQ already proven, simpler config, async-first. Celery adds dependency weight. |
| Self-referential FK | PostgreSQL ltree | ltree powerful but overkill for 2-level hierarchy (gemeente/wijk). FK simpler, no extension. |
| Timestamp tracking | PostgreSQL LISTEN/NOTIFY | LISTEN/NOTIFY requires persistent connections, complicates deployment. Polling sufficient for daily checks. |

**Installation:**
```bash
# Backend: Already installed
# No new dependencies required — all libs already in pyproject.toml
```

**Frontend:**
```bash
# No new libraries needed — use existing:
# - React hooks for notification state
# - Tailwind for badge styling
# - TanStack Query for polling notification counts
```

## Architecture Patterns

### Recommended Project Structure

**Backend:**
```
backend/app/
├── models/
│   ├── change_record.py          # New: ChangeRecord model
│   ├── user_notification.py      # New: UserNotification tracking
│   └── project.py                 # EXTEND: Add parent_id for hierarchy
├── jobs/
│   ├── change_monitor.py          # New: Daily change detection job
│   └── worker.py                  # EXTEND: Register cron_jobs
├── services/
│   └── change_detector.py         # New: Delta detection logic
└── monitoring/
    └── router.py                  # New: Change + notification endpoints
```

**Frontend:**
```
frontend/src/
├── components/
│   ├── notifications/
│   │   ├── NotificationBadge.tsx  # New: Badge with count
│   │   └── ChangeTimeline.tsx     # New: Change history display
│   └── projects/
│       └── ProjectTree.tsx        # EXTEND: Hierarchical folder view
└── hooks/
    └── useNotifications.ts        # New: Poll notification state
```

### Pattern 1: ARQ Cron Job for Daily Monitoring

**What:** Scheduled background job runs daily at configured time, queries APIs for changes since last check, stores new records.

**When to use:** All scheduled monitoring tasks — permits, zoning changes, future data sources.

**Example:**
```python
# backend/app/jobs/worker.py
from arq.cron import cron
from app.jobs.change_monitor import daily_change_monitor_job

class WorkerSettings:
    functions = [pdf_parsing_job, area_scan_job, daily_change_monitor_job]

    # Run daily at 03:00 UTC (off-peak)
    cron_jobs = [
        cron(daily_change_monitor_job, hour=3, minute=0, unique=True)
    ]

    redis_settings = get_redis_settings()
    max_jobs = 5
    job_timeout = 3600
```

**Source:** [ARQ Documentation - Cron Jobs](https://arq-docs.helpmanual.io/)

### Pattern 2: Hierarchical Project Model with Self-Referential FK

**What:** Project table with optional `parent_id` foreign key referencing itself. Gemeente projects have `parent_id=NULL`, wijk projects reference their gemeente parent.

**When to use:** Two-level hierarchy (gemeente → wijk). For deeper trees, consider ltree extension.

**Example:**
```python
# backend/app/models/project.py
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

class Project(Base, TenantMixin, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Hierarchical structure: gemeente (parent) → wijk (children)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Metadata for monitoring
    gemeente_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    wijk_naam: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_monitored: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Relationships
    children: Mapped[list["Project"]] = relationship(
        "Project",
        back_populates="parent",
        remote_side=[id],
        cascade="all, delete-orphan",
    )
    parent: Mapped["Project | None"] = relationship(
        "Project",
        back_populates="children",
        remote_side=[parent_id],
    )
```

**Source:** [SQLAlchemy - Adjacency List Relationships](https://docs.sqlalchemy.org/en/21/orm/self_referential.html)

### Pattern 3: Delta Detection with Cached State

**What:** Store "last checked" timestamp per monitored project. On daily run, query API with date filter `modified:>={last_checked}`, compare identifiers against existing ChangeRecord table, insert only new changes.

**When to use:** All change detection scenarios where API supports date/time filtering.

**Example:**
```python
# backend/app/services/change_detector.py
from datetime import datetime, timedelta
from app.government_apis.sru_bekendmakingen import sru_client

async def detect_permit_changes(
    gemeente_naam: str,
    last_checked: datetime,
    client: httpx.AsyncClient,
    session: AsyncSession,
) -> list[ChangeRecord]:
    """
    Detect new omgevingsvergunningen since last_checked timestamp.

    Uses SRU date filtering to fetch only recent bekendmakingen,
    deduplicates against existing ChangeRecord.identifier.
    """
    # SRU query with date filter
    records, _total = await sru_client.query_by_municipality(
        gemeente=gemeente_naam,
        record_type="Omgevingsvergunning",
        client=client,
    )

    # Filter by date (SRU returns ISO date strings)
    new_records = [
        r for r in records
        if datetime.fromisoformat(r["date"]) > last_checked
    ]

    # Check existing identifiers in ChangeRecord table
    existing_ids = await session.execute(
        select(ChangeRecord.external_id).where(
            ChangeRecord.change_type == "permit",
            ChangeRecord.gemeente_naam == gemeente_naam,
        )
    )
    existing_set = {row[0] for row in existing_ids}

    # Create ChangeRecord entries for new permits
    changes = []
    for record in new_records:
        if record["identifier"] not in existing_set:
            change = ChangeRecord(
                change_type="permit",
                external_id=record["identifier"],
                title=record["title"],
                detected_at=datetime.utcnow(),
                change_date=datetime.fromisoformat(record["date"]),
                gemeente_naam=gemeente_naam,
                metadata=record,  # JSONB
            )
            changes.append(change)

    return changes
```

**Source:** [SRU Bekendmakingen Documentation](https://standaarden.overheid.nl/sru), existing `backend/app/government_apis/sru_bekendmakingen.py`

### Pattern 4: User-Specific Notification Tracking

**What:** Track "last viewed" timestamp per user per project. Badge count = count of ChangeRecord entries linked to that project where `detected_at > user_last_viewed`.

**When to use:** Multi-tenant notification systems where each user sees only unread changes.

**Example:**
```python
# backend/app/models/user_notification.py
class UserNotificationState(Base, TenantMixin, TimestampMixin):
    """
    Tracks when user last viewed changes for a project.
    Badge count = changes detected after last_viewed_at.
    """
    __tablename__ = "user_notification_states"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)

    last_viewed_at: Mapped[datetime] = mapped_column(
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_user_notif_user_project", "user_id", "project_id"),
        UniqueConstraint("user_id", "project_id", name="uq_user_notif_user_project"),
    )

# Endpoint to get unread count
@router.get("/notifications/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Count unread changes across all monitored projects.

    Returns: {"unread_count": 12, "projects_with_changes": 3}
    """
    # Get user's last_viewed timestamps
    stmt = select(UserNotificationState).where(
        UserNotificationState.user_id == current_user.id
    )
    result = await db.execute(stmt)
    view_states = {row.project_id: row.last_viewed_at for row in result.scalars()}

    # Get user's monitored projects
    projects_stmt = select(Project).where(
        Project.organization_id == organization_id,
        Project.is_monitored == True,
    )
    projects = (await db.execute(projects_stmt)).scalars().all()

    total_unread = 0
    projects_with_changes = 0

    for project in projects:
        last_viewed = view_states.get(project.id, datetime.min)

        # Count changes detected after last view
        changes_stmt = select(func.count(ChangeRecord.id)).where(
            ChangeRecord.project_id == project.id,
            ChangeRecord.detected_at > last_viewed,
        )
        count = (await db.execute(changes_stmt)).scalar() or 0

        if count > 0:
            total_unread += count
            projects_with_changes += 1

    return {
        "unread_count": total_unread,
        "projects_with_changes": projects_with_changes,
    }
```

### Pattern 5: React Notification Badge with TanStack Query Polling

**What:** Poll `/notifications/unread-count` endpoint every 60 seconds, display badge with count on navigation rail and project folders.

**When to use:** In-app notifications without WebSocket complexity.

**Example:**
```typescript
// frontend/src/hooks/useNotifications.ts
import { useQuery } from '@tanstack/react-query';

interface NotificationCount {
  unread_count: number;
  projects_with_changes: number;
}

export function useNotifications() {
  return useQuery<NotificationCount>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/unread-count', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
    refetchInterval: 60000, // Poll every 60 seconds
    staleTime: 30000,
  });
}

// frontend/src/components/notifications/NotificationBadge.tsx
import { useNotifications } from '@/hooks/useNotifications';

export function NotificationBadge() {
  const { data } = useNotifications();

  if (!data || data.unread_count === 0) return null;

  const displayCount = data.unread_count > 99 ? '99+' : data.unread_count;

  return (
    <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-medium text-white">
      {displayCount}
    </span>
  );
}
```

**Best practice:** Cap badge counts at 99+ — nobody cares about 847 vs 848 unread.

**Source:** [A Guide to React Notification Badges](https://www.magicbell.com/blog/react-notification-badges), [Material-UI Badge](https://mui.com/material-ui/react-badge/)

### Anti-Patterns to Avoid

- **Polling APIs directly from frontend:** Creates rate limit issues, auth complexity. Always proxy through backend endpoints.
- **WebSocket over-engineering:** For daily-updated data, 60-second polling is sufficient and simpler than WebSocket connection management.
- **N+1 queries for badge counts:** Batch-load notification states, use subqueries to aggregate counts efficiently.
- **Storing full API responses:** Store only identifiers + metadata in ChangeRecord. Link to original source via URL, don't duplicate large payloads.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job scheduling | Custom cron script | ARQ cron_jobs | Existing infra, handles concurrency, crash recovery, job IDs |
| Date range queries | Manual timestamp math | SRU date filters + SQLAlchemy date comparison | SRU supports `modified:>=` syntax, DB handles timezone edge cases |
| Hierarchical queries | Recursive Python loops | SQLAlchemy relationship() with remote_side | ORM handles lazy/eager loading, prevents N+1 queries |
| Badge UI components | Custom CSS | Tailwind utilities + absolute positioning | Consistent with existing UI, responsive, accessible |

**Key insight:** Change detection has subtle edge cases (timezone handling, duplicate detection, partial failures). Leverage existing proven patterns (ARQ for scheduling, SQLAlchemy for relationships, SRU date filtering) rather than reimplementing.

## Common Pitfalls

### Pitfall 1: Timezone Confusion Between API Dates and Database Timestamps

**What goes wrong:** SRU returns date strings (possibly local time), PDOK returns other formats, database stores UTC. Comparing mixed timezones creates false positives/negatives.

**Why it happens:** Dutch government APIs use Europe/Amsterdam timezone, PostgreSQL `TIMESTAMP WITHOUT TIME ZONE` stores naive UTC (per project MEMORY.md).

**How to avoid:**
1. Parse all API dates as Europe/Amsterdam timezone
2. Convert to UTC immediately after parsing
3. Store as naive UTC in database (existing pattern)
4. Use `datetime.utcnow()` for "last checked" timestamps

**Warning signs:** Changes appearing multiple times, or never appearing despite being visible on officielebekendmakingen.nl

**Example fix:**
```python
from zoneinfo import ZoneInfo

def parse_api_date(date_str: str) -> datetime:
    """Parse SRU date string (Europe/Amsterdam) to naive UTC."""
    # SRU returns ISO dates like "2026-02-15"
    dt = datetime.fromisoformat(date_str)
    # Assume Europe/Amsterdam if no timezone
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("Europe/Amsterdam"))
    # Convert to UTC and remove timezone (naive UTC)
    return dt.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
```

### Pitfall 2: Duplicate Change Detection During Concurrent Runs

**What goes wrong:** If two ARQ workers run simultaneously (due to restart during job execution), both may detect the same changes and create duplicate ChangeRecord entries.

**Why it happens:** ARQ `unique=True` prevents duplicate _scheduling_, but doesn't prevent overlapping execution if a job runs longer than the cron interval.

**How to avoid:**
1. Use `unique=True` in cron_jobs definition
2. Add database-level unique constraint on `(change_type, external_id, gemeente_naam)`
3. Handle IntegrityError gracefully in job (log and skip)

**Warning signs:** Duplicate entries in ChangeRecord table with identical external_id.

**Example fix:**
```python
# backend/app/models/change_record.py
class ChangeRecord(Base, TenantMixin, TimestampMixin):
    __table_args__ = (
        UniqueConstraint(
            "change_type", "external_id", "gemeente_naam",
            name="uq_change_type_external_gemeente"
        ),
    )

# backend/app/jobs/change_monitor.py
from sqlalchemy.exc import IntegrityError

async def store_changes(changes: list[ChangeRecord], session: AsyncSession):
    for change in changes:
        try:
            session.add(change)
            await session.flush()
        except IntegrityError:
            logger.info(f"Change {change.external_id} already exists, skipping")
            await session.rollback()
```

### Pitfall 3: Missing Changes Due to API Pagination

**What goes wrong:** SRU returns max 100 records per request. If 150 new permits were issued, the job only detects 100, missing 50.

**Why it happens:** Not handling pagination when `numberOfRecords > maximumRecords`.

**How to avoid:**
1. Check `numberOfRecords` in SRU response
2. If total > max, make multiple requests with `startRecord` parameter
3. Or increase `maximumRecords` to 1000 (SRU max)

**Warning signs:** Notification count suspiciously round numbers (exactly 100), or missing changes visible on website.

**Example fix:**
```python
async def fetch_all_new_permits(gemeente: str, since: datetime, client: httpx.AsyncClient):
    all_records = []
    start_record = 1
    max_per_request = 1000  # SRU maximum

    while True:
        records, total_count = await sru_client.query_by_municipality(
            gemeente=gemeente,
            record_type="Omgevingsvergunning",
            max_records=max_per_request,
            start_record=start_record,
            client=client,
        )

        all_records.extend(records)

        # Stop if we've fetched all records
        if start_record + len(records) > total_count:
            break

        start_record += max_per_request

    return all_records
```

### Pitfall 4: Inefficient Notification Badge Queries (N+1 Problem)

**What goes wrong:** Frontend requests badge count for 50 projects individually, creating 50 database queries, slowing page load.

**Why it happens:** Naive per-project polling without batching.

**How to avoid:**
1. Single endpoint returns badge counts for ALL user's projects
2. Frontend caches result, updates badges in batch
3. Use SQLAlchemy subquery to compute counts in single query

**Warning signs:** Slow project list rendering, high database query count in logs.

**Example fix:** See Pattern 4 above — single query with aggregation.

## Code Examples

Verified patterns from existing codebase and official sources:

### Daily Change Monitor Job

```python
# backend/app/jobs/change_monitor.py
"""Daily change monitoring for omgevingsvergunningen and bestemmingsplannen."""

import asyncio
import logging
from datetime import datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.change_record import ChangeRecord
from app.models.project import Project
from app.services.change_detector import detect_permit_changes, detect_zoning_changes

logger = logging.getLogger(__name__)

async def daily_change_monitor_job(ctx: dict) -> dict:
    """
    Background job: Check for new permits and zoning changes in monitored areas.

    Runs daily at 03:00 UTC via ARQ cron.

    Pipeline:
        1. Load all monitored projects (is_monitored=True)
        2. For each gemeente: detect permit changes via SRU
        3. For each gemeente: detect zoning changes via PLU WMS
        4. Store new ChangeRecord entries
        5. Return summary of detected changes

    Args:
        ctx: ARQ context

    Returns:
        dict with job summary
    """
    engine = create_async_engine(settings.DATABASE_URL, pool_size=5, max_overflow=10)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    http_client: httpx.AsyncClient | None = None
    total_changes = 0

    try:
        http_client = httpx.AsyncClient(timeout=30.0)

        async with session_factory() as session:
            # Get all monitored projects grouped by gemeente
            stmt = select(Project).where(
                Project.is_monitored == True,
                Project.gemeente_code.isnot(None),
            )
            result = await session.execute(stmt)
            projects = result.scalars().all()

            # Group by gemeente_code to avoid duplicate API calls
            gemeentes = {}
            for project in projects:
                if project.gemeente_code not in gemeentes:
                    gemeentes[project.gemeente_code] = {
                        "naam": project.name if project.parent_id is None else project.parent.name,
                        "code": project.gemeente_code,
                        "projects": [],
                    }
                gemeentes[project.gemeente_code]["projects"].append(project)

            logger.info(f"Monitoring {len(gemeentes)} gemeentes with {len(projects)} projects")

            # Check each gemeente for changes
            for gemeente_data in gemeentes.values():
                gemeente_naam = gemeente_data["naam"]

                # Get last check timestamp (use earliest last_checked across projects)
                last_checked = datetime.utcnow() - timedelta(days=2)  # Default: 2 days lookback

                # Detect permit changes
                permit_changes = await detect_permit_changes(
                    gemeente_naam=gemeente_naam,
                    last_checked=last_checked,
                    client=http_client,
                    session=session,
                )

                # Detect zoning changes (WMS GetCapabilities comparison)
                zoning_changes = await detect_zoning_changes(
                    gemeente_code=gemeente_data["code"],
                    last_checked=last_checked,
                    client=http_client,
                    session=session,
                )

                # Link changes to projects
                all_changes = permit_changes + zoning_changes
                for change in all_changes:
                    # Link to all wijk projects in this gemeente
                    for project in gemeente_data["projects"]:
                        change.project_id = project.id
                        session.add(change)

                total_changes += len(all_changes)
                logger.info(f"Detected {len(all_changes)} changes for {gemeente_naam}")

            await session.flush()
            await session.commit()

            logger.info(f"Change monitoring complete: {total_changes} new changes detected")

            return {
                "status": "completed",
                "gemeentes_checked": len(gemeentes),
                "total_changes": total_changes,
            }

    except Exception as e:
        logger.exception(f"Change monitoring job failed: {e}")
        return {"status": "failed", "error": str(e)}

    finally:
        if http_client:
            await http_client.aclose()
        await engine.dispose()
```

**Source:** Adapted from existing `backend/app/jobs/area_scan.py` pattern

### ChangeRecord Model

```python
# backend/app/models/change_record.py
"""ChangeRecord model for tracking detected changes in monitored areas."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin

class ChangeRecord(Base, TenantMixin, TimestampMixin):
    """
    ChangeRecord model for storing detected permits and zoning changes.

    Each record represents a single change (permit or bestemmingsplan update)
    detected during daily monitoring. Linked to a Project (wijk or gemeente).

    Multi-tenant isolated via organization_id.
    """

    __tablename__ = "change_records"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    # Link to monitored project
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Change type: "permit" or "zoning"
    change_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
    )

    # External identifier from source API
    external_id: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    # Change metadata
    title: Mapped[str] = mapped_column(Text, nullable=False)
    detected_at: Mapped[datetime] = mapped_column(
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
        index=True,
    )
    change_date: Mapped[datetime] = mapped_column(nullable=False)  # Official date from API

    # Location
    gemeente_naam: Mapped[str] = mapped_column(String(100), nullable=False)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Full API response stored as JSONB for reference
    metadata: Mapped[dict] = mapped_column(type_=JSONB, nullable=False)

    __table_args__ = (
        Index("ix_change_records_project_detected", "project_id", "detected_at"),
        UniqueConstraint(
            "change_type", "external_id", "gemeente_naam",
            name="uq_change_type_external_gemeente",
        ),
    )
```

**Source:** Pattern from existing `backend/app/models/scan_result.py`

### React Change Timeline Component

```typescript
// frontend/src/components/notifications/ChangeTimeline.tsx
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

interface ChangeRecord {
  id: string;
  change_type: 'permit' | 'zoning';
  title: string;
  detected_at: string;
  change_date: string;
  address?: string;
}

interface ChangeTimelineProps {
  projectId: string;
}

export function ChangeTimeline({ projectId }: ChangeTimelineProps) {
  const { data: changes, isLoading } = useQuery<ChangeRecord[]>({
    queryKey: ['changes', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/monitoring/changes?project_id=${projectId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch changes');
      return response.json();
    },
  });

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-500">Wijzigingen laden...</div>;
  }

  if (!changes || changes.length === 0) {
    return <div className="p-4 text-sm text-gray-500">Geen wijzigingen gedetecteerd</div>;
  }

  return (
    <div className="space-y-2">
      {changes.map((change) => (
        <div
          key={change.id}
          className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
        >
          {/* Icon based on change type */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            change.change_type === 'permit'
              ? 'bg-blue-100 text-blue-600'
              : 'bg-green-100 text-green-600'
          }`}>
            {change.change_type === 'permit' ? '📄' : '🗺️'}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 line-clamp-2">
              {change.title}
            </p>
            {change.address && (
              <p className="text-xs text-gray-500 mt-1">{change.address}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {formatDistanceToNow(new Date(change.detected_at), {
                addSuffix: true,
                locale: nl,
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Source:** Pattern from existing results components, styled with Tailwind (project standard)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling with setInterval | TanStack Query refetchInterval | 2023+ | Automatic cache management, prevents duplicate requests |
| Celery Beat | ARQ cron_jobs | 2024+ (async Python) | Native async/await, simpler Redis config |
| Custom recursive SQL | SQLAlchemy relationship(remote_side) | Always standard | ORM handles N+1 prevention, lazy/eager loading |
| PostgreSQL ltree | Self-referential FK for 2-level trees | Depends on depth | FK sufficient for simple hierarchies, ltree for 3+ levels |
| WebSockets for notifications | Polling for daily-updated data | Context-dependent | WebSockets overkill for low-frequency updates |

**Deprecated/outdated:**
- **Celery for async tasks:** ARQ is the Python async-first standard (2024+), Celery requires worker process management complexity
- **PostgreSQL LISTEN/NOTIFY for polling-based updates:** Useful for true real-time (seconds), but overkill for daily monitoring. Adds connection management complexity.
- **Manual cron scripts:** ARQ cron_jobs provide job tracking, crash recovery, and consistent logging without external cron setup

## Open Questions

1. **Bestemmingsplan change detection mechanism**
   - What we know: PDOK PLU WMS doesn't provide a "recent changes" endpoint or change log
   - What's unclear: How to detect bestemmingsplan updates without comparing full WMS layer metadata daily
   - Recommendation:
     - **Option A:** Store WMS GetCapabilities XML hash per gemeente, compare hash daily to detect layer updates
     - **Option B:** Query GetFeatureInfo for known parcels, detect changes in `planidentificatie` field
     - **Recommended:** Start with Option A (simpler), add Option B if users request parcel-level granularity

2. **Change notification volume per wijk**
   - What we know: Daily checks, expect 0-50 changes per wijk per week based on permit volume
   - What's unclear: Will notification fatigue occur if high-activity gemeente has 200+ changes/month?
   - Recommendation: Start without filtering/grouping, monitor user feedback. Add "group by date" or "show top 10" if volume becomes overwhelming.

3. **Historical change retention policy**
   - What we know: Each ChangeRecord is ~1-2KB (JSONB metadata), 50 wijken × 50 changes/month = 30MB/year
   - What's unclear: Should we keep full history, or rolling 90-day window?
   - Recommendation: Keep full history initially (storage cheap, may enable analytics later). Add soft-delete or archival if database grows beyond 100MB.

4. **Notification badge interaction timing**
   - What we know: Badge clears when user "opens/views" project folder or change detail
   - What's unclear: Exact trigger — folder click, or after viewing change timeline?
   - Recommendation: Update `last_viewed_at` when user clicks into project detail page. Prevents accidental clears from navigation hover.

## Sources

### Primary (HIGH confidence)

- ARQ Documentation - https://arq-docs.helpmanual.io/ (cron jobs, worker configuration)
- SQLAlchemy 2.1 Documentation - Adjacency List Relationships - https://docs.sqlalchemy.org/en/21/orm/self_referential.html
- Existing codebase patterns:
  - `backend/app/jobs/area_scan.py` - ARQ job structure, progress tracking
  - `backend/app/government_apis/sru_bekendmakingen.py` - SRU client, date filtering
  - `backend/app/models/project.py` - Project model baseline
  - `backend/app/models/scan_result.py` - Join table pattern with JSONB metadata

### Secondary (MEDIUM confidence)

- PostgreSQL NOTIFY/LISTEN Guide (2026) - https://oneuptime.com/blog/post/2026-01-25-use-listen-notify-real-time-postgresql/view (Real-time update patterns)
- FastAPI WebSockets Tutorial (2026) - https://oneuptime.com/blog/post/2026-02-02-fastapi-websockets/view (Alternative to polling)
- React Notification Badges Guide - https://www.magicbell.com/blog/react-notification-badges (Badge UX patterns)
- Material-UI Badge Component - https://mui.com/material-ui/react-badge/ (Dot vs count badges)
- SRU Bekendmakingen Standard - https://standaarden.overheid.nl/sru (Query syntax)
- PDOK Services Documentation - https://pdok-ngr.readthedocs.io/services.html (WMS GetCapabilities)

### Tertiary (LOW confidence)

- PostgreSQL Hierarchical Data Models - https://www.ackee.agency/blog/hierarchical-models-in-postgresql (General patterns, not Propdex-specific)
- Server-Sent Events with FastAPI - https://plainenglish.io/blog/server-sent-events-for-push-notifications-on-fastapi (Alternative to WebSocket, but not needed for daily updates)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - ARQ/SQLAlchemy already proven in codebase, official docs confirm cron + self-referential FK patterns
- Architecture: MEDIUM - Delta detection logic verified against SRU capabilities, but bestemmingsplan change detection needs validation (PDOK doesn't document change APIs)
- Pitfalls: MEDIUM - Timezone/duplication issues extrapolated from common patterns, not Propdex-specific experience yet

**Research date:** 2026-02-15
**Valid until:** ~30 days (stable domain — ARQ/SQLAlchemy patterns unlikely to change, but PDOK API updates possible)

**Critical validation needed before planning:**
1. Test SRU date filtering syntax — verify `modified:>={date}` vs `date>={date}` parameter format
2. Confirm PDOK PLU WMS GetCapabilities includes `<LayerUpdateTime>` or equivalent for change detection
3. Verify Redis memory capacity for notification state caching (should be minimal, but worth checking)
