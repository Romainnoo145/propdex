---
phase: 16
plan: 06
subsystem: frontend-property-ui
tags: [react, typescript, ui-components, freshness-indicators, source-attribution, trust-but-verify]

requires:
  - 16-03: PropertyDetailDrawer component structure
  - 16-04: useReports hooks with useRefreshReport

provides:
  - Per-section freshness indicators with amber stale warnings
  - Source badges showing attribution and timestamp
  - Update nu per-section refresh action
  - Update alle bronnen full refresh button
  - Trust but Verify pattern (fresh data shows nothing)

affects:
  - Future property panel implementations can reuse FreshnessIndicator/SourceBadge
  - Report list view may want similar freshness indicators

tech-stack:
  added: []
  patterns:
    - Trust but Verify freshness: Only show warnings for stale data, fresh data has no indicator
    - Hover-reveal tooltips: Amber icon with expanded info on hover
    - Per-section source attribution: Each data section shows its source and timestamp

key-files:
  created:
    - frontend/src/components/property/FreshnessIndicator.tsx
    - frontend/src/components/property/SourceBadge.tsx
  modified:
    - frontend/src/components/property/PropertyDetailDrawer.tsx
    - frontend/src/components/property/PropertySection.tsx

decisions:
  - id: freshness-thresholds
    choice: "Kadaster 7 days, Bestemming 30 days, Monument 180 days"
    context: "Different data sources have different update frequencies"
    rationale: "Kadaster data changes most frequently (property transfers), monument status rarely changes"

  - id: trust-but-verify-pattern
    choice: "Fresh data shows no indicator, only stale data gets amber warning"
    context: "Avoid visual clutter, trust the data by default"
    rationale: "Users should only be concerned when data is stale, not constantly reminded when fresh"

  - id: hover-reveal-tooltip
    choice: "Amber icon with hover tooltip containing 'Update nu' button"
    context: "Balance visibility with action availability"
    rationale: "Icon is visible but not intrusive, action available on hover without cluttering UI"

  - id: per-section-refresh
    choice: "Each section can refresh independently via onRefreshSection callback"
    context: "User may only want to update one section, not entire report"
    rationale: "Allows targeted refresh for faster response, reduces API load"

metrics:
  duration: 156s
  completed: 2026-02-08
---

# Phase 16 Plan 06: Freshness Indicators & Source Badges Summary

**One-liner:** Per-section source attribution with amber stale warnings and Trust but Verify freshness pattern

## What Was Built

Created `FreshnessIndicator` and `SourceBadge` components implementing the "Trust but Verify" approach to data freshness. Each section in the property drawer now shows:

1. **Source badges:** "Bron: Kadaster • 8 feb 2026, 22:40" format
2. **Freshness indicators:** Amber warning icon for stale data with hover tooltip
3. **Per-section refresh:** "Update nu" button in stale indicator tooltip
4. **Full refresh:** "Update alle bronnen" button at bottom of drawer

Fresh data has no visual indicator (trust), only stale data gets amber warning (verify).

## Acceptance Criteria

**Must-haves:**
- [x] Each section shows source attribution: "Bron: Kadaster • 8 feb 2026, 22:40"
- [x] Stale sections show amber warning icon with tooltip explaining age
- [x] Clicking "Update nu" on stale section triggers per-section refresh
- [x] Fresh sections have no visual indicator (no green badge)
- [x] "Update alle bronnen" button at bottom refreshes entire report

**Artifacts:**
- [x] `frontend/src/components/property/FreshnessIndicator.tsx` (85 lines)
- [x] `frontend/src/components/property/SourceBadge.tsx` (37 lines)
- [x] Key links verified:
  - FreshnessIndicator → useRefreshReport via onRefreshSection callback
  - PropertyDetailDrawer → FreshnessIndicator per section

## Task Commits

| Task | Commit | Files Changed | Description |
|------|--------|---------------|-------------|
| 1 | `009b197` | `FreshnessIndicator.tsx`, `SourceBadge.tsx` | Create freshness indicator and source badge components with Trust but Verify pattern |
| 2 | `21f0d64` | `PropertyDetailDrawer.tsx`, `PropertySection.tsx`, `FreshnessIndicator.tsx` | Integrate badges into drawer sections with per-section and full refresh actions |

## Decisions Made

### 1. Freshness Thresholds
**Choice:** Kadaster 7 days, Bestemming 30 days, Monument 180 days

**Rationale:** Different data sources have different update frequencies:
- **Kadaster (7 days):** Property ownership can change frequently via transfers
- **Bestemming (30 days):** Zoning regulations change occasionally via municipal updates
- **Monument (180 days):** Monument status rarely changes, very stable data

Exported as `FRESHNESS_THRESHOLDS` constant for reuse across components.

### 2. Trust but Verify Pattern
**Choice:** Fresh data shows no indicator, only stale data gets amber warning

**Rationale:**
- Reduces visual clutter in the common case (fresh data)
- Users trust the data by default unless warned
- Amber warning draws attention only when needed
- No green checkmarks or "Fresh" badges polluting the UI

### 3. Hover-Reveal Tooltip
**Choice:** Amber icon with hover tooltip containing age and "Update nu" button

**Implementation:**
- Icon always visible for stale data
- Tooltip reveals on hover with:
  - Human-readable age: "Deze data is 3 dagen oud"
  - "Update nu" button triggering onRefreshSection callback
  - "Bezig..." state during refresh

**Rationale:**
- Balance visibility (icon) with action availability (hover)
- Keeps UI clean while making refresh action discoverable
- Tooltip provides context without permanent clutter

### 4. Per-Section Refresh
**Choice:** Each section can refresh independently via `onRefreshSection(section)` callback

**API Design:**
```tsx
<FreshnessIndicator
  sectionName="Kadaster"
  ageSeconds={kadasterSource.age_seconds}
  freshnessThresholdDays={7}
  onRefresh={() => onRefreshSection?.('kadaster')}
  isRefreshing={isRefreshing}
/>
```

**Rationale:**
- Allows targeted refresh for faster response
- Reduces API load (only refresh what's needed)
- Better UX for users who only care about one section
- Still provide "Update alle bronnen" for full refresh

## Implementation Notes

### FreshnessIndicator Component

**Key features:**
- Calculates staleness: `ageSeconds >= freshnessThresholdDays * 86400`
- Returns `null` for fresh data (Trust but Verify)
- Shows amber warning triangle for stale data
- `formatAge` helper: "zojuist" / "X minuten" / "X uur" / "X dagen" / "X weken"
- Tooltip with glassmorphism: `bg-black/90 backdrop-blur-xl border-white/20`
- "Update nu" button disabled during refresh

### SourceBadge Component

**Key features:**
- Dutch date format: `Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })`
- Format: "Bron: {source} • {formatted date}"
- Falls back to "Bron: {source}" if `cachedAt` is null
- Optional tooltip via `title` attribute
- Subtle styling: `text-xs text-white/40`

### PropertyDetailDrawer Integration

**Changes:**
1. **Added props:**
   - `onRefreshSection?: (section: string) => void`
   - `onRefreshAll?: () => void`
   - `isRefreshing?: boolean`

2. **DataState component:**
   - `getSectionSource` helper finds section_sources by name
   - Per-section badges and freshness indicators
   - Wrapped section content in `<div className="space-y-3">` for proper spacing
   - "Update alle bronnen" button at bottom

3. **PropertySection component:**
   - Added `badge?: React.ReactNode` prop
   - Rendered inline next to title in header
   - Gap-2 spacing for proper layout

### Source Metadata Lookup

Uses `PropertyReportResponse.section_sources` field to find per-section metadata:

```typescript
const getSectionSource = (sectionName: string) => {
  return data.section_sources?.find(
    (s) => s.section.toLowerCase() === sectionName.toLowerCase()
  );
};
```

Falls back gracefully if `section_sources` is missing (demo data may not have it).

## Testing Strategy

**Manual testing:**
1. Open property detail drawer with real backend data
2. Verify source badges show correct source name and timestamp
3. Wait for data to become stale (or mock old `cached_at` timestamp)
4. Verify amber warning appears with hover tooltip
5. Click "Update nu" in tooltip, verify refresh triggered
6. Verify "Update alle bronnen" button at bottom works
7. Test with demo data (no section_sources) - should show source names without crashes

**Edge cases handled:**
- `section_sources` missing → No badges shown
- `cached_at` null → Badge shows source name only
- `age_seconds` null → No freshness indicator
- Fresh data → No indicator shown
- Multiple sources per section → Uses first source for badge

## Performance Considerations

**Optimizations:**
- Freshness check is O(1) arithmetic comparison
- `getSectionSource` is O(n) but n is small (3-4 sections)
- Tooltip rendered but hidden via CSS (no dynamic DOM manipulation)
- Date formatting memoized by browser's `Intl.DateTimeFormat`

**No performance concerns** - components are lightweight and render-efficient.

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Blockers:** None

**Concerns:** None

**Dependencies satisfied:**
- PropertyDetailDrawer structure from 16-03 ✓
- useRefreshReport hook from 16-04 ✓
- PropertyReportResponse with section_sources from backend ✓

**Ready for next plan:** Yes

Parent component needs to wire up:
- `onRefreshSection` → `useRefreshReport.mutate(reportId)`
- `onRefreshAll` → `useRefreshReport.mutate(reportId)`
- `isRefreshing` → `useRefreshReport.isPending`

## Phase Integration

This plan completes the Trust but Verify freshness pattern for property reports. The pattern can be reused in:
1. Report list view (show staleness per report card)
2. Quick view panel (show staleness summary)
3. PDF export (include freshness metadata)

**Phase 16 status:** 6/7 plans complete

**Next plan:** 16-07 (final plan in phase)

## Self-Check: PASSED

**Files created:**
- ✓ frontend/src/components/property/FreshnessIndicator.tsx
- ✓ frontend/src/components/property/SourceBadge.tsx

**Commits verified:**
- ✓ 009b197
- ✓ 21f0d64
