# Stack Research — v5.0 Lead Pipeline, Scan History & Map Visualization

**Project:** Propdex v5.0
**Domain:** Dutch property intelligence SaaS — lead pipeline, scan persistence, map visualization
**Researched:** 2026-02-18
**Confidence:** HIGH
**Focus:** Additions and changes ONLY — existing v4.0 stack is validated and unchanged.

---

## Context: What This Milestone Adds

The existing stack (React 19 + Vite 7 + MapLibre GL JS 5.x + TanStack ecosystem + FastAPI + SQLAlchemy 2.x + PostgreSQL/PostGIS + Alembic) handles everything already built. This document covers only the delta needed for three new capability areas:

1. **Lead pipeline** — status tracking per scan result parcel (new SQLAlchemy model, PATCH endpoint, frontend status badge/board)
2. **Scan history** — browsable list of past scans with persist-to-DB results (new `GET /api/scans` list endpoint, frontend history view)
3. **Map visualization of scan results** — parcel polygons colored by score/lead-status on the map (existing MVT tile infrastructure is sufficient; only new GeoJSON endpoint needed for small result sets)

---

## Backend: No New Dependencies Required

All three features can be built entirely with the existing backend stack. No new Python packages needed.

### Lead Pipeline Model — String Column over PostgreSQL Enum

**Decision:** Use `String(30)` with a Python `Literal` type for the lead status column, NOT a PostgreSQL native `ENUM` type.

**Rationale:**
- PostgreSQL `ENUM` types require `ALTER TYPE ... ADD VALUE` for new statuses, which cannot run inside a transaction (requires `autocommit_block` in Alembic). Lead stages evolve — we will add statuses.
- `String` columns validated at the Pydantic schema layer provide the same application-level integrity without migration complexity.
- The existing pattern in the codebase (`AreaScan.status` is `String(20)`, `ScanResult.flags` is `JSONB`) confirms this preference.
- SQLAlchemy 2.x `Mapped[str]` with a `String(30)` column maps cleanly; add a `__table_args__` `CheckConstraint` for DB-level enforcement without enum rigidity.

**Lead status values (initial set):**
```
nieuw | contact_opgenomen | interesse | voorstel | gewonnen | verloren | parkeren
```

**Model pattern (follows existing codebase):**
```python
from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

LEAD_STATUSES = [
    "nieuw", "contact_opgenomen", "interesse",
    "voorstel", "gewonnen", "verloren", "parkeren"
]

class LeadStatus(Base, TenantMixin, TimestampMixin):
    __tablename__ = "lead_statuses"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))
    scan_result_parcel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("parcel_cache.id", ondelete="CASCADE"))
    scan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("area_scans.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="nieuw")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    __table_args__ = (
        CheckConstraint(f"status IN {tuple(LEAD_STATUSES)}", name="ck_lead_status_values"),
        Index("ix_lead_statuses_org_scan", "organization_id", "scan_id"),
        Index("ix_lead_statuses_org_status", "organization_id", "status"),
        UniqueConstraint("organization_id", "scan_id", "scan_result_parcel_id", name="uq_lead_per_parcel_per_scan"),
    )
```

**Confidence:** HIGH — follows AreaScan.status precedent in codebase, verified migration-friendliness via web research.

---

### Scan History — New List Endpoint (No New Dependencies)

**Gap identified:** `GET /api/scans` does not exist. The router only has:
- `POST /api/scans` (trigger)
- `GET /api/scans/{scan_id}` (status poll)
- `GET /api/scans/{scan_id}/results` (parcel results)
- `GET /api/scans/{scan_id}/tiles/{z}/{x}/{y}.pbf` (MVT)
- `GET /api/scans/{scan_id}/export` (CSV/XLSX)

**Solution:** Add `GET /api/scans` returning paginated list of `AreaScan` rows, newest-first. Uses existing `service.py` pattern with `select(AreaScan).where(org filter).order_by(desc).limit/offset`. No new dependencies.

**Response shape:**
```python
class ScanListItem(BaseModel):
    scan_id: uuid.UUID
    gemeente_naam: str
    gemeente_code: str
    wijk_naam: str | None
    status: str
    parcels_total: int
    results_count: int        # derived: count of scan_results rows
    created_at: datetime
    completed_at: datetime | None
    project_id: uuid.UUID | None

class ScanListResponse(BaseModel):
    scans: list[ScanListItem]
    total: int
    offset: int
    limit: int
```

**Pagination:** offset/limit (consistent with existing `ScanResultsResponse` and `ReportListResponse` patterns). TanStack Query `useQuery` with page param — NOT `useInfiniteQuery` (scan history lists are short, no need for infinite scroll).

**Confidence:** HIGH — direct extension of existing router/service/schema pattern.

---

### Map Visualization — GeoJSON Endpoint for Lead Status Coloring

**Existing capability:** The MVT tile endpoint (`GET /api/scans/{scan_id}/tiles/{z}/{x}/{y}.pbf`) already serves parcel polygons colored by score. The `ParcelScoreLayer.tsx` already implements data-driven color interpolation.

**Gap:** Lead status is not in the tile data. MVT tiles include `score` and `score_category` from the `scan_results.flags` JSONB. Lead status lives in the new `lead_statuses` table.

**Decision: Extend MVT query to JOIN lead_statuses, NOT add a separate GeoJSON endpoint.**

**Rationale:**
- Adding a GeoJSON endpoint for all parcel geometries would require fetching potentially thousands of geometries into memory. The existing ST_AsMVT approach streams tiles on demand — far more efficient.
- `tile_proxy.py` already JOINs `parcel_cache` + `scan_results`. Extend it to LEFT JOIN `lead_statuses` and include `lead_status` as a tile property.
- MapLibre's data-driven styling can use `['get', 'lead_status']` in paint expressions, same as current `['get', 'score']`.
- `updateParcelScoreSource()` in `ParcelScoreLayer.tsx` already handles tile URL changes — lead status updates invalidate and re-fetch tiles automatically.

**Extended MVT query pattern:**
```sql
WITH bounds AS (...),
mvt_data AS (
    SELECT
        ST_AsMVTGeom(pc.geometry, bounds.geom, 4096, 256, true) AS geom,
        pc.parcel_id, pc.address, pc.area_m2, pc.has_pand,
        sr.score,
        sr.flags->>'category' AS score_category,
        ls.status AS lead_status        -- NEW: LEFT JOIN
    FROM parcel_cache pc
    JOIN scan_results sr ON sr.parcel_id = pc.id
    LEFT JOIN lead_statuses ls          -- NEW
        ON ls.scan_result_parcel_id = pc.id
        AND ls.scan_id = sr.scan_id
        AND ls.organization_id = pc.organization_id
    CROSS JOIN bounds
    WHERE pc.organization_id = :org_id
      AND sr.scan_id = :scan_id
      AND sr.organization_id = :org_id
      AND ST_Intersects(pc.geometry, bounds.geom)
)
SELECT ST_AsMVT(mvt_data, 'parcel_scores', 4096, 'geom') FROM mvt_data
```

**MapLibre paint update for lead status:**
```typescript
// Color by lead_status when status layer active
'fill-color': [
  'case',
  ['==', ['get', 'lead_status'], 'gewonnen'], '#16a34a',
  ['==', ['get', 'lead_status'], 'interesse'], '#f97316',
  ['==', ['get', 'lead_status'], 'verloren'], '#dc2626',
  ['==', ['get', 'lead_status'], 'parkeren'], '#94a3b8',
  // fallback to score-based color
  ['interpolate', ['linear'], ['get', 'score'], 0, '#dc2626', 100, '#16a34a']
]
```

**Confidence:** HIGH — extends existing, verified tile architecture.

---

## Frontend: One New Dependency (dnd-kit, Optional)

### Lead Status Board — dnd-kit for Drag-and-Drop Kanban

**Decision:** Add `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` ONLY IF a kanban drag-to-status board is in scope. If the lead pipeline uses a simple dropdown status selector (simpler approach), dnd-kit is NOT needed.

**Recommendation: Start with dropdown selector, defer kanban drag-and-drop to a later milestone.**

**Why defer kanban:**
- `@dnd-kit/core` 6.3.1 declares peer dependency `react >= 16.8.0` — it works with React 19 but the library is stale (last published ~Feb 2024). The newer `@dnd-kit/react` 0.3.0 is in early development and not production-ready.
- A dropdown PATCH to `PATCH /api/leads/{parcel_id}/status` provides full lead pipeline functionality without the kanban complexity.
- The existing `ResultsTable` (TanStack Table) already has a status column slot — adding a `<Select>` primitive is a two-line change.

**If kanban is required:**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @dnd-kit/core | 6.3.1 | Drag context, sensors (pointer/touch/keyboard) | Industry standard for React DnD, accessible, ~10KB, tree-shakeable |
| @dnd-kit/sortable | 10.0.0 | Sortable list/column primitives | Required for kanban column arrangement |
| @dnd-kit/utilities | 3.2.2 | CSS transform helpers | Used with useSortable hook |

**Installation (only if kanban is in scope):**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Confidence for dnd-kit:** MEDIUM — functional with React 19 (peer dep is `>=16.8.0`), but library maintenance is slow. No breaking issues found; just note the staleness risk.

---

### Scan History View — No New Dependencies

The scan history list uses:
- `TanStack Query useQuery` (already installed) for `GET /api/scans`
- `TanStack Router` (already installed) for `/resultaten/geschiedenis` or `/history` route
- `TanStack Table` (already installed) for the history table — same pattern as existing `ResultsTable`
- URL search params for pagination — consistent with existing `resultaten.tsx` pattern

No new packages. The `useQuery` paginated approach (not `useInfiniteQuery`) is appropriate — scan history lists are small (tens of entries per org, not thousands).

**Confidence:** HIGH — identical pattern to existing scan results and report list views.

---

### Map Layer Toggle for Lead Status Coloring — No New Dependencies

The map already has `LayerToggle.tsx` and `ParcelScoreLayer.tsx`. The lead status coloring is:
- A new paint expression option in `ParcelScoreLayer` (mode: `'score' | 'lead_status'`)
- A toggle button in the existing `LayerToggle` panel
- When a parcel's lead status changes (PATCH API), invalidate the tile cache by calling `updateParcelScoreSource()` with the same tile URL (forcing a re-fetch)

No new packages. MapLibre's `setData()` / tile cache invalidation handles the refresh.

**Confidence:** HIGH — extends existing architecture.

---

## Summary: New Dependencies Table

| Library | Version | Backend/Frontend | Required For | Confidence |
|---------|---------|-----------------|--------------|------------|
| None (backend) | — | Backend | All features | HIGH |
| @dnd-kit/core | 6.3.1 | Frontend | Kanban only (defer) | MEDIUM |
| @dnd-kit/sortable | 10.0.0 | Frontend | Kanban only (defer) | MEDIUM |
| @dnd-kit/utilities | 3.2.2 | Frontend | Kanban only (defer) | MEDIUM |

**Net result:** Zero new dependencies for MVP. Three optional dnd-kit packages only if kanban drag-drop is explicitly in scope.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| PostgreSQL native `ENUM` type for lead status | Adding new statuses requires `ALTER TYPE` outside transaction — painful Alembic migrations | `String(30)` + `CheckConstraint` + Pydantic validation |
| Martin tile server | External service with no multi-tenant auth — cross-org data leakage risk (documented in existing `tile_proxy.py` comments) | Existing FastAPI ST_AsMVT endpoint |
| Separate GeoJSON geometry endpoint for all scan parcels | Memory-intensive (thousands of geometries in JSON), slow, no streaming | Extend existing MVT tile endpoint with LEFT JOIN for lead_status |
| `fastapi-pagination` PyPI package | Adds a dependency for simple limit/offset that's 3 lines of SQLAlchemy | Direct `select(...).limit(...).offset(...)` pattern |
| `useInfiniteQuery` for scan history | Overkill — scan lists are short (dozens of entries, not thousands) | Simple `useQuery` with page param, consistent with existing patterns |
| `react-beautiful-dnd` | Unmaintained (announced end-of-life) | `@dnd-kit/core` if kanban is required |
| `react-dnd` | No React 19 support planned (open issue) | `@dnd-kit/core` if kanban is required |
| SQLModel | Adds ORM layer over SQLAlchemy that conflicts with existing `Mapped[]` pattern | Raw SQLAlchemy 2.x `mapped_column()` — already used throughout |

---

## Integration Points

### Backend: lead_statuses → tile_proxy.py → MapLibre

```
PATCH /api/leads/{lead_id}/status
  ↓ writes to lead_statuses
  ↓ frontend invalidates tile query key
  ↓ MapLibre re-fetches tiles
  ↓ tile_proxy.py LEFT JOINs lead_statuses
  ↓ lead_status property appears in MVT
  ↓ ParcelScoreLayer paint expression reads lead_status
```

### Backend: GET /api/scans → useScans hook → ScanHistoryTable

```
GET /api/scans?offset=0&limit=20&status=completed
  ↓ new ScanListResponse schema
  ↓ new fetchScanList() in api.ts
  ↓ new useScanList() hook in useScans.ts
  ↓ ScanHistoryTable component (TanStack Table)
  ↓ clicking a row navigates to /resultaten?scan_id=<id>
```

### Frontend: LeadStatus → ResultsTable column

```
ScanResultItem (existing type)
  + lead_status?: string    (new field from new endpoint)
ResultsTable
  + status column with <StatusBadge> or <Select> primitive
  + PATCH on change → invalidate scan-results + tile query keys
```

---

## Schema Migration Strategy

Two new Alembic migrations needed:

**Migration 1: lead_statuses table**
```sql
CREATE TABLE lead_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    scan_result_parcel_id UUID NOT NULL REFERENCES parcel_cache(id) ON DELETE CASCADE,
    scan_id UUID NOT NULL REFERENCES area_scans(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'nieuw',
    notes TEXT,
    contact_name VARCHAR(200),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_lead_status_values CHECK (status IN ('nieuw', 'contact_opgenomen', 'interesse', 'voorstel', 'gewonnen', 'verloren', 'parkeren')),
    CONSTRAINT uq_lead_per_parcel_per_scan UNIQUE (organization_id, scan_id, scan_result_parcel_id)
);
CREATE INDEX ix_lead_statuses_org ON lead_statuses(organization_id);
CREATE INDEX ix_lead_statuses_org_scan ON lead_statuses(organization_id, scan_id);
CREATE INDEX ix_lead_statuses_org_status ON lead_statuses(organization_id, status);
```

**Migration 2: tile_proxy.py query extension** — No migration needed; query change is code-only.

**Pattern note:** Follow existing `db.add() / db.flush() / db.commit()` pattern. NOT `async with db.begin()`.

**Confidence:** HIGH — direct application of existing migration patterns.

---

## Version Compatibility

| Package | Version In Use | Compatibility Notes |
|---------|---------------|---------------------|
| maplibre-gl | 5.18.0 (installed) | `LEFT JOIN lead_status` property in tiles: data-driven expressions `['get', 'lead_status']` — supported since MapLibre 2.x |
| @tanstack/react-query | 5.90.20 (installed) | `useQuery` for scan list — no changes needed. `refetchInterval` for polling also works for history auto-refresh |
| @tanstack/react-table | 8.21.3 (installed) | Status column with cell renderer — standard pattern |
| @tanstack/react-router | 1.158.4 (installed) | New `/resultaten/geschiedenis` or `/history` route via `createFileRoute` |
| @dnd-kit/core | 6.3.1 (not installed) | Peer dep `react >= 16.8.0` — works with React 19.2.0 |
| SQLAlchemy | 2.0.x (installed) | `Mapped[str]` + `String(30)` + `CheckConstraint` — fully supported |
| GeoAlchemy2 | 0.15.x (installed) | No changes needed for tile query extension |

---

## Sources

- [MapLibre GL JS GeoJSONSource — setData and updateData](https://maplibre.org/maplibre-gl-js/docs/API/classes/GeoJSONSource/) — performance characteristics for GeoJSON vs MVT
- [MapLibre GL JS Large Data Guide](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/) — recommendation to use MVT for large parcel datasets
- [MapLibre Expressions & Data-Driven Styling (DeepWiki)](https://deepwiki.com/maplibre/maplibre-gl-js/3.2-expressions-and-data-driven-styling) — `feature-state` vs data-driven properties comparison
- [Alembic PostgreSQL Enum Migration complexity](https://roman.pt/posts/alembic-enums/) — confirms String+CheckConstraint is preferable for evolving status values
- [@dnd-kit/core npm](https://www.npmjs.com/package/@dnd-kit/core) — version 6.3.1, peer dep `react >= 16.8.0`
- [@dnd-kit/react React 19 issue](https://github.com/clauderic/dnd-kit/issues/1654) — confirms new @dnd-kit/react still in development (0.3.0)
- [TanStack Query v5 Paginated Queries](https://tanstack.com/query/v5/docs/react/guides/paginated-queries) — useQuery preferred over useInfiniteQuery for bounded lists
- [TanStack Query v5 Infinite Queries](https://tanstack.com/query/v5/docs/react/guides/infinite-queries) — `maxPages` option; overkill for scan history
- Existing codebase: `backend/app/services/tile_proxy.py` — ST_AsMVT join pattern
- Existing codebase: `backend/app/models/area_scan.py` — String(20) status precedent
- Existing codebase: `frontend/src/components/map/ParcelScoreLayer.tsx` — data-driven paint expression pattern

---

*Stack research for: Propdex v5.0 — Lead Pipeline, Scan History, Map Visualization*
*Researched: 2026-02-18*
