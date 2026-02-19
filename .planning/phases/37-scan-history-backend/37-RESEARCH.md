# Phase 37: Scan History Backend - Research

**Researched:** 2026-02-19
**Domain:** FastAPI REST API, SQLAlchemy 2.x, PostgreSQL
**Confidence:** HIGH

## Summary

Phase 37 adds two read-only list endpoints to the existing `scans` module:
`GET /api/scans` (paginated scan history) and `GET /api/projects/{id}/scans`
(scans for a specific project). Both endpoints query the existing `area_scans`
table, which already stores `gemeente_naam`, `wijk_naam`, `created_at`, and
`project_id`. The parcel count comes from a subquery on `scan_results` — no
schema changes are needed.

The codebase has a clear, established pattern for list endpoints: service layer
function returns `(list, total)`, router constructs the response Pydantic model.
The existing `list_reports` / `GET /api/reports` endpoint in
`app/reports/router.py` + `app/reports/service.py` is the direct template to
follow. The scan-history list is simpler than `list_reports` — no JSONB search,
no soft-delete filtering.

Multi-tenant isolation is already enforced in every existing query via
`AreaScan.organization_id == organization_id`. The second endpoint
(`GET /api/projects/{id}/scans`) requires an additional project ownership check:
first verify the project belongs to the requesting org, then filter scans by
`project_id`.

**Primary recommendation:** Add `list_scans` service function + two router
endpoints to the existing `app/scans/` module. No new files or dependencies
required.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | current | Router, deps, response_model | Already in use throughout |
| SQLAlchemy 2.x | current | `select()`, `func.count()`, `Mapped[]` | Project-wide ORM standard |
| Pydantic v2 | current | Response schemas (`BaseModel`, `Field`) | Already in `app/scans/schemas.py` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| slowapi limiter | current | Rate limiting decorator | All public endpoints |
| `app.auth.dependencies` | n/a | `get_current_active_user`, `get_current_organization_id` | Every authenticated endpoint |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline count subquery | Separate COUNT query | Subquery is idiomatic (matches `list_scan_results` pattern) |
| Returning `parcels_total` from AreaScan | COUNT(scan_results) | `parcels_total` is the discovered count; COUNT gives actual result count |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure

No new files. Changes go into existing files:

```
backend/app/scans/
├── router.py      # Add two new @router.get() endpoints (before /{scan_id} dynamic routes)
├── service.py     # Add list_scans() service function
└── schemas.py     # Add ScanListItem and ScanListResponse schemas
```

The `GET /api/projects/{id}/scans` endpoint can be added to the existing
`app/projects/router.py` as a sub-resource, OR added to `app/scans/router.py`
with a path of `/api/scans?project_id=...`. The sub-resource URL is more REST-
conventional and matches the requirement spec (`GET /api/projects/{id}/scans`),
so add it to `app/projects/router.py`.

### Pattern 1: List Endpoint with Subquery Count

The established pattern from `list_scan_results` (service layer):

```python
# Source: app/scans/service.py::list_scan_results (lines 215-316)

async def list_scans(
    organization_id: uuid.UUID,
    project_id: uuid.UUID | None,
    offset: int,
    limit: int,
    session: AsyncSession,
) -> tuple[list[tuple], int]:
    """
    List AreaScans with parcel_count from scan_results.
    Returns list of (AreaScan, parcel_count) tuples and total count.
    """
    parcel_count_subq = (
        select(func.count(ScanResult.id))
        .where(ScanResult.scan_id == AreaScan.id)
        .scalar_subquery()
    )

    query = (
        select(AreaScan, parcel_count_subq.label("parcel_count"))
        .where(AreaScan.organization_id == organization_id)
    )

    if project_id is not None:
        query = query.where(AreaScan.project_id == project_id)

    count_query = select(func.count()).select_from(
        select(AreaScan).where(AreaScan.organization_id == organization_id).subquery()
    )
    count_result = await session.execute(count_query)
    total = count_result.scalar() or 0

    query = query.order_by(AreaScan.created_at.desc()).offset(offset).limit(limit)
    result = await session.execute(query)
    return list(result.all()), total
```

### Pattern 2: Router Endpoint (follows existing style)

```python
# Source: app/scans/router.py — static path before /{scan_id} dynamic routes
# CRITICAL: Must be placed BEFORE the /{scan_id} route group

@router.get("", response_model=ScanListResponse)
@limiter.limit("60/minute")
async def list_scans(
    request: Request,
    offset: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ScanListResponse:
    ...
```

### Pattern 3: Projects Sub-resource (follows projects router style)

```python
# Source: app/projects/router.py — add after existing @router.get("/{project_id}")

@router.get("/{project_id}/scans", response_model=ScanListResponse)
@limiter.limit("60/minute")
async def list_project_scans(
    request: Request,
    project_id: uuid.UUID,
    offset: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ScanListResponse:
    # 1. Verify project exists and belongs to org (404 if not found — prevents enumeration)
    project_query = select(Project).where(
        Project.id == project_id,
        Project.organization_id == organization_id,
    )
    result = await db.execute(project_query)
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    # 2. List scans filtered by project_id (already org-scoped via service)
    scans, total = await scan_service.list_scans(...)
```

### Pattern 4: Pydantic Schemas

Follow the shape of existing schemas in `app/scans/schemas.py`:

```python
# New schemas to add to app/scans/schemas.py

class ScanListItem(BaseModel):
    """Schema for a single scan in the history list."""
    scan_id: uuid.UUID
    gemeente_naam: str
    gemeente_code: str
    wijk_naam: str | None = None
    scan_date: datetime           # = AreaScan.created_at
    status: str
    parcel_count: int             # COUNT(scan_results) for this scan
    project_id: uuid.UUID | None = None


class ScanListResponse(BaseModel):
    """Schema for paginated scan history list."""
    scans: list[ScanListItem]
    total: int
    offset: int
    limit: int
```

### Anti-Patterns to Avoid

- **Dynamic route collision:** The existing router has a comment "Static path routes MUST come before /{scan_id}". `GET ""` (empty path) is fine — it won't conflict. The new `GET ""` endpoint must be placed before the existing `GET "/{scan_id}"` route.
- **Using `parcels_total` instead of COUNT:** `parcels_total` on `AreaScan` is set during the scan job to the count of discovered parcels. Use `COUNT(scan_results)` to report how many results are actually stored. This is more accurate and consistent for display.
- **Skipping project ownership check:** For `GET /api/projects/{id}/scans`, verify project belongs to the requesting org before filtering scans. Return 404 (not 403) to prevent resource enumeration — consistent with the rest of the codebase.
- **Using `async with db.begin()`:** These are read-only queries; no transaction management needed. But even if writes were needed: use `db.add()` / `db.flush()` / `db.commit()` pattern (not `async with db.begin()`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pagination | Custom offset/limit logic | SQLAlchemy `.offset().limit()` | Already used in `list_scan_results` |
| Total count | Post-fetch len() | `select(func.count()).select_from(subquery)` | Consistent with existing pattern |
| Multi-tenant filter | Manual org check | `.where(AreaScan.organization_id == organization_id)` | Single condition, already proven |
| Auth | Custom JWT decode | `Depends(get_current_active_user)` + `Depends(get_current_organization_id)` | Project standard |

**Key insight:** This phase is 90% reuse. The service layer pattern, the router
pattern, the schema pattern, the test pattern — all are established in the
existing codebase. The main creative work is choosing the right response shape
for the scan list item.

## Common Pitfalls

### Pitfall 1: Route Ordering — Static Before Dynamic
**What goes wrong:** FastAPI matches routes in registration order. If `/{scan_id}` is registered before `""`, a `GET /api/scans` request might be attempted against the `/{scan_id}` UUID parser and fail.
**Why it happens:** The existing `router.py` already has this problem with `GET /wijken` and `GET /parcels/{parcel_id}/enrich` — they have a comment "Static path routes MUST come before /{scan_id}". The new `GET ""` should go at the very top of the router.
**How to avoid:** Add `GET ""` as the first route in `router.py`. The existing comment confirms this ordering is intentional.
**Warning signs:** 422 Unprocessable Entity on `GET /api/scans` when called without scan_id.

### Pitfall 2: parcel_count vs parcels_total
**What goes wrong:** Using `AreaScan.parcels_total` reports the count of parcels *discovered* during scanning (before qualification). `COUNT(scan_results)` reports qualifying parcels that passed the scoring threshold. The success criteria say "parcel count per scan" — use `scan_results` count.
**Why it happens:** Both fields exist on `AreaScan`. `parcels_total` is always available (set during scan), while scan_results count requires a subquery.
**How to avoid:** Use the `scalar_subquery()` pattern (as shown in Pattern 1 above).

### Pitfall 3: Projects Sub-resource Imports
**What goes wrong:** `app/projects/router.py` would need to import from `app/scans/service.py`. This is fine — no circular imports (projects doesn't import scans, scans doesn't import projects).
**Why it happens:** Cross-module imports in a FastAPI app can cause circular dependency if both modules import each other.
**How to avoid:** Verify: `app/scans/service.py` does NOT import from `app/projects/`. It only imports from `app/models/`. Safe to import `scan_service` in `projects/router.py`.

### Pitfall 4: subquery count with project filter
**What goes wrong:** When filtering by `project_id`, the count query must also apply the same `project_id` filter — otherwise `total` returns the count of ALL org scans, not just project scans.
**Why it happens:** The count query is built from a separate `select()`, not derived from the main query.
**How to avoid:** Pass `project_id` to the count query as well, or derive the count subquery from the base query (as in `list_scan_results`):
```python
count_query = select(func.count()).select_from(query.subquery())
```
This automatically inherits all WHERE clauses.

## Code Examples

Verified patterns from project codebase:

### Scalar Subquery for Aggregated Count
```python
# Source: app/projects/router.py lines 111-118
report_count_subquery = (
    select(func.count(SavedReport.id))
    .where(
        SavedReport.project_id == Project.id,
        SavedReport.deleted_at.is_(None),
    )
    .scalar_subquery()
)

query = (
    select(
        Project,
        report_count_subquery.label("report_count"),
    )
    .where(Project.organization_id == organization_id)
    .order_by(Project.name)
)

result = await db.execute(query)
rows = result.all()
# rows = [(Project, report_count), ...]
```

### Count Before Pagination
```python
# Source: app/scans/service.py lines 292-295
count_query = select(func.count()).select_from(query.subquery())
count_result = await session.execute(count_query)
total = count_result.scalar() or 0
```

### List Endpoint Response Pattern
```python
# Source: app/reports/router.py lines 147-175
reports, total = await service.list_reports(
    organization_id=organization_id,
    ...
    offset=offset,
    limit=limit,
    session=db,
)
return ReportListResponse(reports=report_items, total=total)
```

### 404 for Cross-Org Access (not 403)
```python
# Source: app/projects/router.py lines 183-194
project_query = select(Project).where(
    Project.id == project_id,
    Project.organization_id == organization_id,
)
project_result = await db.execute(project_query)
project = project_result.scalar_one_or_none()

if project is None:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Project not found",
    )
```

### Test Setup Pattern (from existing integration tests)
```python
# Source: tests/integration/test_spatial_multi_tenant.py lines 109-129
scan_a = AreaScan(
    organization_id=org_a_id,
    gemeente_code="0363",
    gemeente_naam="Amsterdam",
    bbox_minx=121000.0,
    bbox_miny=487000.0,
    bbox_maxx=122000.0,
    bbox_maxy=488000.0,
    status="completed",
    progress_pct=100,
    parcels_total=10,
    parcels_processed=10,
    parcels_failed=0,
)
test_db.add(scan_a)
await test_db.commit()
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| No scan list endpoint | Phase 37 adds `GET /api/scans` | Frontend can now show scan history |
| Scans are write-only (POST + status poll) | Read endpoints added | Users can re-open past scans |

**No deprecated patterns to avoid.** This phase adds endpoints that don't yet exist.

## Open Questions

1. **Should `GET /api/scans` filter by `status`?**
   - What we know: The requirement says "list of all previous scans" — no explicit status filter
   - What's unclear: Should pending/running scans appear in history? Or only completed?
   - Recommendation: Return ALL statuses by default; optionally accept a `status` query param. This is simplest and most flexible. The frontend can filter on status if needed.

2. **What `parcel_count` means for running/pending scans?**
   - What we know: `scan_results` only gets rows as parcels complete. A running scan may have 0 scan_results.
   - What's unclear: Should in-progress scans show partial count or N/A?
   - Recommendation: Return `COUNT(scan_results)` always — it will be 0 for pending scans, partial for running, final for completed. Frontend can display it alongside status.

3. **Pagination defaults: `offset`/`limit` or `page`/`page_size`?**
   - What we know: All existing list endpoints use `offset`/`limit` (see `list_scan_results`, `list_reports`)
   - Recommendation: Use `offset`/`limit` to match existing endpoints. Default `limit=50`, max `100`.

## Sources

### Primary (HIGH confidence)
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/scans/router.py` — existing router patterns, route ordering comment, endpoint signatures
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/scans/service.py` — `list_scan_results` pattern, count-before-pagination, tuple return
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/scans/schemas.py` — existing Pydantic schemas to extend
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/models/area_scan.py` — `AreaScan` fields: `gemeente_naam`, `wijk_naam`, `project_id`, `created_at`, `status`, `parcels_total`
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/models/scan_result.py` — `scan_id` FK for COUNT subquery
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/projects/router.py` — sub-resource pattern, 404-not-403 pattern, scalar_subquery for counts
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/reports/router.py` + `service.py` — list endpoint template

### Secondary (MEDIUM confidence)
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/tests/integration/test_spatial_multi_tenant.py` — AreaScan factory pattern for tests
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/tests/conftest.py` — async_client fixture, rate limiter disable pattern
- Project MEMORY.md — confirmed transaction pattern (db.add/flush/commit), datetime.utcnow(), multi-tenant isolation rules

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, no new dependencies
- Architecture: HIGH — directly mirrors existing patterns in the same module
- Pitfalls: HIGH — route ordering pitfall explicitly documented in existing code (`# --- Static path routes MUST come before /{scan_id} ---`)

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable codebase, no fast-moving deps)
