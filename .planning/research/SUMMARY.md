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
