# M002 — Research: Kansenkaart + Nav Simplification

**Date:** 2026-03-17

## Summary

M002 transforms Propdex from a 5-route app into a dual-panel map intelligence system. The current architecture has 10 routes under `_authenticated/` with 5 main nav items (Kaart, Projecten, Meldingen, Rapporten, Jurisprudentie). The target is 3 nav items: Kaart, Opgeslagen, Jurisprudentie — with Projecten killed (pipeline/portfolio features absorbed into enriched Opgeslagen), Rapporten killed (report management moved into parcel detail flow), and Meldingen demoted to a map overlay or integrated into gemeente intelligence.

The codebase is well-structured for this. The `_authenticated.tsx` layout already implements a left panel portal system (620px, animated via CSS transition) used by `ParcelPanelShell` for parcel details. The `MapPanelShell` handles right-side gemeente/wijk panels. M002 needs a new left-panel type (GemeenteContextPanel) that shares the existing portal slot with parcel details, plus full-page modals for deeper gemeente intelligence. The existing CBS clients (OData v4 for demographics, OData v3 for crime), jurisprudence feed, and meldingen feed already provide the data — M002 is primarily frontend restructuring with some new backend endpoints for gemeente-level aggregation.

The riskiest parts are: (1) killing two routes without losing features users depend on, (2) the dual left-panel model (gemeente vs parcel competing for the same portal slot), and (3) Kansenkaart heatmap requiring a new map color mode architecture atop the existing `useMapLayerState` hook.

## Recommendation

Slice by architectural risk, not by phase number:

1. **Nav simplification first** — kill Projecten/Rapporten routes, redistribute features, prove nothing breaks. This is the foundation everything else depends on.
2. **GemeenteContextPanel** — repurpose gemeente boundary click from right-panel MapPanelShell to left-panel portal. This validates the dual-panel model.
3. **Gemeente modals** — full-page modals for Demografie, JuridischKlimaat, Meldingen, Wijken. These are mostly composition of existing components (CBS cards, JurisprudenceSection, ChangeTimeline) into modal containers.
4. **Map color modes + Kansenkaart** — extend `useMapLayerState` with color mode concept, add heatmap aggregation. This is the most technically novel slice.
5. **Pipeline → Completeness + enriched favorites** — transform the pipeline model in Opgeslagen, add dossier completeness tracking.

## Implementation Landscape

### Key Files

**Navigation & Layout:**
- `frontend/src/routes/_authenticated.tsx` (146 lines) — Layout orchestrator with left panel portal slot (620px animated div), SideRailNav, BottomTabNav, MapView. The panel portal system is proven and working.
- `frontend/src/components/layout/SideRailNav.tsx` (119 lines) — 5 nav items: Kaart, Projecten, Meldingen, Rapporten, Jurisprudentie. Needs reduction to 3: Kaart, Opgeslagen, Jurisprudentie.
- `frontend/src/components/layout/BottomTabNav.tsx` (48 lines) — Mobile nav with 3 items: Kaart, Projecten, Rapporten. Needs update to match new nav.
- `frontend/src/components/layout/ResultsShell.tsx` — Wrapper for non-map routes. Still needed for Opgeslagen, Jurisprudentie, Instellingen.

**Routes being killed:**
- `frontend/src/routes/_authenticated/projecten.tsx` (32 lines) — Thin wrapper for ProjectList. Currently hosts portfolio view (provincie → gemeente → wijk → parcel drill-down) AND monitoring workspace. Portfolio features move to Opgeslagen.
- `frontend/src/routes/_authenticated/rapporten.tsx` (284 lines) — Report list with search/filter/delete. Reports become accessible from parcel detail flow only.
- `frontend/src/routes/_authenticated/dashboard.tsx` (19 lines) — Placeholder, trivially removable.

**Routes being transformed:**
- `frontend/src/routes/_authenticated/opgeslagen.tsx` (238 lines) — Currently a simple gemeente-grouped favorites list. Must absorb portfolio drill-down, pipeline management, and completeness tracking from Projecten.
- `frontend/src/routes/_authenticated/meldingen.tsx` (1195 lines) — Meldingen feed. Per context, gets demoted — either stays as a standalone route accessible from gemeente modals, or integrates into the map. Decision needed.

**Map panels (HARD RULE: ParcelDetailPanel UNTOUCHED):**
- `frontend/src/components/map/panels/ParcelDetailPanel.tsx` (200 lines) — **DO NOT MODIFY.** Left panel for parcel details.
- `frontend/src/components/map/panels/parcel/ParcelPanelShell.tsx` (94 lines) — **DO NOT MODIFY.** Portal shell for parcel left panel. Uses `panelPortalRef` and `setPanelOpen`.
- `frontend/src/components/map/panels/GemeenteMapPanel.tsx` (89 lines) — Currently a right-side panel (MapPanelShell). M002 turns this into a LEFT panel (GemeenteContextPanel ~400px) sharing the portal slot with parcel details.
- `frontend/src/components/map/panels/WijkMapPanel.tsx` (104 lines) — Currently right-side panel with scan summary, CBS metrics, jurisprudence. Content moves into GemeenteContextPanel as sub-view.
- `frontend/src/components/map/panels/MapPanelShell.tsx` (44 lines) — Right-side panel container. May be removed once gemeente/wijk panels move left.

**Map & layer state:**
- `frontend/src/routes/_authenticated/map.tsx` (2373 lines) — Main map orchestrator. Manages `activePanel` state machine (`gemeente | wijk | parcel`), scan lifecycle, layer toggles. M002 needs to add color mode switching and modify gemeente click handler.
- `frontend/src/lib/map/useMapLayerState.ts` (78 lines) — Centralized layer toggle state. Needs extension with `colorMode` concept for Kansenkaart.
- `frontend/src/lib/map/layers.ts` (90 lines) — Layer catalog and persistence types. Needs `colorMode` or `heatmapMode` addition.
- `frontend/src/components/map/ParcelScoreLayer.tsx` (616 lines) — MVT-based score overlay with 6 sub-layers. Kansenkaart heatmap will be a new layer type alongside these.
- `frontend/src/components/map/LayerToggle.tsx` — Layer control panel. Needs color mode switcher.
- `frontend/src/lib/MapContext.tsx` — React context for map ref, panel state. May need extension for left-panel type discrimination.

**Favorites & portfolio infrastructure:**
- `frontend/src/hooks/useFavorites.ts` (185 lines) — `useParcelFavorites`, `useToggleFavorite`, `useUpdatePipelineStage`, `usePortfolio`. Well-structured, reusable.
- `frontend/src/lib/types/portfolio.ts` (69 lines) — `FavoriteResponse`, `PipelineStage`, `PortfolioResponse`. Foundation for enriched favorites.
- `backend/app/favorites/router.py` — CRUD + portfolio endpoints. May need completeness-related additions.
- `backend/app/favorites/schemas.py` — Pydantic schemas. May need completeness fields.
- `backend/app/models/parcel_favorite.py` — SQLAlchemy model with `parcel_cache_id` FK. Foundation for pulling cached enrichment data.

**Existing projects/portfolio components (5338 lines total):**
- `frontend/src/components/projects/PortfolioView.tsx` (277 lines) — Portfolio drill-down orchestrator. Currently reads from Projecten route URL params. Needs re-homing to Opgeslagen route.
- `frontend/src/components/projects/PortfolioBreadcrumb.tsx`, `PortfolioProvincieView.tsx`, `PortfolioGemeenteView.tsx`, `PortfolioWijkView.tsx` — Drill-down views. Move to Opgeslagen.
- `frontend/src/components/projects/FavoritedParcelCard.tsx` (69 lines) — Parcel card in portfolio. Keep/enhance.
- `frontend/src/components/projects/PipelineStagePill.tsx`, `PipelineStageSelector.tsx`, `PipelineStageFilter.tsx`, `AfgerondModal.tsx` — Pipeline UI components. Move to Opgeslagen.
- `frontend/src/components/projects/CbsNeighborhoodCard.tsx`, `JurisprudenceSection.tsx`, etc. — Data display cards. Reusable in gemeente modals.
- `frontend/src/components/projects/ProjectenPage.tsx`, `ProjectList.tsx`, `useProjectenWorkspace` — Monitoring workspace. KILL (features absorbed elsewhere).
- `frontend/src/components/projects/ProjectCreateModal.tsx`, `ProjectEditModal.tsx` — KILL (no more project management).

**Backend data sources for gemeente intelligence:**
- `backend/app/government_apis/cbs_odata.py` — CBS demographics, nabijheid. Has `_resolve_gemeente_identifier` for gemeente-level queries.
- `backend/app/government_apis/cbs_crime.py` — Crime data per gemeente. Ready.
- `backend/app/api/endpoints/jurisprudence.py` — Gemeente-level ruling endpoints. Ready.
- `backend/app/jobs/change_monitor.py` — Bekendmakingen per gemeente. Data already exists in DB.

**MVT tile infrastructure:**
- `backend/app/services/tile_proxy.py` — PostGIS-based MVT generation with tenant filtering. Kansenkaart heatmap could use a similar approach with aggregated data.
- `backend/app/scans/router.py` — Tile serving endpoint. May need a parallel heatmap tile endpoint.

### Build Order

1. **Nav simplification (lowest risk, highest impact)** — Remove Projecten/Rapporten nav items, redirect routes, move portfolio features to Opgeslagen. Proves the structural change without any new UI. Build Opgeslagen as the enriched favorites page with existing portfolio components.

2. **GemeenteContextPanel on map** — Repurpose gemeente boundary click to open a LEFT panel instead of right-side MapPanelShell. This is the architectural experiment — the left panel portal currently only serves parcel details. Key question: can both gemeente and parcel panels share the same portal slot (mutually exclusive), or do we need a second portal target? The `activePanel` state machine in map.tsx already handles mutual exclusion (`gemeente | wijk | parcel`), so sharing the portal slot should work — when gemeente panel is active, parcel panel isn't, and vice versa. The GemeenteContextPanel would use a similar `ParcelPanelShell`-like wrapper that portals into `panelPortalRef`.

3. **Gemeente modals** — Full-page modals for Demografie (CBS cards), JuridischKlimaat (JurisprudenceSection), Meldingen (ChangeTimeline/feed), Wijken (wijk list with scan status). Mostly composition of existing components into modal containers. May need 1-2 new backend endpoints for gemeente-level CBS aggregation (currently only wijk-level `get_neighborhood_data`).

4. **Map color modes** — Extend layer state with a `colorMode` concept. Currently the map has 6 parcel overlay modes (potential, built_status, etc.) via `activeParcelOverlay`. Kansenkaart adds a fundamentally different visualization — a heatmap layer that aggregates opportunity scores across parcels within a geographic area, rather than per-parcel coloring. This likely needs aggregated tiles from the backend (grid cells with averaged scores) rather than per-parcel MVT tiles.

5. **Pipeline → Completeness** — Transform pipeline stage model into a completeness model. The `parcel_cache_id` FK on `ParcelFavorite` enables joining to `parcel_cache` for enrichment data. Completeness = what percentage of data sections (BAG, BRK, WOZ, energielabel, bestemmingsplan, etc.) are available for this parcel. Backend needs a completeness calculation endpoint; frontend needs dossier progress visualization.

### Verification Approach

- **Nav simplification:** Build compiles, all remaining routes load, no dead links. Opgeslagen page shows portfolio drill-down. Old /projecten and /rapporten URLs redirect gracefully.
- **GemeenteContextPanel:** Click gemeente boundary on map → left panel opens with gemeente info, parcel details panel still works when clicking a parcel.
- **Gemeente modals:** Open each modal from GemeenteContextPanel, verify data loads (CBS demographics, jurisprudence, meldingen).
- **Map color modes:** Toggle between score overlay and heatmap, verify visual change. Heatmap renders aggregated opportunity data.
- **Completeness:** Favorited parcel shows completeness percentage, dossier links work.

## Constraints

- **HARD RULE: ParcelDetailPanel, ParcelDetailModal, and the entire parcel detail flow are UNTOUCHED.** No changes to parcel detail state, components, data fetching, or interactions. ParcelPanelShell is the portal wrapper — it must continue working unchanged.
- The existing `panelPortalRef` portal slot is 620px wide. GemeenteContextPanel is specified at ~400px. The portal width is controlled by the `panelOpen` state in `_authenticated.tsx` — it sets `width: panelOpen ? '620px' : '0px'`. This will need to become dynamic based on which panel type is active.
- Existing `activePanel` state machine in map.tsx (`gemeente | wijk | parcel`) already provides mutual exclusion. No need for a separate panel management system.
- TanStack Router file-based routing means route files create routes automatically. Deleting `projecten.tsx` and `rapporten.tsx` files removes those routes. Need redirect handlers for bookmarks.
- The Jurisprudentie route stays standalone — it's a wizard-based exploration flow that can't live in a panel.
- `useProjectenWorkspace` hook and monitoring-related features (Projects model, monitoring) are tightly coupled to the Projecten route. These need careful extraction or removal.
- Meldingen route (1195 lines) — context says "Kill 2 standalone routes (Projecten, Rapporten) — Jurisprudentie stays." Meldingen isn't explicitly mentioned for removal but isn't in the target nav either. Needs resolution: does Meldingen become part of gemeente intelligence, or stay as a standalone route accessible from gemeente modals?

## Common Pitfalls

- **Panel portal width mismatch** — ParcelPanelShell hardcodes `w-[620px]` on its content div, and `_authenticated.tsx` hardcodes `width: panelOpen ? '620px' : '0px'`. GemeenteContextPanel at ~400px will cause layout mismatch if both use the same portal. Solution: make portal width dynamic via context (pass desired width alongside `setPanelOpen`).
- **Route deletion breaks imports** — Components in `frontend/src/components/projects/` import from the Projecten route's search schema (`useSearch({ from: '/_authenticated/projecten' })`). These imports must be updated when the route is deleted or portfolio params move to Opgeslagen.
- **Monitoring features orphaned** — The "monitoring" side of Projecten (Projects model, ChangeTimeline, WijkScanList) is different from the "portfolio" side (favorites, pipeline). M002 context focuses on killing Projecten but doesn't explicitly say what happens to monitoring. The Project model tracks gemeente monitoring subscriptions — these likely become obsolete if gemeente context moves to the map.
- **Kansenkaart data aggregation** — Per-parcel MVT tiles work for score overlay because each parcel has its own score. A heatmap needs spatial aggregation (grid cells averaging scores across parcels). This requires either: (a) a new backend endpoint that generates aggregated grid tiles, or (b) client-side aggregation from existing per-parcel data. Option (a) is more scalable but requires backend work.
- **CBS gemeente-level data** — `get_neighborhood_data` currently resolves wijk identifiers with gemeente fallback. For the GemeenteContextPanel, we need proper gemeente-level CBS aggregation (summing/averaging across wijken). `_resolve_gemeente_identifier` exists but `get_neighborhood_data` doesn't have a clean gemeente-only mode.

## Open Risks

- **Meldingen route fate unclear** — M002 context says nav goes from 5→3 items (Kaart, Opgeslagen, Jurisprudentie) but doesn't explicitly kill Meldingen. The meldingen feed (1195 lines) is significant. If it moves into gemeente modals, it needs significant refactoring. If it stays as a standalone route, it needs a navigation path (maybe from the gemeente modal).
- **Kansenkaart heatmap data source** — M002 context says "Kansenkaart heatmap data source and aggregation TBD." This is the least-defined feature. Options range from simple (heat-map style interpolation of existing parcel scores) to complex (new aggregation pipeline with grid tiles). Research during the heatmap slice will need to resolve this.
- **Multi-parcel project support** — M002 context mentions "Multi-parcel project support (group adjacent parcels into one deal)" under target features. This is a new data model concept (grouping favorites) that doesn't exist yet. Could be deferred or simplified.
- **Rapport access after killing Rapporten route** — Reports are currently accessed via `/rapporten` (list) and `/rapport/$id` (detail). The Rapporten list route is killed, but individual report viewing (`/rapport/$id`) must survive. Reports become accessible from parcel detail flow, but there's no report list anywhere. Need a clear access pattern.

## Candidate Requirements

These emerged from research and should be discussed before binding:

| Candidate | Type | Notes |
|-----------|------|-------|
| NAV-01: Redirect /projecten → /opgeslagen | table-stakes | Bookmarks and muscle memory |
| NAV-02: Redirect /rapporten → /map | table-stakes | Or redirect to individual report if from old bookmark |
| GEM-PANEL-01: GemeenteContextPanel uses left portal | architectural | Shares portal slot with parcel detail (mutually exclusive) |
| GEM-PANEL-02: Dynamic portal width (400px gemeente, 620px parcel) | architectural | _authenticated.tsx needs to accept variable width |
| MELD-NAV: Meldingen accessible from gemeente modal | feature gap | If /meldingen route is killed, need access path |
| REPORT-ACCESS: /rapport/$id route survives Rapporten kill | table-stakes | Individual reports still viewable |
| HEATMAP-01: Kansenkaart uses aggregated grid data | TBD | Backend aggregation vs client-side — needs spike |
| COMPLETENESS-01: Dossier completeness derived from parcel_cache data | feature | Uses existing parcel_cache_id FK on ParcelFavorite |

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| React 19 + Vite | frontend-design | installed (bundled) |
| MapLibre GL JS | none found | — |
| TanStack Router | none found | — |

## Sources

- Existing codebase exploration (all file references above)
- M002-CONTEXT.md vision document
- DECISIONS.md architectural decision log (200+ decisions reviewed)
