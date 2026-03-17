# M002 — Research

**Date:** 2026-03-17

## Summary

M002 transforms a 5-route navigation app into a dual-panel map intelligence system. The codebase is well-structured for this: the `_authenticated` layout already has a 620px panel portal mechanism (panelPortalRef/setPanelOpen) that's wired but unused — the current panels (GemeenteMapPanel, WijkMapPanel, ParcelDetailPanel) all render via MapPanelShell as fixed right-sidebars instead. The existing ParcelScoreLayer already has 6 overlay modes for the map tiles, providing the infrastructure for Kansenkaart color switching. The Opgeslagen route exists at 238 lines with a basic favorites list view; the Projecten route (32 lines) delegates to ProjectenPage (5,338 lines across 40 sub-components) which already has portfolio drill-down, pipeline stages, and CBS data cards.

The primary risk is the map.tsx file at 2,373 lines — it orchestrates all panel state, scan workflows, layer toggling, and click handlers. Adding a GemeenteContextPanel means adding another panel kind to the existing `ActivePanel` union type and threading new state through this already-dense file. The nav simplification (kill Projecten, Rapporten routes) is mechanically straightforward but requires careful migration of features that currently live on those routes.

The recommended approach: start with nav simplification (lowest risk, proves the routing changes), then build the GemeenteContextPanel using the existing panel portal mechanism, then add map color mode switching (extends existing ParcelScoreLayer infrastructure), and finally transform the pipeline/favorites into the Opgeslagen view.

## Recommendation

**Slice by phase, risk-ordered:**

1. **Nav Simplification** (low risk) — Collapse SideRailNav from 5 items to 3 (Kaart, Opgeslagen, Jurisprudentie). Kill /projecten and /rapporten routes. Move meldingen from standalone route into a map panel or merge into Opgeslagen. This is pure deletion + routing changes with well-understood blast radius.

2. **GemeenteContextPanel** (medium risk) — Replace existing GemeenteMapPanel (89 lines, right sidebar) with a new left-side GemeenteContextPanel (~400px) using the existing panelPortalRef mechanism. Summary cards for Demografie, Juridisch Klimaat, Meldingen, Wijken. This is the architectural pivot — changes how the map's panel system works.

3. **Gemeente Modals** (medium risk) — Full-page modals for each intelligence domain. CBS data components already exist in /components/projects/ (CbsNeighborhoodCard, CriminaliteitCard, NabijheidCard, JuridischKlimaatCard, etc.) — these need to be extracted and adapted for gemeente-level display. The data fetching infrastructure (CBS OData, crime API, jurisprudentie) is already built.

4. **Map Color Modes / Kansenkaart** (medium-high risk) — Extend the existing 6-overlay ParcelScoreLayer system with a Kansenkaart heatmap mode. The LayerToggle UI already supports mode switching. The question is data aggregation — current tiles are per-parcel; a heatmap implies gemeente/wijk-level aggregation which may need a new tile endpoint or client-side aggregation.

5. **Pipeline → Completeness + Enriched Favorites** (low risk) — Transform the Opgeslagen page from a basic list into the enriched favorites view with completeness model. Backend already has ParcelFavorite with pipeline_stage, favorites API, portfolio grouping endpoint. This is primarily frontend UI work.

## Implementation Landscape

### Key Files

- `frontend/src/routes/_authenticated.tsx` (132 lines) — Root authenticated layout. Owns MapView, panelPortalRef (620px slot), MapContext provider. The panel portal is already built but panels don't use it — they render via MapPanelShell instead. **GemeenteContextPanel should use this portal.**
- `frontend/src/routes/_authenticated/map.tsx` (2,373 lines) — The monolith. All map interaction state, panel management, scan workflow, layer toggling. ActivePanel union type (`gemeente | wijk | parcel`) drives which panel renders. **New GemeenteContextPanel adds another panel path here.**
- `frontend/src/components/layout/SideRailNav.tsx` (121 lines) — Current 5-item nav (Kaart, Projecten, Meldingen, Rapporten, Jurisprudentie) + Settings/Logout. **Reduce to 3 items.**
- `frontend/src/components/layout/BottomTabNav.tsx` (52 lines) — Mobile nav with 3 items (Kaart, Projecten, Rapporten). **Update to match new nav.**
- `frontend/src/components/map/panels/MapPanelShell.tsx` (44 lines) — Right sidebar panel container. GemeenteMapPanel/WijkMapPanel/ParcelDetailPanel all use this. **GemeenteContextPanel should NOT use this — it renders on the left via panelPortalRef.**
- `frontend/src/components/map/panels/GemeenteMapPanel.tsx` (89 lines) — Current gemeente right panel showing wijk list. **Replace with GemeenteContextPanel (left panel, summary cards).**
- `frontend/src/components/map/panels/WijkMapPanel.tsx` (104 lines) — Wijk right panel with scan summary, CBS data, jurisprudence. **Keep as right panel or merge into GemeenteContextPanel.**
- `frontend/src/components/map/panels/ParcelDetailPanel.tsx` (200 lines) — **UNTOUCHED per hard constraint.** Left panel on map.
- `frontend/src/components/map/ParcelScoreLayer.tsx` — 6 overlay modes (potential, built_status, report_coverage, vacancy_signal, build_capacity, foundation_risk). **Kansenkaart adds a 7th mode or replaces/extends `potential`.**
- `frontend/src/components/map/LayerToggle.tsx` (~280 lines) — Toggle UI for map modes. **Add Kansenkaart mode selector.**
- `frontend/src/lib/map/layers.ts` — Layer catalog with typed IDs. **Add kansenkaart overlay entry.**
- `frontend/src/routes/_authenticated/opgeslagen.tsx` (238 lines) — Current basic favorites list. **Transform into enriched Opgeslagen view with completeness model.**
- `frontend/src/routes/_authenticated/projecten.tsx` (32 lines) — Route file. **Kill this route.**
- `frontend/src/routes/_authenticated/rapporten.tsx` (284 lines) — Reports list. **Kill this route.**
- `frontend/src/routes/_authenticated/meldingen.tsx` (1,195 lines) — Meldingen feed with gemeente filter, infinite scroll. **Kill standalone route, move to map panel or merge into Opgeslagen.**
- `frontend/src/hooks/useFavorites.ts` — Hooks for favorites CRUD, portfolio fetching, pipeline stage update. Already complete.
- `frontend/src/lib/types/portfolio.ts` — Types for FavoriteResponse, PortfolioResponse. Already complete.
- `backend/app/favorites/router.py` — Favorites CRUD + portfolio grouping API. Already complete.
- `backend/app/models/parcel_favorite.py` — ParcelFavorite model with pipeline_stage, denormalized gemeente/wijk context. Already complete.

### Existing Patterns to Reuse

1. **Panel portal mechanism** — `_authenticated.tsx` already has panelPortalRef with 620px animated width. GemeenteContextPanel should use `createPortal(content, panelPortalRef.current)` and call `setPanelOpen(true/false)`.
2. **ActivePanel union type** — map.tsx uses `{ kind: 'gemeente' | 'wijk' | 'parcel'; ... }` to control which panel renders. Extend naturally.
3. **ParcelScoreLayer overlay system** — 6 fill layers on the same vector tile source, each with its own visibility control and color paint expression. Kansenkaart is a 7th layer or replaces the gradient on `potential`.
4. **CBS data components** — CbsNeighborhoodCard, CriminaliteitCard, NabijheidCard, AgeDistributionCard, IncomeCard, HouseholdCard already exist in /components/projects/. They're currently wijk-scoped but the CBS OData client supports gemeente-level queries.
5. **JuridischKlimaatCard + JurisprudenceSection** — Already fetches per-gemeente analysis. Can be surfaced in GemeenteContextPanel as summary card.
6. **Portfolio drill-down** — PortfolioView already implements provincie → gemeente → wijk → parcel drill-down. The Opgeslagen enriched view can reuse this pattern.

### Build Order

1. **Nav simplification first** — Remove /projecten and /rapporten routes, update SideRailNav/BottomTabNav to 3 items (Kaart, Opgeslagen, Jurisprudentie). This is surgical, low risk, and unblocks the mental model shift. Any features from killed routes that need to survive (report list, meldingen feed) get addressed in later slices.
2. **GemeenteContextPanel second** — This is the architectural centerpiece. Use the existing panelPortalRef portal to render a left panel (~400px) with summary cards when gemeente boundaries are clicked. Existing gemeente click handler in map.tsx calls `activateGemeenteContext()` — extend this to open the left panel.
3. **Gemeente modals third** — Full-page modals for Demografie, JuridischKlimaat, Meldingen, Wijken. Extract CBS/crime/jurisprudence components from /components/projects/ into reusable gemeente-scoped components. These modals overlay the map.
4. **Kansenkaart / map color modes fourth** — Extend ParcelScoreLayer with a heatmap aggregation mode. This depends on understanding whether the backend needs a new tile endpoint for aggregated data or whether client-side aggregation from existing tiles suffices.
5. **Pipeline → Completeness last** — Transform Opgeslagen page. Low risk, mostly UI. Backend already supports all needed operations.

### Verification Approach

- **Nav simplification:** All old route URLs (/projecten, /rapporten, /meldingen) redirect or 404 gracefully. SideRailNav shows exactly 3 items. BottomTabNav matches. No broken links in the app.
- **GemeenteContextPanel:** Click gemeente boundary → left panel opens at ~400px width → map resizes correctly → summary cards render with data. Click elsewhere → panel closes. ParcelDetailPanel (right panel) continues working unchanged.
- **Gemeente modals:** Click summary card → full-page modal opens with correct gemeente data. Close modal → return to panel. Data from CBS/crime/jurisprudence APIs loads correctly.
- **Kansenkaart:** Toggle color mode → map tiles re-render with new color scheme. At least 2 distinct color modes visible. Layer toggle UI reflects active mode.
- **Enriched Opgeslagen:** Navigate to /opgeslagen → see favorites grouped by gemeente with completeness indicators. Pipeline stage changes work. Navigation to map from favorites works.

## Constraints

- **ParcelDetailPanel and ParcelDetailModal are UNTOUCHED.** No changes to components, state, data fetching, or interactions. Build around them, never into them.
- **ParcelDetailPanel renders as LEFT panel on map** — GemeenteContextPanel also needs to render on the left. These two panels are mutually exclusive (can't select a gemeente and a parcel simultaneously).
- **map.tsx is already 2,373 lines.** Adding GemeenteContextPanel state will make it worse. Consider extracting panel orchestration into a custom hook.
- **Existing scan/tile infrastructure stays.** Kansenkaart must work with the existing MVT tile pipeline (PostGIS → ST_AsMVT) or add a parallel aggregation source.
- **TanStack Router file-based routing** — Killing routes means deleting files AND updating routeTree.gen.ts (manually, since `tsr generate` requires config not present per prior decision).

## Common Pitfalls

- **Panel collision** — ParcelDetailPanel uses panelPortalRef (left panel). GemeenteContextPanel also needs to use left panel. Must be mutually exclusive — opening gemeente panel must close parcel panel and vice versa. The ActivePanel union type already enforces this at the state level, but the portal rendering needs to handle the transition.
- **map.tsx state explosion** — Adding GemeenteContextPanel means more state in the already-bloated map.tsx. Extract a `useMapPanels` hook or similar to contain panel state management, or the file becomes unmaintainable.
- **Killed routes with live references** — SideRailNav links, breadcrumbs in ProjectenPage, "Toon Lijst" buttons pointing to /resultaten, melding navigation to /meldingen. Grep thoroughly for all references to killed routes.
- **Mobile layout** — BottomTabNav currently has 3 items (Kaart, Projecten, Rapporten). Opgeslagen replacing Projecten is fine, but losing Rapporten means those features need to be accessible from somewhere on mobile.
- **Kansenkaart data granularity** — Current ParcelScoreLayer uses per-parcel MVT tiles from scan results. A "heatmap" implies spatial aggregation (e.g., average score per wijk or grid cell). If this requires a new backend endpoint, it's higher effort than pure frontend work.
- **CBS data is wijk-scoped** — CbsNeighborhoodCard fetches per-wijk stats. Gemeente-level aggregation may need new backend queries or client-side aggregation across wijken.

## Open Risks

- **Kansenkaart heatmap data source is TBD** (per CONTEXT.md). This needs to be resolved during slice research. Options: (a) client-side aggregation of existing per-parcel scores into grid/hex cells, (b) new backend tile endpoint with pre-aggregated data, (c) WMS-style raster overlay computed server-side. The choice affects scope significantly.
- **Meldingen migration** — The /meldingen route is 1,195 lines with complex infinite scroll, read tracking, gemeente filtering, and detail view. "Kill the route" is easy; "preserve the feature" requires significant integration work into either the map panel or Opgeslagen.
- **Report access after /rapporten is killed** — Users currently browse reports at /rapporten. Where do they go? Options: (a) reports move into Opgeslagen per-parcel view, (b) reports accessible from parcel detail panel only, (c) keep a minimal reports section in Opgeslagen.
- **Resultaten route survival** — /resultaten is the scan results table (268 lines). The CONTEXT.md doesn't explicitly kill it, but if navigation collapses to 2 items, how do users access scan results? Currently via "Toon Lijst" button on map. This might survive as a sub-route or inline view.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| MapLibre | maplibre/maplibre-agent-skills@maplibre-tile-sources | available (49 installs) |
| MapLibre | maplibre/maplibre-agent-skills@maplibre-pmtiles-patterns | available (41 installs) |

## Sources

- Codebase exploration: _authenticated.tsx (panel portal), map.tsx (panel state), SideRailNav (nav items), ParcelScoreLayer (overlay modes), favorites/router.py (backend API), parcel_favorite.py (data model)
- M002-CONTEXT.md (milestone vision and constraints)
- PROJECT.md (current state and architecture)
- REQUIREMENTS.md (active requirements for pipeline, favorites, wijk, gemeente, results, jurisprudentie, meldingen features)
