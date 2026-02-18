# Phase 34: Mobile Responsiveness — Research

**Researched:** 2026-02-18
**Domain:** Responsive layout, touch UX, bottom-sheet patterns, mobile navigation
**Confidence:** HIGH (based on direct codebase audit + Tailwind v4 defaults)

---

## Summary

Phase 34 adapts the Propdex desktop UI for mobile and tablet field use in **read-only** mode. The
app is a map-centric tool with a persistent side-rail nav, floating overlays, a data table, and a
right-side inspector panel — none of which work on small screens. The implementation is purely
CSS/layout-level: no new libraries needed, no backend changes.

Three main problems must be solved:

1. **Navigation gap**: `SideRailNav` is `hidden` below `md:` (768px) with no replacement. A
   bottom tab bar is the standard mobile-first replacement for side-rail nav on fixed-layout apps.

2. **Layout collisions**: The `InspectorPanel` slides in from the right edge (w-80); on a 375px
   screen that takes 85%+ of the viewport. It must become a bottom sheet on mobile. The existing
   `Drawer` component already has this pattern (`md:` breakpoint switches right-drawer to
   bottom-sheet) and can be referenced as the model.

3. **Table unusability**: `ResultsTable` renders a full `<table>` with 7 columns. At 768px this
   overflows or compresses to unreadable widths. It must transform to a card list below 768px.

**No new npm dependencies are needed.** All patterns can be built with Tailwind v4 responsive
variants, the existing CSS custom properties, and a small `useIsMobile` hook using the browser
`matchMedia` API.

**Primary recommendation:** Mobile-first refactor using Tailwind `md:` prefix throughout — bottom
tab bar replaces side-rail, InspectorPanel becomes bottom sheet below md, ResultsTable renders card
list below md, and scan/edit features show a "desktop-only" banner on mobile.

---

## Codebase Audit Findings

### Current Mobile State (verified by source inspection)

| Component | Location | Mobile Problem |
|-----------|----------|----------------|
| `SideRailNav` | `components/layout/SideRailNav.tsx:63` | `className="hidden ... md:flex"` — completely absent on mobile |
| `_authenticated.tsx` | `routes/_authenticated.tsx:95` | `className="flex h-screen"` — no mobile nav replacement |
| `InspectorPanel` | `components/layout/InspectorPanel.tsx:26` | `absolute right-0 top-0 h-full w-80 max-w-[90vw]` — right-side slide-over occupies full width on mobile |
| `ResultsTable` | `components/results/ResultsTable.tsx:330` | Bare `<table>` with 7 columns — overflows on mobile |
| `ResultsLayout` (map overlay) | `components/results/ResultsLayout.tsx:138` | `w-[45%] max-w-2xl` left overlay — covers map but is too small for mobile |
| `AddressSearch` | Referenced in `map.tsx:784` | Floats top-left over map — overlaps controls on mobile |

### Already Mobile-Ready (no changes needed)

- `Drawer.tsx` — already implements bottom-sheet on mobile: `inset-x-0 bottom-0 rounded-t-2xl max-h-[85vh] md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:rounded-none`
- `ResultsShell.tsx` — simple scrollable container, works at any width
- `ProjectList.tsx` — accordion list with white cards, naturally responsive
- `ParcelDetailModal.tsx` — modal overlay, already reasonably responsive

### Existing CSS Primitives

- `index.css` already has `@keyframes slide-up` and `.animate-slide-up` — ready for bottom sheet
- Z-index scale defined as CSS custom properties — bottom tab bar needs a new token (`--z-bottom-nav`)
- Tailwind v4 breakpoints: `sm` = 640px, `md` = 768px, `lg` = 1024px (Tailwind v4 defaults, mobile-first)

### What `md:` Means in This Codebase

All existing desktop-targeted classes use `md:` as the breakpoint. The side-rail uses `md:flex`.
The `Drawer` uses `md:` for the desktop variant. This confirms `md` (768px) is the mobile/desktop
boundary for this project. Stay consistent — do not introduce a different breakpoint for mobile.

---

## Standard Stack

### Core (already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS v4 | 4.1.18 | Responsive variants (`md:`, `sm:`) | Already in use; `md:` is established mobile boundary |
| React 19 | 19.2.0 | Component rendering | Already in use |
| CVA | 0.7.1 | Responsive variant logic | Already in use for primitives |

### Supporting (no new dependencies needed)

`useIsMobile` hook using `window.matchMedia('(max-width: 767px)')` — hand-rolled, ~15 lines. This
is simpler than adding `@tanstack/react-query` helpers or a separate media-query library.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom `useIsMobile` hook | `react-use` (useMedia) | Not in project; adding library for a 15-line hook is unnecessary |
| Tailwind responsive classes | CSS media queries in `index.css` | Classes co-locate with components; CSS file is reserved for global/animation rules |
| Bottom tab bar (custom) | `react-navigation` or similar | Those are React Native; not applicable to web |

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── hooks/
│   └── useIsMobile.ts          # NEW: matchMedia hook returning boolean
├── components/
│   ├── layout/
│   │   ├── SideRailNav.tsx     # MODIFY: hide on mobile (already done), extract nav items
│   │   ├── BottomTabNav.tsx    # NEW: mobile bottom tab bar
│   │   ├── InspectorPanel.tsx  # MODIFY: bottom sheet on mobile
│   │   └── _authenticated.tsx  # MODIFY: add BottomTabNav, adjust padding
│   └── results/
│       ├── ResultsTable.tsx    # MODIFY: card list below md
│       └── ParcelCard.tsx      # NEW: mobile card component for a single parcel
```

### Pattern 1: `useIsMobile` Hook

**What:** `matchMedia` hook that returns `true` when viewport is below `md` breakpoint (768px).
**When to use:** When you need JS-side knowledge of mobile (e.g., render different JSX tree).
**Example:**

```typescript
// src/hooks/useIsMobile.ts
import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 768 // matches Tailwind md:

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
  )

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isMobile
}
```

**Note:** Use this hook only when different JSX must be rendered. For pure styling differences
(colors, padding, font sizes), always prefer Tailwind responsive prefixes — they are faster and
don't cause hydration differences.

### Pattern 2: Bottom Tab Bar

**What:** Fixed bottom navigation replacing `SideRailNav` on mobile. Shows Kaart, Resultaten,
Projecten with lucide-react icons (already used). Height is exactly 56px — all touch targets
are 44px+ (satisfies MOB-03).

**When to use:** Visible only below `md` via `flex md:hidden`.

```tsx
// src/components/layout/BottomTabNav.tsx
// Uses: Link, useMatchRoute from @tanstack/react-router
// Uses: Map, ListOrdered, FolderOpen from lucide-react (already imported in SideRailNav)

export default function BottomTabNav() {
  // Same nav items as SideRailNav (Kaart, Resultaten, Projecten)
  // Fixed bottom, z-index var(--z-bottom-nav), bg-grey-900, border-t border-grey-800
  // flex md:hidden
  // Each item: min-h-[56px] with icon (20px) + label (text-xs)
}
```

**Z-index:** Add `--z-bottom-nav: 250` to `index.css` (same level as side-rail — they never
coexist). Actually the side-rail already has `--z-side-rail: 250`. Reuse that value or add a
separate token. Recommendation: add `--z-bottom-nav: 250` for clarity.

**Body padding:** When bottom tab bar is visible, the main content area needs `pb-14` (56px
padding) to avoid content hidden behind the bar. Add `pb-14 md:pb-0` to the `<main>` element in
`_authenticated.tsx`.

### Pattern 3: Bottom Sheet InspectorPanel

**What:** `InspectorPanel` transforms from a right-edge slide-over to a bottom sheet on mobile.
**Reference:** `Drawer.tsx` already implements exactly this pattern. Mirror it.

```tsx
// InspectorPanel.tsx — MODIFY
// Mobile: fixed inset-x-0 bottom-0 max-h-[60vh] rounded-t-2xl (bottom sheet)
// Desktop: absolute right-0 top-0 h-full w-80 (existing behavior)

<div
  className={`
    // Mobile: bottom sheet
    fixed inset-x-0 bottom-0 max-h-[60vh] rounded-t-xl
    // Desktop: right-side panel
    md:absolute md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:h-full md:w-80 md:max-h-none md:rounded-none
    // Common
    bg-grey-900 border-grey-800 flex flex-col shadow-lg
    transition-transform duration-300 ease-out
    ${isOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}
  `}
  style={{ zIndex: 'var(--z-property-panel)' }}
>
  {/* Drag handle — mobile only */}
  <div className="flex justify-center py-2 md:hidden shrink-0">
    <div className="w-10 h-1 bg-grey-700 rounded-full" />
  </div>
  {/* Existing header + content unchanged */}
</div>
```

**Key insight:** The `InspectorPanel` is currently `absolute` positioned inside `MapShell` (which
is `relative`). On mobile, change to `fixed` so it slides over the bottom tab bar area too. The
`Drawer.tsx` uses `fixed` and this is the correct approach for bottom sheets.

### Pattern 4: ResultsTable → Card List on Mobile

**What:** Below `md`, `ResultsTable` renders a `<div>` list of `ParcelCard` components instead of
a `<table>`.
**When to use:** `useIsMobile()` or CSS `hidden md:block` for the table, `block md:hidden` for
card list.

**Recommended approach:** Use `useIsMobile()` hook to conditionally render table vs card list
inside `ResultsTable`. CSS-only hide/show would duplicate the DOM and create issues with
`useScanResults` data binding. Render one or the other based on hook.

```tsx
// ResultsTable.tsx — MODIFY
const isMobile = useIsMobile()

if (isMobile) {
  return (
    <div className="h-full overflow-y-auto divide-y divide-grey-800">
      {table.getRowModel().rows.map((row) => (
        <ParcelCard
          key={row.id}
          parcel={row.original}
          isSelected={row.original.parcel_id === selectedParcelId}
          onClick={() => onRowClick?.(row.original.parcel_id)}
        />
      ))}
    </div>
  )
}
// ... existing table JSX unchanged
```

**ParcelCard** — simple card showing the key fields a user needs in the field:
- Address (prominent)
- Score badge (amber)
- Area m2
- Bestemming (truncated)
- Tap to select

### Pattern 5: Mobile Read-Only Banner

**What:** On mobile, disable scan/edit features with an inline notice.
**Where to show:** `/resultaten` filter panel controls (disable with a tooltip or replace with
banner), `/map` scan buttons (show "Gebruik desktop" toast/banner).

**Pattern:** Simple conditional in each component:

```tsx
{isMobile && (
  <div className="rounded-md bg-amber-accent/10 border border-amber-accent/30 px-3 py-2 text-xs text-amber-accent">
    Gebruik desktop voor scannen en exporteren
  </div>
)}
```

This satisfies the "graceful disabled with explanation" success criterion.

### Pattern 6: MapShell Controls on Mobile

**What:** The map's floating controls (AddressSearch top-left, LayerToggle, gemeente header) are
positioned absolute. On mobile these stack and overlap.

**Approach:** On mobile:
- `AddressSearch`: full-width at top (`left-0 right-0 top-0` instead of `left-16 top-4`) to avoid side-rail offset
- `LayerToggle`: collapse to a single icon button on mobile; the full toggle list can open as a
  bottom sheet
- Gemeente active header: scroll horizontally or show truncated; scan button hidden on mobile

**Note:** The `_authenticated.tsx` layout currently positions MapView behind a `<main className="flex-1 relative overflow-hidden">`. On mobile (no side-rail), `flex-1` takes full width which is correct. The controls inside `MapShell` use `absolute` positioning relative to `MapShell`'s `relative w-full h-full` container — this is correct for mobile too.

### Anti-Patterns to Avoid

- **Don't use `useState` for breakpoint tracking without SSR guard**: The `useIsMobile` hook needs
  the `() =>` initializer form so it reads the initial value synchronously (avoids flicker).
- **Don't position bottom sheet as `absolute`**: Must be `fixed` so it overlays the bottom nav bar.
- **Don't hide table via CSS only**: Both table and card list would share data-fetching if rendered
  — let `useIsMobile` conditionally render one branch.
- **Don't add viewport meta tag changes**: The project's `index.html` should already have
  `<meta name="viewport" content="width=device-width, initial-scale=1.0">` — do not alter it.
- **Don't break the 44px touch target rule with Tailwind utilities**: `h-12 w-12` (48px) is the
  existing standard in `SideRailNav`. All new mobile touch targets should be `min-h-[44px]` or
  use `h-12` (48px) to be safe.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bottom sheet animation | Custom JS-driven animation | CSS `translate-y` transition + `animate-slide-up` (already in `index.css`) | CSS transitions are GPU-composited, handle interruption |
| Breakpoint detection | Polling `window.innerWidth` | `matchMedia` + event listener | matchMedia fires once on change, not every pixel |
| Mobile nav routing | Custom state machine | `@tanstack/react-router` `Link` + `useMatchRoute` (same as SideRailNav) | Already proven pattern |
| Swipe-to-dismiss | Touch event state machine | CSS `touch-action: pan-y` + existing transition | Adds complexity; not in requirements |

**Key insight:** The Drawer component (`components/ui/Drawer.tsx`) already solved the bottom-sheet
problem. The InspectorPanel just needs to adopt the same responsive pattern rather than building
something new.

---

## Common Pitfalls

### Pitfall 1: Absolute Positioning Breaks on Mobile

**What goes wrong:** `absolute right-0 top-0` controls assume a specific parent width. When the
side-rail disappears, the parent expands to full viewport — this is actually fine for full-width
panels. However, the `AddressSearch` positioned at `left-4 top-4` was designed with the side-rail
(64px) already clipping the left edge. Without the side-rail on mobile, the search bar starts
directly at the screen edge, which may be correct but verify the `max-w-xs` constraint.

**How to avoid:** Verify each absolute-positioned element in `map.tsx` renders correctly at 375px
width. The main changes needed are AddressSearch top positioning and LayerToggle z-index stacking.

### Pitfall 2: Bottom Tab Bar Covers Map Content

**What goes wrong:** Fixed bottom tab bar (56px) sits above map content. Map controls near the
bottom (attribution, navigation controls, any popups) get clipped.

**How to avoid:** Add `padding-bottom: 56px` to the MapLibre container on mobile. MapLibre exposes
`map.setPadding()` for this. Alternatively, the `MapView` component can apply a `pb-14 md:pb-0`
class to its container div.

**Warning sign:** MapLibre attribution control is hidden at bottom-right — if it appears behind
the nav bar, bottom padding wasn't applied.

### Pitfall 3: Touch Events on the Map Conflict with Bottom Sheet

**What goes wrong:** A bottom sheet that slides up from the bottom requires vertical swipe gestures.
MapLibre intercepts all touch events on its canvas. If the InspectorPanel bottom sheet is rendered
inside the `MapShell` (which it is), touch events may be eaten by the map.

**How to avoid:** The InspectorPanel's bottom sheet should use `position: fixed` (not absolute)
so it's outside MapLibre's event capture zone. The existing `Drawer.tsx` uses `fixed` and adds
`onTouchStart={(e) => e.stopPropagation()}` on its scroll container — copy this pattern.

### Pitfall 4: `ResultsLayout` Overlay Removed in Phase 30

**What goes wrong:** Phase 30 removed `ResultsLayout` from the `/map` route overlay. The current
`/map` route does NOT show a results panel overlay — it navigates to `/resultaten`. This is
relevant because MOB-01 says "map, projects, scan results" in read-only mode. The mobile map view
already just shows the map and inspector panel; the results are a separate route. This is already
clean for mobile.

**How to avoid:** Do not re-introduce `ResultsLayout` as an overlay for mobile. The `/resultaten`
route with card layout handles results. Navigation between map and results uses the bottom tab bar
or the "Toon Kaart" / "Toon Lijst" buttons.

### Pitfall 5: `InspectorPanel` is `absolute` inside `MapShell` (not `fixed`)

**What goes wrong:** Changing `InspectorPanel` to a bottom sheet while keeping `absolute`
positioning means it's clipped by `MapShell`'s `overflow-hidden`. The panel would get cut off.

**How to avoid:** Switch `InspectorPanel` to `fixed` positioning on mobile (as noted in Pattern
3). Use `md:absolute` to restore desktop behavior. Test that `overflow-hidden` on `MapShell` does
not clip the fixed panel (it won't — `fixed` escapes overflow context).

### Pitfall 6: SideRailNav is `hidden` on Mobile — It Also Controls Report Sidebar Toggle

**What goes wrong:** The `onToggleSidebar` prop passed to `SideRailNav` controls the report
sidebar (Rapporten / FileText button). If `SideRailNav` is hidden on mobile, there's no way to
open the report sidebar on mobile.

**How to avoid:** For Phase 34, the report sidebar is a desktop-only feature (editing/saving
reports is disabled on mobile). The bottom tab bar does NOT need a "Rapporten" item — scan
results, map, and projects are the read-only views. If the sidebar is needed later, add a
hamburger menu. For now, accept this as a deliberate "desktop-only" feature gap.

---

## Code Examples

### useIsMobile hook

```typescript
// src/hooks/useIsMobile.ts
import { useState, useEffect } from 'react'

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 767px)').matches
      : false
  )

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isMobile
}
```

### BottomTabNav skeleton

```tsx
// src/components/layout/BottomTabNav.tsx
import { Link, useMatchRoute } from '@tanstack/react-router'
import { Map, ListOrdered, FolderOpen } from 'lucide-react'

const navItems = [
  { icon: Map, label: 'Kaart', to: '/map' },
  { icon: ListOrdered, label: 'Resultaten', to: '/resultaten' },
  { icon: FolderOpen, label: 'Projecten', to: '/projecten' },
] as const

export default function BottomTabNav() {
  const matchRoute = useMatchRoute()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 flex md:hidden border-t border-grey-800 bg-grey-900"
      style={{ zIndex: 'var(--z-bottom-nav)' }}
    >
      {navItems.map(({ icon: Icon, label, to }) => {
        const isActive = !!matchRoute({ to })
        return (
          <Link
            key={to}
            to={to}
            className={`flex flex-1 flex-col items-center justify-center min-h-[56px] gap-0.5
              ${isActive ? 'text-amber-accent' : 'text-grey-400'}`}
          >
            <Icon size={20} />
            <span className="text-xs">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

### _authenticated.tsx integration

```tsx
// In AuthenticatedLayout return:
<div className="flex h-screen">
  <SideRailNav ... />           {/* hidden on mobile (md:flex) */}
  <ReportSidebar ... />          {/* desktop only — leave as-is */}
  <main className="flex-1 relative overflow-hidden pb-14 md:pb-0">
    {/* MapView stays unchanged */}
    {/* Route content stays unchanged */}
  </main>
  <BottomTabNav />               {/* NEW: flex md:hidden via CSS inside component */}
</div>
```

### InspectorPanel bottom sheet (key classes)

```tsx
// Mobile: bottom sheet via fixed + translate-y
// Desktop: right-side panel via md:absolute + translate-x

className={`
  fixed inset-x-0 bottom-0 max-h-[65vh]
  md:absolute md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:h-full md:w-80 md:max-h-none
  rounded-t-xl md:rounded-none
  bg-grey-900 border-t md:border-t-0 md:border-l border-grey-800
  flex flex-col shadow-lg
  transition-transform duration-300 ease-out
  ${isOpen
    ? 'translate-y-0 md:translate-y-0 md:translate-x-0'
    : 'translate-y-full md:translate-y-0 md:translate-x-full'
  }
`}
style={{ zIndex: 'var(--z-property-panel)' }}
```

### ParcelCard (mobile results card)

```tsx
// src/components/results/ParcelCard.tsx
interface ParcelCardProps {
  parcel: ScanResultItem
  isSelected: boolean
  onClick: () => void
}

export function ParcelCard({ parcel, isSelected, onClick }: ParcelCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 min-h-[72px] transition-colors
        ${isSelected ? 'bg-grey-850 ring-1 ring-inset ring-amber-accent/30' : 'hover:bg-grey-850'}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-grey-100 truncate">
            {parcel.address ?? parcel.parcel_code ?? 'Onbekend'}
          </p>
          <p className="text-xs text-grey-400 mt-0.5">
            {parcel.area_m2 != null
              ? `${parcel.area_m2.toLocaleString('nl-NL')} m²`
              : '—'}
            {parcel.bestemmingen?.[0]
              ? ` · ${(parcel.bestemmingen[0] as {type?: string}).type ?? ''}`
              : ''}
          </p>
        </div>
        <ScoreBadge score={parcel.score} category={parcel.score_category} />
      </div>
    </button>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@media` queries in CSS | Tailwind responsive prefixes (`md:`) | Project standard (Phase 27+) | Stay in JSX, not in CSS |
| `addEventListener('resize')` | `matchMedia` + event listener | Long-standing best practice | Fires once on breakpoint cross, not every pixel |
| Hamburger menus | Bottom tab bar | 2016+ mobile UX standard | Thumb-reachable navigation at bottom |
| Right-side drawers on mobile | Bottom sheet | iOS/Android native UX standard | Bottom sheets are predictable on touch |

**Deprecated/outdated:**
- Polling `window.innerWidth` on resize: replaced by `matchMedia` (more efficient)
- CSS `display:none` on both layouts: replaced by conditional rendering with `useIsMobile` for the table/card case

---

## Open Questions

1. **MapLibre bottom padding on mobile**
   - What we know: Fixed bottom nav is 56px; MapLibre navigation/attribution controls appear at the bottom
   - What's unclear: Whether MapLibre's `setPadding()` needs to be called programmatically or if CSS padding on the container is sufficient
   - Recommendation: Try CSS `pb-14` on the MapView container first; call `map.resize()` after if needed (already done in `_authenticated.tsx` for visibility changes)

2. **AddressSearch on mobile map**
   - What we know: Positioned `absolute left-4 top-4` inside MapShell; full-width on mobile would improve usability
   - What's unclear: Whether to add full-width class at mobile breakpoint or rely on existing `max-w-xs` constraint
   - Recommendation: Add `left-2 right-2 md:left-4 md:right-auto max-w-none md:max-w-xs` to make it full-width on mobile

3. **Scan action accessibility on mobile**
   - What we know: The gemeente header with "Scan zichtbaar gebied" button appears on the map. On mobile, scanning is disabled (read-only).
   - What's unclear: Whether to hide scan buttons entirely or show them grayed out with a tooltip
   - Recommendation: Hide scan/cancel buttons on mobile (`hidden md:flex`) and show a banner "Gebruik desktop voor scannen" — simpler than managing disabled states

4. **Resultaten route on mobile — filter panel**
   - What we know: `ResultsFilterPanel` is a horizontal row of filter chips above the table
   - What's unclear: How the filter panel responds at mobile widths — not audited in this research
   - Recommendation: Audit `ResultsFilterPanel.tsx` during planning; likely needs horizontal scroll or collapse to a "Filters" button on mobile

---

## Implementation Scope Summary

| Requirement | Files to Change | Complexity |
|-------------|-----------------|------------|
| MOB-01 Mobile read-only map | `map.tsx` (hide scan buttons), `_authenticated.tsx` (add BottomTabNav) | Low |
| MOB-01 Mobile projects view | `ProjectList.tsx` (audit touch targets), `projecten.tsx` | Low — already card-based |
| MOB-01 Mobile scan results | `resultaten.tsx`, `ResultsTable.tsx` | Medium — card rendering |
| MOB-02 Table-to-card layout | `ResultsTable.tsx` (new), `ParcelCard.tsx` (new) | Medium |
| MOB-03 44px touch targets | `BottomTabNav.tsx`, `InspectorPanel.tsx`, filter chips | Low — use `min-h-[44px]` |
| Bottom tab bar (navigation gap) | `BottomTabNav.tsx` (new), `_authenticated.tsx`, `index.css` | Low |
| Inspector bottom sheet | `InspectorPanel.tsx` | Low — follow `Drawer.tsx` pattern |
| `useIsMobile` hook | `hooks/useIsMobile.ts` (new) | Trivial |
| Desktop-only banner | Inline in `map.tsx`, `resultaten.tsx` | Trivial |

---

## Sources

### Primary (HIGH confidence)

- Direct source audit: `SideRailNav.tsx`, `InspectorPanel.tsx`, `ResultsTable.tsx`, `ResultsLayout.tsx`, `_authenticated.tsx`, `Drawer.tsx`, `index.css`, `package.json` — all read and analyzed
- Tailwind v4 default breakpoints: `sm=640px`, `md=768px`, `lg=1024px` — confirmed from `@import "tailwindcss"` with no custom `--breakpoint-*` overrides in `@theme`

### Secondary (MEDIUM confidence)

- `Drawer.tsx` as bottom sheet reference: direct code inspection confirms the pattern works (it's already in production use for `PropertyDetailDrawer`)
- 44px touch target standard: Apple HIG and Material Design both specify 44-48dp minimum tap targets — widely established, not re-verified against 2026 documentation

### Tertiary (LOW confidence)

- MapLibre `setPadding()` for bottom nav padding: cited from MapLibre GL JS API knowledge; not re-verified against Context7 for v5.17.0 — verify during implementation
- `matchMedia` `addEventListener` vs `addListener` (deprecated): `addListener` is deprecated in modern browsers, `addEventListener('change', ...)` is the replacement — HIGH confidence from MDN but not re-verified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all from direct package.json audit
- Architecture: HIGH — patterns derived directly from existing `Drawer.tsx`, `SideRailNav.tsx`
- Pitfalls: HIGH — based on source code inspection of specific component code

**Research date:** 2026-02-18
**Valid until:** 2026-03-20 (30 days — stable technology)
