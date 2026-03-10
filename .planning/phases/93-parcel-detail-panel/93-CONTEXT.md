# Phase 92-93: Aura Layout & Parcel Detail Panel - Context

**Gathered:** 2026-03-10 (updated — deep discussion)
**Status:** Ready for planning

<domain>
## Phase Boundary

Two interconnected deliverables:
1. **Global Aura Layout** (Phase 92 polish): Floating map canvas, background mesh, SideRailNav refinements, Top Command Center (search + toggles split), Plus Jakarta Sans font swap
2. **Parcel Detail Panel** (Phase 93): Left-side floating panel with satellite hero, score badge, zero-scroll bento overview, click-through detail layers

These are implemented together because the layout architecture directly affects panel positioning.

</domain>

<decisions>
## Implementation Decisions

### Font
- **Plus Jakarta Sans** (Google Fonts) replaces Satoshi/Inter everywhere
- Apply globally via CSS @font-face or Google Fonts CDN

### Background Canvas ("Aura Background Mesh")
- Body background: `#F2F6F3` (Morning Mist)
- Two large blurred color blobs behind the map for depth:
  - **Blob 1 (top-left):** Sage Mint `#D1E2D8`, opacity 15%, width ~40vw, `filter: blur(100px)`
  - **Blob 2 (bottom-right):** Light Amber `#F9A826`, opacity 10%, width ~35vw, `filter: blur(100px)`
- Purpose: Morning Mist "breathes" — avoids flat/cold feeling, enhances glass panel blur absorption

### Floating Map Canvas
- Map container: `padding: 16px` all sides, `border-radius: 40px` (`rounded-[40px]`)
- Map "floats" on the Morning Mist + blob background
- Shadow: `box-shadow: 0 20px 60px rgba(0,0,0,0.03)` — very soft
- **Map stays full-size always** — when parcel panel opens, only the viewport center shifts right to keep the selected parcel visible. Map container does NOT resize.

### SideRailNav (Refinements)
- Position: `fixed`, `left-6` (24px), `top-6`, `bottom-6` — change from current `left-4`
- Width: `80px`, `rounded-[40px]`
- Glass: `rgba(255,255,255,0.6)`, `backdrop-filter: blur(20px)`, `border: 1px solid rgba(255,255,255,0.4)`
- Shadow: `0 20px 50px rgba(0,0,0,0.05)`
- Logo: black circle at top (P monogram) — already done
- Active state: Warm Amber `#F9A826` glow/indicator — already done

### Top Command Center (Split Architecture)
Two separate floating pills — NOT one combined bar:

**1. Search Pill (top-left, next to sidebar)**
- Position: `left-[112px]` (80px sidebar + 32px gap), `top-6`
- Width: `320px`, pill-shaped (`rounded-full`)
- Glass material: same as sidebar (`white/60`, `blur`, `border-white/40`)
- Expand animation on click (subtly wider when typing)
- Pure address search — no toggles mixed in

**2. Toggle Pill (top-center)**
- Position: `top-8`, `left-1/2`, `-translate-x-1/2`
- Glass material: same recipe
- Three grouped sections separated by subtle vertical lines (`border-r border-white/20`):
  - **Base Layer:** Kaart / Satelliet (segmented control)
  - **View Level:** Gemeente / Wijk / Perceel (zoom focus)
  - **Intelligence Layer:** Bestemmingsplan toggle (glow when active)
- Active toggle: **Warm Amber `#F9A826`** background with white/black text
- Framer Motion `layoutId` for the sliding active indicator between toggles

### Aura Color & Material Hierarchy
Strict depth layering:
- **Body:** `#F2F6F3` (Morning Mist) + background mesh blobs
- **Panel Surfaces** (sidebar, detail panel):
  - `background: rgba(255,255,255,0.6)`
  - `backdrop-filter: blur(24px)`
  - `border: 1px solid rgba(255,255,255,0.4)` (edge lighting)
  - `box-shadow: 0 20px 50px rgba(0,0,0,0.04)`
- **BentoPods** (data blocks inside panels):
  - `background: rgba(255,255,255,0.4)` — NO blur (saves performance)
  - `border: 1px solid rgba(255,255,255,0.4)`
- **Accent Roles:**
  - **Intelligence:** `#F9A826` (Warm Amber) — scores, active icons, opportunity tags
  - **Action:** `#0E1111` (Deep Obsidian) — primary CTA "Genereer Rapport"
  - **Status:** `#22C55E` (Vitality Green) — positive bestemmingen, success states

### Parcel Detail Panel — Position & Layout
- **Position:** `fixed`, `left-[112px]` (next to sidebar), `top-6`, `bottom-6`
- **Width:** `420px`
- **THIS IS LEFT-SIDE, NOT RIGHT-SIDE** — panel appears left, map stays visible to the right
- Glass material: same as sidebar (white/60, blur 24px, border, shadow)
- `rounded-[32px]`

### Parcel Detail Panel — Content Structure (top to bottom)
| Element | Height | Behavior |
|---------|--------|----------|
| **Satellite Hero** | 180px | Fixed top, `rounded-t-[32px]`, live aerial crop from backend API |
| **Score Badge** | overlay | Deep Obsidian circle floating on hero corner, Amber score inside |
| **Sticky Address Header** | ~80px | `text-2xl font-bold`, stays visible in both overview and detail layers. Contains Back button in detail view |
| **Bento Grid** | flexible | Fills remaining viewport height. `grid-cols-2` layout |
| **Primary CTA** | 60px | "Genereer Rapport" pinned at bottom, Deep Obsidian background |

### Parcel Detail Panel — Zero-Scroll Philosophy
- **Overview (Layer 1):** Hero + address + 4 bento pods + CTA all fit within viewport. `overflow-hidden`. NO scrollbar.
- **Detail View (Layer 2):** Clicking a pod triggers slide-up animation. Hero + address + back button stay as fixed anchors. Detail content section gets `overflow-y-auto` and CAN scroll.
- Transition between layers: Framer Motion `AnimatePresence`

### Bento Stats Grid (4 Category Pods)
- 2×2 grid layout within the panel:
  1. **Potentie** — Score + vrije ruimte + transformatiepotentie
  2. **Risico** — Fundering + bodemtype + asbest + bodemkwaliteit
  3. **Markt** — Marktsignalen + kansen & aandachtspunten
  4. **Juridisch** — Bestemming + vergunningen + meldingen
- Each pod: icon + one-word label + key metric (scannable)
- No separate bestemming bar — bestemming inside Juridisch pod
- Each pod clickable → navigates to detail layer

### Click-Through Layer Navigation
- Clicking pod: slide-up transition replaces bento grid with detail layer
- Hero + address bar persist as fixed header
- Back arrow at top-left returns to bento overview
- Always back to overview first — no horizontal swipe between categories
- Detail layers CAN scroll, overview CANNOT

### Rapport Button
- Sticky bottom, fixed at panel bottom, always visible
- Full-width, Deep Obsidian (`#0E1111`) background
- "Genereer Rapport" → becomes "Bekijk Rapport" (Vitality Green accent) if report exists
- "Bekijk Rapport" navigates to report page

### Animations (Framer Motion)
- **New dependency:** `framer-motion` added to project
- **Panel open:** Slide-in from left (`x: -100%` → `x: 0`), smooth spring, **400-500ms**, Apple-style ease-out with subtle overshoot
- **Panel close:** Slide-out to left (reverse of open animation)
- **Layer switch (overview → detail):** Slide-up — detail content slides up over bento grid. Hero + address stay fixed.
- **Toggle active indicator:** `layoutId` for smooth sliding pill effect between toggle options
- **Cross-fade:** When clicking different parcel while panel is open, content cross-fades (not full panel re-animation)
- **`prefers-reduced-motion`:** All animations respect this — instant transitions as fallback

### All Interactions
- Hover on toggles/pods: `transition duration-300`, subtle `scale-105`
- Remove all hard black borders and heavy shadows globally
- Glass panels use edge-lighting borders (`border-white/40`) instead

### Claude's Discretion
- Exact pod dimensions and gap spacing within 2×2 grid
- Loading skeleton design for satellite image
- Error states (no satellite, no data for category)
- Detail layer sub-section layout per category (stacked vs sub-cards)
- Property info fields (oppervlak, bouwjaar) placement in relevant category layers
- Search pill expand animation specifics
- Framer Motion spring config values (stiffness, damping)

</decisions>

<specifics>
## Specific Ideas

- "Het moet voelen als een high-end besturingssysteem, niet als een website" — Apple-style design philosophy
- "De kaart zweeft niet zomaar op een plat vlak, maar in een ruimte met licht en sfeer" — background mesh creates ambient depth
- "Split View" layout: links de harde feiten, rechts de visuele kaart-context
- Panel = property intelligence briefing — scan 4 pods, click in for depth
- "Glanceability" — alles wat je nodig hebt in één oogopslag
- Reference: Behance real estate bento layouts with map + floating glass panels
- Toggle pill scalability: easy to add future toggles (e.g. "Risico-analyse") without layout shifts
- Search + toggles separation: "Waar kijk ik naar?" (search) vs "Hoe bekijk ik het?" (toggles)

</specifics>

<deferred>
## Deferred Ideas

- **Map markers Aura-style** — Score pills/wijk labels on map in Aura design. Separate discussion needed.
- **Mobile fallback** — Stacked layout instead of side-by-side on small screens. Desktop-only for now.
- Parcel comparison ("Vergelijken") — new capability, separate phase
- Share/link to specific parcel — future phase
- Horizontal swipe between categories — add later if back-to-overview feels too slow

</deferred>

---

*Phase: 92/93 — Aura Layout & Parcel Detail Panel*
*Context gathered: 2026-03-10 (deep discussion)*
