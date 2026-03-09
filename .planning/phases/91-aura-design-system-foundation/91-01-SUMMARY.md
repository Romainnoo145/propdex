---
phase: 91-aura-design-system-foundation
plan: 01
subsystem: ui
tags: [tailwind-v4, css-tokens, design-system, satoshi-font, dark-mode-removal, aura]

# Dependency graph
requires: []
provides:
  - Aura CSS custom properties (@theme block) for all colors, typography, radius, shadows
  - Satoshi font loaded globally via Fontshare CDN
  - Full dark mode removal (no ThemeProvider, no useTheme, no html.light)
  - Aura token migration across 107 component files
  - Button command variant (bg-aura-obsidian)
  - Typography utility classes (.text-display, .text-kpi, .text-label)
affects: [91-02 glass-primitives, 92-side-rail-nav, 93-search-filters, 94-parcel-detail, 95-wijk-bento, 96-map-ux, 97-polish]

# Tech tracking
tech-stack:
  added: [Satoshi font via Fontshare CDN]
  patterns: [Aura token naming (--color-aura-*), neutral scale (--color-neutral-*), glass opacity via Tailwind modifiers (bg-aura-glass-white/60)]

key-files:
  created: []
  modified:
    - frontend/src/styles/index.css
    - frontend/index.html
    - frontend/src/main.tsx
    - frontend/src/components/settings/AppearanceSection.tsx
    - frontend/src/components/primitives/Button.tsx
    - frontend/src/components/primitives/Badge.tsx
    - frontend/src/components/primitives/Card.tsx
    - frontend/src/components/primitives/Input.tsx
    - frontend/src/components/primitives/Select.tsx
    - frontend/src/components/primitives/MetricChip.tsx
    - frontend/src/components/primitives/SearchInput.tsx

key-decisions:
  - "Aura glass-white defined as #ffffff (pure hex) so Tailwind opacity modifiers work: bg-aura-glass-white/60"
  - "AppearanceSection kept with map style selector only, theme toggle removed"
  - "Satoshi loaded via Fontshare CDN (not self-hosted) for simplicity"
  - "Badge 'teal' variant renamed to use aura-green but kept variant name for backward compat"

patterns-established:
  - "Aura token naming: --color-aura-canvas, --color-aura-ink, --color-aura-amber, --color-aura-obsidian, --color-aura-green"
  - "Glass hierarchy via opacity: bg-aura-glass-white/60 (panel), bg-aura-glass-white/40 (pod), bg-aura-glass-white/25 (deep)"
  - "Neutral scale for borders/muted: neutral-200 borders, neutral-500 secondary text, neutral-600 tertiary"
  - "Button command variant: bg-aura-obsidian text-white for authoritative CTAs"

requirements-completed: [DS-01, DS-02, DS-05]

# Metrics
duration: 6min
completed: 2026-03-10
---

# Phase 91 Plan 01: Aura Design System Foundation Summary

**Replace Industrial Amber oklch tokens with Aura hex palette, swap Inter for Satoshi via Fontshare, remove dark mode infrastructure across 107 files**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-09T21:43:21Z
- **Completed:** 2026-03-09T21:49:36Z
- **Tasks:** 2
- **Files modified:** 112

## Accomplishments
- Rewrote index.css @theme block with complete Aura token set (16 color tokens, neutral scale, typography, radius, shadows)
- Migrated 931+ old token references across 107 component files to Aura equivalents
- Fully removed dark mode: deleted ThemeContext.tsx, useTheme.ts, FOUC script, html.light block, theme toggle
- Added Satoshi font via Fontshare CDN, removed Inter/Google Fonts
- Added Button command variant and typography utility classes
- npm run check passes with 0 errors (278 pre-existing warnings)

## Task Commits

Each task was committed atomically:

1. **Task 1: Aura tokens + Satoshi font + dark mode removal** - `895c72a` (feat)
2. **Task 2: Migrate all component files from old tokens to Aura tokens** - `f430b8f` (feat)

## Files Created/Modified
- `frontend/src/styles/index.css` - Complete @theme rewrite with Aura tokens, typography utilities
- `frontend/index.html` - Satoshi via Fontshare CDN, removed FOUC script and Inter
- `frontend/src/main.tsx` - Removed ThemeProvider, updated Toaster to light Aura styling
- `frontend/src/components/settings/AppearanceSection.tsx` - Removed theme toggle, kept map style
- `frontend/src/components/primitives/Button.tsx` - Aura tokens + command variant
- `frontend/src/components/primitives/Badge.tsx` - Aura tokens
- `frontend/src/components/primitives/Card.tsx` - Glass elevation hierarchy
- `frontend/src/components/primitives/Input.tsx` - Aura tokens
- `frontend/src/components/primitives/Select.tsx` - Aura tokens
- `frontend/src/components/primitives/MetricChip.tsx` - Aura tokens, neutral tones
- `frontend/src/components/primitives/SearchInput.tsx` - Aura tokens
- `frontend/src/lib/theme/ThemeContext.tsx` - DELETED
- `frontend/src/lib/theme/useTheme.ts` - DELETED
- 95+ additional component files with token migrations

## Decisions Made
- Used #ffffff for glass-white token (not rgba) to enable Tailwind opacity modifiers
- Kept AppearanceSection with map style selector, removed only theme toggle
- Used Fontshare CDN for Satoshi (official source, free, no build complexity)
- Mapped overlay token to explicit neutral values rather than keeping a mode-dependent variable
- Updated popup styles from dark glass to light glass (white bg with subtle shadow)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Cleaned up opacity modifiers on neutral colors**
- **Found during:** Task 2 (Bulk migration)
- **Issue:** After sed replacement, some patterns like `border-neutral-200/[0.08]` and `bg-neutral-100/[0.03]` were semantically wrong for a light theme (near-invisible borders/backgrounds)
- **Fix:** Replaced with solid neutral values: `border-neutral-200`, `bg-neutral-50`
- **Files modified:** Multiple component files
- **Verification:** Visual semantic correctness, npm run check passes
- **Committed in:** f430b8f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary for visual correctness in light theme context. No scope creep.

## Issues Encountered
- Initial sed pass missed `grey-200`, `grey-500` variants not in the original mapping table. Handled with a second pass targeting all remaining grey-* patterns.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Aura tokens are defined and active across the entire codebase
- Glass hierarchy is prepared (bg-aura-glass-white/60, /40, /25) for plan 02 GlassPanel/BentoPod primitives
- Button command variant ready for use in layout components
- Typography utilities (.text-display, .text-kpi, .text-label) available for Phase 92+ components

---
*Phase: 91-aura-design-system-foundation*
*Completed: 2026-03-10*
