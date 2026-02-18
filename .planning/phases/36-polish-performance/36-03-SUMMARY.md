---
phase: 36-polish-performance
plan: "03"
subsystem: ui
tags: [glassmorphism, mobile, performance, accessibility, motion-reduce]

# Dependency graph
requires:
  - 36-02 (CSS cleanup must complete before modifying same files)
provides:
  - Responsive glassmorphism: solid on mobile, glass on desktop
  - Motion-reduce safety on InspectorPanel transitions
  - Sonner toast without GPU-intensive backdropFilter

key-files:
  modified:
    - frontend/src/components/search/AddressSearch.tsx
    - frontend/src/components/map/LayerToggle.tsx
    - frontend/src/components/map/ScanProgressOverlay.tsx
    - frontend/src/routes/_authenticated/map.tsx
    - frontend/src/main.tsx
    - frontend/src/components/layout/InspectorPanel.tsx
---

## What shipped

### Task 1: Responsive glassmorphism on map floating controls
Applied `bg-grey-900 md:bg-grey-900/90 md:backdrop-blur-md` pattern to 4 files (7 instances total):
- **AddressSearch.tsx** — 2 instances (collapsed icon button + expanded search bar)
- **LayerToggle.tsx** — 1 instance (toggle container)
- **ScanProgressOverlay.tsx** — 1 instance (overlay container)
- **map.tsx** — 3 instances (scan status overlays)

Mobile sees solid `bg-grey-900` backgrounds (no GPU compositing). Desktop glass effect unchanged.

### Task 2: Sonner toast backdropFilter removal
Removed `backdropFilter: 'blur(24px)'` from Toaster's `toastOptions.style` in main.tsx. Replaced with solid `background: 'rgba(0,0,0,0.85)'`. Toast corner placement makes glass imperceptible anyway.

### Task 3: Motion-reduce safety on InspectorPanel
Applied `motion-reduce:transition-none` to 3 elements in InspectorPanel.tsx:
- Panel slide transform (transition-transform duration-300)
- Close button hover transition (transition-colors)
- Progress bar width transition (transition-all)

Users with `prefers-reduced-motion` OS setting see instant state changes instead of animations.

## Decisions

- Only map floating controls got responsive glassmorphism — non-floating UI (BestemmingsplanLegend) already had blur removed entirely in Plan 02
- Sonner toast uses solid background universally (not responsive) since inline styles can't use Tailwind breakpoints and the glass effect is imperceptible in corner placement
- InspectorPanel inline style transitions (if any) left unchanged — Tailwind variants can't apply to inline styles

## Verification

- Zero bare `backdrop-blur-*` without `md:` prefix in the 4 map UI files ✓
- Zero `backdropFilter` references in main.tsx ✓
- 3 `motion-reduce:transition-none` instances in InspectorPanel.tsx ✓
- `npm run check` passes with 0 errors ✓

## Self-Check: PASSED
