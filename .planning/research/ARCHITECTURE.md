# Architecture Research

**Domain:** Propdex v17.0 — Projecten Portfolio + Pipeline
**Researched:** 2026-03-15
**Confidence:** HIGH (full codebase analysis — models, routers, hooks, components all inspected)

---

## Current State Assessment

The existing codebase provides the following relevant infrastructure:

**Backend models (live):**
- `Project` — self-referential hierarchy with `parent_id`, `gemeente_code`, `wijk_naam`, `is_monitored`. Currently used as "report folder" only. No pipeline state, no parcel association.
- `ParcelDocument` — per-parcel document storage keyed by `parcel_id` (Kadaster string) + `document_type`. 20 valid types. LargeBinary in PostgreSQL.
- `ScanResult` — one row per parcel per organization, linked to `parcel_cache.id` (UUID) via FK. Has `score` + `flags` JSONB. UNIQUE on `(organization_id, parcel_id)`.
- `ParcelCache` — geometry + BAG data. `parcel_id` is Kadaster string (e.g., "HTT02-A-1234"). `id` is UUID.
- `AreaScan` — scan job with `gemeente_code`, `wijk_naam`, `project_id` FK to Project.

**Frontend (live):**
- `/projecten` route → `ProjectList.tsx` (1867 lines) — the existing geographic drill-down: provincie → gemeente → wijk.
- Gemeente favorites are **localStorage only** (`propdex:favorite-gemeenten` key, array of gemeente codes). Single-user, not synced, lost on new browser.
- `GemeenteCard`, `WijkCard`, `GemeenteDetailView`, `WijkDetailView` exist. No parcel-level cards in Projecten.
- `ParcelDetailPanel` is the map-side panel. It has Potentie / Risico / Dossiers tabs. No favorite/pipeline controls exist.
- `useDocuments` hook exists for `ParcelDocument` CRUD.

**Key gaps for v17.0:**
1. No parcel favorites model (only gemeente-level localStorage)
2. No pipeline stage tracking (on Project or elsewhere)
3. No outreach template storage
4. No multi-parcel "deal" grouping
5. `ParcelDocument` has no FK to `ScanResult` or `ParcelCache` UUID — it uses the raw Kadaster parcel_id string, which is fine as a natural key but limits JOIN capabilities

---

## Recommended Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Frontend: /projecten                           │
├──────────────────────────────────────────────────────────────────────┤
│  ProvinceCards → GemeenteCards → WijkCards → FavoritedParcelCards    │
│                                                 ↓                    │
│                                    ParcelWorkspaceDrawer             │
│                                 (pipeline + dossier + templates)     │
├──────────────────────────────────────────────────────────────────────┤
│                        Frontend: /map                                 │
│  ParcelDetailPanel → HeartButton (favorite toggle)                   │
│                    → Pipeline badge (shows current stage)            │
└──────────────────────────────────────────────────────────────────────┘
                         ↕ API calls
┌──────────────────────────────────────────────────────────────────────┐
│                        FastAPI Backend                                │
├────────────────┬───────────────────┬─────────────────────────────────┤
│  /api/parcels/ │ /api/documents/   │  /api/projects/                 │
│  favorites     │ (existing CRUD)   │  (existing CRUD)                │
│  {parcel_id}/  │                   │                                 │
│  pipeline      │                   │                                 │
└────────────────┴───────────────────┴─────────────────────────────────┘
                         ↕ SQLAlchemy async
┌──────────────────────────────────────────────────────────────────────┐
│                     PostgreSQL / PostGIS                              │
├──────────────┬───────────────────────┬──────────────────────────────┤
│ parcel_       │  parcel_pipeline_     │  outreach_templates          │
│ favorites     │  stages (new)         │  (new)                       │
├──────────────┴───────────────────────┴──────────────────────────────┤
│  scan_results    parcel_cache    area_scans    projects    parcel_    │
│  (existing)      (existing)      (existing)    (existing)  documents  │
│                                                             (existing) │
└──────────────────────────────────────────────────────────────────────┘
```

### Decision: Extend Project model OR create new models?

**Create new models. Do not extend Project.**

Rationale:
- The `Project` model is a "report folder" concept tied to `AreaScan` via `project_id` FK. Repurposing it to track parcel pipeline stages would violate single responsibility and break the existing scan → project linkage.
- Parcel favorites are orthogonal to scan folders. A user wants to favorite a parcel discovered via any scan, not just parcels in a specific project folder.
- Pipeline stages are per-parcel, not per-scan or per-folder. They track the user's deal-making progress, which can span multiple scans.
- The existing `Project` model already fulfills its intended purpose (grouping reports / scans by geography). Adding pipeline state to it would make it two different things at once.

**New models required:**
1. `ParcelFavorite` — server-backed parcel bookmarks with geographic denormalization
2. `ParcelPipelineStage` — deal pipeline state per favorited parcel
3. `OutreachTemplate` — org-level reusable outreach text templates

---

## New Data Models

### Model 1: `ParcelFavorite`

```python
class ParcelFavorite(Base, TenantMixin, TimestampMixin):
    """
    Server-backed parcel favorite (bookmark).

    Replaces localStorage gemeente favorites at the parcel level.
    Links ParcelCache geometry to the user's portfolio view.

    parcel_id is the Kadaster string identifier (matches ParcelDocument.parcel_id).
    parcel_cache_id is the UUID FK for JOIN efficiency with scan_results.
    Both are stored to avoid requiring a lookup when creating a favorite.
    """
    __tablename__ = "parcel_favorites"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))

    # Natural key (Kadaster string, e.g., "HTT02-A-1234") — matches ParcelDocument
    parcel_id: Mapped[str] = mapped_column(String(50), nullable=False)

    # FK to parcel_cache for geometry JOINs — nullable for parcels not yet in cache
    parcel_cache_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("parcel_cache.id", ondelete="SET NULL"), nullable=True
    )

    # Denormalized geographic context for portfolio drill-down display
    # (avoids JOIN to parcel_cache for list queries)
    gemeente_code: Mapped[str | None] = mapped_column(String(10), nullable=True, index=True)
    gemeente_naam: Mapped[str | None] = mapped_column(String(100), nullable=True)
    wijk_naam: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # User-provided label for this parcel in their portfolio
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Denormalized score at time of favoriting (for display without scan JOIN)
    score_at_favorite: Mapped[float | None] = mapped_column(nullable=True)

    # Optional: group adjacent parcels into one deal
    deal_group_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)

    __table_args__ = (
        UniqueConstraint("organization_id", "parcel_id", name="uq_parcel_favorites_org_parcel"),
        Index("ix_parcel_favorites_org_gemeente", "organization_id", "gemeente_code"),
        Index("ix_parcel_favorites_org_wijk", "organization_id", "wijk_naam"),
    )
```

**Why two IDs (`parcel_id` + `parcel_cache_id`):**
- `parcel_id` (Kadaster string) matches `ParcelDocument.parcel_id` — enables document count join without UUID lookup.
- `parcel_cache_id` (UUID FK) enables efficient geometry JOINs for map rendering.
- If a favorite is created before a scan covers that parcel, `parcel_cache_id` can be NULL and backfilled later.

### Model 2: `ParcelPipelineStage`

```python
PIPELINE_STAGES = Literal[
    "gesignaleerd",   # Spotted — on the radar
    "onderzoek",      # Under investigation — data gathering
    "contact",        # Owner contact phase
    "besluit",        # Go/no-go decision
    "afgerond",       # Completed (bought/passed)
]

class ParcelPipelineStage(Base, TenantMixin, TimestampMixin):
    """
    Deal pipeline stage for a favorited parcel.

    One row per favorited parcel. Created when a parcel is first favorited
    (default: gesignaleerd). Updated as the deal progresses.

    Separate from ParcelFavorite to keep concerns clean:
    - ParcelFavorite = "I care about this parcel"
    - ParcelPipelineStage = "where am I in the deal process"
    """
    __tablename__ = "parcel_pipeline_stages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))

    # FK to ParcelFavorite (1:1 relationship)
    favorite_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("parcel_favorites.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # One pipeline row per favorite
    )

    # Natural key for direct lookup without favorite JOIN
    parcel_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    stage: Mapped[str] = mapped_column(
        String(20), nullable=False, default="gesignaleerd"
    )

    # Rich text note for current stage
    stage_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Date when stage was last changed
    stage_changed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Assigned team member (future: role-based access)
    assigned_to_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    __table_args__ = (
        Index("ix_parcel_pipeline_org_stage", "organization_id", "stage"),
        Index("ix_parcel_pipeline_org_parcel", "organization_id", "parcel_id"),
    )
```

**Why separate table, not a column on `ParcelFavorite`:**
- Keeps `ParcelFavorite` as a stable bookmark record. Pipeline state is mutable and audit-worthy.
- Enables future: pipeline history table (multiple rows showing stage transitions with timestamps).
- Single-responsibility: bookmarking ≠ deal tracking.

**Why NOT on `Project`:**
- Stages track per-parcel deal progress. A `Project` groups many parcels across many scans. Adding `pipeline_stage` to `Project` would mean every wijk-level auto-created project gets a stage, which is semantically wrong.

### Model 3: `OutreachTemplate`

```python
TEMPLATE_TYPES = Literal[
    "brief_eigenaar",          # Letter to property owner
    "pre_overleg_gemeente",    # Pre-consultation request to gemeente
    "aanvraag_informatie",     # Information request
]

class OutreachTemplate(Base, TenantMixin, TimestampMixin):
    """
    Reusable outreach text template at organization level.

    Templates are org-wide, not parcel-specific. They contain
    Jinja2-style placeholders ({{ adres }}, {{ naam_eigenaar }}, etc.)
    that are filled at render time with parcel data.

    Built-in system templates are seeded per organization on first use.
    Users can customize or create additional templates.
    """
    __tablename__ = "outreach_templates"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))

    template_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body_markdown: Mapped[str] = mapped_column(Text, nullable=False)

    # True = system default (seeded), False = user-created/customized
    is_system: Mapped[bool] = mapped_column(nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)

    __table_args__ = (
        Index("ix_outreach_templates_org_type", "organization_id", "template_type"),
    )
```

**Template render approach:** Backend renders templates server-side using a safe variable substitution (no eval — simple `str.replace` or `string.Template`). Variables populated from `ParcelFavorite` + latest `ScanResult.flags` + optional BRK data if already fetched.

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `ParcelFavorite` (new model) | Server-backed parcel bookmarks with geo denormalization | `parcel_cache`, `parcel_documents` (via parcel_id) |
| `ParcelPipelineStage` (new model) | Deal stage per favorite | `parcel_favorites`, `users` |
| `OutreachTemplate` (new model) | Org-level reusable outreach text | None (org-scoped) |
| `/api/parcels/favorites` router (new) | CRUD favorites + pipeline stage updates | `parcel_favorites`, `parcel_pipeline_stages`, `scan_results` |
| `/api/outreach` router (new) | Template CRUD + render endpoint | `outreach_templates`, `parcel_favorites`, `scan_results` |
| `HeartButton` component (new) | Favorite toggle in `ParcelDetailPanel` | `useFavorites` hook → `/api/parcels/favorites` |
| `FavoritedParcelCard` component (new) | Parcel card in Projecten drill-down | `ParcelFavorite` data + pipeline stage |
| `ParcelWorkspaceDrawer` component (new) | Full-page per-parcel workspace | All parcel data, documents, pipeline, templates |
| `useFavorites` hook (new) | TanStack Query wrapper for favorites CRUD | `/api/parcels/favorites` |
| `usePipeline` hook (new) | TanStack Query wrapper for pipeline stage updates | `/api/parcels/favorites/{id}/pipeline` |
| `useOutreachTemplates` hook (new) | Template list + render | `/api/outreach` |
| `ProjectList.tsx` (modify) | Add parcel-level drill-down tier after WijkDetailView | `useFavorites`, `useOutreachTemplates` |

---

## Data Flow

### Favorite Parcel Flow (Map → Projecten)

```
User clicks HeartButton in ParcelDetailPanel
  -> useFavorites.toggleFavorite(parcel)
  -> POST /api/parcels/favorites
       body: { parcel_id, parcel_cache_id, gemeente_code, gemeente_naam, wijk_naam,
               address, score_at_favorite }
  -> Backend: INSERT parcel_favorites + INSERT parcel_pipeline_stages (stage='gesignaleerd')
  -> Invalidate query key: ['favorites', 'gemeente', gemeente_code]
  -> Heart button updates to filled state (optimistic update pattern)

User navigates to /projecten
  -> Gemeente drill-down → Wijk drill-down
  -> WijkDetailView: shows favorited parcel count badge
  -> Click "Percelen" → FavoritedParcelGrid
       -> GET /api/parcels/favorites?gemeente_code=...&wijk_naam=...
       -> Renders FavoritedParcelCard per result
```

### Pipeline Stage Update Flow

```
User opens FavoritedParcelCard → ParcelWorkspaceDrawer
  -> Displays current stage pill (Gesignaleerd | Onderzoek | Contact | Besluit | Afgerond)
  -> User clicks stage pill → PATCH /api/parcels/favorites/{favorite_id}/pipeline
       body: { stage: 'onderzoek', stage_note: 'Belafspraak gepland' }
  -> Backend: UPDATE parcel_pipeline_stages SET stage=..., stage_changed_at=NOW()
  -> Invalidate query: ['favorites', parcel_id]
  -> Stage pill updates (optimistic update)
```

### Outreach Template Render Flow

```
User opens ParcelWorkspaceDrawer → "Opstellen brief" button
  -> GET /api/outreach/templates?type=brief_eigenaar
  -> Select template → POST /api/outreach/render
       body: { template_id, parcel_id }
  -> Backend:
       1. Fetch template body
       2. Fetch ParcelFavorite (address, gemeente, wijk)
       3. Fetch latest ScanResult.flags (score, bouwjaar, bestemming)
       4. [Optional] if BRK data already fetched, inject naam eigenaar
       5. str.Template substitution → rendered markdown
  -> Frontend: renders in modal with copy-to-clipboard + download .docx
```

### Multi-Parcel Deal Group Flow

```
User selects multiple FavoritedParcelCards
  -> "Groepeer als deal" action
  -> PATCH /api/parcels/favorites/bulk-group
       body: { favorite_ids: [...], deal_group_id: <new UUID or existing> }
  -> Backend: UPDATE parcel_favorites SET deal_group_id=... WHERE id IN (...)
  -> Deal group shown as combined card in portfolio
```

---

## API Router Structure

### New: `/api/parcels` router

```
POST   /api/parcels/favorites                      Create favorite
GET    /api/parcels/favorites                      List all favorites (org-wide)
GET    /api/parcels/favorites?gemeente_code=&wijk_naam=  List by geography
GET    /api/parcels/favorites/{favorite_id}        Get single favorite
DELETE /api/parcels/favorites/{favorite_id}        Remove favorite
PATCH  /api/parcels/favorites/{favorite_id}        Update label/notes
PATCH  /api/parcels/favorites/{favorite_id}/pipeline  Update pipeline stage
PATCH  /api/parcels/favorites/bulk-group           Group multiple into deal
```

### New: `/api/outreach` router

```
GET    /api/outreach/templates                     List templates (seeded + custom)
POST   /api/outreach/templates                     Create custom template
PATCH  /api/outreach/templates/{id}                Update template
DELETE /api/outreach/templates/{id}                Delete (custom only)
POST   /api/outreach/render                        Render template with parcel data
```

---

## Frontend File Structure (New + Modified)

```
frontend/src/
├── components/
│   ├── projects/
│   │   ├── FavoritedParcelGrid.tsx    # NEW — parcel card grid in wijk drill-down
│   │   ├── FavoritedParcelCard.tsx    # NEW — card per favorited parcel
│   │   ├── PipelineStagePill.tsx      # NEW — stage indicator + click-to-change
│   │   ├── DealGroupBadge.tsx         # NEW — visual indicator for grouped parcels
│   │   ├── ParcelWorkspaceDrawer.tsx  # NEW — full-page parcel workspace (dossier + pipeline + outreach)
│   │   ├── OutreachTemplateModal.tsx  # NEW — template select + render + copy
│   │   ├── WijkDetailView.tsx         # MODIFY — add favorited parcel count + FavoritedParcelGrid
│   │   └── ProjectList.tsx            # MODIFY — wire favorite counts into wijk cards
│   └── map/
│       └── panels/
│           └── parcel/
│               ├── HeartButton.tsx    # NEW — favorite toggle in ParcelDetailPanel
│               └── ParcelDetailPanel.tsx  # MODIFY — add HeartButton + pipeline stage badge
├── hooks/
│   ├── useFavorites.ts    # NEW — TanStack Query: list/create/delete/update favorites
│   ├── usePipeline.ts     # NEW — TanStack Query: pipeline stage mutations
│   └── useOutreach.ts     # NEW — TanStack Query: template list + render
├── lib/
│   └── types/
│       └── portfolio.ts   # NEW — ParcelFavorite, PipelineStage, OutreachTemplate types
```

---

## Relation to Existing `scan_results`

The `ParcelFavorite.parcel_cache_id` FK enables this JOIN for live score display:

```sql
SELECT pf.*, sr.score, sr.flags
FROM parcel_favorites pf
LEFT JOIN scan_results sr
  ON sr.parcel_id = pf.parcel_cache_id
  AND sr.organization_id = pf.organization_id
WHERE pf.organization_id = $1
  AND pf.gemeente_code = $2
```

The `parcel_cache_id` nullable FK means no scan is required to favorite a parcel (e.g., from a direct address lookup). When a scan later covers the parcel, a background task or the next page load can backfill `parcel_cache_id`.

**Score display strategy:** Show `score_at_favorite` (stored at bookmark time) as primary display. Show live `scan_results.score` when available, with a visual "updated since favorited" indicator if scores diverge significantly.

---

## Relation to Existing `ParcelDocument`

`ParcelDocument` already uses `parcel_id` (Kadaster string) as its key. No schema change needed. The workspace drawer simply fetches documents via the existing `GET /api/documents/{parcel_id}/documents` endpoint. The document categories (bestemmingscheck, bodem, fundering, etc.) are already well-defined.

**Dossier completeness tracking:** Compute document coverage client-side: `VALID_DOCUMENT_TYPES.filter(type => docsByType.has(type)).length / VALID_DOCUMENT_TYPES.length`. No backend model needed — it's a derived display metric.

---

## Architectural Patterns

### Pattern 1: Optimistic Updates for Heart Button

**What:** Toggle favorite state instantly in UI before API round-trip confirms.

**When to use:** Any mutation the user expects to be instant (favorites, pipeline stage).

**How:** TanStack Query `onMutate` callback updates the cache, `onError` rolls back.

```typescript
// useFavorites.ts
useMutation({
  mutationFn: createFavorite,
  onMutate: async (newFavorite) => {
    await queryClient.cancelQueries({ queryKey: ['favorites'] })
    const previous = queryClient.getQueryData(['favorites'])
    queryClient.setQueryData(['favorites'], (old) => [...old, newFavorite])
    return { previous }
  },
  onError: (_err, _vars, context) => {
    queryClient.setQueryData(['favorites'], context?.previous)
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
})
```

### Pattern 2: Geographic Denormalization in Favorites

**What:** Store `gemeente_code`, `gemeente_naam`, `wijk_naam`, `address` on `ParcelFavorite` at creation time.

**When:** Always for favorites. Avoids multi-table JOIN on every portfolio list render.

**Trade-off:** Address data can get stale if BAG corrects an address. Acceptable — denormalized copy is display-only, and the source data (ParcelCache) remains authoritative.

### Pattern 3: System Template Seeding

**What:** Backend seeds default outreach templates per organization on first `GET /api/outreach/templates` call (lazy seeding).

**When:** First user in an organization opens the templates list.

**How:**
```python
# In GET /api/outreach/templates handler:
count = await db.scalar(select(func.count()).where(...))
if count == 0:
    await seed_default_templates(organization_id, db)
```

Avoids migration-time seeding (which requires knowing all org IDs), avoids background jobs for a simple UI feature.

### Pattern 4: Pipeline Stage as Enumerated String (Not Enum Type)

**What:** Store pipeline stage as `String(20)` column, validate in Pydantic schema.

**When:** All pipeline states.

**Why not PostgreSQL ENUM:** Adding a new stage value to a PostgreSQL ENUM requires `ALTER TYPE`, which locks the table. String columns with application-level validation (Pydantic `Literal`) allow stage evolution without migrations.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 favorites | In-memory list rendering, no pagination needed |
| 100-1000 favorites | Add pagination to `GET /api/parcels/favorites` (limit/offset) |
| 1000+ favorites | Add `sort_by` + filter params; consider cursor-based pagination |

The app is single-tenant initially (one client, small team). Favorites volume will be low (tens to hundreds of parcels). No premature optimization needed.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Reusing `Project` model for Pipeline Stages

**What people do:** Add `pipeline_stage` field to the existing `Project` model.

**Why wrong:** `Project` is linked to `AreaScan` (via `project_id` FK on `area_scans`). An auto-created wijk-project would get a pipeline stage. The pipeline concept applies to individual parcels, not to scan folders.

**Do this instead:** `ParcelPipelineStage` with FK to `ParcelFavorite`. Keep scan folders (Project) and deal pipeline (PipelineStage) separate.

### Anti-Pattern 2: Keeping Favorites in localStorage

**What people do:** Keep gemeente-level favorites in localStorage and add parcel-level favorites the same way.

**Why wrong:** localStorage is per-browser, not per-user. Team of 2-5 users (per PROJECT.md) cannot share portfolio view. Data lost on browser clear. Cannot show parcel favorites on map layer.

**Do this instead:** Migrate to server-backed `parcel_favorites` table. The gemeente-level localStorage favorites can stay as-is for now (they are a display preference, not a data asset) — replace them when redesigning the portfolio view.

### Anti-Pattern 3: Storing Rendered Templates

**What people do:** Save rendered outreach letters as documents in `ParcelDocument`.

**Why wrong:** Rendered letters contain snapshot data. If the user edits the template, old rendered versions become confusing. Mixing template instances with original documents pollutes the dossier.

**Do this instead:** Render on demand (POST /api/outreach/render). User copies to clipboard or downloads. No persistence of rendered output. The template itself is persisted in `OutreachTemplate`.

### Anti-Pattern 4: Requiring Scan Before Favoriting

**What people do:** Only allow favoriting parcels that exist in `scan_results`.

**Why wrong:** Users may want to favorite a parcel found via address search (direct lookup without area scan). The favorite model must support this.

**Do this instead:** `parcel_cache_id` is nullable on `ParcelFavorite`. The Kadaster `parcel_id` string is always available from any parcel lookup path (scan result, direct address lookup, map click). Use that as the stable key.

### Anti-Pattern 5: Blocking Heart Button on BRK Eigendom Data

**What people do:** Require BRK ownership data before allowing a favorite (to pre-populate outreach template).

**Why wrong:** BRK is Tier 3 (paid, on-demand). Blocking a free action (favoriting) on a paid call creates friction and cost.

**Do this instead:** Favorite immediately. Outreach template render fetches BRK only when user explicitly opens the template composer. BRK data is fetched then, not at favorite time.

---

## Build Order (considering dependencies)

### Phase 1: Backend Foundation — New Models + Migrations

**Components:** `ParcelFavorite`, `ParcelPipelineStage`, `OutreachTemplate` models + Alembic migration + Pydantic schemas.

**Why first:** All subsequent phases depend on these table definitions. No external dependencies.

**Files:**
- `backend/app/models/parcel_favorite.py` (NEW)
- `backend/app/models/parcel_pipeline_stage.py` (NEW)
- `backend/app/models/outreach_template.py` (NEW)
- `backend/app/schemas/portfolio.py` (NEW — ParcelFavoriteCreate/Response, PipelineStageUpdate, TemplateCreate/Response)
- `backend/alembic/versions/xxx_add_portfolio_models.py` (NEW migration)

### Phase 2: Favorites API Router

**Components:** `POST/GET/DELETE /api/parcels/favorites` + pipeline stage update endpoint.

**Depends on:** Phase 1 models.

**Files:**
- `backend/app/parcels/router.py` (NEW router)
- `backend/app/parcels/__init__.py` (NEW)
- Register router in `backend/app/main.py`

**Test coverage:** Integration tests for create/list/delete favorites + pipeline update. Follow pattern of `test_reports_router.py`.

### Phase 3: Outreach Templates API

**Components:** Template CRUD + render endpoint with system template seeding.

**Depends on:** Phase 1 models. Independent of Phase 2 (can be built in parallel).

**Files:**
- `backend/app/outreach/router.py` (NEW)
- `backend/app/outreach/templates_seed.py` (NEW — default Dutch templates)
- `backend/app/outreach/renderer.py` (NEW — safe string.Template substitution)

### Phase 4: Frontend Types + HeartButton

**Components:** TypeScript types for all new API shapes + `HeartButton` in `ParcelDetailPanel`.

**Depends on:** Phase 2 API shapes (for TypeScript type parity).

**Files:**
- `frontend/src/lib/types/portfolio.ts` (NEW)
- `frontend/src/hooks/useFavorites.ts` (NEW)
- `frontend/src/hooks/usePipeline.ts` (NEW)
- `frontend/src/components/map/panels/parcel/HeartButton.tsx` (NEW)
- Modify `ParcelDetailPanel.tsx` — add HeartButton + pipeline stage badge

### Phase 5: Portfolio Drill-Down in Projecten

**Components:** FavoritedParcelGrid + FavoritedParcelCard + PipelineStagePill + wiring into WijkDetailView.

**Depends on:** Phase 4 (hooks + types). Phase 2 API must be live.

**Files:**
- `frontend/src/components/projects/FavoritedParcelGrid.tsx` (NEW)
- `frontend/src/components/projects/FavoritedParcelCard.tsx` (NEW)
- `frontend/src/components/projects/PipelineStagePill.tsx` (NEW)
- Modify `WijkDetailView.tsx` — add favorited parcel section
- Modify `ProjectList.tsx` — add favorite counts to wijk cards

### Phase 6: ParcelWorkspaceDrawer + Outreach Templates UI

**Components:** Full parcel workspace with dossier completeness, pipeline management, template composer.

**Depends on:** Phases 4 + 5 (favorites infrastructure) + Phase 3 (outreach API).

**Files:**
- `frontend/src/components/projects/ParcelWorkspaceDrawer.tsx` (NEW)
- `frontend/src/components/projects/OutreachTemplateModal.tsx` (NEW)
- `frontend/src/hooks/useOutreach.ts` (NEW)

### Phase 7 (deferred): Multi-Parcel Deal Groups

**Components:** Bulk-group mutation + DealGroupBadge + combined deal card.

**Depends on:** All prior phases. Deferred because it adds UI complexity without core value.

**Why deferred:** The deal_group_id column on `ParcelFavorite` is already in Phase 1 migration. Implementation can happen later without schema changes.

---

## Integration Points Summary

| Integration Point | Type | Existing Component | Change |
|-------------------|------|--------------------|--------|
| `ParcelFavorite` model | NEW | None | New model + migration |
| `ParcelPipelineStage` model | NEW | None | New model + migration |
| `OutreachTemplate` model | NEW | None | New model + migration |
| `/api/parcels/favorites` router | NEW | `/api/projects` (pattern source) | New router, same auth pattern |
| `/api/outreach` router | NEW | None | New router |
| `HeartButton` in ParcelDetailPanel | NEW | `ParcelDetailPanel.tsx` | Add component, modify panel |
| `FavoritedParcelGrid` in WijkDetailView | NEW | `WijkDetailView.tsx` | Modify detail view |
| Gemeente favorites localStorage | REPLACE (parcel level) | `ProjectList.tsx` line 93 | Keep gemeente localStorage, add server-backed parcel favorites |
| `ParcelDocument` | UNCHANGED | `documents/router.py` | No change — parcel_id string key already works |
| `scan_results` JOIN | ADDITIVE | `ScanResult` model | Query in favorites list endpoint only |
| TanStack Query cache | ADDITIVE | Existing query keys | New keys: `['favorites']`, `['pipeline', parcel_id]`, `['templates']` |

---

## Sources

- Codebase: `backend/app/models/project.py`, `parcel_document.py`, `scan_result.py`, `parcel_cache.py`, `area_scan.py` (HIGH confidence — direct inspection)
- Codebase: `backend/app/projects/router.py`, `backend/app/documents/router.py` (HIGH confidence — direct inspection)
- Codebase: `frontend/src/components/projects/ProjectList.tsx` lines 93-211 (HIGH confidence — localStorage favorites pattern confirmed)
- Codebase: `frontend/src/lib/types/project.ts`, `scan.ts` (HIGH confidence — type shapes confirmed)
- Codebase: `frontend/src/hooks/useProjects.ts` (HIGH confidence — TanStack Query mutation patterns confirmed)
- Project context: `.planning/PROJECT.md` v17.0 milestone spec (HIGH confidence)
- Memory: `MEMORY.md` — Phase 105, Phase 106, Map Panel Architecture, TanStack Query patterns (HIGH confidence)

---

*Architecture research for: Propdex v17.0 Projecten Portfolio + Pipeline*
*Researched: 2026-03-15*
