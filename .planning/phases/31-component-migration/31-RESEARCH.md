# Phase 31: Component Migration (Glassmorphism → Industrial Amber) - Research

**Researched:** 2026-02-18
**Domain:** Tailwind v4 design token migration, React component styling, CSS glassmorphism removal
**Confidence:** HIGH — all findings from direct codebase inspection; no external libraries needed

## Summary

Phase 31 migrates high-visibility components from glassmorphism (`bg-black/30 backdrop-blur-xl border-white/10`) to the Industrial Amber design token system established in Phase 27. The design tokens and primitives are already live and working — this phase is a CSS class substitution exercise, not an architecture change.

The codebase has two clearly distinct surface types that were established in Phase 29 (DS-04 rule):

1. **Navigation chrome / floating map UI** — currently glassmorphism, will move to `bg-grey-900` solid or maintain `bg-grey-900/90 backdrop-blur-md` for map-overlay context only
2. **Data content areas** — must be solid grey tokens with no backdrop-filter

The migration scope has two tiers:
- **Tier A (MIG-01 named targets):** Drawer, Modal, SideRailNav, ReportSidebar, PropertyCard — these are explicitly in scope per success criteria
- **Tier B (MIG-02 sweep):** ResultsLayout, ResultsTable, PropertyDetailPanel, PropertyDetailDrawer, ParcelDetailModal, ResultsFilterPanel, dashboard and instellingen placeholders — all use raw glassmorphism instead of design tokens

No new dependencies are required. All needed primitives (`Button`, `Card`, `Badge`, `Input`, `Select`, `cn()`) and tokens (`bg-grey-900`, `bg-grey-850`, `border-grey-800`, `text-grey-400`, `text-grey-100`, `bg-amber-accent`) are already in place.

**Primary recommendation:** Work component-by-component; replace glassmorphism classes with design token equivalents; run `npm run check` after each component; commit per component. The DS-04 rule decides the substitution: nav chrome over map = can keep backdrop-blur with `bg-grey-900/90`, data panels = solid `bg-grey-900`.

## Standard Stack

### Core (already installed — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | 4.1.18 | CSS utility classes with @theme tokens | Already installed; tokens defined in index.css |
| class-variance-authority | 0.7.1 | Type-safe variant management | Already used in primitives |
| clsx + tailwind-merge | 2.1.1 / 3.4.1 | Class merging via cn() | Already in lib/utils.ts |
| lucide-react | 0.564.0 | Icon set | Already used in SideRailNav, InspectorPanel |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-focus-lock | 2.13.7 | Focus trapping in Modal/Drawer | Already used; preserve in migration |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct class substitution | New variant system | Not needed — primitives already have the right variants |
| CSS variables for glass recipe | Inline Tailwind | Phase 29 assessed this as unnecessary overhead |

**Installation:** None required.

## Architecture Patterns

### Design Token Reference (from index.css @theme)

The Industrial Amber tokens for backgrounds/surfaces:

```css
/* Grey surfaces — use these instead of bg-black/N */
bg-grey-950   → oklch(0.13 0.005 270)  — deepest background (body)
bg-grey-900   → oklch(0.18 0.005 270)  — panels, sidebars, drawers
bg-grey-850   → oklch(0.23 0.005 270)  — elevated cards within panels
bg-grey-800   → oklch(0.28 0.005 270)  — borders, dividers, subtle backgrounds
bg-grey-700   → oklch(0.35 0.005 270)  — disabled / muted
bg-grey-400   → oklch(0.65 0.005 270)  — secondary text, icons
bg-grey-100   → oklch(0.95 0.005 270)  — primary text
```

The design system accent for active states:

```css
bg-amber-accent      → oklch(0.78 0.15 85.87)  — primary action highlight
text-amber-accent    → same, as text
border-amber-accent  → same, as border
```

### DS-04 Rule: When to Keep vs Remove backdrop-blur

```
Over map canvas (absolute positioned):
  → bg-grey-900/90 backdrop-blur-md border-grey-800  ✓ keep blur (glass over visual content)

Navigation chrome floating over map:
  → bg-grey-900 border-r border-grey-800              ✓ solid preferred
  → bg-grey-900/90 backdrop-blur-md                   ✓ acceptable if overlay

Data panels (ReportSidebar, Drawer, Modal content):
  → bg-grey-900 (solid, no backdrop-filter)            ✓ solid required

Data content within panels:
  → bg-grey-850 rounded-md border border-grey-800     ✓ card elevation
```

### Pattern 1: Glassmorphism → Solid Panel

**What:** Convert bg-black/40 backdrop-blur-xl + border-white/10 to solid design tokens

**When to use:** Any panel that sits alongside or within the page (not over the map canvas)

```tsx
// Before (glassmorphism):
<aside className="bg-black/40 backdrop-blur-xl border-r border-white/10">

// After (Industrial Amber):
<aside className="bg-grey-900 border-r border-grey-800">
```

### Pattern 2: Interactive Element States

**What:** Convert white/opacity hover and active states to grey token equivalents

```tsx
// Before:
'text-white/50 hover:bg-white/10 hover:text-white'
'bg-white/15 text-white'   // active state

// After:
'text-grey-400 hover:bg-grey-850 hover:text-grey-100'
'bg-grey-800 text-grey-100'   // active state

// Active with amber accent (for primary nav items):
'bg-amber-accent/15 text-amber-accent'
```

### Pattern 3: Inner Card/Section Within Panel

**What:** Convert bg-white/5 border border-white/10 data cells to Card primitive or equivalent

```tsx
// Before:
<div className="bg-white/5 rounded-lg p-3 border border-white/10">

// After (using Card primitive):
import { Card, CardContent } from '@/components/primitives';
<Card elevation="elevated" className="p-3">

// After (manual equivalent):
<div className="bg-grey-850 rounded-md p-3 border border-grey-800">
```

### Pattern 4: Text Opacity → Grey Tokens

**What:** Convert text-white/N opacity classes to semantic grey tokens

```tsx
// text-white/90 → text-grey-100 (primary)
// text-white/80 → text-grey-100 (primary, same token)
// text-white/60 → text-grey-400 (secondary)
// text-white/50 → text-grey-400 (secondary)
// text-white/40 → text-grey-600 (muted)
// text-white/30 → text-grey-600 (muted)
// text-white    → text-grey-100 (primary)
```

### Pattern 5: Dividers/Borders

```tsx
// Before: border-white/10
// After:  border-grey-800

// Before: bg-white/10 (divider line)
// After:  bg-grey-800
```

### Pattern 6: Skeleton/Loading States

```tsx
// Before: bg-white/10 animate-pulse
// After:  bg-grey-800 animate-pulse
```

### Pattern 7: Modal/Drawer Structure

For Modal and Drawer specifically — these are generic overlays that can appear over the map:

```tsx
// Modal backdrop: keep semi-transparent dark (it's overlaying everything)
// Before: bg-black/40 backdrop-blur-sm
// After:  bg-grey-950/60  (slightly more opaque, uses token)

// Modal panel: solid dark surface (bg-grey-900, NOT glass)
// Before: bg-black/60 backdrop-blur-xl border border-white/15
// After:  bg-grey-900 border border-grey-800

// Drawer panel:
// Before: bg-black/40 backdrop-blur-xl border-white/10
// After:  bg-grey-900 border-grey-800
```

### Pattern 8: SideRailNav Active/Hover State

The SideRailNav is nav chrome that floats over the map on the left edge. It needs solid styling:

```tsx
// Container:
// Before: bg-black/30 backdrop-blur-xl border-r border-white/10
// After:  bg-grey-900 border-r border-grey-800

// Active nav item — use amber accent for selected state:
// Before: bg-white/15 text-white
// After:  bg-amber-accent/15 text-amber-accent  (amber glow for selected)
//  OR:   bg-grey-800 text-grey-100              (neutral, less prominent)

// Inactive nav item:
// Before: text-white/50 hover:bg-white/10 hover:text-white
// After:  text-grey-400 hover:bg-grey-850 hover:text-grey-100

// Tooltip:
// Before: bg-black/90 text-white
// After:  bg-grey-950 text-grey-100 border border-grey-800
```

### Anti-Patterns to Avoid

- **Keeping `backdrop-blur` on solid panels:** backdrop-filter blurs what's BEHIND the element. On a `bg-grey-900` panel that sits beside the map (not over it), `backdrop-blur` has no effect and wastes GPU. Remove it.
- **Using Card primitive for everything:** PropertyDetailDrawer has 773 lines of content. Converting its internal data cells to `<Card>` is good, but don't wrap sections in Card when a simple `div className="bg-grey-850"` is cleaner.
- **Changing semantic meaning:** `bg-amber-500/20 text-amber-200` (PropertyQuickCard monument badge) is semantic — it's "this is a monument" status, not glassmorphism. Leave semantic color badges alone unless they conflict with the design token set.
- **Migrating map-context floating cards to solid:** The map scan status card, zone info card, gemeente header in map.tsx use `bg-grey-900/90 backdrop-blur-md` — this is CORRECT per Phase 29 (floating over map canvas). Do not remove blur here.
- **Removing the popup CSS:** `.propdex-property-popup .maplibregl-popup-content` in index.css uses `rgba(0,0,0,0.55) backdrop-filter:blur(16px)`. This is the MapLibre popup for PropertyQuickCard. Phase 31 success criteria do NOT include this — it's a map-layer concern. Leave it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Button styling in panels | Custom button CSS | `<Button variant="ghost">` or `<Button variant="outline">` | Already has correct hover states for dark backgrounds |
| Input fields in sidebars | `className="bg-white/5 border-white/10"` | `<Input>` primitive | Handles focus ring, disabled state, consistent sizing |
| Select dropdowns in sidebars | Raw `<select className="bg-black/40...">` | `<Select>` primitive | Consistent ChevronDown indicator, focus ring |
| Status/category badges | Inline `px-2 py-0.5 bg-amber-500/20` | `<Badge variant="amber">` | Already styled for Industrial Amber |

## Component-by-Component Migration Map

### Tier A: Named in Success Criteria

#### 1. `frontend/src/components/ui/Modal.tsx` (56 lines)

| Element | Current | Replacement |
|---------|---------|-------------|
| Backdrop | `bg-black/40 backdrop-blur-sm` | `bg-grey-950/60` |
| Panel surface | `bg-black/60 backdrop-blur-xl rounded-2xl border border-white/15` | `bg-grey-900 rounded-lg border border-grey-800` |

#### 2. `frontend/src/components/ui/Drawer.tsx` (77 lines)

| Element | Current | Replacement |
|---------|---------|-------------|
| Backdrop | `bg-black/20 backdrop-blur-sm` | `bg-grey-950/40` |
| Panel surface | `bg-black/40 backdrop-blur-xl border-t border-white/10` | `bg-grey-900 border-t border-grey-800` |
| Border (desktop) | `border-white/15` | `border-grey-800` |
| Drag handle | `bg-white/30` | `bg-grey-700` |

#### 3. `frontend/src/components/layout/SideRailNav.tsx` (158 lines)

| Element | Current | Replacement |
|---------|---------|-------------|
| Nav container | `bg-black/30 backdrop-blur-xl border-r border-white/10` | `bg-grey-900 border-r border-grey-800` |
| Active item | `bg-white/15 text-white` | `bg-amber-accent/15 text-amber-accent` |
| Inactive item | `text-white/50 hover:bg-white/10 hover:text-white` | `text-grey-400 hover:bg-grey-850 hover:text-grey-100` |
| Divider | `bg-white/10` | `bg-grey-800` |
| Tooltip | `bg-black/90 text-white` | `bg-grey-950 text-grey-100 border border-grey-800` |

#### 4. `frontend/src/components/layout/ReportSidebar.tsx` (306 lines)

| Element | Current | Replacement |
|---------|---------|-------------|
| Aside container | `bg-black/40 backdrop-blur-xl border-r border-white/10` | `bg-grey-900 border-r border-grey-800` |
| Section headers | `border-b border-white/10` | `border-b border-grey-800` |
| Text primary | `text-white` | `text-grey-100` |
| Text secondary | `text-white/60`, `text-white/50`, `text-white/80` | `text-grey-400` |
| Text muted | `text-white/40`, `text-white/30` | `text-grey-600` |
| Close button | `text-white/50 hover:bg-white/10 hover:text-white` | Use `<Button variant="ghost" size="sm">` |
| Select fields | `bg-white/5 border-white/10 text-white` | Use `<Select>` primitive |
| Accordion hover | `hover:bg-white/5` | `hover:bg-grey-850` |
| Empty state | `text-white/30` | `text-grey-600` |
| Inner X icon | Inline SVG | Replace with `<X size={20} />` from lucide-react |
| Inner ChevronIcon | Inline SVG | Replace with `<ChevronRight size={16} />` from lucide-react |

#### 5. PropertyCard references (PropertyQuickCard is a MapLibre popup — see Pitfalls below)

The `PropertyQuickCard.tsx` renders inside a MapLibre popup container. Its styling uses inline Tailwind on the React portal content, not on the popup CSS itself. Content within the popup:

| Element | Current | Replacement |
|---------|---------|-------------|
| `bg-amber-500/20 text-amber-200` (monument badge) | semantic — keep | no change |
| `bg-green-500/10 text-green-200/70` (no monument) | semantic — keep | no change |
| `bg-white/20` (detail button) | `bg-grey-800` | |
| `bg-white/20` (hover detail button) | `hover:bg-grey-700` | |
| `text-white/40` (close button) | `text-grey-600` | |
| `bg-white/20 animate-pulse` (loading skeleton) | `bg-grey-800 animate-pulse` | |

The popup CSS in `index.css` (`.propdex-property-popup .maplibregl-popup-content`) — DO NOT CHANGE. It's rendered in MapLibre's DOM and uses raw CSS, not Tailwind tokens.

### Tier B: Glassmorphism Sweep (MIG-02)

These files use glassmorphism patterns and should be cleaned up:

#### `frontend/src/components/results/ResultsLayout.tsx` (136 lines)

The left overlay panel (`bg-black/40 backdrop-blur-xl border-r border-white/10`) slides over the map — this is a navigation chrome / overlay case:

```tsx
// Current: bg-black/40 backdrop-blur-xl border-r border-white/10
// After:   bg-grey-900 border-r border-grey-800
// (solid — it's a wide panel, not a floating card)
```

Also: header text `text-white` → `text-grey-100`, close button white/60 → grey-400.

#### `frontend/src/components/results/ResultsTable.tsx` (~360 lines)

Multiple patterns:
- Sticky thead: `bg-black/60 backdrop-blur-sm` → `bg-grey-900`
- Table row selected: `bg-white/15 ring-1 ring-white/30` → `bg-grey-850 ring-1 ring-amber-accent/30`
- Table row hover: `hover:bg-white/5` → `hover:bg-grey-850`
- Table text: `text-white/60`, `text-white/80` → `text-grey-400`, `text-grey-100`
- Borders: `border-white/10`, `border-white/5` → `border-grey-800`
- Pagination buttons: `bg-white/10 hover:bg-white/20 text-white/80` → `bg-grey-850 hover:bg-grey-800 text-grey-100`
- Loading skeleton: `bg-white/5 animate-pulse` → `bg-grey-800 animate-pulse`

#### `frontend/src/components/results/ResultsFilterPanel.tsx` (~160 lines)

Selects: `bg-black/40 border border-white/15` → Use `<Select>` primitive.
Also note: `focus:ring-emerald-500/50` → should use `focus:ring-teal-accent` (design token).

#### `frontend/src/components/results/ParcelDetailModal.tsx` (177 lines)

Uses `<Modal>` (which will be migrated in Tier A). Internal content:
- `bg-white/5 rounded-lg border border-white/10` data cells → `bg-grey-850 rounded-md border border-grey-800`
- Text colors → grey tokens
- `bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-400/30` score circle → keep or use `<Badge variant="success">` approach
- Bestemming chips `bg-blue-500/10 border border-blue-400/30 text-blue-300` → use `<Badge variant="info">` or `<Badge variant="teal">`

#### `frontend/src/components/property/PropertyDetailPanel.tsx` (605 lines)

Outer container uses `bg-black/40 backdrop-blur-xl rounded-2xl border border-white/15`:

```tsx
// Desktop panel:
// Before: h-full bg-black/40 backdrop-blur-xl rounded-2xl border border-white/15
// After:  h-full bg-grey-900 rounded-lg border border-grey-800

// Mobile bottom sheet:
// Before: h-full bg-black/40 backdrop-blur-xl rounded-t-2xl border-t border-x border-white/15
// After:  h-full bg-grey-900 rounded-t-lg border-t border-x border-grey-800
```

Internal: Extensive `bg-white/5 border-white/10` data cells → Card primitive or `bg-grey-850 border-grey-800`.

#### `frontend/src/components/property/PropertyDetailDrawer.tsx` (773 lines — LARGE)

Uses `<Drawer>` (migrated in Tier A). Internal content still needs migration:
- All `border-white/10` → `border-grey-800`
- All `text-white/N` → appropriate grey tokens
- All `bg-white/5`, `bg-white/10` data cells → `bg-grey-850 border-grey-800`
- Buttons: `bg-white/10 hover:bg-white/20 text-white` → use `<Button>` primitive or `bg-grey-850 hover:bg-grey-800 text-grey-100`

This is the largest file (773 lines). Consider splitting into smaller sub-components after migration to keep under 300-line rule.

#### `frontend/src/routes/_authenticated/dashboard.tsx` and `instellingen.tsx`

These are placeholder pages with glassmorphism cards:

```tsx
// Before: rounded-xl border border-white/10 bg-black/30 p-8 backdrop-blur-xl
// After:  rounded-lg border border-grey-800 bg-grey-900 p-8
```

#### `frontend/src/components/map/LayerToggle.tsx` (~170 lines)

This floats over the map — use dark glassmorphism per DS-04:

```tsx
// Container: bg-black/30 backdrop-blur-md border border-white/20
// After: bg-grey-900/90 backdrop-blur-md border border-grey-800
// (floating over map, blur is correct)

// Active tab: bg-white/70 text-gray-900 → bg-amber-accent text-grey-950
// Inactive: text-white/70 hover:bg-white/10 → text-grey-400 hover:bg-grey-800
// Dividers: border-white/20 → border-grey-700
```

#### `frontend/src/components/search/AddressSearch.tsx`

Floats over map — keep blur:

```tsx
// Search button: bg-black/30 backdrop-blur-md border border-white/20
// After: bg-grey-900/90 backdrop-blur-md border border-grey-800

// Input container: bg-black/30 backdrop-blur-md border border-white/20
// After: bg-grey-900/90 backdrop-blur-md border border-grey-800

// Dropdown: bg-black/40 backdrop-blur-md border border-white/20
// After: bg-grey-950 border border-grey-800 (no blur — dropdown over UI, not map)
```

## Common Pitfalls

### Pitfall 1: Backdrop Blur on Non-Map Context

**What goes wrong:** Keeping `backdrop-blur-xl` on panels that sit beside the map but don't overlay it (ReportSidebar, ResultsLayout). The blur composites what's visually behind the element — a solid `bg-grey-950` body has nothing to blur, so it just looks like a slightly transparent solid.

**Why it happens:** Developers copy the class pattern without checking if the element actually floats over visual content.

**How to avoid:** Only keep `backdrop-blur` when the element is `position: absolute` or `position: fixed` over the map canvas or another rich background. Sidebars positioned in flex layouts next to the map should use solid `bg-grey-900`.

**Warning signs:** `backdrop-blur` class present on an element that is `position: relative` in a flex row.

### Pitfall 2: Breaking Focus Trap in Modal/Drawer

**What goes wrong:** Changing the DOM structure in Modal or Drawer breaks the `react-focus-lock` wrapping.

**Why it happens:** FocusLock needs a single root element with `role="dialog"` descendants.

**How to avoid:** Only change className values in Modal.tsx and Drawer.tsx — do not restructure the JSX tree. The element tree (FocusLock > div > backdrop + panel) must remain intact.

### Pitfall 3: PropertyDetailDrawer File Size

**What goes wrong:** PropertyDetailDrawer.tsx is 773 lines. The project rule is keep files under 300 lines. After migration, this file should be split.

**Why it happens:** Large files accumulate incrementally.

**How to avoid:** After completing the glassmorphism migration within the file, evaluate split points. Likely: extract a `<KadasterSection>`, `<ZoningSection>`, `<MonumentSection>` etc. But split only AFTER migration is done and `npm run check` passes — don't combine migration with refactoring.

### Pitfall 4: Semantic Color Badges vs Design Token Classes

**What goes wrong:** Converting `bg-amber-500/20 text-amber-200` (monument badge), `bg-blue-500/10 text-blue-300` (bestemming chip) to grey tokens because they look like glassmorphism.

**Why it happens:** These look like opacity patterns similar to glassmorphism.

**How to avoid:** These are semantic — they carry meaning ("monument", "bestemming type"). The correct migration is:
- Monument badge → `<Badge variant="amber">` (maps to `bg-amber-accent/15 text-amber-accent`)
- Bestemming chip → `<Badge variant="teal">` or `<Badge variant="info">`
- No monument → `<Badge variant="default">` or `<Badge variant="success">`

### Pitfall 5: MapLibre Popup CSS

**What goes wrong:** Modifying `.propdex-property-popup .maplibregl-popup-content` in `index.css`, thinking it's part of MIG-02 (legacy glassmorphism CSS removal).

**Why it happens:** It uses `rgba(0,0,0,0.55)` and `backdrop-filter: blur(16px)` — looks like glassmorphism.

**How to avoid:** This is the MapLibre popup (pill-shaped "te koop" sign). It renders in MapLibre's own DOM via `popup.setDOMContent()`. It MUST use raw CSS (not Tailwind). It floats over the map canvas. Blur is correct and intentional here. Leave it unchanged.

### Pitfall 6: TypeScript Check Must Pass After Each Component

**What goes wrong:** Batching all changes, then discovering a type error after many files changed.

**How to avoid:** After each component file, run `npm run check` from the frontend directory. Fix errors before proceeding to the next component.

### Pitfall 7: Active Nav State Decision

**What goes wrong:** Using `bg-amber-accent/15 text-amber-accent` for active SideRailNav items may be too prominent if ALL routes show an active item. The amber glow should confirm "you are here" without screaming.

**Recommendation:** Use `bg-grey-800 text-grey-100` for the active state (neutral, clear) rather than amber. Reserve `text-amber-accent` for the active indicator dot/stripe. Or test `bg-amber-accent/10 text-grey-100` — slight amber tint without full amber text.

## Code Examples

### Glassmorphism Class Substitution Table

```
bg-black/30 backdrop-blur-xl  → bg-grey-900  (panel, sidebar)
bg-black/40 backdrop-blur-xl  → bg-grey-900  (panel, modal)
bg-black/60 backdrop-blur-xl  → bg-grey-900  (modal surface)
bg-black/30 backdrop-blur-md  → bg-grey-900/90 backdrop-blur-md  (floating over map)
bg-grey-900/90 backdrop-blur-md → keep as-is (already Phase 29 convention)

border-white/10  → border-grey-800
border-white/15  → border-grey-800
border-white/20  → border-grey-800

text-white       → text-grey-100
text-white/90    → text-grey-100
text-white/80    → text-grey-100
text-white/60    → text-grey-400
text-white/50    → text-grey-400
text-white/40    → text-grey-600
text-white/30    → text-grey-600
text-white/70    → text-grey-400

bg-white/5       → bg-grey-850  (data cell, inner card)
bg-white/10      → bg-grey-850  (hover, data cell)
bg-white/15      → bg-grey-800  (active item)
bg-white/20      → bg-grey-800  (button bg)
bg-white/70      → bg-amber-accent  (strongly active tab)

hover:bg-white/5   → hover:bg-grey-850
hover:bg-white/10  → hover:bg-grey-850
hover:bg-white/20  → hover:bg-grey-800

bg-white/10 animate-pulse  → bg-grey-800 animate-pulse  (skeleton)

ring-white/30  → ring-amber-accent/30  (selected row ring)
```

### Button Migration Example

```tsx
// Before (custom glass button):
<button className="text-white/50 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-colors">

// After (use ghost Button primitive):
import { Button } from '@/components/primitives';
<Button variant="ghost" size="sm" onClick={...}>

// Before (close button with icon):
<button onClick={onClose} className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white">
  <XIcon />
</button>

// After (using lucide X instead of inline SVG):
import { X } from 'lucide-react';
<Button variant="ghost" size="sm" onClick={onClose} aria-label="Sluit">
  <X size={16} />
</Button>
```

### Select Migration in ReportSidebar

```tsx
// Before:
<select className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-white/20 focus:outline-none">

// After:
import { Select } from '@/components/primitives';
<Select value={projectFilter || ''} onChange={(e) => setProjectFilter(e.target.value || undefined)}>
  <option value="">Alle projecten</option>
  {/* ... */}
</Select>
```

### ReportCard Migration

```tsx
// Before:
<div className="group cursor-pointer rounded-lg border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10">

// After (using Card primitive):
import { Card } from '@/components/primitives';
<Card
  elevation="elevated"
  className="group cursor-pointer p-3 transition-colors hover:bg-grey-800 cursor-pointer"
  onClick={onClick}
>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Glassmorphism (rgba + backdrop-blur) | Layered grey tokens | Phase 27 decision | Consistent dark-first, no GPU waste on non-map context |
| Hardcoded bg-black/N | bg-grey-900 token | Phase 27 | Single source of truth, theming possible |
| text-white/N opacity | text-grey-N tokens | Phase 27 | Accessible, predictable contrast |
| Inline SVG icons | lucide-react | Phase 28 | Consistent weight, tree-shakeable |

**Deprecated/outdated after this phase:**
- `bg-black/40 backdrop-blur-xl border-white/10` — replaced by solid grey tokens
- Inline SVG `XIcon`, `ChevronIcon` in ReportSidebar — replaced by lucide-react icons
- `focus:ring-emerald-500/50` in ResultsFilterPanel — replaced by `focus:ring-teal-accent`
- `rounded-2xl` on modals/drawers — replaced by `rounded-lg` (design system radius is subtle 4-6px)

## Open Questions

1. **Active SideRailNav item: amber accent or neutral?**
   - What we know: Phase 27 established amber as the primary action/highlight color
   - What's unclear: Whether a persistent nav indicator should use amber text (high visibility) or neutral grey (subtle "you are here")
   - Recommendation: Use `bg-grey-800 text-grey-100` for active state (neutral), test with amber indicator stripe later if desired

2. **PropertyDetailDrawer 773 lines: migrate then split, or split first?**
   - What we know: Project rule is 300-line max; the file is 2.6x over limit
   - What's unclear: Whether the planner wants file split as a separate plan or bundled
   - Recommendation: Migrate glassmorphism first (this phase), then split as a follow-on task within the same phase

3. **Rounded corner size on Modal/Drawer**
   - Current: `rounded-2xl` (very rounded, consumer-app feel)
   - Design system: `rounded-md` (6px), `rounded-lg` (8px) — subtle/technical
   - Recommendation: Change to `rounded-lg` during migration to match Industrial Amber aesthetic

4. **ResultsFilterPanel: emerald focus ring**
   - Current: `focus:ring-emerald-500/50` (hardcoded Tailwind color, not a design token)
   - Recommendation: Replace with `focus:ring-teal-accent` (design token)

## Recommended Plan Structure

Based on scope, Phase 31 should be 2-3 plans:

**Plan 31-01: Core UI Primitives Migration** (Modal, Drawer)
- These are shared by many consumers; migrate first so consumers automatically benefit
- ~130 lines total across both files; fast win

**Plan 31-02: Navigation Chrome Migration** (SideRailNav, ReportSidebar, InspectorPanel, LayerToggle, AddressSearch)
- All floating/chrome UI, all follow similar patterns
- SideRailNav: 158 lines; ReportSidebar: 306 lines

**Plan 31-03: Data Panel & Content Migration** (ResultsLayout, ResultsTable, PropertyDetailPanel, PropertyDetailDrawer, ParcelDetailModal, ResultsFilterPanel, ParcelEnrichmentCard, ReportCard, dashboard, instellingen)
- Largest scope; PropertyDetailDrawer split may be needed
- Run `npm run check` after each file; commit per-component

**Alternative:** Split 31-03 into two plans (results/ folder vs property/ folder) if scope feels too large.

## Sources

### Primary (HIGH confidence — direct codebase inspection)

All findings verified by reading source files directly. No external sources needed for this phase.

- `/home/klarifai/Documents/klarifai/clientprojects/propdex/frontend/src/styles/index.css` — Complete design token set (12 grey tokens, amber/teal accents, semantic colors)
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/frontend/src/components/primitives/` — All 5 primitives: Button (CVA variants), Card (elevation), Badge (semantic variants), Input, Select
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/frontend/src/components/ui/Drawer.tsx` — Glassmorphism baseline: `bg-black/40 backdrop-blur-xl border-white/10`
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/frontend/src/components/ui/Modal.tsx` — Glassmorphism baseline: `bg-black/60 backdrop-blur-xl border-white/15`
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/frontend/src/components/layout/SideRailNav.tsx` — `bg-black/30 backdrop-blur-xl`
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/frontend/src/components/layout/ReportSidebar.tsx` — `bg-black/40 backdrop-blur-xl`
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/.planning/phases/27-design-system-foundation/27-CONTEXT.md` — DS decisions: dark-first, layered greys NOT glassmorphism, amber/teal accents
- `/home/klarifai/Documents/klarifai/clientprojects/propdex/.planning/phases/29-silver-map-theme-layout-shells/29-RESEARCH.md` — DS-04 rule: nav chrome = glass over map OK, data areas = solid

### Secondary (HIGH — adjacent phase summaries)

- Phase 29 research: confirmed `bg-grey-900/90 backdrop-blur-md` pattern for floating map cards
- Phase 27 context: confirmed `layered greys over glassmorphism` decision, `surface layering (base #111 → card #1A1A1A → elevated #222), NOT glassmorphism`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — direct codebase inspection; substitution table verified against actual files
- Pitfalls: HIGH — identified from actual code (popup CSS, FocusLock structure, file size)
- Tier A vs Tier B scope: HIGH — based on phase success criteria + 32-file grep audit
- Active nav state color: MEDIUM — design judgment call, not a technical fact

**Research date:** 2026-02-18
**Valid until:** 2026-04-18 (60 days — design system is stable, no external libraries evolving)
