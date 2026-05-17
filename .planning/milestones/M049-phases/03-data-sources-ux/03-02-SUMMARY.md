---
phase: 03-data-sources-ux
plan: 02
subsystem: ui
tags: [tanstack-router, framer-motion, settings-nav, superuser-gate]

# Dependency graph
requires:
  - phase: none
    provides: "Standalone extension to existing SettingsTabNav pill nav"
provides:
  - "5th pill 'Data-bronnen' in SettingsTabNav, superuser-gated"
  - "Fuzzy-matched active state for /instellingen/data-bronnen/* sub-routes"
  - "isDataBronnenActive flag with fuzzy route matching"
affects: [03-04-route-plan, instellingen-layout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fuzzy matchRoute for parent + child route active-state: matchRoute({ to: '/instellingen/data-bronnen', fuzzy: true })"
    - "Superuser-gated pill using user?.is_superuser && <Link ...> (same as Admin + Beleid-beheer)"
    - "Shared layoutId='settings-tab' across all 5 pills for cross-tab Framer Motion spring transition"

key-files:
  created: []
  modified:
    - "frontend/src/components/settings/SettingsTabNav.tsx"

key-decisions:
  - "Type-check deferred for Link to='/instellingen/data-bronnen' until route file lands in 03-04 (routeTree.gen.ts not yet updated) — per plan Step D option 2"
  - "isAccountActive updated to exclude isDataBronnenActive to prevent Account pill showing active on /instellingen/data-bronnen"
  - "fuzzy: true on matchRoute ensures pill stays active on both /instellingen/data-bronnen and /instellingen/data-bronnen/GM0983 sub-route"

patterns-established:
  - "Settings pill extension: add active-flag, update isAccountActive, append guarded Link block"

requirements-completed: [UX-05]

# Metrics
duration: 5min
completed: 2026-05-14
---

# Phase 03 Plan 02: SettingsTabNav Data-bronnen Pill Summary

**5th pill 'Data-bronnen' added to SettingsTabNav with superuser gate, fuzzy sub-route match, and shared Framer Motion layoutId — superusers can now navigate to the data hub from settings**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-14T16:16:00Z
- **Completed:** 2026-05-14T16:21:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Extended SettingsTabNav from 4 to 5 pills with zero regression on existing pills
- New isDataBronnenActive flag uses `fuzzy: true` — covers both /instellingen/data-bronnen index and /instellingen/data-bronnen/$gemeenteCode detail route
- isAccountActive updated to exclude new tab (prevents Account pill activating on /instellingen/data-bronnen)
- Pre-existing 4 pills (Account, Score profiel, Admin, Beleid-beheer) remain unchanged in markup, styling, and order

## Diff Summary (3 changes)

**Change A — New active flag (line 12):**
```tsx
const isDataBronnenActive = !!matchRoute({ to: '/instellingen/data-bronnen', fuzzy: true })
```

**Change B — Updated isAccountActive (line 13):**
```tsx
const isAccountActive = !isScoreActive && !isAdminActive && !isBeleidActive && !isDataBronnenActive
```

**Change C — New Data-bronnen pill block (lines 85–102):**
```tsx
{user?.is_superuser && (
  <Link to="/instellingen/data-bronnen" ...>
    {isDataBronnenActive && (
      <motion.div layoutId="settings-tab" className="... bg-[#0E1111]" ... />
    )}
    <span ...>Data-bronnen</span>
  </Link>
)}
```

## Task Commits

1. **Task 1: Extend SettingsTabNav with Data-bronnen pill** - `29ea1a40` (feat)

**Plan metadata commit:** (pending — created with final state update)

## Files Created/Modified
- `frontend/src/components/settings/SettingsTabNav.tsx` — Extended from 87 → 105 lines; 5 pills, 5 layoutId occurrences, 5 font-family style props, 3 superuser gates

## Decisions Made
- Type-check deferred for the new Link's `to` prop until Plan 03-04 creates the route file and regenerates routeTree.gen.ts. The only errors in npm run check attributable to this change are 2 TS2322 errors on `to="/instellingen/data-bronnen"`. All other existing type errors are pre-existing in unrelated files.
- `fuzzy: true` on matchRoute is necessary because the detail sub-route (`$gemeenteCode`) must also keep the pill active.

## Deviations from Plan

None - plan executed exactly as written. Type-check deferral was explicitly anticipated and documented in the plan's Step D option 2.

## Issues Encountered
- Pre-existing type errors across unrelated files (DataCatalog.tsx, BottomTabNav.tsx, WijkMapPanel.tsx, etc.) showed up in `npm run check` — these are out of scope per deviation rules scope boundary. Not fixed, not introduced by this task.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SettingsTabNav 5-pill nav is complete and committed
- Route `/instellingen/data-bronnen` must be created in Plan 03-04 to resolve the deferred TS2322 type error
- Plan 03-01 (types + query hooks) and Plan 03-02 (this plan) are both complete; 03-03 (components) and 03-04 (routes) can now proceed

---
*Phase: 03-data-sources-ux*
*Completed: 2026-05-14*
