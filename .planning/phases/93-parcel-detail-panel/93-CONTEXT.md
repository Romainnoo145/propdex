# Phase 92-93: Aura Layout & Parcel Detail Panel - Context

**Gathered:** 2026-03-10 (updated — post-execution refinement)
**Status:** Ready for planning

<domain>
## Phase Boundary

Two interconnected deliverables:
1. **Global Aura Layout** (Phase 92 — DONE): Flex-based layout, three-pod sidebar, background mesh, Top Command Center, Plus Jakarta Sans
2. **Parcel Detail Panel** (Phase 93): Left-side floating panel with satellite hero, score badge, zero-scroll bento overview, click-through detail layers

</domain>

<decisions>
## Implementation Decisions

### CRITICAL: Layout Architecture (Phase 92 — Already Built)

The layout is a **flex system**, NOT fixed-position overlays:

```
body (bg-aura-canvas #F2F6F3)
  ├─ Sage Mint blob (40% opacity, blur 150px, top-left)
  ├─ Amber blob (12% opacity, blur 150px, bottom-right)
  └─ App Container (p-4 flex gap-4)
       ├─ Sidebar zone (w-16, three floating glass pods)
       │    ├─ Logo pod (rounded-full, bg-white/60, backdrop-blur-xl)
       │    ├─ Nav pod (rounded-[32px], bg-white/60, backdrop-blur-xl)
       │    └─ System pod (rounded-[32px], bg-white/60, backdrop-blur-xl)
       └─ Content area (flex-1, min-w-0)
            ├─ Map (absolute inset-0, rounded-[40px], border-white/20)
            └─ Outlet (non-map routes)
```

**The parcel detail panel must position WITHIN the content area (flex-1), NOT relative to viewport.**

### Font
- **Plus Jakarta Sans** (Google Fonts) — already applied globally via CDN

### Background Canvas ("Aura Background Mesh")
- Body: `#F2F6F3` (Morning Mist)
- Blob 1 (top-left): Sage Mint `#D1E2D8`, opacity 40%, 500px, `filter: blur(150px)`
- Blob 2 (bottom-right): Amber `#F9A826`, opacity 12%, 600px, `filter: blur(150px)`

### Floating Map Canvas
- Map: `absolute inset-0 rounded-[40px] overflow-hidden border border-white/20`
- Map is a flex-1 child — fills space next to sidebar
- **Map stays full-size always** — when parcel panel opens, map re-centers (easeTo with x offset) to keep parcel visible. Map container does NOT resize.

### SideRailNav (DONE — Three Floating Pods)
- Three separate glass pods (logo circle + nav capsule + system capsule)
- Glass: `bg-white/60 backdrop-blur-xl border border-white/40 shadow-sm`
- Active indicator: 48px amber circle with Framer Motion `layoutId` (spring stiffness 380, damping 30)
- Icons: `size={22} strokeWidth={1.5}`
- Container: invisible `w-16` flex column

### Top Command Center (DONE — Split Architecture)
Two separate floating pills within the content area:

**1. Search Pill (top-left)**
- Position: `absolute top-2 left-4` within content area
- Glass: `bg-white/20 backdrop-blur-3xl border border-white/40`
- Width: 320px, pill-shaped (`rounded-full`)

**2. Toggle Pill (top-center)**
- Position: `absolute top-8 left-1/2 -translate-x-1/2` within content area
- Three sections: Base Layer | View Level | Intelligence Layer
- Framer Motion `layoutId` per section for sliding amber indicator

### Aura Color & Material Hierarchy
Strict depth layering:
- **Body:** `#F2F6F3` (Morning Mist) + background mesh blobs
- **Glass Pods** (sidebar pods, detail panel):
  - `background: rgba(255,255,255,0.6)`
  - `backdrop-filter: blur(24px)` (or `backdrop-blur-xl`)
  - `border: 1px solid rgba(255,255,255,0.4)` (edge lighting)
  - `box-shadow: shadow-sm` or subtle
- **BentoPods** (data blocks inside panels):
  - `background: rgba(255,255,255,0.4)` — NO blur (saves performance)
  - `border: 1px solid rgba(255,255,255,0.4)`
- **Accent Roles:**
  - **Intelligence:** `#F9A826` (Warm Amber) — scores, active icons, opportunity tags
  - **Action:** `#0E1111` (Deep Obsidian) — primary CTA "Genereer Rapport"
  - **Status:** `#22C55E` (Vitality Green) — positive bestemmingen, success states

### Parcel Detail Panel — Position & Layout
- **Position:** `absolute` within the content area (flex-1 div), NOT `fixed` to viewport
- **Positioning:** `left-0 top-0 bottom-0` within content area — sits between sidebar and map
- **Width:** `420px`
- **THIS IS LEFT-SIDE** — panel appears left within content area, map stays visible to the right
- Glass material: `bg-white/60 backdrop-blur-xl border border-white/40 shadow-sm`
- `rounded-[32px]`
- The map container stays `absolute inset-0` — panel overlaps the left portion of the map

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
- `framer-motion` already installed
- **Panel open:** Slide-in from left (`x: -100%` → `x: 0`), smooth spring, **400-500ms**, Apple-style ease-out with subtle overshoot
- **Panel close:** Slide-out to left (reverse of open animation)
- **Layer switch (overview → detail):** Slide-up — detail content slides up over bento grid. Hero + address stay fixed.
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
- Sidebar = three floating glass pods, NOT one strip. Background (Aura) visible between pods.

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
*Context updated: 2026-03-10 (post Phase 92 execution with design refinements)*
