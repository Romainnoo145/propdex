# Project Research Summary

**Project:** Propdex v17.0 — Projecten Portfolio
**Domain:** PropTech portfolio management + deal pipeline (Dutch real estate)
**Researched:** 2026-03-15
**Confidence:** HIGH

## Executive Summary

v17.0 adds the acquisition pipeline layer that Propdex has been missing: the ability to take a parcel discovered via scanning and actively manage it through the deal lifecycle. Today users find and score parcels in Propdex, then lose context in Excel and email. This milestone introduces server-backed parcel favorites, a 5-stage Dutch acquisition pipeline (Gesignaleerd → Onderzoek → Contact → Besluit → Afgerond), a per-parcel deal workspace with dossier management, and outreach templates that leverage the platform's existing BRK eigendom and bestemming data. The recommended approach builds on the existing FastAPI + React + TanStack Query stack with zero new backend dependencies — all five features are covered by already-installed packages (SQLAlchemy, Jinja2, fastapi-mail).

The key architectural decision is to introduce two new models (`ParcelFavorite` and `ParcelPipelineStage`) rather than extending the existing `Project` model, which serves a different purpose as a gemeente monitoring folder. The `ParcelFavorite` model must store both the Kadaster string identifier (stable, for document joins) and a nullable `parcel_cache_id` UUID FK (for geometry joins), because these are two different identity systems in the codebase. Geographic context (gemeente_code, wijk_naam, address) is denormalized on the favorite row to avoid expensive JOINs on every portfolio page load.

The critical risk areas are compliance and data model correctness. BRK eigendomsdata for natural persons (homeowners) must never be stored — outreach templates must use placeholders, never pre-populated owner names. Email sending must be deferred entirely to a future dedicated milestone; v17.0 delivers downloadable DOCX/PDF templates only. On the architecture side, `ProjectList.tsx` (currently 1867 lines) must be refactored into sub-components before any v17 features are added, otherwise the component becomes unmaintainable within one or two phases.

## Key Findings

### Recommended Stack

All five backend features (favorites, pipeline stages, email templates, dossier completeness, multi-parcel grouping) are covered by packages already installed. `pyproject.toml` requires no changes. Jinja2 3.1.6 and fastapi-mail 1.6.2 are already in the `.venv`; both are used in existing auth and WeasyPrint flows and can be reused directly. The sole optional frontend addition is `@dnd-kit/core` (drag-and-drop for a kanban pipeline board), but research recommends against kanban — a simpler pill/dropdown stage selector fits the spatial mental model of real estate developers better and eliminates the dependency entirely.

**Core technologies (new additions only):**
- `ParcelFavorite` SQLAlchemy model — follows `ChangeReadState` pattern; org-scoped, INSERT/DELETE, no new packages
- `PipelineStage` Python Enum — use `native_enum=False` (VARCHAR storage) to avoid `ALTER TYPE` migrations on stage additions
- Jinja2 letter templates — identical pattern to existing WeasyPrint HTML templates; reuse `PackageLoader`
- `FastMail` for email — reuse existing `fm` instance from `app/auth/email.py`; same `MessageSchema` pattern
- TanStack Query mutations — `useMutation` + `queryClient.invalidateQueries`; same pattern as existing document upload

**Version compatibility:** All confirmed against installed packages in `.venv`. `@dnd-kit/core ^6.3.1` is compatible with React 19 if kanban is ever chosen later.

### Expected Features

**Must have (table stakes):**
- Parcel favoriting (server-side, org-scoped) — cannot manage a pipeline without saving leads
- Geographic portfolio navigation (provincie → gemeente → wijk → parcel) — developers think spatially
- Pipeline status per parcel (5-stage Dutch acquisition flow) — without stages it is just a list
- Parcel project workspace (dedicated per-parcel view: notes, documents, status) — the core product surface
- Dossier completeness indicator (% complete + missing items list) — users need "what am I still missing?"

**Should have (differentiators):**
- Outreach template generator (brief naar eigenaar + pre-overleg gemeente) — leverages existing BRK + bestemming data; no competitor does this for Dutch parcels
- Dossier completeness with action links (Kadaster, EP-Online, gemeenteloket) — Propdex knows WHERE to get missing docs; unique to the platform
- Multi-parcel project grouping (optional named Project linking multiple parcels for multi-lot deals)
- Stage-based document requirements (different docs required at each pipeline stage)

**Defer to v2+ (Phase 3 / future milestone):**
- Map-integrated pipeline overlay (pipeline stage colors on main map) — HIGH complexity
- Go/no-go dashboard (auto-generated summary at Besluit stage) — HIGH complexity; needs Score v3.0 integration
- AI-personalized outreach letter — adds latency and per-token cost; templated letters are better for legal correspondence

**Anti-features (explicitly out of scope):**
- Full CRM contact management, automated email sending, financial feasibility modeling, Kadaster change monitoring, drag-and-drop kanban board, buyer/investor pipeline (sell side)

### Architecture Approach

Three new models are required, all following existing TenantMixin + TimestampMixin patterns. `ParcelFavorite` is the root entity — everything else hangs off it. `ParcelPipelineStage` is a separate 1:1 table (not a column on `ParcelFavorite`) to keep bookmarking and deal-tracking concerns separate and enable future audit history. `OutreachTemplate` is an org-level entity with lazy seeding (first `GET /api/outreach/templates` seeds system defaults per org). The frontend extends `/projecten` by extracting `ProjectList.tsx` into sub-components (`ProjectenPage`, `ProvincieView`, `GemeenteView`, `WijkView`, `ParcelPortfolioView`) before adding any new UI. A dedicated bulk portfolio endpoint (`GET /api/portfolio/wijken/{wijk_code}/parcels`) returns all card data in a single JOIN query to prevent N+1 fetches.

**Major components:**
1. `ParcelFavorite` model + `/api/parcels/favorites` router — root of the portfolio; CRUD + pipeline stage update
2. `ParcelPipelineStage` model — deal tracking with stage transition validation (backend enforces allowed transitions; pipeline stage as VARCHAR Enum, not PostgreSQL ENUM type)
3. `OutreachTemplate` model + `/api/outreach` router — Jinja2 template CRUD + render-on-demand (no stored rendered output)
4. `HeartButton` component in `ParcelDetailPanel` — entry point; optimistic update via TanStack Query `onMutate`
5. Bulk portfolio endpoint — single JOIN across `parcel_favorites`, `parcel_cache`, `scan_results`, `parcel_documents` COUNT
6. `FavoritedParcelGrid` + `FavoritedParcelCard` + `PipelineStagePill` — parcel tier in `/projecten` drill-down
7. `ParcelWorkspaceDrawer` component — full per-parcel workspace (dossier + pipeline + outreach)

### Critical Pitfalls

1. **Project model conflation (folder vs deal)** — The existing `Project` model is a scan folder organizer. Adding `pipeline_stage` or `parcel_id` to it corrupts `ProjectList.tsx` filtering (`topLevelProjects = allProjects.filter(p => p.parent_id === null)`). Use separate `ParcelFavorite` + `ParcelPipelineStage` tables exclusively. Any migration adding `pipeline_stage` to the `projects` table is a warning sign.

2. **localStorage parcel favorites** — Gemeente favorites stay in localStorage (navigation preference) but parcel favorites are business data and must be server-side from day one. Team members cannot share a portfolio view if it is browser-local. The feature is new — no migration of existing data needed; build the DB table from the start.

3. **Kadaster parcel_id vs UUID** — `ParcelCache` has two identity columns: Kadaster string (`parcel_id`, e.g., `"HTT02-A-1234"`) and internal UUID (`id`). New models must store BOTH: the Kadaster string as primary lookup key (stable across re-scans, matches `ParcelDocument`), and a nullable FK to `parcel_cache.id` (for geometry JOINs only). Never use only the UUID — it can be regenerated when a wijk is re-scanned.

4. **BRK data in outreach templates (AVG violation)** — Owner name/address from BRK is ephemeral Tier 3 data and must never be stored. Templates must use `{{ naam_eigenaar }}` as a literal placeholder; the user fills it manually. For `rechtspersoon` (companies), KvK number and company name may be stored with proper purpose documentation. For `natuurlijk_persoon`, zero storage.

5. **N+1 portfolio query explosion** — A wijk with 50 favorited parcels requires score, document count, and pipeline stage per card. TanStack `useQuery` inside `.map()` fires 250 backend requests. Build the bulk portfolio endpoint before building the frontend list component.

6. **ProjectList.tsx at 1867 lines** — Adding v17 features directly to this file without extraction creates a 3000+ line file. Refactor into sub-components as the first v17 task (estimated 2-4 hours), before any feature work begins.

7. **Email/SMTP outreach infrastructure** — Unsolicited emails to property owners trigger Dutch Telecommunicatiewet Art. 11.7. Shared SMTP with no domain reputation gets blacklisted. MVP must deliver DOCX/PDF download only; email sending is a dedicated future milestone requiring SPF/DKIM/DMARC setup.

## Implications for Roadmap

Based on the dependency graph in FEATURES.md and the build order in ARCHITECTURE.md, five phases are suggested:

### Phase 1: Backend Foundation — Models + API Routers
**Rationale:** All subsequent phases depend on the `ParcelFavorite` and `ParcelPipelineStage` table definitions. Pure backend phase with no UI — unblocks all parallel frontend work. All schema decisions (dual parcel ID, pipeline stage as VARCHAR Enum, BRK exclusion) must be locked here.
**Delivers:** `ParcelFavorite`, `ParcelPipelineStage`, `OutreachTemplate` models + Alembic migration + Pydantic schemas + `/api/parcels/favorites` router (CRUD + pipeline update) + `/api/outreach` router (template CRUD + render) + system template seeding
**Addresses:** Parcel favoriting, pipeline stage tracking, outreach template storage
**Avoids:** Project model conflation (new tables only); Kadaster dual-ID pattern enforced in schema; pipeline stage as VARCHAR Enum with `PipelineStage(str, Enum)` and Pydantic `use_enum_values=True`

### Phase 2: ProjectList.tsx Refactor + HeartButton
**Rationale:** The component refactor must happen before adding any new portfolio UI — it is a prerequisite, not optional cleanup. The HeartButton is the user-facing entry point for the entire pipeline feature and validates the favorites API end-to-end.
**Delivers:** Extracted `ProjectenPage` / `ProvincieView` / `GemeenteView` / `WijkView` / `ParcelPortfolioView` sub-components; `HeartButton` in `ParcelDetailPanel` with optimistic TanStack Query mutation; `useFavorites` + `usePipeline` hooks; `frontend/src/lib/types/portfolio.ts`
**Uses:** Phase 1 API; TanStack Query `onMutate` / `onError` optimistic update pattern (already used in document upload)
**Avoids:** ProjectList.tsx spaghetti exceeding 2000 lines; localStorage parcel favorites

### Phase 3: Portfolio Drill-Down (Projecten Parcel Tier)
**Rationale:** Once the HeartButton exists and favorites are server-backed, the portfolio view can display them. The bulk endpoint must be built before the frontend list to prevent N+1 queries by design.
**Delivers:** `GET /api/portfolio/wijken/{wijk_code}/parcels` bulk JOIN endpoint; `FavoritedParcelGrid` + `FavoritedParcelCard` + `PipelineStagePill` components; wijk card shows favorited parcel count badge; pipeline stage changeable from the card
**Implements:** Geographic portfolio navigation; pipeline status per parcel
**Avoids:** N+1 query explosion — bulk endpoint ships before list component is built

### Phase 4: ParcelWorkspaceDrawer + Dossier Intelligence
**Rationale:** The workspace is the most complex surface. It depends on favorites infrastructure (Phases 2-3), the existing document system, and the outreach API (Phase 1). Dossier completeness is computed server-side using `DOSSIER_SCHEMA` set intersection.
**Delivers:** `ParcelWorkspaceDrawer` (full-page per-parcel workspace); dossier completeness indicator with category breakdown + action links to Dutch government sources; stage-based document requirements; pipeline stage management with notes; `OutreachTemplateModal` with template render + copy/DOCX download
**Uses:** Phase 1 outreach API; existing `ParcelDocument` + `/api/documents` endpoint (no duplication)
**Avoids:** BRK data stored in templates (placeholders only); stored rendered templates (render on demand, never persist)

### Phase 5: Multi-Parcel Deal Groups (Deferred)
**Rationale:** The `deal_group_id` UUID column is already in the Phase 1 migration. The bulk-group mutation and combined deal card UI are deferred because they add complexity without blocking core pipeline value.
**Delivers:** `PATCH /api/parcels/favorites/bulk-group` endpoint; `DealGroupBadge` component; combined deal card in portfolio view; optional named `Project` linking multiple parcels
**Deferred because:** Core parcel-level pipeline ships first; multi-lot grouping affects a minority of deals; data infrastructure already in place from Phase 1

### Phase Ordering Rationale

- Phase 1 (Backend) must be first: zero-dependency, unblocks everything; all models defined upfront avoids schema churn.
- Phase 2 (Refactor + HeartButton) must be second: validates the favorites API end-to-end while keeping the component structure clean before features compound.
- Phase 3 (Portfolio View) must follow HeartButton: cannot show favorited parcels without a mechanism to favorite them.
- Phase 4 (Workspace) must follow portfolio: users access the workspace from a favorited parcel card.
- Phase 5 (Deal Groups) is deferred: the `deal_group_id` column is already in the Phase 1 migration, so no additional schema change when it ships.

### Research Flags

Phases with well-documented patterns (skip `/gsd:research-phase`):
- **Phase 1:** All models follow established TenantMixin + TimestampMixin patterns in the codebase; Jinja2 + fastapi-mail already in active use
- **Phase 2:** TanStack Query optimistic updates and component extraction are standard React patterns well-documented in the existing codebase
- **Phase 3:** Bulk endpoint JOIN query pattern is standard SQLAlchemy; TanStack Query list hook follows existing `useProjects` pattern

Phases that may benefit from deeper research during planning:
- **Phase 4 (Workspace):** The 20 document types need mapping to Dutch government source URLs for action links — minor research to compile the complete table. The `string.Template` vs Jinja2 safe substitution approach for outreach template rendering needs a decision before implementation.
- **Phase 5 (Deal Groups):** Many-to-many vs one-to-many parcel grouping cardinality needs validation with the client before committing to the schema.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified from direct `.venv` inspection + pyproject.toml; zero new dependencies confirmed |
| Features | MEDIUM | Dutch acquisition pipeline stages from CMS.law + Vastgoedjournaal + domain knowledge; Spartner.nl competitor features unknown |
| Architecture | HIGH | Full codebase analysis — all models, routers, hooks, and components inspected directly; build order derived from actual dependency analysis |
| Pitfalls | HIGH | All pitfalls verified against actual codebase code paths; AVG/GDPR constraints from Dutch law sources; BRK storage prohibition confirmed in existing code comment |

**Overall confidence:** HIGH

### Gaps to Address

- **Spartner.nl competitor features:** No public feature documentation found. Competitive differentiation vs. the primary Dutch competitor is unknown. Not blocking for v17.0.
- **Multi-parcel grouping cardinality:** Whether a parcel should belong to multiple deal groups (many-to-many) vs. one group only (current design). Validate with client before Phase 5.
- **Outreach template delivery format:** Research recommends DOCX/PDF download only (not email sending) for v17.0 MVP. Confirm with client that download-only is acceptable, or document that email sending is explicitly deferred.
- **Pipeline stage transition strictness:** Research recommends enforcing allowed transitions server-side. Confirm whether users need free-form stage jumps for deals that skip phases (e.g., Gesignaleerd directly to Afgerond for a quick pass/reject decision).

## Sources

### Primary (HIGH confidence)
- `backend/pyproject.toml` + `.venv` direct inspection — confirmed installed packages and versions
- `backend/app/models/project.py`, `parcel_document.py`, `scan_result.py`, `parcel_cache.py` — confirmed data model patterns and dual-ID system
- `backend/app/auth/email.py` — confirmed FastMail pattern reusable for outreach
- `frontend/src/components/projects/ProjectList.tsx` lines 93-213 — confirmed localStorage gemeente favorites pattern
- `frontend/src/lib/types/brk.ts` — confirmed "NEVER cache or store BRK eigendomsdata" code comment
- `frontend/package.json` — confirmed React 19, Framer Motion 12.35.2, TanStack Query 5.x
- MEMORY.md — Phase 105 BRK ephemeral pattern, Phase 106 document upload pattern

### Secondary (MEDIUM confidence)
- [CMS.law: Acquisition of Real Estate in the Netherlands](https://cms.law/en/nld/publication/how-to-invest-in-commercial-real-estate-in-the-netherlands/acquisition-of-real-estate) — Dutch acquisition pipeline stages (LOI → due diligence → SPA → notarispassering)
- [Vastgoedjournaal: Acquisitieplanning](https://vastgoedjournaal.nl/news/53347/acquisitieplanning-de-start-van-vastgoedmanagement) — Dutch 4-phase pipeline
- [Planruimte: Vooroverleg gemeente / principeverzoek](https://www.planruimte.nl/vooroverleg/) — pre-consultation process and content
- [Adventures in CRE: Development Due Diligence Checklist](https://www.adventuresincre.com/real-estate-development-due-diligence-checklist/) — due diligence document categories
- Dutch Telecommunicatiewet Art. 11.7 — unsolicited electronic marketing requirements
- AVG Article 6 + Article 30 — lawful basis and processing register obligations for outreach

### Tertiary (LOW confidence)
- Spartner.nl — competitor feature set unknown; no public documentation found
- `@dnd-kit/core` React 19 compatibility — peer deps specify React 17+; no confirmed React 19 test evidence (unlikely to be an issue)

---
*Research completed: 2026-03-15*
*Ready for roadmap: yes*

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

# Stack Research

**Domain:** PropTech portfolio management + deal pipeline (Dutch real estate)
**Researched:** 2026-03-15
**Confidence:** HIGH (all recommendations are zero-new-dependency or use already-installed packages verified from pyproject.toml + .venv)

---

## Context: Subsequent Milestone

This covers ONLY new stack requirements for **v17.0 Projecten Portfolio**. Existing validated
capabilities (FastAPI, SQLAlchemy 2.x, React 19, Vite 7, MapLibre, TanStack Query v5, Framer
Motion, Jinja2, fastapi-mail, WeasyPrint) are NOT re-documented.

The five new features are:
1. Server-side parcel favorites (replacing localStorage)
2. Pipeline stage tracking per parcel
3. Email template generation and sending (brief naar eigenaar, pre-overleg gemeente)
4. Dossier completeness tracking
5. Multi-parcel project grouping

---

## Final Answer: Zero New Backend Dependencies

All five backend features are covered by the existing installed stack.

| Feature | New pip package? | Uses instead |
|---------|-----------------|-------------|
| Server-side parcel favorites | None | SQLAlchemy 2.x (new model, same pattern as `ChangeReadState`) |
| Pipeline stage tracking | None | SQLAlchemy `Enum` type (already used in codebase) |
| Email template generation | None | Jinja2 3.1.6 (already installed, used for WeasyPrint HTML templates) |
| Email sending | None | fastapi-mail 1.6.2 (already installed, same `FastMail` pattern as `auth/email.py`) |
| Dossier completeness tracking | None | Pure Python set logic over existing `ParcelDocument` rows |
| Multi-parcel project grouping | None | Nullable FK to existing `Project` model — zero new tables |

**`pyproject.toml` changes: none required.**

---

## Frontend: One Optional Addition

One frontend library is recommended for drag-to-reorder pipeline stage management if a
kanban board layout is chosen. It is deferrable if a simpler pill/dropdown stage selector
is used instead.

| Library | Version | Purpose | Condition |
|---------|---------|---------|-----------|
| `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` | `^6.3.1` | Accessible drag-and-drop for kanban pipeline board | Only if kanban layout chosen |

**`package.json` changes: none required if linear stage selector used.**

---

## Recommended Stack (New Additions Only)

### Backend — New Models (no new packages)

| Model | Columns (key) | Pattern |
|-------|--------------|---------|
| `ParcelFavorite` | `organization_id`, `user_id`, `parcel_id`, `wijk_naam`, `gemeente_code`, `pipeline_stage`, `notes`, `project_id` | Follows `ChangeReadState` — tenant-isolated, INSERT/DELETE rows |

**Why single model:** The v17.0 spec says pipeline stage is per-favorited parcel. A separate
`PipelineStatus` table is only needed if non-favorited parcels need pipeline state, which is
not in scope.

**Why denormalize `wijk_naam` + `gemeente_code` on the row:** Portfolio navigation
(provincie → gemeente → wijk → parcel) requires geographic drill-down without joining to
`scan_results`. The geographic context stored on the favorite row avoids coupling favorites
to a specific scan that may be re-run or deleted.

**Why no FK from `ParcelFavorite` to `ScanResult`:** `scan_results` is per-org and changes
when re-scanned. A FK would break favorites when scans are updated. Match by `parcel_id`
string at query time (same pattern as `ChangeRecord.matched_parcel_id` persisted FK).

**Schema:**
```sql
parcel_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,          -- TenantMixin
  user_id UUID REFERENCES users(id),      -- per-user favorites (not org-wide)
  parcel_id VARCHAR(50) NOT NULL,         -- Kadaster identifier
  wijk_naam VARCHAR(200),                 -- denormalized for portfolio nav
  gemeente_code VARCHAR(10),              -- denormalized for province drill-down
  pipeline_stage VARCHAR(20) DEFAULT 'gesignaleerd',  -- PipelineStage enum
  notes TEXT,                             -- free-form user notes
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,  -- optional deal grouping
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, user_id, parcel_id)
)
```

### Backend — New Constants File

| File | Content |
|------|---------|
| `app/projects/constants.py` | `PipelineStage` enum + `DOSSIER_SCHEMA` dict |

```python
# app/projects/constants.py

from enum import Enum

class PipelineStage(str, Enum):
    GESIGNALEERD = "gesignaleerd"
    ONDERZOEK = "onderzoek"
    CONTACT = "contact"
    BESLUIT = "besluit"
    AFGEROND = "afgerond"

# Expected document types per dossier category.
# Completeness = uploaded_types ∩ expected_types / |expected_types|
DOSSIER_SCHEMA: dict[str, list[str]] = {
    "acquisitie": [
        "kadaster_uittreksel",
        "eigendomsbewijs",
        "koopovereenkomst",
    ],
    "technisch": [
        "bodemonderzoek",
        "funderingsrapport",
        "asbestinventarisatie",
    ],
    "planologisch": [
        "bestemmingsplan",
        "omgevingsvergunning",
        "vooroverleg_gemeente",
    ],
    "juridisch": [
        "akte_van_levering",
        "erfpacht_akte",
        "kwalitatieve_verplichting",
    ],
    "notities": [],  # free-form, no completeness tracking
}
```

### Backend — New Jinja2 Templates

| File | Purpose |
|------|---------|
| `app/projects/templates/brief_eigenaar.jinja2` | Dutch owner outreach letter |
| `app/projects/templates/pre_overleg_gemeente.jinja2` | Pre-consultation municipality letter |

**Template variables for `brief_eigenaar.jinja2`:**
`parcel_adres`, `perceel_id`, `eigenaar_naam` (user-provided — never auto-populated from BRK),
`projectnaam`, `organisatie_naam`, `datum`, `gebruiker_naam`, `contactgegevens`

**Template variables for `pre_overleg_gemeente.jinja2`:**
`gemeente_naam`, `parcel_adres`, `bestemming_naam`, `bouwplan_omschrijving`,
`datum`, `organisatie_naam`, `contactgegevens`

**Rendering pattern** (identical to WeasyPrint HTML templates):
```python
from jinja2 import Environment, PackageLoader

env = Environment(loader=PackageLoader("app", "projects/templates"))
template = env.get_template("brief_eigenaar.jinja2")
rendered = template.render(**variables)
```

**Sending pattern** (identical to `auth/email.py`):
```python
from app.auth.email import fm  # reuse existing FastMail instance
from fastapi_mail import MessageSchema, MessageType

message = MessageSchema(
    subject=f"Brief: {parcel_adres}",
    recipients=[recipient_email],  # user must provide — AVG compliance
    body=rendered_html,
    subtype=MessageType.html,
)
await fm.send_message(message)
```

**AVG/GDPR constraint:** Recipient email address for `brief_eigenaar` MUST be entered
manually by the user. Never auto-populate from BRK eigendomsdata (personal data, Tier 3).
The template generates letter text; delivery is the user's responsibility.

### Frontend — New Route

| Route | Purpose |
|-------|---------|
| `/projecten` (existing, rebuild) | Geographic portfolio navigator — provincie → gemeente → wijk → parcel |
| `/projecten/$parcelId` (new) | Per-parcel project workspace with pipeline, dossier, outreach |

**State management:** TanStack Query for all server state (favorites list, pipeline stage,
dossier completeness). No new state manager needed. Mutations use `useMutation` +
`queryClient.invalidateQueries` — same pattern as existing parcel document upload.

**Completeness calculation:** Derive in the API response (Python set intersection), not
client-side. Return `completeness_pct: float` + `missing_types: list[str]` per category.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-beautiful-dnd` | Unmaintained since 2022, React 18+ issues in strict mode | `@dnd-kit/core` if DnD needed; or skip entirely with pill selector |
| `redux` / `zustand` | TanStack Query manages server state; local UI state is component-scoped | TanStack Query mutations + React `useState` |
| SendGrid / Postmark | SaaS email adds cost and data-processor obligations (AVG) for outreach letters that users send manually | fastapi-mail with existing `MAIL_*` SMTP settings |
| `celery` | ARQ already provides async jobs; Celery adds broker complexity | `arq` (already installed, Redis-backed) |
| Separate file storage (S3/MinIO) | LargeBinary PostgreSQL works at current scale; Phase 106 proved the pattern | PostgreSQL `LargeBinary` (existing `ParcelDocument` pattern) |
| Elasticsearch | Portfolio search is over hundreds of favorited parcels per org max | PostgreSQL full-text search (`to_tsvector`) |
| A new `PipelineStatus` model | Pipeline state is per-favorited-parcel — adding columns to `ParcelFavorite` is sufficient | Column on `ParcelFavorite` |
| A new `DealGroup` model | The existing `Project` model already has `name`, `description`, org isolation, `gemeente_code`/`wijk_naam` context | Nullable `project_id` FK on `ParcelFavorite` pointing at existing `projects` table |
| Materialized view for completeness | Derived computation from `parcel_documents` is fast at expected scale (<1000 docs/parcel) | Python set intersection at query time |
| GraphQL | REST with TanStack Query already has clean data contracts | FastAPI REST endpoints |

---

## Dossier Completeness Pattern

**No DB changes.** The completeness percentage is computed at read time:

```python
# In the parcel workspace API endpoint
from app.projects.constants import DOSSIER_SCHEMA

uploaded = await db.execute(
    select(ParcelDocument.document_type)
    .where(ParcelDocument.organization_id == org_id)
    .where(ParcelDocument.parcel_id == parcel_id)
)
uploaded_types = {row[0] for row in uploaded.all()}

completeness = {}
for category, expected in DOSSIER_SCHEMA.items():
    if not expected:
        completeness[category] = {"pct": None, "missing": []}
        continue
    uploaded_in_cat = uploaded_types & set(expected)
    pct = len(uploaded_in_cat) / len(expected)
    missing = [t for t in expected if t not in uploaded_types]
    completeness[category] = {"pct": round(pct, 2), "missing": missing}
```

**Why compute at read time:** A stored completeness percentage goes stale when documents
are added or deleted. Computing from source (document rows) ensures accuracy. With TanStack
Query's cache, this query runs once per navigation — no performance issue at expected scale.

---

## Multi-Parcel Project Grouping Pattern

**Approach:** Add nullable `project_id UUID` FK on `ParcelFavorite` → `projects.id`.
A "deal" (multi-parcel project) is a `Project` row with `name` + optional `description`.
Parcels in the deal share the same `project_id`.

**Constraint:** One parcel per project (simplest model for v17.0). If many-to-many is
needed in a future phase, introduce a `ProjectParcel` join table.

**Migration:** Single `alembic revision --autogenerate` — one FK column, one index.

**Why reuse `Project` not a new model:** The `projects` table already has multi-tenant
isolation (`organization_id`), hierarchy support (`parent_id` self-ref), and geographic
context (`gemeente_code`, `wijk_naam`). Zero new tables. The existing `Project` endpoints
can serve deal CRUD.

---

## Installation

```bash
# Backend — zero new dependencies
# All features use: sqlalchemy, jinja2, fastapi-mail, alembic (all already installed)

# Run migration after adding ParcelFavorite model
cd backend && alembic revision --autogenerate -m "add_parcel_favorites"
alembic upgrade head

# Frontend — only if kanban pipeline board chosen (not pill selector)
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `fastapi-mail` | `1.6.2` (installed) | FastAPI 0.115, Python 3.11 | Verified in existing auth flow — same `FastMail` instance reusable |
| `jinja2` | `3.1.6` (installed) | Python 3.11, WeasyPrint 68.1 | Already used for PDF report templates — identical usage |
| `SQLAlchemy Enum` | part of `>=2.0.25` | PostgreSQL 16, asyncpg 0.29 | Standard pattern — `sa.Enum(PipelineStage)` with `native_enum=False` to avoid PG enum type migrations |
| `@dnd-kit/core` | `^6.3.1` | React 19, TypeScript 5.9 | No peer dep conflicts; designed for React 17+ |

**SQLAlchemy Enum note:** Use `native_enum=False` to store as VARCHAR. PostgreSQL native
enums require a separate `CREATE TYPE` migration and cannot be easily altered — the VARCHAR
approach matches the existing codebase pattern.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Nullable `project_id` FK on `ParcelFavorite` | New `ProjectMembership` join table | Only if a parcel needs to belong to multiple projects simultaneously |
| `PipelineStage` enum column on `ParcelFavorite` | Separate `PipelineStatus` table with history | Only if stage change audit trail is required (future phase) |
| Jinja2 letter templates | Claude AI generation | AI adds 5-30s latency and per-token cost; templated letters with variable substitution are deterministic, instant, and appropriate for legal correspondence |
| Compute completeness at read time | Stored `completeness_pct` column | Only if query performance becomes an issue at >10k documents per org |
| `@dnd-kit/core` | Framer Motion `Reorder` | Framer `Reorder` handles simple list reorder but not cross-list kanban (dragging between pipeline stages); `@dnd-kit` is the current standard for accessible multi-list DnD |

---

## Sources

- `backend/pyproject.toml` — confirmed installed packages and versions (HIGH confidence — direct file read)
- `backend/.venv/lib/python3.11/site-packages/fastapi_mail-1.6.2.dist-info/METADATA` — confirmed fastapi-mail 1.6.2 installed (HIGH confidence — direct .venv inspection)
- `jinja2-3.1.6.dist-info` in `.venv` — confirmed Jinja2 3.1.6 installed (HIGH confidence)
- `app/auth/email.py` — existing FastMail pattern; `FastMail(ConnectionConfig(...))` + `MessageSchema` (HIGH confidence — direct code read)
- `app/models/change_read_state.py` — `ParcelFavorite` design follows this pattern exactly (HIGH confidence)
- `app/models/parcel_document.py` — dossier completeness builds on this model (HIGH confidence)
- `app/models/project.py` — multi-parcel grouping reuses this model (HIGH confidence)
- `frontend/package.json` — confirmed React 19, Framer Motion 12.35.2, TanStack Query 5.x installed (HIGH confidence)
- `@dnd-kit` React 19 compatibility: https://dndkit.com — peer deps specify React 17+ (MEDIUM confidence — React 19 is recent but no breaking changes in React API used by dnd-kit)

---

*Stack research for: v17.0 Projecten Portfolio — portfolio management + deal pipeline*
*Researched: 2026-03-15*

# Feature Research: Projecten Portfolio — Deal Pipeline & Portfolio Management

**Domain:** Property portfolio management + deal pipeline for Dutch vastgoedontwikkelaars (PropTech)
**Researched:** 2026-03-15
**Milestone:** v17.0 Projecten Portfolio
**Confidence:** MEDIUM — Pipeline stage naming from general PropTech + Dutch domain knowledge; Dutch-specific acquisition workflow from government/industry sources; dossier completeness patterns from international PropTech (no Dutch-specific tools found)

---

## Context: What This Milestone Adds

Propdex already has: map scanning, per-parcel scoring, due diligence reports, document uploads, BRK eigendom modal, and a basic heart/favorite for gemeenten. The gap is **no place for a developer to manage their actual acquisition pipeline** after they find an opportunity.

Today a developer uses Propdex to find/score parcels, then manages the acquisition in Excel/email/their head. This milestone adds the pipeline layer that closes the loop: favorite a parcel → assign a stage → track the dossier → prepare outreach → make a go/no-go call.

---

## Table Stakes

Features users expect in any property pipeline tool. Missing = product feels like a prototype.

| Feature | Why Expected | Complexity | Dependencies on Existing | Notes |
|---------|--------------|------------|--------------------------|-------|
| **Parcel favoriting** (heart button) | Cannot manage a pipeline without first saving a lead. The most basic primitive — "I care about this parcel" | LOW | ParcelDetailPanel (exists), localStorage heart for gemeenten (exists as pattern) | Needs server-side persistence (not localStorage) — must be org-scoped. DB model: `FavoritedParcel(org_id, parcel_id, wijk_id, created_at)` |
| **Geographic portfolio navigation** (provincie → gemeente → wijk → parcel) | Developers organize their pipeline geographically. "Show me everything I'm tracking in Noord-Holland" is natural to them | MEDIUM | Gemeente/wijk card nav (exists), SVG silhouettes (exists) | New /projecten route with drill-down. Provincie layer is new (currently skip to gemeente). Re-use existing WijkMapPanel patterns for cards |
| **Pipeline status per parcel** | Every CRM for real estate has stages. Without stages, there's no pipeline — just a list | MEDIUM | Per-parcel document storage (exists) | 5 stages (see Pipeline Stages section). Status stored in `FavoritedParcel` or separate `ParcelProject` model |
| **Parcel project workspace** (expanded dossier view) | After favoriting, users need a dedicated workspace per parcel: notes, documents, status, contacts | HIGH | Per-parcel document storage (exists), 5 dossier categories (exists), notes system (exists) | Full-screen or route-based workspace. Shows dossier completeness + action links per missing doc |
| **Dossier completeness indicator** | Users need to know "what am I still missing?" before a go/no-go meeting. Percentage + missing items list | MEDIUM | 20 document types already defined in upload system | Weighted checklist: which docs are critical vs nice-to-have for each pipeline stage. Progress bar per category |
| **Multi-parcel project grouping** | Adjacent parcels often form one deal (e.g., three lots for apartment block). Must group them | MEDIUM | Parcel selection (exists in /resultaten), FavoritedParcel model | `Project` model with many-to-many parcels. Display as "project" card in portfolio, not individual parcel cards |

---

## Dutch Pipeline Stages

Based on research into Dutch vastgoedontwikkeling acquisition workflow and general real estate CRM patterns.

### Standard Dutch Developer Pipeline (5 Stages)

| Stage | Dutch Label | Description | Trigger | Exit Criterion |
|-------|-------------|-------------|---------|----------------|
| 1 | **Gesignaleerd** | Parcel identified as interesting from scan. Initial signal. | Heart/favorite parcel | Decide to investigate further |
| 2 | **Onderzoek** | Active due diligence: ownership research, zoning analysis, feasibility check. Pre-contact phase | Promote from Gesignaleerd | Sufficient info to decide: contact owner or drop |
| 3 | **Contact** | Owner contacted (brief/email/phone). May include principeverzoek at gemeente. Negotiation begins | Promote from Onderzoek | LOI signed, OR dropped |
| 4 | **Besluit** | Internal go/no-go decision. Board/partner approval. Term sheet / koopovereenkomst negotiation | Owner responded positively | Go → purchase agreement, No-go → Afgerond/Afgewezen |
| 5 | **Afgerond** | Closed: Gekocht (purchased) OR Afgewezen (rejected) with reason | Decision made | — |

**Rationale for these 5 stages:**
- Maps to the Nederlandse acquisitieproces: signalering → analyse → contactfase → principebesluit → afsluiting
- Aligns with the formal Dutch real estate transaction flow: LOI → due diligence → SPA → notarispassering
- "Principeverzoek" (vooroverleg gemeente) happens in the Contact stage, after initial owner outreach
- Avoids over-engineering: CRM tools that define 10+ stages see poor adoption

---

## Differentiators

Features that set Propdex apart from generic CRM tools and competing PropTech.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Outreach template generator** (brief naar eigenaar) | Generic CRM tools have no idea who owns a Dutch parcel or how to approach them. Propdex already has BRK eigendom data (naam, type, adres). A pre-filled letter template leverages that uniquely | MEDIUM | BRK eigendom modal (exists), parcel data (exists) | Two templates: (1) Brief particuliere eigenaar, (2) Brief rechtspersoon/BV. Pre-fill: naam eigenaar, adres perceel, bestemming, developer org name. Word/PDF export. Claude AI personalization is P2 |
| **Pre-overleg gemeente template** (principeverzoek) | Before investing in a formal permit application, developers always do vooroverleg. Propdex knows the bestemming, bouwregels, max_bouwlagen — enough to draft a principeverzoek request | MEDIUM | Bestemming data (exists), DSO bouwregels (exists), parcel geometry (exists) | Template auto-populates: adres perceel, kadastrale aanduiding, huidige bestemming, gewenste functiewijziging, oppervlakte. Links to gemeente's vooroverleg portal |
| **Dossier completeness with action links** | Other tools show you what's missing. Propdex knows WHERE to get it — Kadaster, EP-Online, gemeenteloket. That's unique. | MEDIUM | 20 document types (exists), BRK/EP-Online/WOZ integrations (exist) | Per-missing-document: show "Ophalen via [source]" with direct link or trigger button. e.g., missing energielabel → "Ophalen via EP-Online" button that fetches it |
| **Map-integrated pipeline view** | Color-code parcels on the main map by pipeline stage. No other NL tool shows "my pipeline" on a map | HIGH | MapLibre tiles (exists), score tile system (exists), FavoritedParcel model | Overlay: Gesignaleerd=blue, Onderzoek=amber, Contact=orange, Besluit=purple, Gekocht=green, Afgewezen=grey. Must be a separate tile layer or client-side GeoJSON overlay |
| **Go/no-go dashboard** | At "Besluit" stage, auto-generate a go/no-go summary: score, risico, eigendom, dossier completeness, aanbeveling | HIGH | Score v3.0 (exists), risico data (exists), dossier model (exists) | Single-page printable summary. Could be a variant of the existing PDF rapport. HIGH value for investor presentations |
| **Stage-based dossier requirements** | Different stages need different documents. In "Onderzoek" you need kadaster extract + bestemmingsplan. In "Besluit" you need bodemonderzoek + taxatierapport | MEDIUM | Document type system (exists), pipeline stages (new) | Show required docs per stage. Incomplete required docs = warning badge. This replaces a flat completeness %, gives context |

---

## Anti-Features

Scope traps or domain violations to explicitly avoid.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **Full CRM with contact management** | "We need to track who we talked to at which gemeente" | Turns Propdex into Salesforce. Huge scope, generic problem. Not a differentiator. | Store a single "contactpersoon" field per project (naam + email). Deep CRM is out of scope |
| **Automated email sending** (send brief to eigenaar) | Developers want one-click outreach | Legal risk (spam/GDPR), deliverability infrastructure, reply management. This is not a mail tool. | Generate template → copy/export. User sends via their own email. Never auto-send |
| **Financial feasibility modeling** | "Can we add a grondexploitatie berekening?" | Separate product domain. Requires market price data, construction cost APIs, tax modeling. Already in PROJECT.md out-of-scope | Link to external tools (CBRE, JLL, Excel). Later milestone |
| **Notificaties when owner changes** (Kadaster monitoring) | Triggered by BRK eigendom feature | Requires daily Kadaster polling per parcel. Expensive, rate-limited, legal unclear. | Existing ChangeRecord meldingen feed handles municipality-level changes. Kadaster monitoring is a separate paid tier feature |
| **Drag-and-drop Kanban board** | Visual pipeline management like Trello | Complex UI, poor fit for geographic data. Developers think spatially, not in Kanban boards. | Status dropdown per parcel card + map-based color coding is more natural for this domain |
| **Deal value / ROI tracking** | "Show me IRR on my portfolio" | Requires financial data Propdex doesn't have (purchase price, development costs, expected sales). No reliable source. | Defer to financial modeling milestone. For now: show WOZ value as proxy |
| **Buyer/investor pipeline** (sell finished units) | Confused request from PROJECT.md "out of scope" list | This is selling built units to end buyers — a completely different CRM type for a different persona. Propdex is acquisition-side only | Explicitly NOT building. State clearly in UI: "Dit is de acquisitiezijde" |
| **Automated Kadaster BRK batch fetch** for portfolio | "Show eigendom for all my favorited parcels at once" | BRK is Tier 3 (paid per call). Batch fetching for 50 parcels = expensive, no user trigger. | Keep BRK as on-demand (existing confirm dialog pattern). Show "eigendom onbekend" in portfolio view until user individually requests it |

---

## Feature Dependencies

```
Parcel Favoriting (new DB model)
    └──enables──> Geographic Portfolio Navigation
    └──enables──> Pipeline Status Assignment
    └──enables──> Multi-Parcel Project Grouping
                      └──enables──> Project Workspace
                                        └──enables──> Dossier Completeness Indicator
                                        └──enables──> Stage-based Document Requirements
                                        └──enables──> Outreach Template Generator
                                                          └──requires──> BRK eigendom data (EXISTS)
                                        └──enables──> Pre-overleg Gemeente Template
                                                          └──requires──> Bestemming data (EXISTS)
                                        └──enables──> Go/No-go Dashboard
                                                          └──requires──> Score v3.0 (EXISTS)
                                                          └──requires──> Risico data (EXISTS)

Map-integrated pipeline view
    └──requires──> Parcel Favoriting + Pipeline Status
    └──requires──> MapLibre tile/overlay system (EXISTS)

BRK eigendom data (EXISTS)
    └──enhances──> Outreach Template Generator

Score v3.0 (EXISTS) ──enhances──> Go/No-go Dashboard
```

### Dependency Notes

- **Parcel Favoriting must come first:** Everything in this milestone depends on a server-side model linking parcel_id to org_id with metadata (stage, notes). Cannot build the portfolio UI without this.
- **Multi-parcel grouping vs single-parcel view:** Both should exist. Most parcels will be managed individually; grouping is for complex multi-lot acquisitions. The Project model should be optional: a parcel can be in the pipeline without being in a named Project.
- **Outreach templates require BRK data but BRK is on-demand:** Template generator should work even without BRK — fall back to "eigenaar onbekend, vul in" fields. BRK data pre-fills it when available.
- **Map pipeline overlay conflicts with scan tile layer:** These cannot be active simultaneously cleanly. Map pipeline view likely needs to be a separate toggle mode or only visible on /projecten map view.

---

## Dutch Due Diligence Dossier Categories

Based on Dutch property development practice and the existing Propdex document type system.

### Stage-Required Documents

| Stage | Required Documents | Nice-to-Have |
|-------|-------------------|--------------|
| **Onderzoek** | Kadaster uittreksel, bestemmingsplankaart + regels, BAG basisregistratie | Eigendomshistorie, WOZ-beschikking |
| **Contact** | Eigendomsbewijs (BRK), energie-index (EP), taxatierapport globaal | Principeverzoek gemeente response, erfdienstbaarheden |
| **Besluit** | Bodemonderzoek fase 1, bouwkundige schouw, asbestinventarisatie (indien vóór 1993) | Constructierapport, omgevingsvergunning onderzoek |
| **Afgerond/Gekocht** | Koopovereenkomst, notariële akte, hypotheekakte | Bewijs overdrachtsbelasting |

### Action Links per Missing Document Type

| Document Type | Source | Action |
|--------------|--------|--------|
| Kadaster uittreksel | Kadaster.nl | Link: `https://www.kadaster.nl/producten/perceel/kadastrale-informatie` |
| BRK eigendomsdata | BRK Bevragen API | Trigger: Open eigendom modal (existing feature) |
| Energielabel | EP-Online | Trigger: Fetch via existing EP-Online integration |
| WOZ-waarde | Waardeloket | Trigger: Fetch via existing WOZ integration |
| Bodemonderzoek | Bodemloket / gecertificeerde bureaus | Link: `https://www.bodemloket.nl` |
| Bestemmingsplan | PDOK / DSO | Trigger: Open scan / show in map |
| Principeverzoek response | Gemeente loket | Info: "Dien in via gemeenteloket, upload response hier" |

---

## MVP Definition

### Phase 1 — Core Portfolio (must have)

- [x] `FavoritedParcel` DB model (org_id, parcel_id, gemeente_code, wijk_code, stage, created_at)
- [x] Heart/favorite button in ParcelDetailPanel → saves to DB, not localStorage
- [x] /projecten route: provincie → gemeente → wijk → favorited parcel cards
- [x] Pipeline stage selector per parcel card (Gesignaleerd → Onderzoek → Contact → Besluit → Afgerond)
- [x] Parcel project workspace: dedicated full-page or slide-over per parcel with dossier + status + notes

### Phase 2 — Dossier Intelligence (high value, more complex)

- [x] Dossier completeness indicator (% complete + missing items list with action links)
- [x] Stage-based document requirements (show which docs are required at current stage)
- [x] Multi-parcel project grouping (optional named `Project` linking multiple parcels)
- [x] Outreach templates: brief naar eigenaar + pre-overleg gemeente template

### Phase 3 — Advanced Pipeline (differentiators, can defer)

- [ ] Map-integrated pipeline overlay (pipeline stage colors on main map) — HIGH complexity
- [ ] Go/no-go dashboard (auto-generated summary at Besluit stage) — HIGH complexity
- [ ] Claude AI-personalized outreach letter — P2, needs testing

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Parcel favoriting (server-side) | HIGH | LOW | P1 |
| Geographic portfolio navigation | HIGH | MEDIUM | P1 |
| Pipeline status per parcel | HIGH | LOW | P1 |
| Parcel project workspace | HIGH | HIGH | P1 |
| Dossier completeness indicator | HIGH | MEDIUM | P1 |
| Multi-parcel project grouping | MEDIUM | MEDIUM | P2 |
| Outreach template: brief eigenaar | HIGH | MEDIUM | P2 |
| Outreach template: principeverzoek | MEDIUM | MEDIUM | P2 |
| Stage-based document requirements | MEDIUM | LOW | P2 |
| Map pipeline overlay | MEDIUM | HIGH | P3 |
| Go/no-go dashboard | HIGH | HIGH | P3 |
| AI-personalized outreach | MEDIUM | HIGH | P3 |

---

## Competitor Feature Analysis

| Feature | Transect (US) | Spartner (NL) | Dealpath (US) | Our Approach |
|---------|---------------|---------------|---------------|--------------|
| Pipeline stages | Yes, generic | Unknown | Yes, CRE-focused | 5 NL-specific stages matching Dutch acquisition flow |
| Geographic portfolio view | Yes (map-first) | Unknown | No (table-first) | Map-first + card drill-down matching existing Propdex nav |
| Dossier completeness | No | Unknown | Yes | Yes + action links to Dutch gov sources (unique) |
| Outreach templates | No | Unknown | No | Yes, pre-filled with BRK eigenaar data (unique) |
| Document management | Basic | Unknown | Advanced VDR | Already have 20 document types — extend, not replace |
| Multi-parcel grouping | No | Unknown | Yes | Yes — project model for adjacent lots |
| Go/no-go decision support | Partial (zoning) | Unknown | No | Yes — leverages score v3.0 + risico data |

**Confidence note:** Spartner.nl information not publicly detailed — LOW confidence on their features. Transect/Dealpath are US-focused CRE platforms with publicly documented features — MEDIUM confidence on comparison.

---

## Sources

- [CMS.law: Acquisition of Real Estate in the Netherlands](https://cms.law/en/nld/publication/how-to-invest-in-commercial-real-estate-in-the-netherlands/acquisition-of-real-estate) — Dutch acquisition pipeline (LOI → due diligence → SPA → notarispassering)
- [Adventures in CRE: Development Due Diligence Checklist](https://www.adventuresincre.com/real-estate-development-due-diligence-checklist/) — 105 due diligence tasks, 10 categories, status tracking
- [Vastgoedjournaal: Acquisitieplanning](https://vastgoedjournaal.nl/news/53347/acquisitieplanning-de-start-van-vastgoedmanagement) — Dutch 4-phase pipeline: Lead → Soft Pipeline → Committed → Under Construction
- [Infonu.nl: Fasen van de Vastgoedontwikkeling](https://financieel.infonu.nl/diversen/74895-fasen-van-de-vastgoedontwikkeling.html) — 6 development phases (initiatief → haalbaarheid → planontwikkeling → realisatie → beheer)
- [IPLO: Procedure omgevingsvergunning](https://iplo.nl/regelgeving/overzicht-procedures/procedure-aanvraag-omgevingsvergunning-regulier/) — formal permit procedure
- [Planruimte: Vooroverleg gemeente / principeverzoek](https://www.planruimte.nl/vooroverleg/) — pre-consultation with municipality: informal step before permit application
- [De Omgevingsadviseurs: Principeverzoek of vooroverleg indienen?](https://www.deomgevingsadviseurs.nl/diensten/omgevingsadvies/principeverzoek) — principeverzoek process and content
- [Lawyersnetherlands.com: Real estate due diligence in the Netherlands](https://lawyersnetherlands.com/real-estate-due-diligence-in-the-netherlands/) — Netherlands-specific due diligence: legal, tax, environmental, technical, commercial
- [REsimpli: Best Pipeline Stages for Real Estate Investors](https://resimpli.com/blog/the-best-pipeline-stages-for-real-estate-investors-using-a-crm/) — generic pipeline stage patterns for property investors
- [PropFolio](https://propfolio.tech) — AI operating system for CRE investment management (competitor reference)

---

*Feature research for: v17.0 Projecten Portfolio — property portfolio management + deal pipeline for Dutch vastgoedontwikkelaars*
*Researched: 2026-03-15*

# Pitfalls Research

**Domain:** Portfolio management + deal pipeline + outreach automation added to existing property intelligence platform (v17.0 Projecten Portfolio)
**Researched:** 2026-03-15
**Confidence:** HIGH — all pitfalls verified against actual codebase models, schemas, existing frontend code, and AVG/GDPR framework constraints

---

## Critical Pitfalls

### Pitfall 1: Conflating "Project as folder" with "Project as deal" — using the same model for both

**What goes wrong:**
The existing `Project` model (`backend/app/models/project.py`) is a report-folder organizer. It has `name`, `description`, `parent_id` (for gemeente→wijk hierarchy), `gemeente_code`, `wijk_naam`, and `is_monitored`. The v17 milestone introduces a "deal workspace" concept per parcel with pipeline stages, dossier completeness, outreach tracking, and notes. The tempting shortcut is to extend the `Project` model with pipeline fields (`status`, `pipeline_stage`, `parcel_id`, etc.) since it already exists and has org isolation.

This path leads to a model that is simultaneously a gemeente monitoring folder AND a deal workspace. The self-referential `parent_id` hierarchy (`gemeente → wijk → project`) breaks when projects also represent parcel-level deals. Every query that lists "top-level projects" (`parent_id IS NULL`) now has to distinguish folder-type from deal-type. The `ProjectList.tsx` component (1867 lines) already does `topLevelProjects = allProjects.filter(p => p.parent_id === null)` — adding deal-type projects to this result set corrupts the portfolio navigation view.

**Why it happens:**
The `Project` model is nearby, has `organization_id`, `TenantMixin`, and relationships to `AreaScan` already. Adding a `project_type` discriminator column feels cheaper than a migration for a new table. This is the classic "add one more column" trap.

**How to avoid:**
Introduce a separate `ParcelProject` model (or `Deal` model) with its own table. Fields: `id`, `organization_id`, `parcel_id` (String, Kadaster key), `parcel_cache_id` (FK to parcel_cache.id), `pipeline_stage`, `notes`, `created_by_user_id`, `created_at`, `updated_at`. This model does NOT extend `Project` and does NOT participate in the parent/child folder hierarchy. The `Project` model remains a gemeente/wijk monitoring folder. The new model is a deal workspace attached to a specific parcel.

Keep the two concepts visually unified in the frontend (both live under `/projecten`) but backed by separate API endpoints and models.

**Warning signs:**
- Migration adding `pipeline_stage`, `parcel_id`, or `project_type` to the `projects` table
- A query that filters `WHERE project_type = 'deal'` or `WHERE project_type = 'folder'`
- `ProjectList.tsx` receiving deal-type objects mixed with gemeente folder objects

**Phase to address:**
The phase that introduces "favorite a parcel → create workspace" should define the new model. Enforce the separation in the schema design review before writing any migration.

---

### Pitfall 2: Favorites stored only in localStorage — losing them on new device, incognito, or multiple-user org

**What goes wrong:**
`ProjectList.tsx` already uses `localStorage` keys `propdex:favorite-gemeenten` and `propdex:recent-gemeenten` (lines 93–95). The v17 milestone plans parcel-level favorites ("heart button → save parcel to its wijk"). If parcel favorites follow the same localStorage pattern, users lose their entire favorites list when they:
- Switch to a different browser or device
- Clear browser storage (privacy-conscious users, IT policy)
- Work in a multi-user org where two analysts research the same area

The specific failure mode: user favorites 30 parcels across 5 wijken during a field research day, returns to the office on a different machine, all favorites are gone. They re-favorite some from memory, losing the rest permanently.

**Why it happens:**
localStorage is zero-infrastructure, instant, and already the pattern in the codebase for gemeente favorites. It's the fastest path for MVP. The cost is invisible until a real user loses data.

**How to avoid:**
Server-side favorites from day one for parcel-level favorites (they are the core portfolio data). Use a `ParcelFavorite` table: `id`, `organization_id`, `user_id`, `parcel_id` (String — Kadaster key), `parcel_cache_id` (FK — nullable, populated when parcel is in cache), `wijk_naam`, `gemeente_code`, `favorited_at`. Use a `UNIQUE(organization_id, user_id, parcel_id)` constraint to prevent duplicates.

Gemeente-level favorites can stay in localStorage (they're a navigation preference, not business data). Parcel favorites are business data and must be server-side.

Migration strategy: the parcel favorites feature is NEW — there is no existing localStorage parcel data to migrate. No migration needed. Simply build server-side from the start.

**Warning signs:**
- `localStorage.setItem('propdex:favorite-parcels', ...)` in any new code
- A `useFavoritesParcels` hook that reads/writes only localStorage
- No migration in `backend/alembic/versions/` for a `parcel_favorites` table

**Phase to address:**
The phase introducing the heart/favorite button on the parcel detail panel.

---

### Pitfall 3: Kadaster `parcel_id` is a string key, not a UUID — join semantics differ from all other FK patterns

**What goes wrong:**
Every other model in the system uses UUID primary keys. `ParcelCache` has a UUID `id` column AND a separate string `parcel_id` column (e.g., `"HTT02-A-1234"` — the Kadaster identifier). New models that reference parcels (favorites, deals, pipeline entries) will be built by developers who see `UUID` everywhere and instinctively use `ForeignKey("parcel_cache.id")`. This works until a parcel is re-scanned and a new `ParcelCache` row is created (which can happen when a wijk is re-scanned — the `ON CONFLICT DO NOTHING` pattern means a new row may exist with a different UUID but the same `parcel_id` string).

More critically: `parcel_id` (the string) is the stable Kadaster identifier. `parcel_cache.id` (UUID) is an internal database row identifier that can be regenerated. The `ScanResult` model uses `parcel_id: Mapped[uuid.UUID]` pointing to `parcel_cache.id` — which is correct for scan results. But for "I favorited parcel HTT02-A-1234", the stable key is the Kadaster string, not the database UUID.

**Why it happens:**
SQLAlchemy FK patterns in the codebase all use UUIDs. New developers follow the existing pattern without reading the comment on `ParcelCache.parcel_id` that says "Kadaster parcel identifier".

**How to avoid:**
For all new portfolio/favorites models: store BOTH fields.
- `parcel_id: String(50)` — the stable Kadaster key (for querying, display, BRK lookups)
- `parcel_cache_id: UUID | None` — FK to `parcel_cache.id`, NULLABLE (parcel may not be in cache yet)

Use the Kadaster string as the lookup key for display. Use the cache FK only when joining to scan data. Add a compound index on `(organization_id, parcel_id)` for lookup performance.

**Warning signs:**
- New model with `ForeignKey("parcel_cache.id", ondelete="CASCADE")` as the ONLY parcel reference
- A favorite or deal that disappears when parcel_cache is re-created
- Frontend parcel IDs coming from the map click handler (these are the Kadaster strings from tile metadata, not UUIDs)

**Phase to address:**
Schema design phase for both favorites and deal workspace models. Enforce in code review: any new model touching a parcel must carry the Kadaster string.

---

### Pitfall 4: Pipeline state machine without guards — illegal transitions cause data integrity issues

**What goes wrong:**
The pipeline spec is: `Gesignaleerd → Onderzoek → Contact → Besluit → Afgerond`. Without transition guards on the backend, the frontend can POST any stage value directly and skip stages. A deal jumps from `Gesignaleerd` to `Afgerond` in one click. This is hard to audit later ("when did we make contact?") and corrupts reporting ("how many deals are in Onderzoek?").

Additionally, without a transition history table, there is no audit trail. If a deal regresses from `Besluit` back to `Contact` (owner stopped responding), there is no record of when that happened or why. The current timestamp on `updated_at` only captures the last change.

**Why it happens:**
"We can add validation later" is the typical deferral. The PATCH endpoint becomes `{ pipeline_stage: "any_string" }` with no validation, and fixing it after data is dirty requires a migration + data repair.

**How to avoid:**
1. Define stage as an Enum in the Python model: `class PipelineStage(str, Enum)` — Pydantic will reject invalid values automatically.
2. Add a `pipeline_stage_transitions` table: `(deal_id, from_stage, to_stage, changed_by_user_id, changed_at, note)`. Immutable audit log. One INSERT per transition.
3. Keep allowed transitions list in the backend service, not just the frontend: `ALLOWED_TRANSITIONS = { "gesignaleerd": ["onderzoek"], "onderzoek": ["contact", "gesignaleerd"], ...}`. Return 422 if the requested transition is not in the allowed list.

This is not over-engineering. Real estate deals are legally sensitive and users need to know when "Contact" started for timing purposes (municipality pre-consultations have deadlines).

**Warning signs:**
- PATCH endpoint accepting arbitrary `pipeline_stage` string with only Pydantic `str` type
- No `pipeline_transitions` table or equivalent audit log in the schema
- Frontend directly setting `pipeline_stage` without calling a dedicated transition endpoint

**Phase to address:**
The phase introducing the pipeline stage feature. The transition table should be in the same migration as the pipeline_stage column.

---

### Pitfall 5: Outreach templates generate emails containing BRK eigendomsdata — AVG/GDPR violation

**What goes wrong:**
The v17 milestone includes "automated outreach templates: brief naar eigenaar". The BRK eigendomsdata (owner name, address, KvK number) is fetched ephemerally and never stored (Tier 3 data). If outreach templates are populated with BRK data and stored as "sent outreach" records, the platform begins storing personal data (owner names, addresses) from Kadaster in its database.

This violates the explicit design decision in `ParcelCache` ("Tier 3: BRK eigendomsdata = NEVER stored here") and requires a new AVG/GDPR legal basis justification. The Kadaster BRK API terms of service specify that data must not be stored beyond the session needed for the specific legitimate purpose query.

Additionally, if an outreach email is generated with an owner's home address and sent, this constitutes direct marketing to a natural person, which requires an opt-in basis under AVG Article 6 and may require a verzenddatum in a register (Article 30 processing activities). Sending letters to homeowners without a documented legal basis is a fine risk.

**Why it happens:**
"The template needs the owner's name to be personal, let's pre-fill it from the BRK modal that's already open." The UX is elegant in the moment. The compliance cost is invisible until an AVG audit.

**How to avoid:**
1. Templates must NOT store or log the owner's name/address from BRK data. The template placeholders remain unfilled in the stored record: `"Geachte {naam_eigenaar},"` — the user fills them manually before sending.
2. If the platform sends emails on behalf of the user (not just generates a Word document), add a prominent disclaimer: "U bent zelf verantwoordelijk voor de AVG-grondslag van deze correspondentie."
3. For `rechtspersoon` (companies/BVs), storing the company name and KvK number is fine (company data, not personal data). For `natuurlijk_persoon`, never store the name.
4. The "sent outreach" log should store: `(parcel_id, sent_at, sent_by_user_id, template_type, recipient_type: 'rechtspersoon' | 'overheid' | 'niet-opgeslagen')` — never the actual recipient name/address for natural persons.

**Warning signs:**
- A `ParcelOutreach` model with `recipient_naam`, `recipient_adres` columns as String
- An outreach template that fetches BRK data and stores the rendered template text
- Backend storing any response from `/api/scans/parcels/{id}/eigendom` beyond the HTTP response cycle

**Phase to address:**
The outreach templates phase. Define the data retention policy before building the template engine.

---

### Pitfall 6: Multi-parcel grouping creates N+1 query explosion for portfolio views

**What goes wrong:**
The portfolio view needs to show: provincie → gemeente → wijk → favorited parcels. For each parcel card, it needs: parcel metadata (from `parcel_cache`), scan score (from `scan_results`), document count (from `parcel_documents`), pipeline stage (from the new deal model), and possibly the latest enrichment flag (from `scan_results.flags`). If each parcel card fetches these independently, a wijk with 50 favorited parcels fires 250 backend requests.

In `ProjectList.tsx`, the current pattern already fetches scan history separately (`useScanHistory`) and joins it client-side with gemeente data. That pattern scales to 10-20 items. At 50+ favorited parcels across multiple wijken, the client-side join approach breaks.

**Why it happens:**
TanStack Query makes it easy to fire independent queries per item. `useQuery(parcel_details_${id})` per parcel card seems clean (independent caching, individual loading states) until scale reveals the problem.

**How to avoid:**
Build a dedicated portfolio list endpoint that returns all data needed for a wijk's parcel cards in a single query:

```
GET /api/portfolio/wijken/{wijk_code}/parcels
Response: [{
  parcel_id, address, score, document_count, pipeline_stage, favorited_at, flags_summary
}]
```

This endpoint does a single JOIN across `parcel_favorites`, `parcel_cache`, `scan_results`, `parcel_documents` (COUNT), and the new deal model. Returns everything the card needs. One HTTP request per wijk.

**Warning signs:**
- `useQuery(parcelDetails_${parcel_id})` fired inside a `.map()` over a list of favorites
- The portfolio wijk view taking 3+ seconds to load with 20 favorites
- Backend logs showing 50+ identical queries per page load

**Phase to address:**
The portfolio list view phase. The bulk endpoint must be designed before the frontend component is built, not added as a fix-up later.

---

### Pitfall 7: ProjectList.tsx at 1867 lines — adding portfolio features causes unmaintainable spaghetti

**What goes wrong:**
`ProjectList.tsx` currently handles: provincie/gemeente/wijk drill-down navigation, scan history integration, CBS data display, gemeente monitoring subscriptions, SVG boundary rendering, change timelines, and localStorage favorites for gemeenten. Adding parcel favorites, deal pipeline, workspace expansion, and outreach into the same component produces a 3000+ line file where state changes in the favorites section inadvertently re-render the entire gemeente tree.

The existing component already has deeply nested conditional rendering for `selectedGemeenteId`, `selectedWijkId`, `selectedProvinceCode`. Adding a fourth level (`selectedParcelId`) without extracting sub-components causes a combinatorial explosion of render conditions.

**Why it happens:**
"The component already does similar things, I'll add a section." The spaghetti grows one feature at a time. Each addition seems small in isolation.

**How to avoid:**
Before adding any v17 features, extract the `ProjectList.tsx` into a routing hierarchy:
- `ProjectenPage.tsx` — top-level shell, loads portfolio data, owns URL state
- `ProvincieView.tsx` — province-level cards
- `GemeenteView.tsx` — already extracted as `GemeenteDetailView.tsx` (reuse)
- `WijkView.tsx` — already extracted as `WijkDetailView.tsx` (reuse)
- `ParcelPortfolioView.tsx` — NEW: list of favorited parcels per wijk with deal cards

Each view component receives its data as props, does not read URL params directly (the parent reads URL, passes data). This makes each piece independently testable.

The refactoring effort is 2-4 hours and prevents a full rewrite 3 phases later.

**Warning signs:**
- Adding v17 features directly into `ProjectList.tsx` without extraction
- `ProjectList.tsx` line count exceeds 2000
- `useState` count in `ProjectList.tsx` exceeds 12

**Phase to address:**
The first v17 phase (whatever introduces the portfolio navigation). Refactor first, then add features.

---

### Pitfall 8: Email/SMTP setup for outreach — reputation, deliverability, and spam classification

**What goes wrong:**
If the platform generates and sends outreach emails directly (as opposed to just generating Word/PDF letter templates), it enters a minefield:
- Emails to property owners without prior consent are classified as unsolicited commercial email under the Dutch Telecommunicatiewet Article 11.7 if sent to individuals
- A shared SMTP server (e.g., SendGrid trial, basic SES) sending 100 outreach emails per day across multiple organizations gets the sending domain blacklisted within weeks if any recipient marks as spam
- Without proper SPF/DKIM/DMARC records on the sending domain, major Dutch ISPs (KPN, Ziggo) will reject or spam-folder the emails
- No bounce handling means repeated sends to invalid addresses, worsening reputation

**Why it happens:**
"Let's just add email sending via SendGrid, it's 3 lines of code." The infrastructure complexity is underestimated. This is the #1 reason outreach features in PropTech products are abandoned.

**How to avoid:**
For v17 MVP: generate letter templates as downloadable DOCX/PDF only. Do NOT build email sending. The user prints or emails the letter themselves. This is safer, AVG-compliant (user controls the send), and eliminates infrastructure complexity.

If email sending is required in a future phase: use a dedicated subdomain (`brief@mail.propdex.nl`), configure SPF/DKIM/DMARC, use a transactional email provider with bounce/complaint webhooks (Postmark or AWS SES), and build hard-bounce suppression lists per organization. This is a 2-4 week engineering effort that should be its own milestone.

**Warning signs:**
- Adding `smtplib` or `aiosmtplib` to backend dependencies
- SendGrid or Mailgun API key appearing in `backend/.env`
- An outreach endpoint that POSTs directly to an email API

**Phase to address:**
Outreach templates phase. Gate the MVP at "generate template" and explicitly defer "send email" to a future milestone with proper infrastructure planning.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store parcel favorites in localStorage | Zero backend work | Lost on new device, lost in multi-user org, corrupt on storage clear | Never for parcel-level business data |
| Add `pipeline_stage` to existing `Project` model | No new table/migration | Folder projects mixed with deal projects, corrupts ProjectList filtering | Never |
| Accept arbitrary string for `pipeline_stage` in PATCH endpoint | Fast to build | Dirty data, no audit trail, impossible to report on | Never |
| Skip transition audit log | Faster MVP | No "when did contact start?" data, can't reconstruct deal history | Never for deals with legal significance |
| Generate outreach emails server-side in MVP | "Complete" feature | AVG exposure, deliverability infrastructure debt, spam complaints | Never in MVP — defer to dedicated milestone |
| Client-side join of favorites + scan scores | Simple frontend code | N+1 fetches at scale, slow portfolio view with 50+ parcels | Only with < 10 items max and explicit scale cap |
| Extend `ParcelDocument.document_type` enum inline | No schema change | Proliferating document types without UX structure | Acceptable for first 3 new types only |
| Use `parcel_cache.id` (UUID) as stable parcel reference | Consistent with other FKs | Breaks when parcel cache is regenerated | Never for portfolio/favorites data — use Kadaster string |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| BRK eigendomsdata in outreach templates | Storing rendered template with owner name from BRK response | Templates use placeholders; BRK data is display-only in the browser, never written to DB |
| ParcelDocument for workspace dossier | Creating new document type keys per phase without updating `VALID_DOCUMENT_TYPES` in `documents/router.py` | Add new keys to the set in the router; document type keys must be validated server-side |
| TanStack Query for portfolio items | Using `useQuery` inside `.map()` per parcel card | Batch endpoint returning all parcel data per wijk in one request |
| ScanResult unique constraint | `UNIQUE(organization_id, parcel_id)` means one ScanResult per parcel per org — portfolio features that need per-scan history for a parcel must query `area_scans` directly | Join through `area_scans` for historical scan data, not by creating new ScanResult rows |
| pipeline_stage Enum in Pydantic | Pydantic v2 `str(Enum)` serializes as `"PipelineStage.gesignaleerd"` not `"gesignaleerd"` | Use `use_enum_values=True` in the model config, or define stage as `Literal["gesignaleerd", ...]` |
| AVG / GDPR for `rechtspersoon` vs `natuurlijk_persoon` | Treating all owner types identically in data retention | `rechtspersoon` (BV, NV, stichting) data is company data, can be stored with proper purpose. `natuurlijk_persoon` data cannot be stored — requires per-case legitimate interest documentation |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Portfolio view queries all ParcelCache for a gemeente to find favorites | 2+ second load times for gemeenten with 5000+ parcels | Favorites table stores the Kadaster parcel_id string; look up only favorited parcels by ID list | > 500 parcels in cache for any gemeente |
| Pipeline stage history table grows unbounded | Slow stage queries as deal history accumulates | Index on `(deal_id, changed_at DESC)`, keep history append-only, archive old deals after 2 years | > 10K deals active simultaneously (unlikely near-term) |
| Document count query per parcel in portfolio list | N queries for N favorites | Include `document_count` in the portfolio list endpoint subquery (COUNT with GROUP BY) | > 20 favorited parcels in a single wijk view |
| MapLibre layer for "favorited parcels" rendering all org favorites | Tile payload bloats for orgs with 100+ favorites | Favorites overlay should only render for currently visible wijk, not all favorites globally | > 50 favorites globally |
| Wijk-level portfolio endpoint returns all historical scan data | Response payload 500KB+ | Limit to most recent completed scan per parcel; flags_summary should be a trimmed subset | Per-parcel flags JSONB averages 8KB |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing any BRK eigendomsdata (owner name, address) in ParcelFavorite or ParcelProject notes | AVG violation, Kadaster API ToS breach, potential fine | All new models must have zero BRK fields; add a comment in the model file explicitly prohibiting this |
| Pipeline deal accessible to other organizations via direct UUID guessing | Cross-org data leak | Every deal endpoint must filter by `organization_id`; return 404 not 403 for cross-org IDs |
| Outreach log storing recipient details for natural persons | AVG Article 9 special category risk if health/financial data implied | Log recipient_type only (`rechtspersoon` or `not_logged`), never name/address |
| `parcel_id` string used in URL path without validation | Path traversal / injection via crafted parcel_id strings | Validate parcel_id matches the Kadaster pattern `^[A-Z]{3}[0-9]{2}-[A-Z]-[0-9]+$` before use in queries |
| Multi-parcel deal grouping without org check on each parcel | An attacker adds a parcel from another org to their deal | Each parcel in a multi-parcel deal must be validated as belonging to the requesting org (present in their `parcel_cache`) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Heart/favorite button requires a scan to exist for that parcel | User finds a parcel via address search, wants to favorite it, can't because no scan_result exists | Allow favoriting any parcel by Kadaster ID; create a minimal `ParcelFavorite` record without requiring scan data |
| Pipeline stage shown as English enum values ("gesignaleerd", "onderzoek") | Dutch real estate professionals expect Dutch professional terminology | Map stage keys to display labels: `gesignaleerd` → "Gesignaleerd", `onderzoek` → "In onderzoek", `besluit` → "Besluit fase" |
| Deleting a deal workspace deletes all uploaded documents | Users lose due diligence documents they worked to collect | Soft-delete deals; documents should survive for 30 days post-deletion with a recovery option |
| Portfolio navigation requires navigating through provincie → gemeente → wijk even for known parcels | 4 clicks to reach a parcel you work with daily | Add a "recent / pinned parcels" section at the top of the portfolio page (top 5, localStorage is fine here) |
| Dossier completeness shown as a single percentage without breakdown | "67% complete" means nothing — which documents are missing? | Show completeness as a checklist: each document type as a row with uploaded/missing status |
| Outreach template forces a specific letter format | Dutch municipalities and owners expect different tones for pre-overleg vs. eigenaar contact | Provide two distinct template categories: "Brief aan eigenaar" (formal, private tone) and "Pre-overleg gemeente" (professional, planning language) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Parcel favorites:** Verify that favoriting a parcel without a scan_result (found via address search only) works — the favorite creates a `parcel_favorites` row even if `parcel_cache_id` is NULL
- [ ] **Pipeline stage transitions:** Verify that PATCH `/deals/{id}/stage` rejects invalid transitions (e.g., `gesignaleerd` → `afgerond` directly) with 422, not 200
- [ ] **Multi-tenant isolation:** Verify that `GET /portfolio/wijken/{wijk_code}/parcels` filters by `organization_id`, not just wijk code — two orgs scanning the same wijk get independent portfolio views
- [ ] **Document count in portfolio:** Verify COUNT query uses `organization_id` filter on `parcel_documents` table — org A cannot see org B's document counts
- [ ] **BRK data isolation:** Verify that no BRK fields appear in any new migration or model — grep for `eigenaar`, `kvk`, `naam` in new schema files
- [ ] **ProjectList.tsx refactor:** Verify that the existing gemeente monitoring view still works after component extraction — the `useProjectChanges`, `useUnreadCounts` hooks must still be wired correctly
- [ ] **ParcelDocument integration:** Verify that the new workspace document tab shows documents uploaded via the existing `/api/documents` endpoint, not a duplicate endpoint
- [ ] **Pipeline stage history:** Verify at least one transition is recorded in the audit log when a deal stage changes — check the audit table directly, not just the deal's current stage
- [ ] **Outreach template:** Verify that the generated template does NOT include the owner's name for `natuurlijk_persoon` owners — it must show `{naam_eigenaar}` as a literal placeholder
- [ ] **Deal deletion cascade:** Verify that deleting a deal does NOT cascade-delete `parcel_documents` for that parcel — documents belong to the parcel, not the deal

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Pipeline stage column added to existing Project model | HIGH | Write a migration to copy pipeline_stage to a new Deal table, null it out in Project, update all API endpoints and frontend hooks — 1-2 days |
| Parcel favorites in localStorage, data lost by users | MEDIUM | Build server-side favorites table, add import endpoint that reads localStorage on first login and migrates to server — 1 day backend + frontend |
| BRK data stored in ParcelProject notes | HIGH | Audit log of all notes, scrub BRK data via regex (name patterns, addresses), notify Kadaster per their breach protocol — potential GDPR fine if reported |
| N+1 fetches in portfolio view | MEDIUM | Add bulk portfolio endpoint, update frontend to use it — 4-8 hours backend + frontend |
| Email sending domain blacklisted | HIGH | New sending domain setup (weeks), contact ISP postmasters for delisting, rebuild reputation — weeks of work |
| ProjectList.tsx too complex to add features | MEDIUM | Extract to sub-components before adding new features — easier now than after another 500 lines are added |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Project model conflation (folder vs deal) | Phase introducing deal workspace / favorites | Verify no pipeline fields on `projects` table; verify new `parcel_projects` or `deals` table exists |
| localStorage parcel favorites | Phase introducing heart button | Verify `parcel_favorites` table in migration; verify no `localStorage.setItem` for parcel favorites |
| Kadaster parcel_id string vs UUID | Phase introducing any model that references parcels | Verify new models store Kadaster string as primary parcel reference; FK to parcel_cache is optional |
| Pipeline state machine without guards | Phase introducing pipeline stage | Verify stage as Enum; verify transition audit table; verify 422 on invalid transitions |
| BRK data in outreach templates | Phase introducing outreach templates | Grep new models for BRK field names; verify template stores placeholders not values |
| N+1 portfolio query | Phase introducing portfolio wijk parcel list | Load wijk with 30+ favorited parcels; verify single batch API call in network tab |
| ProjectList.tsx spaghetti | First phase of v17 (before any feature work) | Verify component split; ProjectList.tsx under 400 lines after refactor |
| Email outreach infrastructure | Any phase — blocked until dedicated email milestone | Verify no SMTP dependencies in backend; outreach phase delivers DOCX/PDF only |

---

## Sources

- Existing codebase: `backend/app/models/project.py`, `backend/app/schemas/project.py`, `backend/app/projects/router.py` — confirmed folder/report semantics
- Existing codebase: `backend/app/models/parcel_cache.py` — confirmed dual-ID pattern (UUID internal + Kadaster string)
- Existing codebase: `backend/app/models/parcel_document.py` — confirmed org_id + parcel_id (Kadaster string) pattern for parcel-attached data
- Existing codebase: `frontend/src/components/projects/ProjectList.tsx` lines 93-213 — confirmed localStorage gemeente favorites pattern
- Existing codebase: `frontend/src/lib/types/brk.ts` — "CRITICAL: BRK eigendomsdata MUST NEVER be cached or stored" comment
- Existing codebase: `backend/app/models/scan_result.py` — UNIQUE(organization_id, parcel_id) constraint implications
- Dutch Telecommunicatiewet Art. 11.7 — unsolicited electronic marketing requirements
- AVG Article 6 — lawful basis for processing personal data (relevant to natural person owner outreach)
- AVG Article 30 — register of processing activities (relevant to outreach logging)
- Kadaster BRK Bevragen API terms — data must not be stored beyond session legitimate interest purpose
- MEMORY.md: "BRK eigendom is ephemeral (no caching) — workspace must handle this"
- MEMORY.md: "Parcel IDs come from Kadaster (string, not UUID) — join semantics differ from typical FK patterns"
- MEMORY.md: "ProjectList.tsx is 1867 lines — needs careful refactoring, not a rewrite"

---
*Pitfalls research for: v17.0 Projecten Portfolio — portfolio management, deal pipeline, outreach automation*
*Researched: 2026-03-15*

# Gemeente Intelligence — Databronnen Research

> Research uitgevoerd 2026-03-17. Basis voor gemeente panel datamodel.

## Bronnen per integratiestatus

### LIVE (al geïntegreerd)

| Bron | API | Dekking | Backend file |
|------|-----|---------|-------------|
| CBS Demografie | CBS OData v4 | 100% | `cbs_odata.py`, `cbs_crime.py` |
| Jurisprudentie | Rechtspraak.nl | ~90% | `jurisprudence_analysis.py` |
| Rijksmonumenten | RCE REST + SPARQL | 100% | `rce_monuments.py`, `rce_linked_data.py` |
| Energielabels | EP-Online | 100% | `ep_online.py` |
| Bekendmakingen | SRU + monitoring | per project | `sru_bekendmakingen.py` |

### STUB (API beschikbaar, integratie mogelijk)

| Bron | API Endpoint | Auth | Dekking | Key velden |
|------|-------------|------|---------|------------|
| **Open Raadsinformatie** | `api.openraadsinformatie.nl/v1/elastic/` | Geen | 77% (265/342) | titel, type, datum, status, tekst, gemeente |
| **Verordeningen (CVDR)** | `lokaleregelgeving.overheid.nl` | Geen | 100% | naam, type, datum, artikelen |
| **STTR Toepasbare Regels** | `service.omgevingswet.overheid.nl/publiek/toepasbare-regels/api/` | API key (DSO portal) | ~60% | activiteit, vergunningsplicht, voorwaarden |
| **RVO Subsidies** | `rvo.nl/api/v1/opendata/subsidies` | Geen | Nationaal | naam, status, (geen per-gemeente filter) |
| **Zuid-Holland Subsidies** | `subsidieregister.zuid-holland.nl/api/` | Geen | Alleen ZH | naam, bedrag, ontvanger, project |
| **Gemeentelijke subsidies** | data.overheid.nl CKAN | Geen | 150+ gem. | Wisselend per gemeente |
| **Beschermde stadsgezichten** | RCE WMS | Geen | 100% | naam, type, datum_aanwijzing |

### PLACEHOLDER (geen machine-readable bron)

| Bron | Huidige status | Toekomst |
|------|---------------|----------|
| **Welstandsnota** | ~20% gedigitaliseerd, PDF + kaart | AI PDF parsing, gemeente scraping |
| **Parkeernormen** | CROW referentie + gemeente PDFs | AI extraction uit Nota Parkeernormen |
| **Omgevingsvisie** | Verplicht gepubliceerd, alleen PDF | AI samenvatting uit PDF |
| **Woonvisie** | Per gemeente PDF | AI extraction woningbouwdoelen |
| **Gemeentelijk erfgoed** | Per gemeente register, geen centrale API | Scraping per gemeente |
| **Verduurzamingsverordening** | Versnipperd in lokale regelgeving | CVDR text mining |

## Relevante subsidie-programma's voor vastgoedontwikkeling

| Programma | Scope | Bedrag | Relevant voor |
|-----------|-------|--------|---------------|
| **SFT** (Stimuleringsregeling Flex- en Transformatiewoningen) | Nationaal | €14.000/woning | Optoppen, splitsen, transformatie |
| **Realisatiestimulans** | Nationaal | €7.000/betaalbare woning | Nieuwbouw, transformatie |
| **Woningbouwimpuls** | Nationaal | €1 mrd totaal | Betaalbare woningbouw |
| **Volkshuisvestingsfonds** | Nationaal | Per aanvraag | Splitsen, optoppen, verduurzaming |
| **ISDE** | Nationaal | ~€500M/jaar | Verduurzaming bestaande bouw |

## Raadsinformatie — relevante zoektermen

Voor vastgoedontwikkelaars meest relevante document types + keywords:
- **Woonvisie** — woningbouwdoelstellingen, doelgroepen
- **Grondbeleid** — voorkeursrecht, grondexploitatie, anti-speculatie
- **Bestemmingsplanwijziging** — herbestemming, verdichting
- **Woningbouwprogramma** — aantallen, mix sociaal/vrije sector
- **Prestatieafspraken** — afspraken gemeente-corporaties-ontwikkelaars
- **Moties** — speculatie, betaalbaarheid, verduurzaming

## Datamodel

Volledig TypeScript datamodel: `frontend/src/lib/types/gemeente-intelligence.ts`

12 secties in `GemeenteIntelligence`:
- 3x LIVE (cbs, juridisch, meldingen)
- 5x STUB (raadsinformatie, huisvestingsverordening, subsidies, sttr, erfgoed)
- 4x PLACEHOLDER (welstandsnota, parkeernormen, visie, verduurzaming)