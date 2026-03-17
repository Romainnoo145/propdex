# M002: v18.0 Kansenkaart + Nav Simplification

**Vision:** Transform the UI from a 5-route app into a dual-panel map intelligence system. Navigation collapses to 3 items (Kaart + Opgeslagen + Jurisprudentie). The map becomes the entire product surface — gemeente intelligence in a left panel with summary cards and full-page modals, parcel intelligence stays in the right panel. Kansenkaart adds map color mode switching. Pipeline management moves into enriched Opgeslagen favorites.

## Success Criteria

- Navigation shows exactly 3 items (Kaart, Opgeslagen, Jurisprudentie) on both desktop and mobile
- Old routes (/projecten, /rapporten) return 404 or redirect — no broken links in the app
- Clicking a gemeente boundary on the map opens a left-side context panel (~400px) with summary cards for Demografie, Juridisch Klimaat, Meldingen, Wijken
- ParcelDetailPanel continues to work unchanged — opening it closes the gemeente panel and vice versa
- Clicking a summary card in the gemeente panel opens a full-page modal with detailed intelligence data
- Map has at least 2 switchable color modes via the layer toggle UI
- /opgeslagen shows favorited parcels grouped by gemeente with pipeline stage management and completeness indicators
- Meldingen feed is accessible from the gemeente context panel (not a dead standalone route)

## Key Risks / Unknowns

- **Panel mutual exclusion** — ParcelDetailPanel and GemeenteContextPanel both render on the left via panelPortalRef. Must be mutually exclusive via ActivePanel union type. If the portal mechanism doesn't support clean transitions, the architectural pivot fails.
- **map.tsx complexity (2,373 lines)** — Adding gemeente panel state to an already-dense file risks regressions. Panel orchestration needs extraction into a hook.
- **Kansenkaart data source TBD** — Current ParcelScoreLayer uses per-parcel MVT tiles. A heatmap implies spatial aggregation. If a new backend endpoint is needed, scope grows significantly. Client-side aggregation from existing tiles is the preferred path.
- **Meldingen migration** — The /meldingen route is 1,195 lines with complex infinite scroll, read tracking, and filtering. Killing the route is easy; preserving the feature in a modal requires significant integration work.

## Proof Strategy

- **Panel mutual exclusion** → retire in S02 by proving GemeenteContextPanel opens in the left portal, closes when a parcel is selected, and ParcelDetailPanel is fully unaffected
- **map.tsx complexity** → retire in S02 by extracting panel orchestration into a useMapPanels hook before adding new panel state
- **Kansenkaart data source** → retire in S04 by shipping color mode switching using existing ParcelScoreLayer infrastructure (client-side recoloring of existing tiles, not new aggregation endpoints)
- **Meldingen migration** → retire in S03 by embedding the meldingen feed in a gemeente modal, preserving core functionality (feed, filtering, read tracking)

## Verification Classes

- Contract verification: TypeScript compilation, route tree correctness, no broken imports
- Integration verification: Panel transitions on map (gemeente↔parcel mutual exclusion), data loading in modals, color mode switching on live tiles
- Operational verification: None (no new backend services)
- UAT / human verification: Nav flow (3 items, correct routing), panel interactions on map, modal data display, Opgeslagen pipeline management

## Milestone Definition of Done

This milestone is complete only when all are true:

- All 5 slices are complete with their individual verifications passing
- Navigation shows 3 items on desktop and mobile, old routes are dead
- Gemeente left panel opens/closes without affecting parcel right panel
- At least 4 gemeente modals render real data (Demografie, JuridischKlimaat, Meldingen, Wijken)
- Map has 2+ color modes switchable via layer toggle
- Opgeslagen shows grouped favorites with pipeline stage management
- No regressions in existing parcel detail flow, scan workflow, or jurisprudentie explorer
- Success criteria re-checked against live running app

## Requirement Coverage

### Mapped

| Requirement | Primary Slice | Supporting |
|-------------|--------------|------------|
| GEM-01 (gemeente wijk boundaries) | S02 | — |
| GEM-02 (gemeente context without bottom sheet) | S02 | S03 |
| PIPE-01 (pipeline stages) | S05 | — |
| PIPE-02 (pipeline stage selector) | S05 | — |
| PIPE-03 (default Gesignaleerd) | S05 | — |
| PIPE-04 (filter by pipeline stage) | S05 | — |
| PIPE-05 (Afgerond reason) | S05 | — |
| FAV-03 (favorite markers on map) | S04 | — |
| FAV-04 (favorite count badge) | S05 | — |
| MELD-01 (meldingen feed redesign) | S03 | — |
| MELD-02 (gemeente filter + scroll preserved) | S03 | — |

### Deferred (not M002 scope)

| Requirement | Reason |
|-------------|--------|
| SCAN-01 (energielabel in scan) | Scan enrichment, not UI restructuring |
| SCAN-02 (WOZ in scan) | Scan enrichment, not UI restructuring |
| SCAN-03 (vergunningen in scan) | Scan enrichment, not UI restructuring |
| RES-01 (resultaten Aura styling) | Visual polish, not structural — /resultaten route survives unchanged |
| RES-02 (table functionality + styling) | Visual polish |
| JUR-01 (wizard Aura styling) | Visual polish — Jurisprudentie route stays unchanged |
| JUR-02 (explorer glass containers) | Visual polish |

### Superseded by M002 Vision

| Requirement | Reason |
|-------------|--------|
| WIJK-01 (Bottom Bento Sheet) | M002 replaces bottom sheet with left GemeenteContextPanel |
| WIJK-02 (4-column bento layout) | Superseded by summary cards in left panel |
| WIJK-03 (wijk outer glow) | Can be added later; not part of panel restructuring |
| WIJK-04 (click-through from wijk pods) | Replaced by gemeente modal drill-down |
| PORT-01 through PORT-08 | Projecten page killed; portfolio moves to Opgeslagen with different UX model |
| BACK-01 through BACK-05 | Already validated in M001; backend stays unchanged |

## Slices

- [ ] **S01: Nav Simplification** `risk:low` `depends:[]`
  > After this: SideRailNav shows 3 items (Kaart, Opgeslagen, Jurisprudentie), BottomTabNav matches, /projecten and /rapporten routes are deleted, /meldingen route still exists but is removed from nav (killed in S03), no broken links anywhere in the app

- [ ] **S02: GemeenteContextPanel** `risk:high` `depends:[S01]`
  > After this: Clicking a gemeente boundary opens a ~400px left panel via panelPortalRef with summary cards (Demografie, Juridisch Klimaat, Meldingen, Wijken). Panel closes when clicking elsewhere or selecting a parcel. ParcelDetailPanel works unchanged. map.tsx panel orchestration extracted into useMapPanels hook.

- [ ] **S03: Gemeente Intelligence Modals** `risk:medium` `depends:[S02]`
  > After this: Clicking a summary card in GemeenteContextPanel opens a full-page modal with real data. Demografie modal shows CBS demographics. JuridischKlimaat modal shows klimaat analysis. Meldingen modal embeds the meldingen feed with gemeente filter and infinite scroll. Wijken modal shows wijk list with scan summaries. /meldingen standalone route is deleted.

- [ ] **S04: Map Color Modes + Kansenkaart** `risk:medium` `depends:[S01]`
  > After this: LayerToggle UI has 2+ color modes for the ParcelScoreLayer. User can switch between "Opportunity Score" (existing gradient) and at least one alternative visualization (e.g. built status, vacancy signal). Favorited parcels show a distinct marker/color on the map. Mode switching is instant (client-side repaint, no new API calls).

- [ ] **S05: Enriched Opgeslagen + Pipeline** `risk:low` `depends:[S01]`
  > After this: /opgeslagen shows favorited parcels grouped by gemeente with pipeline stage pills (Gesignaleerd → Onderzoek → Contact → Besluit → Afgerond). User can change pipeline stage inline. Completeness indicators show data coverage per parcel. Afgerond captures reason (Gekocht/Afgewezen). Filter by pipeline stage works across all groups.

## Boundary Map

### S01 → S02

Produces:
- SideRailNav with 3 items and updated route structure
- BottomTabNav with matching 3 items
- Clean routeTree.gen.ts without /projecten, /rapporten
- Verified that /meldingen route still works (nav link removed but route exists until S03)

Consumes:
- nothing (first slice)

### S02 → S03

Produces:
- GemeenteContextPanel component rendering in panelPortalRef
- useMapPanels hook managing ActivePanel state (gemeente | wijk | parcel)
- Summary cards in panel with onClick handlers ready for modal wiring
- Stable gemeente code/naam passed to panel from map click handler

Consumes:
- S01: Clean 3-item nav (no stale links to killed routes)

### S01 → S04

Produces:
- Clean route structure (S04 doesn't depend on panel work)

Consumes:
- nothing specific from S01 (S04 extends ParcelScoreLayer, independent of nav)

### S01 → S05

Produces:
- Opgeslagen route exists and is navigable from nav

Consumes:
- nothing specific from S01 (S05 rebuilds the Opgeslagen page content)

### S02 → S04

No dependency. S04 works on map layers independent of panel system.

### S02 → S05

No dependency. S05 works on the Opgeslagen route independent of map panels.
