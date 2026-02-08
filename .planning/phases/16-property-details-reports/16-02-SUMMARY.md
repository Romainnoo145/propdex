---
phase: 16-property-details-reports
plan: 02
subsystem: frontend-ui-architecture
status: complete
completed: 2026-02-08
duration: 189 seconds (~3 minutes)

tags:
  - react
  - tanstack-router
  - navigation
  - layout
  - side-rail
  - glassmorphism

requires:
  - 15-05  # Map view and layout foundation
  - 14-03  # TanStack Router setup
  - 13-02  # CSS variables and z-index scale

provides:
  - Side-rail navigation component with icon-based nav
  - Four authenticated routes (Dashboard, Kaart, Projecten, Instellingen)
  - Restructured app shell (side-rail + content area)
  - Logout functionality moved to side-rail
  - Placeholder pages for Dashboard, Projecten, Instellingen

affects:
  - 16-03  # Property drawer will be positioned relative to side-rail
  - 16-04  # Sidebar will be positioned relative to side-rail
  - 16-05  # Property detail panel positioning

tech-stack:
  added: []
  patterns:
    - Icon-based side-rail navigation
    - Flex layout with fixed nav + flex-1 content
    - TanStack Router active route detection via useMatchRoute
    - Glassmorphism UI for navigation

key-files:
  created:
    - frontend/src/components/layout/SideRailNav.tsx
    - frontend/src/routes/_authenticated/dashboard.tsx
    - frontend/src/routes/_authenticated/projecten.tsx
    - frontend/src/routes/_authenticated/instellingen.tsx
  modified:
    - frontend/src/routes/_authenticated.tsx
    - frontend/src/components/layout/AppLayout.tsx
    - frontend/src/styles/index.css
    - frontend/src/routeTree.gen.ts

decisions:
  - decision: Side-rail width 64px (w-16)
    rationale: Icon-only navigation, standard touch target size (48px + padding)
    alternatives: 48px (too cramped), 80px (wastes space)

  - decision: Z-index 250 (between sidebar 200 and property-panel 300)
    rationale: Side-rail should be above map controls but below property panels
    alternatives: Same as sidebar (200) - would make layering ambiguous

  - decision: Hide side-rail on mobile (md:flex)
    rationale: Thin icon-only rail isn't mobile-friendly, saves screen space
    alternatives: Bottom tab bar for mobile (deferred to later)

  - decision: Glassmorphism design (bg-black/30 backdrop-blur-xl)
    rationale: Consistent with Phase 15 map controls, allows map to show through
    alternatives: Solid dark background - less visually interesting

  - decision: Default route redirects to /map (not /dashboard)
    rationale: Map is the primary interface, dashboard has no content yet
    alternatives: /dashboard as default - would show placeholder on every login

---

# Phase 16 Plan 02: Side-Rail Navigation & App Shell Summary

**One-liner:** Icon-based side-rail navigation with glassmorphism, four routes (Dashboard/Kaart/Projecten/Instellingen), logout moved from floating button to side-rail bottom

---

## What Was Built

### SideRailNav Component
- **Design:** Fixed left position, 64px width, glassmorphism (bg-black/30 backdrop-blur-xl border-r border-white/10)
- **Z-index:** 250 (between sidebar and property panel)
- **Navigation items:**
  1. Dashboard (grid icon) → `/dashboard`
  2. Kaart (map pin icon) → `/map`
  3. Projecten (folder icon) → `/projecten`
  4. Instellingen (gear icon) → `/instellingen`
- **Active state:** bg-white/15 background, text-white (vs text-white/50 inactive)
- **Hover tooltips:** Pure CSS (group + group-hover pattern), dark pill labels appear to right of icon
- **Logout:** Arrow-exit icon at bottom with "Uitloggen" tooltip, calls `useAuth().logout()` then navigates to `/auth`
- **Responsive:** Hidden on mobile (md:flex breakpoint)
- **Icons:** Inline SVG (24x24, stroke-based) for Dashboard, Map, Folder, Settings, Logout

### App Shell Restructure
- **_authenticated.tsx:**
  - Now uses flex layout: `<div className="flex h-screen">`
  - SideRailNav fixed on left (w-16)
  - Main content area: `<main className="flex-1 relative overflow-hidden">`
  - Removed floating logout button (temporary Phase 15 solution)

- **AppLayout.tsx:**
  - Changed from `h-screen` to `h-full` (parent now handles height)
  - Updated comment to explain height inheritance

### Placeholder Routes
Created three new authenticated routes with identical structure:
- `/dashboard` - "Dashboard" heading, "Binnenkort beschikbaar" subtitle
- `/projecten` - "Projecten" heading, "Binnenkort beschikbaar" subtitle
- `/instellingen` - "Instellingen" heading, "Binnenkort beschikbaar" subtitle

All use:
- AppLayout wrapper
- Full-height centered layout
- Glassmorphism card (bg-black/30 backdrop-blur-xl border border-white/10)
- White text with secondary white/70 subtitle

### Route Tree
TanStack Router plugin auto-generated `routeTree.gen.ts` with:
- All three new routes registered
- Proper parent route (`/_authenticated`)
- Type-safe route definitions

---

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `3de34f0` | feat(16-02): create SideRailNav component |
| 2 | `68bfea6` | feat(16-02): restructure app shell with side-rail nav and add placeholder routes |

---

## Key Files Modified

### Created
- `frontend/src/components/layout/SideRailNav.tsx` (196 lines) - Icon navigation with glassmorphism
- `frontend/src/routes/_authenticated/dashboard.tsx` (17 lines) - Dashboard placeholder
- `frontend/src/routes/_authenticated/projecten.tsx` (17 lines) - Projecten placeholder
- `frontend/src/routes/_authenticated/instellingen.tsx` (17 lines) - Instellingen placeholder

### Modified
- `frontend/src/routes/_authenticated.tsx` - Added SideRailNav, removed floating logout button
- `frontend/src/components/layout/AppLayout.tsx` - Changed h-screen → h-full
- `frontend/src/styles/index.css` - Added --z-side-rail: 250 CSS variable
- `frontend/src/routeTree.gen.ts` - Auto-generated with new routes

---

## Decisions Made

### 1. Side-rail width: 64px (w-16)
**Context:** Icon-only navigation needs sufficient touch target size
**Decision:** 64px width provides 48px icons + 8px padding each side
**Alternatives:**
- 48px: Too cramped, icons would be tight
- 80px: Wastes horizontal space, unnecessary for icon-only nav
**Impact:** Standard touch-friendly size, doesn't consume too much screen real estate

### 2. Z-index: 250 (between sidebar 200 and property-panel 300)
**Context:** Layering order for app shell elements
**Decision:** Side-rail at 250 sits between map sidebar (200) and property panels (300)
**Alternatives:**
- Same as sidebar (200): Ambiguous layering, unclear precedence
- Higher than panels (400): Would block important property data
**Impact:** Clear layering hierarchy, side-rail always visible but doesn't block critical UI

### 3. Mobile: Hidden (md:flex)
**Context:** Icon-only navigation isn't mobile-friendly
**Decision:** Hide side-rail below md breakpoint (768px)
**Alternatives:**
- Show on mobile: Wastes precious screen space, icons hard to tap accurately
- Bottom tab bar: Better mobile UX but deferred to later phase
**Impact:** Cleaner mobile layout, more screen space for map/content

### 4. Logout moved to side-rail bottom
**Context:** Phase 15 had temporary floating logout button at bottom-right
**Decision:** Move logout to side-rail bottom with arrow-exit icon
**Alternatives:**
- Keep floating button: Inconsistent with new nav architecture
- User menu in top-right: No top bar exists, would require additional UI
**Impact:** Logout always accessible, consistent with side-rail design

### 5. Default route: /map (not /dashboard)
**Context:** Root `/` needs to redirect somewhere for authenticated users
**Decision:** Keep existing redirect to `/map` (Phase 15 behavior)
**Alternatives:**
- `/dashboard`: Would show "Binnenkort beschikbaar" on every login
**Impact:** Users land directly on primary interface (map view)

---

## Technical Details

### Active Route Detection
```tsx
const matchRoute = useMatchRoute()
const isActive = matchRoute({ to: item.to })
```
Uses TanStack Router's `useMatchRoute` hook for type-safe active route detection.

### Hover Tooltip Pattern
```tsx
<Link to="/dashboard" className="group relative">
  <div>{icon}</div>
  <span className="absolute left-full ml-2 opacity-0 group-hover:opacity-100">
    Dashboard
  </span>
</Link>
```
Pure CSS solution (no library), uses `group` + `group-hover` Tailwind utilities.

### App Shell Layout
```tsx
<div className="flex h-screen">
  <SideRailNav />  {/* w-16, fixed */}
  <main className="flex-1 relative overflow-hidden">
    <Outlet />  {/* Map, Dashboard, etc */}
  </main>
</div>
```
Flex container with fixed-width nav + flex-1 content area.

---

## Testing Notes

### Verification Performed
1. ✅ Type-check: `pnpm exec tsc --noEmit` - No errors in modified files
2. ✅ Route tree: Auto-generated with all three new routes
3. ✅ Active route detection: `useMatchRoute` returns correct boolean
4. ✅ Layout structure: SideRailNav + flex-1 Outlet

### Pre-existing Issues
- `src/components/ui/Drawer.tsx(32,13): error TS7030: Not all code paths return a value`
  - **Note:** This error existed before this plan, not introduced by changes
  - **Impact:** None on side-rail nav functionality
  - **Resolution:** Will be fixed in Phase 16-03 when implementing Drawer

### Manual Testing Required
The following require visual/functional verification:
1. Side-rail visible on all authenticated pages (Dashboard, Kaart, Projecten, Instellingen)
2. Clicking each icon navigates to correct route
3. Active route highlighted with bg-white/15
4. Hover tooltips appear to right of each icon
5. Logout button works from side-rail
6. Map page has side-rail visible with map filling remaining space
7. Placeholder pages show centered glassmorphism card
8. Mobile: side-rail hidden below md breakpoint (768px)

---

## Deviations from Plan

### Auto-fixed Issues

**None** - Plan executed exactly as written.

---

## Next Phase Readiness

### Blockers
None

### Concerns
1. **Mobile navigation:** Side-rail is hidden on mobile, no replacement navigation exists yet
   - **Impact:** Mobile users can't navigate between pages
   - **Mitigation:** Can be addressed in future phase with bottom tab bar or hamburger menu
   - **Urgency:** Medium (mobile isn't primary target for v2.0)

2. **Pre-existing Drawer.tsx error:** Type error prevents full `npm run check` pass
   - **Impact:** CI/CD would fail if running `npm run check`
   - **Mitigation:** Will be fixed in Phase 16-03 when implementing Drawer
   - **Urgency:** High (blocks clean type-check)

### Recommendations
1. **Phase 16-03:** Fix Drawer.tsx type error before implementing property drawer
2. **Future phase:** Add mobile navigation (bottom tab bar or hamburger menu)
3. **Future phase:** Add keyboard navigation (arrow keys, tab focus, escape key)

---

## Integration Points

### Upstream Dependencies
- **Phase 15-05:** Map view provides the primary interface rendered in Outlet
- **Phase 14-03:** TanStack Router provides routing, active route detection
- **Phase 13-02:** CSS variables (--z-side-rail) and glassmorphism design patterns

### Downstream Impact
- **Phase 16-03:** Property drawer will be positioned relative to side-rail (ml-16 offset)
- **Phase 16-04:** Map sidebar will be positioned relative to side-rail (left-16 instead of left-0)
- **Phase 16-05:** Property detail panel positioning may need side-rail offset
- **All future authenticated pages:** Will automatically have side-rail nav via `_authenticated` layout

---

## Performance Notes

- **Bundle impact:** +196 lines (SideRailNav) + 51 lines (3 placeholder routes) = ~247 lines
- **Runtime impact:** Minimal - simple icon links, no heavy computations
- **Re-renders:** `useMatchRoute` hook re-evaluates on route change (expected behavior)

---

## Self-Check: PASSED

### Files Created
✅ frontend/src/components/layout/SideRailNav.tsx - EXISTS
✅ frontend/src/routes/_authenticated/dashboard.tsx - EXISTS
✅ frontend/src/routes/_authenticated/projecten.tsx - EXISTS
✅ frontend/src/routes/_authenticated/instellingen.tsx - EXISTS

### Commits
✅ 3de34f0 - feat(16-02): create SideRailNav component
✅ 68bfea6 - feat(16-02): restructure app shell with side-rail nav and add placeholder routes
