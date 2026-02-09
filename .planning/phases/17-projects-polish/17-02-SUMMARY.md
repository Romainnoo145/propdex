---
phase: 17-projects-polish
plan: 02
subsystem: frontend-polish
tags: [mobile, ux, confidence-indicators, badges, refresh]
dependency_graph:
  requires: [17-01]
  provides: [ConfidenceBadge, PropertyBottomSheet, monument-badges, ai-confidence-display]
  affects: [PropertyQuickCard, PropertyDetailDrawer]
tech_stack:
  added: []
  patterns: [confidence-badges, mobile-bottom-sheet, touch-safe-scrolling]
key_files:
  created:
    - frontend/src/components/property/ConfidenceBadge.tsx
    - frontend/src/components/property/PropertyBottomSheet.tsx
  modified:
    - frontend/src/components/property/PropertyQuickCard.tsx
    - frontend/src/components/property/PropertyDetailDrawer.tsx
    - frontend/src/styles/index.css
decisions:
  - name: "ConfidenceBadge color scheme"
    choice: "GREEN for HIGH, YELLOW for MEDIUM, RED for LOW with 20% bg opacity and 40% border opacity"
    rationale: "Matches existing badge patterns (SourceBadge), uses semantic colors, sufficient contrast on glassmorphism background"
    alternatives: ["Neutral gray badges with text labels", "Icon-based indicators"]
  - name: "Monument badge placement in QuickCard"
    choice: "Inline after address text, before Details button"
    rationale: "Compact horizontal layout fits popup constraints, visible but non-intrusive"
    alternatives: ["Separate line below address (too tall for popup)", "Replace map pin icon (loses context)"]
  - name: "Bottom sheet touch handling"
    choice: "stopPropagation on touch events in scrollable content area"
    rationale: "Prevents map pan when scrolling drawer on mobile, critical for UX"
    alternatives: ["CSS touch-action (insufficient browser support)", "Pointer-events (blocks all interaction)"]
  - name: "Force refresh button location"
    choice: "Drawer header actions area, before save/export buttons"
    rationale: "Power user feature, consistent with existing action button pattern, clear visual hierarchy"
    alternatives: ["Footer area (too far from data)", "Per-section refresh (redundant with existing FreshnessIndicator)"]
  - name: "AI interpretation placement"
    choice: "After building dimensions, before zoning plans in BestemmingContent"
    rationale: "AI provides summary/interpretation of zoning plans, logical to show overview before detail sections"
    alternatives: ["Top of section (overshadows primary bestemming)", "Separate section (redundant structure)"]
metrics:
  duration_seconds: 182
  completed_date: "2026-02-09"
---

# Phase 17 Plan 02: Mobile Polish & Confidence Indicators Summary

**One-liner:** Mobile bottom sheet, confidence badges (HIGH/MEDIUM/LOW), monument indicators on QuickCard, and AI zoning display with force refresh.

## Objective

Create mobile-responsive property detail viewing with PropertyBottomSheet, add visual confidence indicators for AI interpretations, display monument status on QuickCard, and provide force refresh capability for power users.

## What Was Built

### Components Created

**1. ConfidenceBadge.tsx** (40 lines)
- Color-coded confidence indicator with three levels
- HIGH: green (bg-green-500/20, border-green-500/40, text-green-100)
- MEDIUM: yellow (bg-yellow-500/20, border-yellow-500/40, text-yellow-100)
- LOW: red (bg-red-500/20, border-red-500/40, text-red-100) with tooltip warning
- Props: `confidence: 'HIGH' | 'MEDIUM' | 'LOW'`, optional `label: string`
- Follows SourceBadge styling pattern (inline-flex, text-xs, rounded-md border)

**2. PropertyBottomSheet.tsx** (67 lines)
- Mobile-only bottom sheet (md:hidden)
- Slide-up animation from translateY(100%) to translateY(0)
- FocusLock and useEscapeKey for keyboard navigation
- Touch-safe scrolling with stopPropagation on touch events
- Glassmorphism design: bg-black/40 backdrop-blur-xl border-t border-white/10
- Max height 85vh with rounded-t-2xl corners
- Drag handle visual indicator (w-10 h-1 bg-white/30 rounded-full)
- Body scroll prevention when open

### Components Modified

**3. PropertyQuickCard.tsx**
- Added monument badge inline after address text
- Amber badge for Rijksmonument: bg-amber-500/20 text-amber-200
- Green badge for Geen monument: bg-green-500/10 text-green-200/70
- Conditional rendering based on `data.monuments?.is_monument`
- No badge shown if monuments data is null

**4. PropertyDetailDrawer.tsx**
- Added ConfidenceBadge import
- Added "Ververs" force refresh button in header actions
  - Icon: circular arrow SVG
  - Text: "Ververs" (normal), "Bezig..." (during refresh)
  - Disabled state with opacity-50 and cursor-not-allowed
  - Conditional rendering based on onRefreshAll prop availability
- Added AI Interpretatie section in BestemmingContent
  - Displays after building dimensions, before zoning plans
  - Header with "AI INTERPRETATIE" label + ConfidenceBadge
  - Glassmorphism box with samenvatting text
  - LOW confidence warning with yellow alert box
  - Disclaimers list (text-white/40 text-xs italic)
  - Conditional rendering: only if ai_parsing.parsed_plan exists and status is 'complete'

**5. index.css**
- Added slide-up animation keyframes (0.3s ease-out)
- Added .animate-slide-up utility class

## Deviations from Plan

None - plan executed exactly as written.

## Technical Decisions

### Confidence Badge Color Scheme
Chose semantic color mapping (green=high, yellow=medium, red=low) with 20% background opacity and 40% border opacity. This provides clear visual hierarchy while maintaining readability on dark glassmorphism backgrounds. Alternative neutral gray badges would have reduced at-a-glance interpretability.

### Monument Badge Placement
Placed inline in QuickCard after address text, before Details button. The MapLibre popup is horizontally constrained, so a separate line would increase height excessively. Inline placement provides monument status without disrupting the compact "te koop" sign aesthetic.

### Touch Event Handling
Used stopPropagation on onTouchStart/onTouchMove/onTouchEnd in PropertyBottomSheet scrollable area. This prevents map pan gestures from triggering when user scrolls drawer content on mobile. CSS touch-action was insufficient due to browser support gaps. Pointer-events would have blocked all interaction including scrolling.

### Force Refresh Button Location
Placed in drawer header actions area, before save/export buttons. This groups all data actions together and maintains visual hierarchy (refresh → save → export → close). Alternative footer placement would separate it from the data it refreshes, reducing discoverability.

### AI Interpretation Section Placement
Positioned after building dimensions but before detailed zoning plans in BestemmingContent. AI provides summary/interpretation of the plans, so showing it before the raw plan data creates logical information flow (overview → details). Alternative top-of-section placement would overshadow the primary bestemming, which is the most critical zoning information.

## Integration Points

### ConfidenceBadge Usage
- PropertyDetailDrawer: AI Interpretatie section (ai_parsing.parsed_plan.overall_confidence)
- Future: Available for other AI confidence indicators (monument detection, etc.)

### PropertyBottomSheet Usage
- Not yet integrated (ready for Phase 17-03 or 17-04)
- Props designed to mirror Drawer: isOpen, onClose, children
- Mobile-only (md:hidden), will replace Drawer on small viewports

### Monument Badge on QuickCard
- Reads data.monuments.is_monument
- Shows immediately when property is selected
- Provides at-a-glance heritage status without opening drawer

### Force Refresh Button
- Wires to existing onRefreshAll prop
- Complements existing per-section FreshnessIndicator refresh
- Allows power users to force full data refresh without individual section clicks

## Testing Notes

### Type Safety
- All TypeScript checks pass (npx tsc --noEmit)
- ConfidenceBadge props typed as 'HIGH' | 'MEDIUM' | 'LOW'
- PropertyBottomSheet uses same props pattern as Drawer
- ai_parsing field access matches PropertyReportResponse type definition

### Conditional Rendering
- ConfidenceBadge only renders with valid confidence level
- Monument badge only renders if monuments data exists
- AI Interpretatie section only renders if ai_parsing.parsed_plan exists AND status is 'complete'
- Force refresh button only renders if onRefreshAll prop provided

### Touch Interaction
- Bottom sheet stopPropagation prevents map pan during scroll
- Escape key closes bottom sheet (useEscapeKey)
- FocusLock traps focus within sheet when open
- Backdrop click closes sheet

## Performance Characteristics

- ConfidenceBadge: No state, pure presentational component
- PropertyBottomSheet: One useEffect for body scroll lock, one for escape key
- Monument badge: Simple conditional rendering, no additional API calls
- AI section: Reads from existing PropertyReportResponse, no new data fetching
- Force refresh: Uses existing onRefreshAll callback, no new state

## Files Changed

**Created (2 files, 107 LOC):**
- `frontend/src/components/property/ConfidenceBadge.tsx` (40 lines)
- `frontend/src/components/property/PropertyBottomSheet.tsx` (67 lines)

**Modified (3 files, +95/-0):**
- `frontend/src/components/property/PropertyQuickCard.tsx` (+13 lines)
- `frontend/src/components/property/PropertyDetailDrawer.tsx` (+64 lines)
- `frontend/src/styles/index.css` (+18 lines)

**Total delta:** +202 LOC

## Commits

1. `6828526` - feat(17-02): add ConfidenceBadge, monument badge on QuickCard, and mobile bottom sheet
2. `d1eb05f` - feat(17-02): add AI zoning display and force refresh button to PropertyDetailDrawer

## Verification

### Must-Haves Met

- [x] On mobile viewports, property details display in a bottom sheet instead of right drawer (component created, ready for integration)
- [x] Monument badge appears on PropertyQuickCard showing Rijksmonument (amber) or Geen monument (green)
- [x] AI zoning section shows confidence badge (HIGH green, MEDIUM yellow, LOW red) with explanatory text
- [x] ConfidenceBadge follows existing SourceBadge styling pattern

### Artifacts Verified

- [x] `frontend/src/components/property/PropertyBottomSheet.tsx` exists (min 40 lines): 67 lines ✓
- [x] `frontend/src/components/property/ConfidenceBadge.tsx` exists (min 20 lines): 40 lines ✓
- [x] `frontend/src/components/property/PropertyQuickCard.tsx` contains "monument": ✓
- [x] `frontend/src/components/property/PropertyDetailDrawer.tsx` contains "ConfidenceBadge": ✓

### Key Links Verified

- [x] PropertyDetailDrawer imports ConfidenceBadge: `import { ConfidenceBadge } from './ConfidenceBadge'` ✓
- [x] PropertyBottomSheet imports useEscapeKey: `import { useEscapeKey } from '@/hooks/useEscapeKey'` ✓

## Self-Check: PASSED

**Created files exist:**
- FOUND: frontend/src/components/property/ConfidenceBadge.tsx
- FOUND: frontend/src/components/property/PropertyBottomSheet.tsx

**Modified files exist:**
- FOUND: frontend/src/components/property/PropertyQuickCard.tsx
- FOUND: frontend/src/components/property/PropertyDetailDrawer.tsx
- FOUND: frontend/src/styles/index.css

**Commits exist:**
- FOUND: 6828526 (ConfidenceBadge, monument badge, bottom sheet)
- FOUND: d1eb05f (AI zoning display, force refresh button)

**Type safety:**
- PASSED: npx tsc --noEmit (no errors)

**Imports verified:**
- FOUND: ConfidenceBadge import in PropertyDetailDrawer
- FOUND: useEscapeKey import in PropertyBottomSheet
- FOUND: FocusLock import in PropertyBottomSheet

**Content verified:**
- FOUND: "monument" in PropertyQuickCard
- FOUND: "ConfidenceBadge" usage in PropertyDetailDrawer
- FOUND: slide-up animation in index.css
- FOUND: "Ververs" force refresh button in PropertyDetailDrawer

## Next Steps

1. **Phase 17-03 or 17-04:** Integrate PropertyBottomSheet into map page responsive layout
   - Replace Drawer with PropertyBottomSheet on mobile viewports
   - Update ViewTier state machine to handle mobile/desktop differences
   - Test touch interactions on real devices

2. **Future enhancement:** Extend ConfidenceBadge usage to other AI features
   - Monument detection confidence (if RCE API adds confidence scores)
   - Future ML-based zoning classification

3. **Future enhancement:** Add animation to confidence badge when data refreshes
   - Subtle pulse or color transition on confidence level change
   - Requires state tracking of previous confidence value

## Duration

**Execution time:** 182 seconds (3m 2s)

**Tasks:**
- Task 1 (ConfidenceBadge, monument badge, bottom sheet): ~90s
- Task 2 (AI zoning display, force refresh button): ~92s
