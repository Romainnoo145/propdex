# Phase 93: Parcel Detail Panel - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Clicking a parcel opens a floating glass panel that tells the full property story through visual bento pods and click-through layers — zero scroll on the overview. Replaces the current scrollable ParcelDetailModal with an Aura-styled floating panel. Includes a backend aerial crop API for the hero image.

</domain>

<decisions>
## Implementation Decisions

### Panel Shell & Positioning
- Fixed right-side panel, ~380px wide, positioned top-4 right-4 bottom-4
- Glass blur background, matches Aura design system (like SideRailNav on the left)
- Slide + fade animation from right when opening
- Clicking another parcel cross-fades content within the panel
- Close via X button or clicking the map background
- **Map re-center on open**: When panel slides in, map must re-center so the selected parcel sits in the center of the *remaining visible* map area (shifted left to account for panel width)
- Re-center only, do NOT auto-zoom — user controls zoom

### Hero Image & Score Badge
- Live satellite crop from backend API, centered on parcel coordinates
- Full-width at top of panel, ~160px tall
- Score badge: bottom-right pill badge overlaid on hero image
- Score number (e.g. "78") in colored pill using amber→green gradient matching score value
- Slight shadow on badge for readability against any satellite background

### Address Bar
- Address line sits between hero image and bento grid
- Always visible — persists even when navigating into detail layers
- Part of the fixed header area alongside the back button (in detail layer view)

### Bento Stats Grid (4 Category Pods)
- **4 category pods** arranged in a 2×2 grid:
  1. **Potentie** — Score + vrije ruimte + transformatiepotentie
  2. **Risico** — Fundering + bodemtype + asbest + bodemkwaliteit
  3. **Markt** — Marktsignalen + kansen & aandachtspunten
  4. **Juridisch** — Bestemming + vergunningen + meldingen
- Each pod shows: score/icon + one-word label (minimal, scannable)
  - Potentie: score number (78) with color
  - Risico: traffic light icon (green/amber/red)
  - Markt: days-on-market number
  - Juridisch: bestemming type name
- No separate bestemming status bar — bestemming is part of the Juridisch pod
- Bento overview is zero-scroll (everything fits without scrolling)
- Each pod is clickable — serves as both summary AND navigation entry point

### Click-Through Layer Navigation
- Clicking a pod replaces panel content below the hero+address with the detail layer
- Hero image + address bar stay visible as fixed header
- Back arrow at top-left of detail layer returns to bento overview
- Always back to overview first — no horizontal swipe between categories
- Overview IS the navigation hub
- Detail layers CAN scroll within the panel (zero-scroll only applies to the bento overview)

### Layer Depth
- Claude's Discretion: Claude decides whether sub-sections within a category (e.g. fundering, bodem, asbest within Risico) show all at once or as clickable sub-cards, based on data density per category

### Rapport Button
- Sticky bottom bar, fixed at the bottom of the panel
- Full-width button with glass background
- Always visible regardless of which layer you're in — never scrolls away
- Single CTA only: "Genereer Rapport" — no secondary actions
- State switch: if rapport already exists, changes to "Bekijk Rapport" with green accent (aura-green) instead of amber
- "Bekijk Rapport" navigates to the report page

### Claude's Discretion
- Exact pod dimensions and spacing within the 2×2 grid
- Loading skeleton design while satellite image loads
- Error states (no satellite image available, no data for a category)
- Detail layer sub-section layout (stacked vs sub-cards per category)
- Property info fields (oppervlak, bouwjaar, gemeente) placement — fold into relevant category detail layers

</decisions>

<specifics>
## Specific Ideas

- The panel should feel like a property intelligence briefing — scan the 4 pods, click in for depth
- Potentie pod is the hero metric — most important for developer decision-making
- Satellite crop gives immediate spatial context that a map pin alone doesn't provide
- "Living map" philosophy: the panel floats ON the map, map stays interactive behind it

</specifics>

<deferred>
## Deferred Ideas

- Parcel comparison ("Vergelijken") — would be a new capability, separate phase
- Share/link to specific parcel — future phase
- Horizontal swipe between categories — can be added later if the back-to-overview flow feels too slow

</deferred>

---

*Phase: 93-parcel-detail-panel*
*Context gathered: 2026-03-10*
