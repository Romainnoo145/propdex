---
phase: 15-property-data-map-interactions
plan: 03
subsystem: frontend-ui
tags: [react, typescript, pdok-api, autocomplete, map-ui, glassmorphism]

requires:
  - phase: 15-01
    reason: useAddressSuggest hook with debounced PDOK API integration

provides:
  - artifact: AddressSearch component
    exports: [AddressSearch]
    purpose: Floating search bar with PDOK autocomplete for address lookup

affects:
  - phase: 15-04
    reason: AddressSearch will be integrated into map page for property lookup
  - phase: 15-05
    reason: Selected address triggers geocode lookup and map interaction

tech-stack:
  added: []
  patterns:
    - Keyboard navigation with highlightedIndex state
    - Click-outside detection with useRef and document event listener
    - Conditional dropdown visibility based on query length and results

key-files:
  created:
    - frontend/src/components/search/AddressSearch.tsx
  modified: []

decisions:
  - decision: No aria-* attributes or role="combobox"
    rationale: Keep implementation simple with basic semantic HTML and keyboard handlers
    impact: Accessibility relies on keyboard navigation implementation rather than ARIA semantics
  - decision: Focus always stays on input element
    rationale: Dropdown items are not focusable - highlighted state is visual only, controlled by keyboard
    impact: Simpler state management, no focus trap logic needed
  - decision: "Geen resultaten" shown only when not loading
    rationale: Prevents flash of "no results" during debounce/loading period
    impact: Better UX - empty state only shows after API response

metrics:
  duration: 1 minute
  completed: 2026-02-08
---

# Phase 15 Plan 03: Floating Address Search Summary

**One-liner:** Floating glassmorphism search bar with PDOK autocomplete, keyboard navigation, and 300ms debounced API calls.

## What Was Built

Created `AddressSearch` component providing the primary user interface for property lookup:

**Core functionality:**
- Floating search bar positioned at top-center of map
- Real-time autocomplete via useAddressSuggest hook (300ms debounce, 3-char minimum)
- Full keyboard navigation (ArrowDown/ArrowUp to navigate, Enter to select, Escape to close)
- Click-outside handler to close dropdown
- Loading spinner during API fetch
- "Geen resultaten" message when no suggestions found

**Styling:**
- Glassmorphism aesthetic matching LayerToggle (bg-black/30, backdrop-blur-md)
- Floating position with z-index CSS variables (--z-search-bar: 100, --z-dropdown: 400)
- White text with transparency, smooth transitions
- Highlighted item with bg-white/15 for keyboard navigation feedback

**Component interface:**
```typescript
interface AddressSearchProps {
  onSelect: (suggestion: SuggestResult) => void;
  className?: string;
}
```

**State management:**
- `query` - controlled input value
- `highlightedIndex` - keyboard navigation cursor (-1 = none)
- `showDropdown` - dropdown visibility flag
- `containerRef` - ref for click-outside detection

## Task Commits

| Task | Commit  | Summary                                          |
| ---- | ------- | ------------------------------------------------ |
| 1    | 7c2e22b | Build AddressSearch with autocomplete & keyboard |

## Key Technical Details

**Keyboard Navigation Implementation:**
- ArrowDown/ArrowUp wrap at list boundaries (0 ↔ length-1)
- Enter key selects highlighted suggestion, updates input to weergavenaam, closes dropdown
- Escape clears highlight and closes dropdown
- Focus stays on input at all times (dropdown items not focusable)

**Dropdown Visibility Logic:**
```typescript
const isDropdownVisible =
  showDropdown &&
  query.length >= 3 &&
  (suggestions.length > 0 || !isLoading);
```

This prevents:
- Showing dropdown before 3 characters typed
- Showing dropdown during loading state
- Flash of "no results" during debounce period

**Click-Outside Handler:**
- Uses `useRef` on container div
- Document mousedown listener checks if click target is outside containerRef
- Cleanup on unmount prevents memory leaks

**Integration with useAddressSuggest:**
- Hook handles 300ms debounce automatically
- Only triggers API call when debouncedQuery >= 3 chars
- Returns `{ data, isLoading }` for component to render states

## Deviations from Plan

None - plan executed exactly as written.

## Files Changed

**Created:**
- `frontend/src/components/search/AddressSearch.tsx` (181 lines)
  - AddressSearch component with full keyboard navigation
  - Glassmorphism styling matching existing map controls
  - Integration with useAddressSuggest hook

## Integration Points

**Inputs:**
- `onSelect: (suggestion: SuggestResult) => void` - callback when user selects address
- `className?: string` - optional additional classes for positioning

**Outputs:**
- Calls `onSelect` with full SuggestResult object containing:
  - `weergavenaam` - display name of selected address
  - `id` - PDOK identifier for geocode lookup
  - `type` - result type (adres)
  - `score` - relevance score

**Dependencies:**
- useAddressSuggest hook (from 15-01)
- SuggestResult type (from lib/types/property)

## Next Phase Readiness

**Ready for 15-04 (Map Page Integration):**
- AddressSearch component fully functional
- onSelect callback provides SuggestResult data
- Floating position ready for map overlay

**Blocks:** None

**Concerns:** None

**Validation:**
- `npm run check` passes (TypeScript + ESLint)
- Component renders with glassmorphism styling
- Keyboard handlers implemented
- Click-outside handler closes dropdown
- Z-index variables used correctly

## Self-Check: PASSED

All files created:
- ✓ frontend/src/components/search/AddressSearch.tsx

All commits exist:
- ✓ 7c2e22b
