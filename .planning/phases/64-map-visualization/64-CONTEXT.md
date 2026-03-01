# Phase 64: Map Visualization - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Give users a clear, accurate spatial picture of Venlo's development opportunities through the map. Three deliverables: BAG building footprints layer (toggleable), score-based parcel coloring with correct opportunity mapping, and map clarity improvements (labels, zoom, density). The Venlo dataset (108,789 parcels, 21 wijken) from Phase 63 is the target.

</domain>

<decisions>
## Implementation Decisions

### Building footprints layer
- Outline-only rendering (no fill) — keeps parcel score colors visible underneath
- Dark grey/charcoal outline color — neutral, doesn't compete with score colors, works in both themes
- Clicking a building footprint selects the parent parcel (buildings are visual context, parcels are the actionable unit)
- Data source: PDOK BAG WMS tiles — no extra data storage, always up-to-date, minimal frontend work

### Score color scheme
- Continuous gradient from low to high score (not discrete buckets)
- Grey-to-green palette: grey for low-opportunity (in_gebruik), transitioning through yellow/amber to green for high-opportunity (vacant/sloop)
- Empty parcels (no buildings) get a hatched/diagonal stripe pattern overlay in addition to score color — instantly distinguishable from built parcels
- Compact gradient legend bar in a map corner, always visible when score layer is on, collapsible

### Map clarity & defaults
- Default zoom: fit wijk bounds — auto-zoom to show entire wijk boundary when user opens a wijk
- Progressive label disclosure: no labels at wijk overview zoom, score numbers at medium zoom, address + score at street zoom
- Dense areas: cluster parcels at overview zoom with average score and parcel count, expand to individual parcels on zoom-in
- Wijk boundary: dashed outline — thin dashed line for spatial context without competing with parcel colors

### Layer panel UX
- Default state: parcels + scores ON, BAG buildings OFF (user enables when they want building context)
- Toggles grouped by type: "Data layers" (parcels, buildings), "Overlays" (scores, bestemmingsplan), "Basemap" (satellite, streets)
- Mutual exclusivity: basemap options only (satellite vs streets). All data/overlay layers can be combined freely
- No opacity controls — layers are on or off, opacity pre-tuned for best visual result
- Layer toggle state persisted via localStorage across sessions

### Claude's Discretion
- Exact gradient color stops and transition points
- Cluster threshold (how many parcels trigger clustering)
- Label font sizes and readability tuning
- WMS tile layer configuration details
- Hatched pattern line spacing and angle

</decisions>

<specifics>
## Specific Ideas

- Green = go/opportunity — the color metaphor should feel intuitive for real estate developers
- Buildings are context, parcels are the actionable unit — this distinction should be clear in all interactions
- Demo scenario: user opens Venlo wijk, immediately sees score-colored parcels, can toggle buildings for context, zoom in to high-scoring (green) parcels

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 64-map-visualization*
*Context gathered: 2026-03-02*
