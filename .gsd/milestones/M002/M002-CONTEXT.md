# M002: v18.0 Kansenkaart + Nav Simplification

## Vision

Transform the UI from a 5-route app into a dual-panel map intelligence system. Navigation collapses to 2 items (Kaart + Opgeslagen). The map becomes the entire product surface — gemeente intelligence lives in a new left panel with summary cards and full-page modals, parcel intelligence stays in the right panel. Kansenkaart heatmap adds color mode switching for spatial opportunity visualization. Pipeline management moves from dead Projecten page into enriched Opgeslagen favorites.

## Goals

1. Kill 2 standalone routes (Projecten, Rapporten) — Jurisprudentie stays as its own route (wizard-based exploration can't live on the map)
2. Add GemeenteContextPanel (left panel, ~400px) triggered by clicking gemeente boundaries
3. Build full-page modals for gemeente intelligence: Demografie, JuridischKlimaat, Meldingen, Wijken
4. Add Kansenkaart heatmap with map color mode switching
5. Transform pipeline into completeness model with enriched favorites in Opgeslagen view

## Constraints

- **HARD RULE: ParcelDetailModal, ParcelDetailPanel, and the entire parcel detail flow are UNTOUCHED.** No changes to parcel detail state, components, data fetching, or interactions. ParcelDetailPanel is the left-panel on the map, ParcelDetailModal is in results. Both are proven, shipped work — M002 builds around them, never into them.
- Existing parcel right panel must continue working unchanged
- parcel_favorites FK to parcel_cache (from M001 S13) is the data foundation for enriched favorites
- All existing backend APIs remain — this is primarily a frontend restructuring
- Mobile responsive must be maintained (but can be simplified for dual-panel)

## Phases (from product vision)

1. **Phase 114:** Nav Simplification (5 → 3 items: Kaart, Opgeslagen, Jurisprudentie)
2. **Phase 115:** Gemeente Left Panel (GemeenteContextPanel)
3. **Phase 116:** Gemeente Modals (Demografie, JuridischKlimaat, Meldingen, Wijken)
4. **Phase 117:** Map Color Modes + Kansenkaart heatmap
5. **Phase 118:** Pipeline → Completeness + enriched favorites

## Key Risks

- Killing 2 routes means the features they provided must be accessible elsewhere (or explicitly dropped)
- Jurisprudentie explorer stays as standalone route — wizard-based exploration is a different interaction model from the map
- Dual-panel layout on smaller screens could be challenging
- Gemeente boundary click currently triggers zoom — needs to be repurposed for left panel
- Kansenkaart heatmap data source and aggregation TBD
