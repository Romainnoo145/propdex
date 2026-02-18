# Architecture Patterns: v5.0 Lead Pipeline

**Domain:** PropTech — lead pipeline, scan persistence, parcel-level map visualization
**Researched:** 2026-02-18
**Confidence:** HIGH (direct codebase analysis, no external dependencies introduced)

---

## Executive Summary

The v5.0 Lead Pipeline milestone adds four capabilities on top of the existing architecture:

1. **Scan persistence** — AreaScan records already exist in the DB; the gap is a browsable index in the Projecten view so users can return to any previous scan without knowing the `scan_id`.
2. **Lead pipeline** — a new `Lead` model linking `ParcelCache` → a pipeline stage (Nieuw → Onderzoek → Contact → Onderhandeling → Afgewezen/Gekocht), attached to an owning `Project`.
3. **Map scan layers** — the MVT tile endpoint (`/api/scans/{scan_id}/tiles/{z}/{x}/{y}.pbf`) and `ParcelScoreLayer` already work for the active scan; the gap is restoring score tiles for any previously completed scan from the Projecten view.
4. **Report integration** — `SavedReport` already has `project_id`; the gap is generating a report for a lead parcel from the `ParcelCache` (not from an address search), and surfacing those reports inside the lead card.

All new features integrate with existing patterns and require no new infrastructure, no new external APIs, and no new npm packages. The build order respects model-first → API-second → frontend-last dependency ordering.

---

## Existing Architecture (What v5.0 Integrates With)

### Data Model (as shipped in v4.0)

```
Organization
  └── Project (self-referential, gemeente → wijk hierarchy)
        ├── SavedReport (project_id FK, nullable — reports can be unassigned)
        ├── AreaScan (project_id FK, nullable — auto-created wijk projects)
        └── ChangeRecord (project_id FK — permit/zoning change alerts)

AreaScan
  └── ScanResult (scan_id FK + parcel_id FK — join table)
        └── ParcelCache (geometry, score, bestemmingen, enrichment_data)
```

### Backend Request Path

```
HTTP request
  → FastAPI router (/api/scans, /api/projects, /api/reports, /api/monitoring)
  → service layer (CRUD, queries)
  → SQLAlchemy 2.x async models
  → PostgreSQL/PostGIS (EPSG:28992 geometry, JSONB fields)
```

ARQ background jobs handle the scan pipeline (BAG WFS → bestemmingen WMS → scoring → ParcelCache insert). The job writes directly to `parcel_cache` and `scan_results` tables.

### Frontend Request Path

```
TanStack Router (file-based routes under _authenticated/)
  → TanStack Query (useQuery / useMutation hooks in src/hooks/)
  → apiFetch() wrapper in src/lib/api.ts (Bearer token injection)
  → FastAPI backend
```

MapLibre GL JS lives in `MapContext` (persistent, never unmounts). Map layers are imperative functions in `src/components/map/` — they call `map.addSource()` / `map.addLayer()` directly.

### Existing Gap: Project ↔ Scan Linkage

The `AreaScan.project_id` FK exists but the `projects/router.py` does not expose an endpoint to list scans for a project. The `ProjectList` frontend component contains hardcoded `DEMO_REPORTS` and a `// TODO: fetch from useReports({ project_id }) when live` comment. The `ProjectResponse` schema does not include scan history.

---

## New Components Required

### New Backend: Lead Model

The single most important new backend model. Connects a parcel to a project with a pipeline stage.

```python
# backend/app/models/lead.py (NEW)

class Lead(Base, TenantMixin, TimestampMixin):
    """
    Lead model — a parcel tracked through the acquisition pipeline.

    Links a ParcelCache entry to a Project with a pipeline stage.
    A lead is created when a user promotes a scan result to the pipeline.

    Stage flow: nieuw → onderzoek → contact → onderhandeling → afgewezen | gekocht
    """
    __tablename__ = "leads"

    id: Mapped[uuid.UUID]

    parcel_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("parcel_cache.id", ondelete="CASCADE"),
        nullable=False,
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Pipeline stage — one of the Dutch acquisition stages
    stage: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="nieuw",
    )

    # Source scan — for traceability (which scan found this parcel)
    source_scan_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("area_scans.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Free-text notes per lead
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Link to generated report (nullable — report is optional)
    report_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("saved_reports.id", ondelete="SET NULL"),
        nullable=True,
    )

    __table_args__ = (
        # Unique: one lead per parcel per project (no duplicates)
        UniqueConstraint("organization_id", "project_id", "parcel_id",
                         name="uq_leads_org_project_parcel"),
        Index("ix_leads_org_project", "organization_id", "project_id"),
        Index("ix_leads_org_stage", "organization_id", "stage"),
    )
```

Valid stage values: `nieuw`, `onderzoek`, `contact`, `onderhandeling`, `afgewezen`, `gekocht`.

### New Backend: Leads Router

```
/api/leads
  POST   /                          # Create lead (promote parcel from scan)
  GET    /                          # List leads (filter by project_id, stage)
  GET    /{lead_id}                 # Get single lead with parcel + report data
  PATCH  /{lead_id}                 # Update stage or notes
  DELETE /{lead_id}                 # Remove from pipeline
  POST   /{lead_id}/report          # Generate report for lead parcel
```

The `POST /` body accepts `parcel_id`, `project_id`, `source_scan_id`, and optional `stage` (defaults to `nieuw`). The stage progression is unconstrained on the backend — any stage can transition to any other stage (frontend enforces the visual Kanban flow).

### New Backend: Scans History Endpoint

```
/api/scans
  GET /                             # NEW: List completed scans for org
  GET /{scan_id}                    # EXISTING: Status poll
  ...
```

The `GET /api/scans` endpoint returns completed scans for the authenticated organization, ordered by `created_at` DESC. This feeds the Projecten scan history view.

Response shape:
```python
class ScanListResponse(BaseModel):
    scans: list[ScanListItem]
    total: int

class ScanListItem(BaseModel):
    scan_id: uuid.UUID
    gemeente_naam: str
    gemeente_code: str
    wijk_naam: str | None
    status: str
    parcels_total: int
    results_count: int
    scan_date: datetime
    project_id: uuid.UUID | None
    lead_count: int   # JOIN COUNT on leads table
```

### Project Router: Add Scans Subresource

Add `GET /api/projects/{project_id}/scans` to the existing projects router. Returns the scan history for a specific project (where `area_scans.project_id = :project_id`). This is the entry point for the "Toon kaart" button in the Projecten view.

### Modified Backend: Reports Router

The existing `/api/reports` accepts a postcode + huisnummer address. To generate a report for a lead parcel, add a new endpoint that derives the address from the `ParcelCache.address` field and dispatches the same aggregator pipeline:

```
POST /api/reports/from-parcel
  Body: { parcel_id: uuid, project_id: uuid | null, report_name: str | null }
```

This endpoint:
1. Looks up `ParcelCache` by `parcel_id` (tenant-scoped)
2. Extracts postcode + huisnummer from `ParcelCache.address` (existing regex in enrich endpoint)
3. Calls the same `property_aggregator` service as the address-based flow
4. Saves as `SavedReport` with `project_id` set

This avoids duplicating the aggregator — it reuses the entire existing report generation stack.

---

## New Frontend Components

### New Route: `/leads` (or Kanban inside Projecten)

Decision: embed the lead pipeline as a sub-view within `/projecten` (not a new top-level route) to avoid adding a fourth icon to `SideRailNav`. The Projecten view becomes a tabbed view: "Scans" (existing project list) | "Leads" (Kanban board).

Alternative (simpler): A dedicated `/leads` route with its own nav icon. Given the Kanban board is the primary delivery artifact of v5.0, a dedicated route is more discoverable. Add a `Briefcase` icon to `SideRailNav`.

**Recommended: Add `/leads` as a new route with its own SideRailNav icon.** The `projecten` route stays focused on project/scan organization. This keeps each view single-purpose.

```
routes/_authenticated/
  leads.tsx      # NEW: Kanban board — list leads, drag or click to change stage
  resultaten.tsx # EXISTING: scan result table
  map.tsx        # EXISTING: map
  projecten.tsx  # EXISTING: project + scan history
```

### New Frontend Hook: `useLeads`

```typescript
// src/hooks/useLeads.ts (NEW)
export function useLeads(projectId?: string, stage?: string)
export function useCreateLead()
export function useUpdateLead()
export function useDeleteLead()
export function useGenerateLeadReport()
```

Pattern follows existing `useScans.ts` and `useProjects.ts`: TanStack Query wrapping `apiFetch()`, query key includes filters for correct cache scoping.

### New Frontend Hook: `useScansHistory`

```typescript
// src/hooks/useScans.ts (EXTEND EXISTING)
export function useScanHistory()   // GET /api/scans (list of completed scans)
export function useProjectScans(projectId: string)  // GET /api/projects/{id}/scans
```

### Modified Component: `ProjectList`

Remove the `DEMO_REPORTS` hardcoded data. Replace with `useProjectScans(project.id)` for real scan history. Show each scan as a clickable row that navigates to `/map?scan_id=X` (restores the score layer for that scan).

### New Component: `LeadKanbanBoard`

```
src/components/leads/
  LeadKanbanBoard.tsx   # Stage columns: Nieuw | Onderzoek | Contact | Onderhandeling | Afgewezen | Gekocht
  LeadCard.tsx          # Single lead card: parcel address, score badge, notes
  LeadDetailModal.tsx   # Expanded lead view: parcel data, notes editor, report CTA, stage selector
  LeadStageSelector.tsx # Dropdown for stage change
  PromoteParcelModal.tsx  # Appears in scan results — "Add to Pipeline" flow
```

The Kanban board does not require a drag-and-drop library. Stage changes happen via a dropdown in `LeadCard` — simpler, mobile-friendly, avoids the complexity and accessibility issues of drag-and-drop.

### Modified Component: `ResultsTable` / `BulkActionBar`

Add "Voeg toe aan pipeline" as a bulk action alongside the existing Excel export. The `BulkActionBar` gets a new button that opens a project selector modal, then creates Lead records for all selected parcels.

### Modified Component: `InspectorPanel`

Add a "Voeg toe aan pipeline" button at the bottom of the inspector. Opens an inline project selector (using existing `useProjects()` hook). On confirm: `POST /api/leads` with `parcel_id` from the current inspector parcel.

### Modified: Map Score Layer for Historical Scans

The `ParcelScoreLayer` and tile endpoint already work. The gap is wiring up the "Toon kaart" button from the Projecten scan history to navigate to `/map?scan_id=X`. The map page already handles `urlScanId` in its `useEffect` and calls `addParcelScoreLayer(tileUrl, 'parcel_scores')`.

No new map layer code is needed. The existing `addParcelScoreLayer` function is reused.

---

## Data Flow Changes

### New: Parcel → Lead Promotion Flow

```
User selects parcel in scan results table
  → Clicks "Voeg toe aan pipeline" (BulkActionBar or InspectorPanel)
  → PromoteParcelModal: choose project, optionally set stage
  → POST /api/leads { parcel_id, project_id, source_scan_id, stage }
  → Lead record created in DB (organization-scoped)
  → TanStack Query invalidates ['leads'] cache
  → LeadKanbanBoard re-renders with new lead card
```

### New: Lead Report Generation Flow

```
User opens lead card → clicks "Genereer rapport"
  → POST /api/reports/from-parcel { parcel_id, project_id }
  → Backend: reads ParcelCache.address → extracts postcode/huisnummer
  → Dispatches property_aggregator (same as address search path)
  → SavedReport created, Lead.report_id updated
  → useQuery invalidates ['lead', lead_id] and ['reports']
  → Lead card shows "Rapport bekijken" link
```

### Modified: Projecten → Previous Scan Flow

```
User opens Projecten view
  → ProjectList renders project rows with scan history (useProjectScans)
  → User clicks a completed scan row
  → navigate({ to: '/map', search: { scan_id } })
  → map.tsx useEffect detects urlScanId → sets activeScanId
  → Existing addParcelScoreLayer() renders score tiles
  → Existing "Toon Lijst" button links to /resultaten?scan_id=X
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `leads/` router (NEW) | Lead CRUD, stage transitions, report linking | `parcel_cache`, `projects`, `saved_reports`, `area_scans` |
| `scans/` router (MODIFIED) | Add `GET /api/scans` list endpoint | `area_scans`, `scan_results`, `leads` (for lead_count) |
| `projects/` router (MODIFIED) | Add `GET /api/projects/{id}/scans` subresource | `area_scans` |
| `reports/` router (MODIFIED) | Add `POST /api/reports/from-parcel` | `parcel_cache`, `property_aggregator`, `saved_reports` |
| `LeadKanbanBoard` (NEW) | Kanban UI for pipeline stages | `useLeads`, `LeadCard`, `LeadDetailModal` |
| `LeadCard` (NEW) | Single lead display, stage change | `useUpdateLead`, parcel data from lead response |
| `PromoteParcelModal` (NEW) | Parcel → Lead conversion flow | `useLeads`, `useProjects`, scan context |
| `BulkActionBar` (MODIFIED) | Add "Voeg toe aan pipeline" bulk action | `PromoteParcelModal`, `useLeads` |
| `InspectorPanel` (MODIFIED) | Add "Voeg toe aan pipeline" button | `PromoteParcelModal`, `useLeads` |
| `ProjectList` (MODIFIED) | Replace demo data with real scan history | `useProjectScans`, `useProjects` |
| `/leads` route (NEW) | Lead pipeline page | `LeadKanbanBoard`, TanStack Router |

---

## Patterns to Follow

### Pattern 1: Lead API Follows Scan Service Pattern

The leads service follows the same structure as `app/scans/service.py`:
- Separate `service.py` with CRUD functions
- Router imports service functions (not SQLAlchemy directly)
- All queries filter by `organization_id` first

```python
# backend/app/leads/service.py (NEW)
async def list_leads(
    organization_id: uuid.UUID,
    project_id: uuid.UUID | None,
    stage: str | None,
    session: AsyncSession,
) -> list[tuple[Lead, ParcelCache]]:
    """JOIN leads with parcel_cache for display data."""
    query = (
        select(Lead, ParcelCache)
        .join(ParcelCache, Lead.parcel_id == ParcelCache.id)
        .where(Lead.organization_id == organization_id)
    )
    if project_id:
        query = query.where(Lead.project_id == project_id)
    if stage:
        query = query.where(Lead.stage == stage)
    ...
```

The response schema embeds the parcel data inline (denormalized) — the client does not need to make separate parcel requests to render the Kanban board.

### Pattern 2: DB Transaction Pattern

Follow the established pattern from `MEMORY.md`:

```python
# CORRECT (existing pattern)
lead = Lead(organization_id=organization_id, parcel_id=..., ...)
db.add(lead)
await db.flush()
await db.commit()

# WRONG — causes "transaction already begun"
async with db.begin():
    ...
```

### Pattern 3: Scan History Uses Existing `area_scans` Table

Do not create a new scan history table. The `area_scans` table already contains all needed fields: `gemeente_naam`, `gemeente_code`, `wijk_naam`, `status`, `parcels_total`, `created_at`, `project_id`. Add `results_count` via a `COUNT` subquery on `scan_results`.

```python
# backend/app/scans/service.py (NEW function)
async def list_completed_scans(
    organization_id: uuid.UUID,
    session: AsyncSession,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict], int]:
    results_count_sq = (
        select(func.count(ScanResult.id))
        .where(ScanResult.scan_id == AreaScan.id)
        .scalar_subquery()
    )
    lead_count_sq = (
        select(func.count(Lead.id))
        .where(Lead.source_scan_id == AreaScan.id)
        .scalar_subquery()
    )
    query = (
        select(AreaScan, results_count_sq.label("results_count"), lead_count_sq.label("lead_count"))
        .where(
            AreaScan.organization_id == organization_id,
            AreaScan.status == "completed",
        )
        .order_by(AreaScan.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    ...
```

### Pattern 4: Report from Parcel Reuses Aggregator

The `POST /api/reports/from-parcel` endpoint does not duplicate logic. It extracts postcode/huisnummer from `ParcelCache.address` (reusing the existing regex already in `scans/router.py:enrich_parcel`) and calls the same `property_aggregator` service used by the existing address-based report flow.

```python
# backend/app/reports/router.py (NEW endpoint in existing file)
@router.post("/from-parcel", response_model=SaveReportResponse)
async def create_report_from_parcel(
    request: Request,
    body: ReportFromParcelRequest,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    # 1. Fetch ParcelCache
    parcel = await db.execute(select(ParcelCache).where(
        ParcelCache.id == body.parcel_id,
        ParcelCache.organization_id == organization_id,
    ))
    # 2. Extract postcode/huisnummer from address
    # 3. Call property_aggregator (same as /api/properties/{postcode}/{huisnummer})
    # 4. Save as SavedReport (same as POST /api/reports)
    # 5. Optionally link to Lead via PATCH /api/leads/{lead_id}
```

### Pattern 5: Kanban Without Drag-and-Drop

The Kanban board renders stage columns as flex containers. Stage transitions happen via a `<select>` dropdown in the `LeadCard` header — no drag-and-drop library required.

```tsx
// src/components/leads/LeadCard.tsx (NEW)
function StageSelector({ lead, onStageChange }: ...) {
  return (
    <select
      value={lead.stage}
      onChange={(e) => onStageChange(lead.id, e.target.value)}
      className="text-xs ..."
    >
      {STAGES.map(stage => (
        <option key={stage.value} value={stage.value}>{stage.label}</option>
      ))}
    </select>
  )
}

const STAGES = [
  { value: 'nieuw',        label: 'Nieuw' },
  { value: 'onderzoek',    label: 'Onderzoek' },
  { value: 'contact',      label: 'Contact' },
  { value: 'onderhandeling', label: 'Onderhandeling' },
  { value: 'afgewezen',    label: 'Afgewezen' },
  { value: 'gekocht',      label: 'Gekocht' },
]
```

### Pattern 6: Map Score Layer Reuse for Historical Scans

No new map layer code is needed. The flow is:

```tsx
// In ProjectList, scan row click handler:
const handleScanClick = (scan: ScanListItem) => {
  navigate({ to: '/map', search: { scan_id: scan.scan_id } })
}

// In map.tsx, existing useEffect handles it:
useEffect(() => {
  if (!urlScanId || activeScanId) return
  setActiveScanId(urlScanId)
  navigate({ to: '/map', search: {}, replace: true })
}, [urlScanId, activeScanId, navigate])

// Existing useEffect renders score tiles when activeScanId is set + scan status is completed:
useEffect(() => {
  if (!mapReady || !mapRef.current || !scanStatus.data) return
  if (scanStatus.data.status === 'completed' && activeScanId) {
    const tileUrl = getScanTileUrl(activeScanId)
    addParcelScoreLayer(mapRef.current, tileUrl, 'parcel_scores')
  }
}, [scanStatus.data, activeScanId, mapReady])
```

The only issue: for historical scans, `useScanPolling` polls status but immediately gets `completed` — triggering the score layer on first poll. This already works correctly. No changes needed to `map.tsx` for historical scan display.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: New Lead-Specific Map Layer

Do not create a `LeadMapLayer` that shows lead status on the map using pins. This is listed as a Future requirement, not v5.0. Adding it now would require new PostGIS queries, new MVT tile endpoints, and complex map state management for lead status colors. The existing score overlay is sufficient for v5.0.

### Anti-Pattern 2: Drag-and-Drop Kanban Library

Do not add `react-dnd`, `@dnd-kit/core`, or similar libraries. They add bundle weight (~30-60KB), complex accessibility handling, and drag-and-drop is not natural on mobile (where the project must work). A select dropdown for stage changes is simpler, accessible, and consistent with the existing mobile-first approach.

### Anti-Pattern 3: Separate Lead History Table

Do not create a `lead_history` audit table for tracking stage transitions. This is a future feature (audit trail). For v5.0, the `updated_at` timestamp on the Lead model is sufficient. The TimestampMixin provides this automatically.

### Anti-Pattern 4: Blocking Report Generation

Do not make `POST /api/reports/from-parcel` synchronous-blocking. The existing property aggregator makes multiple external API calls (BAG, PDOK, DSO, RCE, SRU) that can take 10-30 seconds. Follow the existing pattern: trigger the report generation in the request, return immediately with the `report_id`, and let the frontend poll for the report to finish loading (or use the ARQ background job pattern if needed).

For simplicity in v5.0, the synchronous approach is acceptable (the endpoint already uses `httpx.AsyncClient` with `await`). If performance is a concern, wrap in ARQ later.

### Anti-Pattern 5: `project_id` on Lead as Optional

The `project_id` FK on `Lead` should be `NOT NULL`. Leads without a project are orphaned and unbrowsable — there is no UI flow that creates a lead outside of a project context. If the project is deleted, `ondelete="CASCADE"` cleans up the leads.

### Anti-Pattern 6: Separate Scan History API

Do not create a new `/api/scan-history` endpoint. Use the existing `/api/scans` path with a `GET /` list action — follows REST convention where `GET /api/scans` returns the collection. The frontend already imports from `SCANS_BASE = '/api/scans'`.

---

## New vs Modified Explicit List

### New Backend Files

| File | Purpose |
|------|---------|
| `backend/app/models/lead.py` | Lead model (parcel → project + stage) |
| `backend/app/leads/__init__.py` | Package init |
| `backend/app/leads/router.py` | Lead CRUD endpoints |
| `backend/app/leads/service.py` | Lead CRUD service layer |
| `backend/app/leads/schemas.py` | Lead Pydantic schemas |
| `backend/alembic/versions/{hash}_add_leads_table.py` | DB migration |

### Modified Backend Files

| File | Change |
|------|--------|
| `backend/app/scans/router.py` | Add `GET /` list endpoint for completed scans |
| `backend/app/scans/service.py` | Add `list_completed_scans()` function |
| `backend/app/scans/schemas.py` | Add `ScanListItem`, `ScanListResponse` schemas |
| `backend/app/projects/router.py` | Add `GET /{project_id}/scans` subresource |
| `backend/app/schemas/project.py` | Add `scan_count` to `ProjectResponse` |
| `backend/app/reports/router.py` | Add `POST /from-parcel` endpoint |
| `backend/app/reports/schemas.py` (or `backend/app/schemas/report.py`) | Add `ReportFromParcelRequest` |
| `backend/app/core/main.py` (or `app.py`) | Include leads router |
| `backend/app/models/__init__.py` | Import Lead model for Alembic discovery |

### New Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/routes/_authenticated/leads.tsx` | Leads pipeline route |
| `frontend/src/components/leads/LeadKanbanBoard.tsx` | Kanban board layout |
| `frontend/src/components/leads/LeadCard.tsx` | Single lead card with stage selector |
| `frontend/src/components/leads/LeadDetailModal.tsx` | Lead expanded view + report CTA |
| `frontend/src/components/leads/PromoteParcelModal.tsx` | Add parcel to pipeline flow |
| `frontend/src/hooks/useLeads.ts` | TanStack Query hooks for leads |
| `frontend/src/lib/types/lead.ts` | Lead TypeScript types |

### Modified Frontend Files

| File | Change |
|------|--------|
| `frontend/src/components/layout/SideRailNav.tsx` | Add Leads nav icon (Briefcase or Target) |
| `frontend/src/components/projects/ProjectList.tsx` | Replace demo data with `useProjectScans()` |
| `frontend/src/components/results/BulkActionBar.tsx` | Add "Voeg toe aan pipeline" action |
| `frontend/src/components/layout/InspectorPanel.tsx` | Add "Voeg toe aan pipeline" button |
| `frontend/src/hooks/useScans.ts` | Add `useScanHistory()`, `useProjectScans()` |
| `frontend/src/lib/api.ts` | Add `fetchScanHistory()`, `fetchProjectScans()`, lead API calls |
| `frontend/src/lib/types/scan.ts` | Add `ScanListItem`, `ScanListResponse` types |
| `frontend/src/routeTree.gen.ts` | Auto-regenerated when leads.tsx is added |

---

## Suggested Build Order

The ordering below respects data dependencies (model before API before UI) and ensures each phase is independently testable.

### Phase A: Data Layer (Build First — Everything Else Depends On It)

1. Create `backend/app/models/lead.py` — Lead model with all fields
2. Update `backend/app/models/__init__.py` — import Lead for Alembic
3. Generate Alembic migration (`alembic revision --autogenerate -m "add_leads_table"`)
4. Run migration against dev DB
5. Add `GET /api/scans` list endpoint to `scans/router.py` + service function
6. Add `GET /api/projects/{project_id}/scans` to `projects/router.py`

**Why first:** All frontend and subsequent API work depends on the Lead table existing and scan history being queryable. Backend tests can be written against these endpoints before any frontend work.

### Phase B: Lead Pipeline API (Builds on Phase A)

7. Create `backend/app/leads/schemas.py` — Pydantic schemas
8. Create `backend/app/leads/service.py` — CRUD functions (list, create, update, delete)
9. Create `backend/app/leads/router.py` — all 6 endpoints
10. Register leads router in `main.py`
11. Add `POST /api/reports/from-parcel` to `reports/router.py`

**Why second:** API endpoints must exist before frontend hooks can be written against them.

### Phase C: Frontend Types and Hooks (Builds on Phase B)

12. Create `frontend/src/lib/types/lead.ts` — Lead TypeScript types
13. Update `frontend/src/lib/types/scan.ts` — add `ScanListItem`, `ScanListResponse`
14. Update `frontend/src/lib/api.ts` — add lead API calls and scan history calls
15. Create `frontend/src/hooks/useLeads.ts` — TanStack Query hooks
16. Update `frontend/src/hooks/useScans.ts` — add `useScanHistory()`, `useProjectScans()`

**Why third:** Components depend on typed hooks, not raw fetch calls.

### Phase D: Projecten Scan History (Quick Win — Unblocks Map Reuse)

17. Update `ProjectList.tsx` — replace demo data with `useProjectScans()`, add scan history rows with "Toon kaart" button
18. Verify map reuse: "Toon kaart" → `/map?scan_id=X` → score tiles appear (existing code handles this)

**Why fourth:** This is the smallest deliverable — replaces demo data with real data, unblocks validation of the scan history flow. No new components needed.

### Phase E: Lead Pipeline UI (Builds on Phase C)

19. Create `PromoteParcelModal.tsx` — project selector + stage picker
20. Modify `BulkActionBar.tsx` — add "Voeg toe aan pipeline" action
21. Modify `InspectorPanel.tsx` — add promote button
22. Create `LeadCard.tsx` — card with stage selector dropdown
23. Create `LeadDetailModal.tsx` — expanded lead view + report generation CTA
24. Create `LeadKanbanBoard.tsx` — stage column layout + `useLeads()` data
25. Create `leads.tsx` route — Kanban board page
26. Update `SideRailNav.tsx` — add Leads icon

**Why fifth:** Pipeline UI requires all the preceding pieces. The Kanban board is the most visible deliverable and should be built after the data plumbing is verified.

### Phase F: Report Integration for Leads (Builds on Phase E)

27. Wire "Genereer rapport" button in `LeadDetailModal` to `POST /api/reports/from-parcel`
28. After report generation, show "Rapport bekijken" link → `/rapport/{id}`
29. Verify the from-parcel report flow end-to-end

**Why sixth:** Report generation is valuable but not blocking for pipeline usability. The lead card shows parcel data (address, score, bestemmingen) even without a report.

### Phase G: Bug Fixes (Can Run in Parallel with Any Phase)

- Backend register endpoint 500 error (investigate and fix independently)
- Known issues cleanup (PLU WMS validation, parcel count pre-check)

**Why parallel:** Bug fixes are independent of feature development. Can be done between phases or at the end.

---

## Dependency Graph

```
Lead model (A)
  ↓
Lead API (B)
  ↓
Lead types + hooks (C)
  ↓
Projecten scan history (D) ← can start in parallel with E after C
  ↓
Pipeline UI: PromoteParcelModal → BulkActionBar + InspectorPanel (E)
  ↓
LeadCard → LeadKanbanBoard → /leads route (E continued)
  ↓
Report integration for leads (F)
```

Bug fixes (G) have no dependency and can run at any point.

---

## Scalability Considerations

| Concern | At Current Scale | At Scale (10k leads/org) |
|---------|-----------------|--------------------------|
| Lead list query | Simple index scan on `(organization_id, project_id)` | Add cursor pagination (currently offset-based is fine) |
| Kanban board render | All leads per project in one request | Add per-stage lazy loading if >100 leads per stage |
| Score tile generation | PostGIS ST_AsMVT per request | Add tile caching (Redis or HTTP cache headers) |
| Scan history list | `ORDER BY created_at DESC LIMIT 50` | Existing index `ix_area_scans_org_status` covers this |
| Report from parcel | Synchronous aggregator (10-30s) | Move to ARQ background job, poll for completion |

---

## Sources

All findings are based on direct codebase inspection (HIGH confidence). No external sources required for architecture decisions — patterns are derived from existing working code.

- `backend/app/models/parcel_cache.py` — Three-tier data model
- `backend/app/models/area_scan.py` — Scan status flow
- `backend/app/models/scan_result.py` — Scan↔Parcel join table
- `backend/app/models/project.py` — Self-referential hierarchy
- `backend/app/models/report.py` — SavedReport + project_id FK
- `backend/app/scans/router.py` — All existing scan endpoints + tile proxy
- `backend/app/scans/service.py` — Service layer patterns
- `backend/app/services/tile_proxy.py` — PostGIS MVT generation
- `frontend/src/components/map/ParcelScoreLayer.tsx` — Score overlay implementation
- `frontend/src/components/layout/InspectorPanel.tsx` — Parcel detail panel
- `frontend/src/components/projects/ProjectList.tsx` — TODO comments identifying gaps
- `frontend/src/routes/_authenticated/map.tsx` — Historical scan restoration pattern
- `frontend/src/hooks/useScans.ts` — TanStack Query patterns
- `.planning/PROJECT.md` — v5.0 requirements
