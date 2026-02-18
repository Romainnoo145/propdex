# Project Research Summary

**Project:** Propdex v5.0 — Lead Pipeline, Scan History & Map Visualization
**Domain:** Dutch PropTech SaaS — property intelligence with acquisition pipeline
**Researched:** 2026-02-18
**Confidence:** HIGH

## Executive Summary

Propdex v5.0 adds three interconnected capabilities to a mature existing platform: a lead acquisition pipeline for tracking parcels through a Dutch deal workflow, a browsable scan history so users can return to previous scans without losing context, and map-level lead status coloring. All three features integrate cleanly with the v4.0 stack (FastAPI + SQLAlchemy 2.x + PostgreSQL/PostGIS + MapLibre GL JS + TanStack ecosystem) and require zero new backend dependencies and zero new frontend dependencies for MVP. The existing MVT tile infrastructure, TanStack Query patterns, and service layer conventions are sufficient to deliver the full milestone.

The recommended approach is model-first, API-second, frontend-last. The Lead model is the single most important new artifact — everything in the pipeline depends on it. The scan history gap is a missing `GET /api/scans` list endpoint only; the underlying `AreaScan` table already stores all needed data. Map lead-status coloring is achieved by extending the existing MVT tile query with a LEFT JOIN on the new `lead_statuses` table, not by building a separate GeoJSON endpoint. The decisive architectural choice across all three features: extend the MVT pipeline everywhere, never introduce a GeoJSON fallback for parcel geometry.

The critical risks are multi-tenant data isolation on the new `leads` table (RLS policy is not automatic — must be written explicitly per table), parcel cache lifecycle mismatch (leads must survive parcel cache eviction via `ON DELETE SET NULL` and denormalized `parcel_code`), and coordinate system errors if any GeoJSON endpoint is added without `ST_Transform(geometry, 4326)`. All three pitfalls are pre-empted by the architecture research, which documents exact prevention patterns grounded in the existing codebase.

## Key Findings

### Recommended Stack

The v4.0 stack handles everything. No new packages are required for MVP delivery. The only optional addition is `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` for kanban drag-and-drop, but research strongly recommends deferring kanban — a dropdown stage selector delivers full pipeline functionality with far less complexity, and the dnd-kit packages are stale (last published ~Feb 2024). See `STACK.md` for full version compatibility table.

**Core technologies (no changes to existing stack):**
- FastAPI + SQLAlchemy 2.x: new Lead model follows `Mapped[]` + `mapped_column()` pattern throughout
- PostgreSQL/PostGIS: Lead status as `String(30)` + `CheckConstraint` (NOT PostgreSQL native ENUM — adding new statuses to a native ENUM requires `ALTER TYPE` outside transaction, incompatible with Alembic transaction-wrapped migrations)
- MapLibre GL JS 5.x: existing `ParcelScoreLayer` extended via data-driven `['get', 'lead_status']` expressions — supported since MapLibre 2.x
- TanStack Query v5: `useQuery` with page param for scan history (NOT `useInfiniteQuery` — scan history lists are dozens of entries, not thousands)
- TanStack Router + TanStack Table: new `/leads` route via `createFileRoute`, reuse existing table patterns for scan history

**What NOT to add:**
- PostgreSQL native ENUM for lead status — migration pain when stages evolve
- Martin tile server — no multi-tenant auth, cross-org data leakage risk
- Separate GeoJSON geometry endpoint for parcel polygons — memory-intensive, no streaming, viewport-unaware
- `fastapi-pagination` PyPI package — simple limit/offset is 3 lines of SQLAlchemy
- `react-beautiful-dnd` (end-of-life) or `react-dnd` (no React 19 support)

### Expected Features

**Must have (table stakes — users expect these):**
- Scan history list + scan picker — highest-priority gap; users lose access to all previous scan results without this; data already exists, just needs `GET /api/scans` list endpoint
- Lead model with Dutch pipeline stages: Nieuw → Onderzoek → Contact → Onderhandeling → Afgewezen/Gekocht
- Lead status in results table — dropdown per row, no need to open InspectorPanel
- Lead status in InspectorPanel — full detail with notes text area
- Pipeline summary view — count-per-stage dashboard ("6 Nieuw, 3 Onderzoek, 1 Gekocht"), not kanban
- Filter results by lead status — hide Afgewezen by default; essential noise reduction in large scans
- Restore scan tile layer on map when returning from results page (already partially implemented; solidify)

**Should have (competitive differentiators):**
- Lead status visible on map — color parcels by pipeline stage, toggle vs score-coloring
- Dutch pipeline stage labels throughout — resonates with NL/BE developers vs generic English CRM
- Scan history with contextual metadata (gemeente name, wijk, date, parcel count, lead count)
- Lead notes per parcel — free-text field; no full timestamped audit log for MVP
- "Voeg toe aan pipeline" bulk action in results table and from InspectorPanel

**Defer to v5.x:**
- Lead status color layer on map — validate after leads exist in production use
- Lead notes history (timestamped log) — upgrade from single text field after validation
- Report linked to lead in InspectorPanel UI
- Lead count badge on wijk overlay

**Defer to v6+:**
- Scan comparison across time — meaningful only after 6+ months of production scan data
- Multi-user lead collaboration — WebSockets, presence, conflict resolution
- Kanban drag-and-drop — not needed at tens of leads; reconsider at hundreds
- Scheduled re-scan triggers — overlaps with existing change monitoring feature

### Architecture Approach

The v5.0 architecture is strictly additive. All new components follow established patterns (service.py → router.py → schemas.py per domain module). The Lead model is the central new entity, linking `ParcelCache` → `Project` with a pipeline stage. Scan history reuses the existing `AreaScan` table — no new storage model. The MVT tile pipeline is extended by one LEFT JOIN, not replaced. The frontend gets one new route (`/leads`), one new nav icon, and several component modifications — all following existing TanStack Query hook patterns. See `ARCHITECTURE.md` for the complete new/modified file list.

**Major components:**
1. `backend/app/models/lead.py` (NEW) — Lead model with `parcel_id`, `project_id`, `stage`, `source_scan_id`, `notes`; `ON DELETE SET NULL` for parcel cache resilience; `ON DELETE CASCADE` for project deletion; `UniqueConstraint` per org+project+parcel
2. `backend/app/leads/` module (NEW) — router + service + schemas for full Lead CRUD (6 endpoints: POST, GET list, GET single, PATCH, DELETE, POST report)
3. `GET /api/scans` list endpoint (NEW) — paginated `AreaScan` list with `results_count` + `lead_count` subqueries; existing scans router modified
4. `GET /api/projects/{id}/scans` subresource (NEW) — feeds Projecten scan history view; replaces hardcoded `DEMO_REPORTS`
5. `POST /api/reports/from-parcel` (NEW) — generates report from `ParcelCache.address`, reusing existing property aggregator pipeline without duplication
6. `tile_proxy.py` LEFT JOIN extension (MODIFIED) — adds `lead_status` property to MVT tiles via LEFT JOIN on `lead_statuses`
7. `/leads` route + `LeadKanbanBoard` (NEW) — pipeline page with stage columns, dropdown stage selectors (no drag-and-drop library)
8. `PromoteParcelModal` (NEW) — parcel → lead conversion flow, invoked from `BulkActionBar` and `InspectorPanel`
9. `ProjectList` (MODIFIED) — replace hardcoded `DEMO_REPORTS` with real `useProjectScans()` data

**Build order:** Lead model (A) → Lead API (B) → Types + Hooks (C) → Projecten scan history quick win (D) → Pipeline UI (E) → Report integration (F) → Bug fixes (G, parallel throughout).

### Critical Pitfalls

1. **Cross-tenant data leak on leads table** — `TenantMixin` provides the column but does NOT create the RLS policy. Every new table needs an explicit `ALTER TABLE leads ENABLE ROW LEVEL SECURITY; CREATE POLICY ...` in the migration. Write a multi-tenant integration test (create lead as org A, assert org B sees 0 rows) before any lead endpoint ships. Prevention: follow existing RLS pattern from `parcel_cache` migration.

2. **Parcel cache eviction silently deletes leads** — `parcel_cache` is a cache, not a stable reference table. Lead FK to `parcel_cache.id` must use `ON DELETE SET NULL`, and the lead record must denormalize `parcel_code` (kadaster ID) + `address` for identity after cache eviction. Never use `ON DELETE CASCADE` from leads to parcel cache — this would silently delete user's pipeline data on force-rescan.

3. **GeoJSON coordinate system error** — `parcel_cache.geometry` is EPSG:28992 (RD New). Any new GeoJSON endpoint that serializes geometry without `ST_Transform(geometry, 4326)` renders parcels in the North Sea with no error. Always use `ST_AsGeoJSON(ST_Transform(geometry, 4326), 6)` in SQL; never transform in Python. The existing MVT endpoint handles this correctly — the solution is to use MVT and avoid new GeoJSON geometry endpoints.

4. **PostgreSQL ENUM blocks pipeline evolution** — Lead stage must be `VARCHAR(30)` + `CheckConstraint`, not a PostgreSQL native `ENUM`. All existing Propdex models (`AreaScan.status` = `String(20)`) follow this pattern. Alembic cannot run `ALTER TYPE ... ADD VALUE` inside a transaction — the migration fails at the first stage rename or addition.

5. **MapLibre feature-state fails silently with UUID IDs** — Any new GeoJSON source without `generateId: true` or `promoteId` will silently break hover and selection highlighting. `setFeatureState()` accepts UUIDs but does nothing with them — no console error. Use `generateId: true` on any new GeoJSON source; clear stale states with `map.removeFeatureState()` before `setData()` calls. The existing MVT tile endpoint avoids this because PostGIS generates integer rowids automatically.

## Implications for Roadmap

Based on combined research, the natural phase structure follows the explicit dependency chain identified in ARCHITECTURE.md (Phases A→G). Features and pitfall mitigations cluster cleanly into 5-6 roadmap phases.

### Phase 1: Data Foundation
**Rationale:** Every frontend and API feature depends on the Lead model existing and scan history being queryable. Nothing else can be built without this layer.
**Delivers:** Lead model + Alembic migration + RLS policy; `GET /api/scans` list endpoint; `GET /api/projects/{id}/scans` subresource
**Addresses features:** Scan history (backend), Lead pipeline (backend foundation)
**Avoids pitfalls:** Cross-tenant data leak (Pitfall 1 — RLS written in this migration), Parcel cache eviction (Pitfall 6 — `ON DELETE SET NULL` + `parcel_code` denormalization), PostgreSQL ENUM (Pitfall 7 — `String(30)` + `CheckConstraint` from the start)
**Research flag:** No deeper research needed — patterns derived directly from existing codebase migrations

### Phase 2: Lead Pipeline API
**Rationale:** All 6 lead endpoints + `POST /api/reports/from-parcel` must exist before frontend hooks can be written. Backend tests can be written against these endpoints before any frontend work.
**Delivers:** `backend/app/leads/` module (router + service + schemas), `POST /api/reports/from-parcel`
**Addresses features:** Lead CRUD, pipeline stage transitions, report generation from parcel
**Uses:** SQLAlchemy 2.x `Mapped[]` pattern, `db.add()/flush()/commit()` (NOT `async with db.begin()` — causes "transaction already begun" per MEMORY.md)
**Research flag:** No deeper research needed — follows established scan/project service patterns exactly

### Phase 3: Frontend Types, Hooks & Scan History UI
**Rationale:** Components depend on typed hooks, not raw fetch calls. The scan history UI is the fastest visible deliverable (replaces hardcoded demo data with real data, zero new components).
**Delivers:** Lead TypeScript types, `useLeads` hook, `useScanHistory` / `useProjectScans` hooks; updated `ProjectList.tsx` with real scan history + "Toon kaart" navigation to `/map?scan_id=X`
**Addresses features:** Scan history list with metadata, revisit old scan on map (wires the existing map `useEffect` handler to real data)
**Uses:** TanStack Query `useQuery` with page param, existing `apiFetch()` wrapper
**Research flag:** No deeper research needed — identical pattern to existing `useScans.ts` and `useProjects.ts`

### Phase 4: Lead Pipeline UI
**Rationale:** Requires all data plumbing from Phases 1-3 verified. The Kanban board is the most visible deliverable — build it after the foundation is solid and tested.
**Delivers:** `PromoteParcelModal`, `LeadKanbanBoard`, `LeadCard` with dropdown stage selector, `LeadDetailModal`, `/leads` route, updated `BulkActionBar` and `InspectorPanel`, new `SideRailNav` icon (Briefcase or Target)
**Addresses features:** Lead status in results table, lead status in InspectorPanel, pipeline summary view, "Voeg toe aan pipeline" bulk action
**Avoids pitfalls:** No drag-and-drop library (ARCHITECTURE.md Anti-Pattern 2 — select dropdown is accessible, mobile-friendly, sufficient at current lead volume)
**Research flag:** No deeper research needed — standard TanStack Table + Modal + Query pattern

### Phase 5: Map Lead Status Integration & MVT Extension
**Rationale:** Depends on leads existing in the system (Phase 1). Extends the MVT tile query rather than building new infrastructure. The `ParcelScoreLayer` paint expression toggle is a frontend-only change once the tile includes `lead_status`.
**Delivers:** Extended `tile_proxy.py` with LEFT JOIN on `lead_statuses`; `ParcelScoreLayer` mode toggle (score | lead_status); map layer toggle "Toon leadstatus"
**Addresses features:** Lead status visible on map, score/lead-status toggle
**Avoids pitfalls:** GeoJSON coordinate system error (Pitfall 2 — MVT avoids this entirely), GeoJSON setData bottleneck at 2000 parcels (Pitfall 5 — MVT is viewport-aware), MapLibre UUID feature-state (Pitfall 3 — MVT uses PostGIS integer IDs)
**Research flag:** No deeper research needed — direct extension of existing `tile_proxy.py` with documented SQL pattern in STACK.md

### Phase 6: Bug Fixes & Hardening
**Rationale:** Independent of feature development; can run in parallel with any phase. Final hardening round before milestone close.
**Delivers:** Backend register endpoint 500 fix; ARQ idempotency (`ON CONFLICT DO NOTHING` for ScanResult re-runs on worker restart); Redis tile cache using existing ARQ Redis connection; batch flush pattern for scan jobs (Python `uuid4()` + `add_all()` every 100 rows)
**Avoids pitfalls:** ARQ re-run crashes on duplicate ScanResult (Pitfall 4), MVT tile DB overload at 5+ concurrent users (Pitfall 8), N+1 flush pattern for 2000-parcel scans (Pitfall 9)
**Research flag:** No research needed — all mitigations are code-level patterns with exact implementations in PITFALLS.md

### Phase Ordering Rationale

- Phases 1 → 2 → 3 → 4 are strictly sequential due to model → API → hooks → UI dependency chain
- Phase 5 (MVT extension) can begin after Phase 1 (Lead model exists for the LEFT JOIN), but the UI toggle requires Phase 4 complete
- Phase 6 is fully parallel — bug fixes have no dependencies and can absorb slack time between other phases
- Phase 3 delivers the first user-visible feature (scan history) before the full kanban pipeline (Phase 4) — enables early validation
- Report integration (`POST /api/reports/from-parcel`) is built in Phase 2 but wired into the UI in Phase 4 (`LeadDetailModal`) — correctly deferred until leads are usable

### Research Flags

Phases with standard patterns (no `/gsd:research-phase` needed during planning):
- **Phase 1:** TenantMixin + RLS pattern documented in existing migrations; Lead model follows existing `AreaScan` pattern exactly
- **Phase 2:** Exact replica of scan/project service structure; report-from-parcel reuses existing aggregator
- **Phase 3:** Identical to existing `useScans.ts` + `useProjects.ts` patterns
- **Phase 4:** Standard TanStack Table + Modal + Query pattern; dropdown stage selector avoids dnd-kit complexity
- **Phase 5:** Extends `tile_proxy.py` — documented in STACK.md with exact SQL including the LEFT JOIN
- **Phase 6:** All mitigations are code-level; ARQ + Redis patterns are established in existing codebase

No phases require deeper research. All patterns are grounded in direct codebase inspection (HIGH confidence) or official documentation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies for MVP confirmed. All compatibility checked against installed versions. dnd-kit defer decision backed by React 19 peer dep analysis and library staleness. |
| Features | HIGH | What exists vs. what is missing determined by direct codebase reading (no guessing). Dutch pipeline stages are standard NL real estate practice confirmed across multiple sources. Competitor analysis (Dealpath, Northspyre) is MEDIUM confidence but not decision-critical for this milestone. |
| Architecture | HIGH | All patterns derived from direct inspection of existing working code. Build order confirmed by explicit dependency graph. No external API dependencies introduced. Report-from-parcel reuses existing aggregator — verified by reading `reports/router.py`. |
| Pitfalls | HIGH | Critical pitfalls (RLS, coordinate system, parcel cache lifecycle) verified with official sources and existing codebase examples. MVT-over-GeoJSON recommendation is technically grounded in MapLibre documentation and PostGIS capabilities. |

**Overall confidence:** HIGH

### Gaps to Address

- **"Afgewezen" vs. "Verloren" stage naming inconsistency:** STACK.md uses `verloren` while FEATURES.md and ARCHITECTURE.md use `afgewezen`. Both mean "rejected/lost" in Dutch but have different connotations. This must be resolved before the Lead model migration is written — it cannot be changed without a subsequent migration. Recommend `afgewezen` (rejected — implies a decision about the property) over `verloren` (lost — implies a failure of the salesperson).

- **Report-from-parcel: synchronous vs. async:** `POST /api/reports/from-parcel` makes multiple external API calls (BAG, PDOK, DSO, RCE, SRU) that can take 10-30 seconds. The synchronous approach is acceptable for MVP, but the planning phase should flag this for measurement during Phase 2 implementation. If response times exceed 15 seconds consistently, wrap in an ARQ background job with polling — the same pattern used elsewhere.

- **Lead history table (Pitfall 12 — LOW urgency):** Omitting a `lead_history` table for stage transition timestamps is hard to retrofit. The roadmapper should make an explicit decision: include a minimal `lead_history` table in Phase 1 (adds ~30 minutes of work, prevents a painful future migration) or consciously defer with a "will not have in v5.0" note. Research recommends including it from day one.

- **`project_id` NOT NULL on leads — empty project state:** ARCHITECTURE.md establishes that `project_id` is NOT NULL (leads without a project are orphaned and unbrowsable). The UI must handle the empty-projects state gracefully when a user tries to add their first parcel to the pipeline. The `PromoteParcelModal` needs a "Create project first" path or inline project creation.

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `backend/app/models/area_scan.py` — `String(20)` status precedent, AreaScan field inventory
- `backend/app/scans/router.py` — existing scan endpoints, tile proxy pattern, organization scoping
- `backend/app/services/tile_proxy.py` — ST_AsMVT JOIN pattern, geometry handling
- `frontend/src/components/map/ParcelScoreLayer.tsx` — data-driven paint expression pattern to extend
- `frontend/src/components/layout/InspectorPanel.tsx` — parcel detail panel extend point
- `frontend/src/components/projects/ProjectList.tsx` — DEMO_REPORTS TODO identifying the gap
- `frontend/src/routes/_authenticated/map.tsx` — historical scan restoration existing `useEffect` pattern
- `frontend/src/hooks/useScans.ts` — TanStack Query pattern to replicate for leads

### Primary (HIGH confidence — official documentation)
- [MapLibre GL JS Large Data Guide](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/) — MVT over GeoJSON recommendation for large parcel datasets
- [MapLibre feature-state integer ID requirement #1043](https://github.com/maplibre/maplibre-gl-js/issues/1043) — UUID feature-state silent failure pitfall
- [PostGIS ST_AsGeoJSON](https://postgis.net/docs/ST_AsGeoJSON.html) — coordinate projection with `ST_Transform`
- [PostGIS ST_Transform](https://postgis.net/docs/ST_Transform.html) — EPSG:28992 → 4326 pattern
- [GeoAlchemy2 + Alembic](https://geoalchemy-2.readthedocs.io/en/latest/alembic.html) — GIST index autogenerate gap
- [TanStack Query v5 Paginated Queries](https://tanstack.com/query/v5/docs/react/guides/paginated-queries) — `useQuery` vs `useInfiniteQuery` decision
- [MapLibre GL JS GeoJSONSource — setData](https://maplibre.org/maplibre-gl-js/docs/API/classes/GeoJSONSource/) — performance characteristics for GeoJSON vs MVT

### Secondary (MEDIUM confidence)
- [Alembic PostgreSQL Enum complexity](https://roman.pt/posts/alembic-enums/) — confirms `VARCHAR` + `CheckConstraint` is preferable for evolving status values
- [Dealpath deal pipeline management](https://www.dealpath.com/deal-pipeline-management/) — competitor feature comparison for Dutch pipeline stage decisions
- [reSPACio real estate pipeline stages](https://respacio.com/real-estate-software/contact-management/guide-to-real-estate-pipeline-stages/) — Dutch acquisition stage reference
- [@dnd-kit/core npm](https://www.npmjs.com/package/@dnd-kit/core) — version 6.3.1, React 19 peer dep confirmation, staleness assessment
- [ARQ documentation — idempotency](https://arq-docs.helpmanual.io/) — at-least-once delivery, re-run handling
- [MapLibre GL JS Memory Leak #6154](https://github.com/maplibre/maplibre-gl-js/issues/6154) — GeoJSON source update memory behavior
- [MapLibre Expressions & Data-Driven Styling (DeepWiki)](https://deepwiki.com/maplibre/maplibre-gl-js/3.2-expressions-and-data-driven-styling) — `feature-state` vs data-driven property comparison

---
*Research completed: 2026-02-18*
*Ready for roadmap: yes*
