---
phase: 16
plan: 03
subsystem: frontend-ui
tags: [progressive-disclosure, state-machine, glassmorphism, tier-architecture, react]

requires:
  - "16-01 (Drawer primitive)"
  - "16-02 (App shell structure)"
  - "15-04 (PropertyDetailPanel reference)"
  - "15-03 (Address search flow)"

provides:
  - PropertyQuickCard (Tier 1): Floating card with address + key metrics
  - PropertyDetailDrawer (Tier 2): Full-height drawer with all sections
  - Tier state machine: none → quick → drawer
  - Progressive disclosure UX pattern

affects:
  - "16-07 (Save/export will wire placeholder handlers)"
  - "Future phases needing property detail display"

tech-stack:
  added: []
  patterns:
    - "Tier state machine for progressive disclosure"
    - "State-based rendering (tier enum replaces boolean flag)"

key-files:
  created:
    - frontend/src/components/property/PropertyQuickCard.tsx
    - frontend/src/components/property/PropertyDetailDrawer.tsx
  modified:
    - frontend/src/routes/_authenticated/map.tsx

decisions:
  tier-state-machine:
    chosen: "ViewTier enum with 'none' | 'quick' | 'drawer' states"
    rationale: "Type-safe state transitions, prevents invalid combinations (can't have both open)"
    alternatives: "Two booleans (showQuickCard, showDrawer) - more error-prone"

  quick-card-positioning:
    chosen: "Bottom-center of map, 6rem from bottom (bottom-24)"
    rationale: "Centered horizontally, clears map controls at bottom, floating above map"
    alternatives: "Bottom-right corner - conflicts with layer toggle"

  drawer-close-behavior:
    chosen: "Returns to QuickCard (tier='quick'), keeps geometry"
    rationale: "User can quickly revisit QuickCard without clearing map state"
    alternatives: "Close everything - loses context, requires re-search"

  section-content-duplication:
    chosen: "Duplicate Kadaster/Bestemming/Monument/Bronnen content functions from PropertyDetailPanel"
    rationale: "PropertyDetailPanel is legacy reference, new components are independent"
    alternatives: "Extract to shared module - premature optimization, may diverge in Plan 07"

metrics:
  duration: 220s
  completed: 2026-02-09
---

# Phase 16 Plan 03: Progressive Disclosure (Tier 1 & 2) Summary

**One-liner:** Two-tier progressive disclosure system (QuickCard → Drawer) with tier state machine replacing fixed-width PropertyDetailPanel

---

## What Was Built

### PropertyQuickCard (Tier 1)
- **Purpose:** Fast context — address + key metrics in floating card
- **Position:** Bottom-center of map (mobile: full width at bottom, desktop: 20rem width centered)
- **Content:**
  - Address line (straat huisnummer, bold)
  - Postcode + woonplaats (secondary line)
  - Three metrics: Bouwjaar | Oppervlakte | Status
  - "Bekijk volledige details" button with right arrow
  - Close X button
- **Styling:** Glassmorphism (`bg-black/50 backdrop-blur-xl border-white/15`)
- **Loading state:** Skeleton loaders (2 lines + 3 metric boxes)

### PropertyDetailDrawer (Tier 2)
- **Purpose:** Deep analysis — all property sections in full-height drawer
- **Uses:** Drawer primitive from Plan 16-01
- **Header:**
  - Title: "Eigendomsinformatie"
  - Save/bookmark button (placeholder for Plan 07)
  - Export PDF button (placeholder for Plan 07)
  - Close X button
- **Content sections:**
  - PropertySummary (address + metrics + completeness)
  - Kadaster (cadastral parcels)
  - Bestemming (zoning plans + building rules)
  - Monument (monument status + restrictions)
  - Bronnen (data sources)
- **Behavior:**
  - Close returns to QuickCard (tier='quick')
  - Map stays visible with backdrop overlay

### Tier State Machine
- **Type:** `ViewTier = 'none' | 'quick' | 'drawer'`
- **Flow:**
  1. Address search → `tier='quick'` (QuickCard appears)
  2. "Bekijk details" button → `tier='drawer'` (Drawer opens)
  3. Drawer close → `tier='quick'` (back to QuickCard, keep geometry)
  4. QuickCard close → `tier='none'` (clear everything + remove geometry)
- **Replaces:** Boolean `showPanel` flag
- **Benefits:** Type-safe transitions, prevents invalid states

---

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create PropertyQuickCard (Tier 1) | 27fc901 | PropertyQuickCard.tsx |
| 2a | Create PropertyDetailDrawer (Tier 2) | 62b350f | PropertyDetailDrawer.tsx |
| 2b | Rewire map page with tier state machine | b455ce5 | map.tsx |

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Key Links (Verified)

```
frontend/src/routes/_authenticated/map.tsx:108
  → tier === 'quick' (renders PropertyQuickCard)

frontend/src/routes/_authenticated/map.tsx:117
  → tier === 'drawer' (renders PropertyDetailDrawer)

frontend/src/components/property/PropertyDetailDrawer.tsx:2
  → import { Drawer } from '@/components/ui/Drawer'
```

All key links present and correct.

---

## Decisions Made

**1. Tier state machine over boolean flags**
- Single enum prevents invalid states (can't have both QuickCard and Drawer open)
- Type-safe transitions
- Clear intent: `tier='drawer'` vs `showQuickCard=false && showDrawer=true`

**2. QuickCard bottom-center positioning**
- Desktop: Centered horizontally, 6rem from bottom (clears map controls)
- Mobile: Full width at bottom (4px margins)
- Z-index: `var(--z-property-panel)` (300)

**3. Drawer close returns to QuickCard**
- Keeps geometry layer visible
- User can quickly review QuickCard summary
- Only QuickCard close clears everything

**4. Duplicated section content functions**
- PropertyDetailPanel is legacy reference, not actively used
- New components are independent
- May diverge in Plan 07 when adding save/export

---

## Testing Notes

**Manual verification:**
1. Address search shows QuickCard with address + metrics
2. "Bekijk volledige details" opens Drawer
3. Drawer shows all sections (Kadaster, Bestemming, Monument, Bronnen)
4. Drawer close returns to QuickCard (geometry still visible)
5. QuickCard close clears everything
6. Escape key works at each tier (via useEscapeKey hook in Drawer)

**TypeScript:** No type errors (`npm run check` passed)

**ESLint:** No lint errors

---

## Next Phase Readiness

**Ready for Plan 16-04 (Command Palette Navigation):**
- PropertyQuickCard and PropertyDetailDrawer are in place
- Map page has tier state machine
- Can add command palette trigger in Phase 16-04

**Ready for Plan 16-07 (Save & Export):**
- Drawer has placeholder handlers `onSave` and `onExportPDF`
- Can wire actual functionality in Plan 07

**Known gaps:**
- Save/export buttons are placeholders (console.log)
- PropertyDetailPanel still exists but unused (kept as reference)

---

## Performance & Scale

**Bundle impact:** +~800 LOC (QuickCard + Drawer + content sections)

**Runtime:** No performance concerns, standard React state machine

**Mobile:** QuickCard is mobile-optimized (full width at bottom)

---

## Self-Check: PASSED

**Created files exist:**
```
✓ frontend/src/components/property/PropertyQuickCard.tsx
✓ frontend/src/components/property/PropertyDetailDrawer.tsx
```

**Commits exist:**
```
✓ 27fc901 (Task 1: PropertyQuickCard)
✓ 62b350f (Task 2a: PropertyDetailDrawer)
✓ b455ce5 (Task 2b: Tier state machine)
```
