# Phase 8 — Deferred Items (out of scope)

These pre-existing failures were observed during Phase 8 execution but are NOT
caused by Phase 8 changes. Per scope boundary rule (only auto-fix issues directly
caused by current task's changes), they are documented here for follow-up rather
than fixed.

## Storybook Phase 7 pre-existing failures (5)

File: `frontend/src/stories/parcel/PotentieLayer.stories.tsx`

Failures observed running `pnpm exec vitest run --project=storybook src/stories/parcel/PotentieLayer.stories.tsx`:
- `Phase 7 — Pinned page (0 pins → TOP FACTOREN)`
- `Phase 7 — Pinned page (3 pins + 3 ghosts)`
- `Phase 7 — Pinned factor visible on both pinned-page and group-page`
- `Phase 7 — Hover star + click pins factor`
- `Phase 7 — 5th pin attempt shows toast`

Confirmed pre-existing via `git stash` test. Not introduced by Phase 8 (Tasks 7-9
only add new Phase8* exports — they do not modify existing Phase 7 stories).

## TypeScript pre-existing errors

`pnpm exec tsc -b --noEmit` reports:
- framer-motion `ease: number[]` type mismatch (multiple files)
- `src/stories/layout/ReportSidebar.stories.tsx` + `SideRailNav.stories.tsx`:
  `is_superuser` property missing in mock User object

Confirmed pre-existing via `git stash` test. Not caused by Phase 8 type
additions in `scan.ts`.

## Frontend `pnpm check` gate caveat

The plan's acceptance criterion `cd frontend && pnpm check` exit 0 cannot be
satisfied while pre-existing TS errors stand. Phase 8 did not introduce them —
fixing them is M049+ work.
