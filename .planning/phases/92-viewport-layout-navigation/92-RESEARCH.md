# Phase 92: Viewport Layout & Navigation - Research

**Researched:** 2026-03-10
**Domain:** Frontend layout architecture, CSS viewport management, floating navigation
**Confidence:** HIGH

## Summary

Phase 92 transforms the Propdex layout from a traditional sidebar+content arrangement into a viewport-locked map with all controls floating on glass surfaces. The current `_authenticated.tsx` already uses `h-screen` with a flex layout containing `SideRailNav` (16px/64px wide, border-right, solid bg) alongside a `main` area with the map. This phase replaces that with a full-viewport map and repositions all navigation as floating glass overlays.

The current codebase is well-prepared for this change: `MapShell` already provides `pointer-events-none` with `[&>*]:pointer-events-auto` for floating elements, `GlassPanel` primitive exists with `blur: 'active'` and `rounded: 'rail'` variants, Aura tokens and z-index scale are established, and the `AddressSearch` already positions itself absolutely. The main work is restructuring `_authenticated.tsx` layout, rebuilding `SideRailNav` as a floating glass rail, reshaping `AddressSearch` into a pill, and relocating `LayerToggle` from bottom-left to top-center.

**Primary recommendation:** Restructure `_authenticated.tsx` to make map truly full-viewport, convert SideRailNav to a floating `GlassPanel` with `blur="active" rounded="rail"`, transform AddressSearch into a rounded-full pill, and move LayerToggle to top-center as a chip dock.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NAV-01 | Viewport-locked layout -- map fills 100% screen, all UI floats on z-50 with 16px margin from edges | Restructure `_authenticated.tsx`: remove flex sidebar layout, make map `absolute inset-0`, all overlays use existing z-index scale. MapShell already provides pointer-events pattern. |
| NAV-02 | Floating SideRailNav (left, 80px wide, rounded-[40px], glass): Propdex logo top, functional icons middle, settings + notifications + profile bottom, tooltips on hover | Current SideRailNav is 64px (`w-16`) with border-right solid bg. Convert to `fixed left-4 top-4 bottom-4 w-20 GlassPanel blur="active" rounded="rail"`. Reorder icons per spec: logo top, Map/Resultaten/Jurisprudentie middle, Settings+Notifications+Profile bottom. Tooltips already implemented. |
| NAV-03 | Search pill (top-left, rounded-full, glass) with PDOK address autocomplete | AddressSearch already positions `absolute top-4 left-4`. Shift to `left-[112px]` (80px rail + 16px gap + 16px margin) to clear SideRailNav. Apply `rounded-full` and `GlassPanel blur="active" rounded="pill"` styling. PDOK autocomplete logic unchanged. |
| NAV-04 | Filter/Toggle dock (top-center) with chip-style dropdowns for gemeente/perceel toggle and layer controls | LayerToggle currently `absolute bottom-4 left-4`. Move to `top-4 left-1/2 -translate-x-1/2`. Already has pill-shaped chips with rounded-full buttons. Reposition and verify overlay dropdown behavior works at top of screen. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 4.1.18 | Utility-first styling | Already in use, v4 with `@theme` block in `index.css` |
| class-variance-authority | 0.7.1 | Component variants | Already used by GlassPanel, Button, Badge |
| lucide-react | 0.564.0 | Icons | Already used throughout SideRailNav |
| MapLibre GL JS | 5.17.0 | Map rendering | Already mounted in `_authenticated.tsx` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tailwind-merge | 3.4.1 | Class dedup | Used in `cn()` utility for composing classes |
| clsx | 2.1.1 | Conditional classes | Used alongside tailwind-merge |

### Alternatives Considered
None -- this phase uses only existing dependencies. No new packages needed.

## Architecture Patterns

### Current Layout Structure
```
_authenticated.tsx:
  <div className="flex h-screen">
    <SideRailNav />                    // 64px fixed sidebar, border-right
    <main className="flex-1 relative overflow-hidden">
      <div absolute inset-0>           // MapView (CSS-toggled visibility)
        <MapView />
      </div>
      <MapContext.Provider>
        <Outlet />                     // Route content (MapShell wraps map controls)
      </MapContext.Provider>
    </main>
    <BottomTabNav />                   // Mobile bottom bar
  </div>
```

### Target Layout Structure
```
_authenticated.tsx:
  <div className="relative h-screen w-screen overflow-hidden">
    <div className="absolute inset-0">   // MapView -- true full viewport
      <MapView />
    </div>
    <MapContext.Provider>
      <Outlet />                          // Route content
    </MapContext.Provider>
    <SideRailNav />                       // Floating glass, fixed left-4
    <BottomTabNav />                      // Mobile only, unchanged
  </div>
```

### Pattern 1: Viewport-Locked Map
**What:** Map fills entire viewport with no document scroll. All UI elements float on top with `pointer-events-none` containers and `pointer-events-auto` on interactive children.
**When to use:** Full-screen map applications where the map is the primary content.
**Implementation:**
- Parent: `relative h-screen w-screen overflow-hidden`
- Map: `absolute inset-0` (already the case)
- Controls: Each positioned with `fixed` or `absolute` + z-index
- MapShell already implements `pointer-events-none [&>*]:pointer-events-auto`

### Pattern 2: Floating Glass Navigation Rail
**What:** SideRailNav becomes a floating panel with 16px margins from viewport edges, glass blur, and pill-rounded corners.
**Key change:** From `h-full w-16 shrink-0 flex-col border-r bg-aura-glass-white/60` (in-flow) to `fixed left-4 top-4 bottom-4 w-20 rounded-[40px] bg-aura-glass-white/60 backdrop-blur-xl border-white/40 shadow-glass` (floating).
**Critical:** SideRailNav must render on ALL authenticated routes (not just /map), so it stays in `_authenticated.tsx`.

### Pattern 3: Search Pill Positioning
**What:** AddressSearch shifts right to clear the floating SideRailNav.
**Current:** `absolute top-4 left-4`
**Target:** `absolute top-4 left-[112px]` (80px nav + 16px gap + 16px original margin)
**Note:** On mobile (< md), SideRailNav is hidden, so search reverts to `left-4`. Use `left-4 md:left-[112px]`.

### Pattern 4: Top-Center Filter Dock
**What:** LayerToggle moves from bottom-left to top-center, becoming the central chip dock.
**Current:** `absolute bottom-4 left-4`
**Target:** `absolute top-4 left-1/2 -translate-x-1/2`
**Consideration:** The score gradient legend that currently sits beside it (bottom-left) needs repositioning. Move legend to bottom-right near attribution.

### Anti-Patterns to Avoid
- **Nesting position:fixed inside position:relative containers:** Fixed positioning is relative to viewport, not parent. The SideRailNav should use `fixed` so it appears on all routes, not `absolute` which would limit it to map view.
- **Breaking MapView remount:** The MapView is deliberately never unmounted (CSS-toggled). Do not change this pattern -- map re-initialization is expensive.
- **Adding body scroll:** `overflow-hidden` on the root container is essential. Any page-level scrollbar breaks the full-viewport illusion.
- **Hardcoding pixel offsets:** Use CSS custom properties or calc() for derived positions to keep offsets maintainable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Glass panel styling | Manual className strings | `GlassPanel` primitive with `blur="active"` | Already built in Phase 91, handles border, blur, shadow, reduced-motion |
| Tooltip positioning | Custom tooltip logic | Existing tooltip pattern in SideRailNav | `absolute left-full ml-2` with `group-hover:opacity-100` already works |
| Responsive breakpoints | Custom media queries | Tailwind `md:` prefix | Current SideRailNav uses `hidden md:flex`, BottomTabNav uses `md:hidden` |
| Z-index management | Arbitrary z-values | CSS variables from `index.css` (--z-side-rail, --z-search-bar, etc.) | Already established scale prevents z-index wars |

**Key insight:** Phase 91 created all the visual primitives. This phase is purely a layout restructuring -- no new components need to be created, only existing ones restyled and repositioned.

## Common Pitfalls

### Pitfall 1: Non-Map Routes Lose SideRailNav
**What goes wrong:** Moving SideRailNav into MapShell or map.tsx removes it from /resultaten, /rapporten, etc.
**Why it happens:** Enthusiasm for "everything floats on the map" leads to putting nav inside the map route.
**How to avoid:** SideRailNav MUST stay in `_authenticated.tsx` (the layout route). It renders on ALL authenticated routes. For non-map routes, it floats over the solid `bg-aura-canvas` background instead of the map.
**Warning signs:** Navigate to /resultaten and SideRailNav disappears.

### Pitfall 2: MapLibre Controls Clash with Floating UI
**What goes wrong:** MapLibre's built-in NavigationControl (top-right zoom buttons) and GeolocateControl overlap with floating panels.
**Why it happens:** MapLibre controls use their own z-index and positioning.
**How to avoid:** MapView adds controls at `top-right`. The SideRailNav is on the left, search top-left, filters top-center. No clash with default MapLibre control positions. If parcel detail panel (Phase 93) goes right, check for overlap then.
**Warning signs:** Zoom controls hidden behind panels.

### Pitfall 3: Pointer Events Leak Through Glass Panels
**What goes wrong:** Clicks on glass panels pass through to the map underneath due to transparent areas.
**Why it happens:** `pointer-events-none` on MapShell parent propagates to children that aren't explicitly `pointer-events-auto`.
**How to avoid:** Every floating container must have `pointer-events-auto`. MapShell's `[&>*]:pointer-events-auto` handles direct children, but nested containers need explicit `pointer-events-auto` if they're within a `pointer-events-none` wrapper.
**Warning signs:** Clicking on the SideRailNav triggers a map click event.

### Pitfall 4: Mobile BottomTabNav Overlaps LayerToggle
**What goes wrong:** On mobile, the BottomTabNav (fixed bottom) overlaps with the score legend or other bottom-positioned elements.
**Why it happens:** Phase 92 is desktop-only per requirements, but BottomTabNav exists for mobile.
**How to avoid:** Keep BottomTabNav as-is (`md:hidden`). SideRailNav gets `hidden md:flex` (already has this). LayerToggle at top-center avoids mobile bottom conflicts.
**Warning signs:** Elements stack on mobile viewport.

### Pitfall 5: ResultsShell Content Margin
**What goes wrong:** Non-map routes that use `ResultsShell` get their content hidden behind the floating SideRailNav.
**Why it happens:** Previously SideRailNav was in-flow (flex layout) and pushed content right. Now it's floating/fixed and overlaps.
**How to avoid:** Add `md:pl-[112px]` (80px rail + 16px gap + 16px padding) to `ResultsShell` or the `<main>` wrapper for non-map routes. For map routes, no padding needed since MapShell content is absolutely positioned.
**Warning signs:** Text on /resultaten page starts underneath the glass rail.

## Code Examples

### SideRailNav Conversion (key changes)
```tsx
// FROM: in-flow sidebar
<nav className="hidden h-full w-16 shrink-0 flex-col items-center justify-between border-r border-neutral-200 bg-aura-glass-white/60 py-4 md:flex">

// TO: floating glass rail
<nav className="fixed left-4 top-4 bottom-4 hidden w-20 flex-col items-center justify-between rounded-[40px] border border-white/40 bg-aura-glass-white/60 py-6 shadow-glass backdrop-blur-xl md:flex aura-float"
  style={{ zIndex: 'var(--z-side-rail)' }}>
```

### _authenticated.tsx Layout Change
```tsx
// FROM: flex sidebar layout
<div className="flex h-screen">
  <SideRailNav />
  <main className="flex-1 relative overflow-hidden">
    ...
  </main>
  <BottomTabNav />
</div>

// TO: full-viewport with floating elements
<div className="relative h-screen w-screen overflow-hidden">
  {/* Map: always in DOM, CSS-toggled */}
  <div className="absolute inset-0" style={{ display: isMapVisible ? 'block' : 'none' }}>
    <MapView ... />
  </div>
  {/* Non-map routes need left padding to clear floating SideRailNav */}
  <main className={cn('relative h-full', !isMapVisible && 'md:pl-24')}>
    <MapContext.Provider value={{ mapRef, mapReady }}>
      <Outlet />
    </MapContext.Provider>
  </main>
  <SideRailNav />
  <BottomTabNav />
</div>
```

### AddressSearch Position Shift
```tsx
// FROM:
<div className={`absolute top-4 left-4 z-[var(--z-search-bar)] ${className}`}>

// TO:
<div className={`absolute top-4 left-4 md:left-[112px] z-[var(--z-search-bar)] ${className}`}>
```

### LayerToggle Reposition
```tsx
// FROM:
<div className="absolute bottom-4 left-4 z-[var(--z-map-controls)] flex items-center gap-2">

// TO:
<div className="absolute top-4 left-1/2 -translate-x-1/2 z-[var(--z-map-controls)] flex items-center gap-2">
```

### Score Legend Reposition
```tsx
// Move from inline next to LayerToggle to absolute bottom-right
{showGradientLegend && (
  <div className="absolute bottom-4 right-4 z-[var(--z-map-controls)] ...">
    ...
  </div>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sidebar in-flow layout | Floating nav over full-viewport map | Tailwind v4 + modern CSS | Standard for map-heavy SaaS (Mapbox Studio, Felt, Google Maps) |
| `h-screen` + flex | `h-dvh` (dynamic viewport height) | 2023 CSS spec | `h-dvh` handles mobile browser chrome better than `h-screen`. Consider using `h-dvh` instead of `h-screen` for true mobile viewport. |

**Note on `dvh`:** Tailwind v4 supports `h-dvh` (100dvh). This handles the mobile browser URL bar shrinking/expanding. Since Propdex is desktop-only for now, `h-screen` works fine, but `h-dvh` is a free improvement.

## Open Questions

1. **Propdex Logo Asset**
   - What we know: No logo SVG/PNG exists in `frontend/public/` or `frontend/src/assets/`. Current top-of-nav is `WorkspaceSwitcher` (briefcase icon + role label).
   - What's unclear: Should the logo be a text mark ("Propdex"), an icon, or the WorkspaceSwitcher remains as-is?
   - Recommendation: Use a text mark "P" in a circle as placeholder, or keep WorkspaceSwitcher at top. The requirement says "Propdex logo top" -- create a simple SVG text mark or use first letter as monogram.

2. **Non-Map Route Content Offset**
   - What we know: With floating SideRailNav, non-map routes (/resultaten, /rapporten, /projecten) need left padding to avoid content hiding behind the rail.
   - What's unclear: Exact padding value -- `pl-24` (96px) may not be enough for 80px rail + 16px gap.
   - Recommendation: Use `md:pl-[112px]` on non-map content areas (80px + 16px margin + 16px gap). Apply conditionally in `_authenticated.tsx` based on `isMapVisible`.

3. **BestemmingsplanLegend Position**
   - What we know: Currently rendered in MapShell with its own absolute positioning. With LayerToggle moving to top-center, legend needs to move too.
   - Recommendation: Keep legend at bottom-right, separate from the top-center chip dock.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `_authenticated.tsx`, `SideRailNav.tsx`, `MapShell.tsx`, `MapView.tsx`, `AddressSearch.tsx`, `LayerToggle.tsx`, `GlassPanel.tsx`, `index.css` -- direct file reads
- Phase 91 CONTEXT.md -- Aura design system decisions (glass hierarchy, blur budget, token system)
- REQUIREMENTS.md -- NAV-01 through NAV-04 specifications

### Secondary (MEDIUM confidence)
- Tailwind CSS v4 `h-dvh` utility -- verified exists in Tailwind v4 documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- direct codebase analysis of every file that needs modification
- Pitfalls: HIGH -- derived from actual code patterns and layout interactions observed

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- no external API dependencies, pure CSS/layout work)
