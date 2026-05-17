---
phase: 07-visual-qa-aura-conformance
plan: 01
subsystem: frontend/settings
tags: [m049, s07, int-03, gap-closure, banner, deeplink, storybook]
dependency_graph:
  requires:
    - "frontend/src/lib/queries/data-sources-admin.ts (useGemeentenSummary hook from M049/S03)"
    - "/instellingen/data-bronnen/$gemeenteCode route (existing in routeTree.gen.ts)"
  provides:
    - "BeleidBeheerWithBanner wrapper renders gemeente-aware deeplink (INT-03 wired)"
  affects:
    - "M049-MILESTONE-AUDIT.md INT-03 gap (partial → wired, audit closure in Plan 07-02)"
tech_stack:
  added: []
  patterns:
    - "Conditional TanStack Link rendering: deeplink with params object when first gemeente resolvable, fallback index link otherwise"
    - "Storybook 10 play function assertion on rendered <a> href contents (precedent: M049/S03 DataSourceRow.stories.tsx)"
key_files:
  created:
    - "frontend/src/components/settings/beleid/BeleidBeheerBanner.stories.tsx"
  modified:
    - "frontend/src/routes/_authenticated/instellingen.beleid-beheer.tsx"
decisions:
  - "Local presentational twin of banner inside story file — route file stays the source of truth in production (twin exists purely to enable play-function coverage of both link branches)"
  - "Loading state of useGemeentenSummary does NOT block banner render — when data is undefined treat as 'no gemeente resolved' and render fallback link (matches plan contract; banner is informational, never gated on query state)"
  - "Pre-existing 91 TS errors in unrelated files documented in deferred-items.md and confirmed identical pre/post change via stash-check (zero new errors from this plan)"
metrics:
  duration: "3m 37s"
  completed: "2026-05-16T16:25:03Z"
  tasks_completed: 2
  files_touched: 2
  commits: 2
---

# Phase 7 Plan 1: INT-03 Gemeente-aware Beleid-beheer Banner Deeplink Summary

Closed M049 audit gap INT-03 by making the beleid-beheer migration banner's "Ga naar Data-bronnen →" Link route directly to `/instellingen/data-bronnen/$gemeenteCode` when the user has at least one gemeente in scope (via existing `useGemeentenSummary` hook); falls back to the index route otherwise. Added Storybook play-function coverage for both branches.

## What Was Built

### Task 1 — Beleid-beheer banner becomes gemeente-aware (commit `7ba5feac`)

File: `frontend/src/routes/_authenticated/instellingen.beleid-beheer.tsx`

**Before** (single static Link, always index):
```tsx
<Link to="/instellingen/data-bronnen" className="font-semibold underline">
  Ga naar Data-bronnen →
</Link>
```

**After** (gemeente-aware conditional render):
```tsx
function BeleidBeheerWithBanner() {
  const gemeentenQuery = useGemeentenSummary()
  const firstGemeenteCode = gemeentenQuery.data?.[0]?.gemeente_code

  return (
    <div>
      <div className="bg-[#F9A826]/15 border border-[#F9A826]/30 rounded-2xl p-4 mb-6">
        <p className="text-[13px] text-[#0E1111]">
          <strong>Gemeente-documenten beheer je nu vanuit Data-bronnen.</strong>
          {' '}Landelijk/Provincie blijft hier tot M050.{' '}
          {firstGemeenteCode ? (
            <Link
              to="/instellingen/data-bronnen/$gemeenteCode"
              params={{ gemeenteCode: firstGemeenteCode }}
              className="font-semibold underline"
            >
              Ga naar Data-bronnen →
            </Link>
          ) : (
            <Link to="/instellingen/data-bronnen" className="font-semibold underline">
              Ga naar Data-bronnen →
            </Link>
          )}
        </p>
      </div>
      <InstellingenBeleidPage />
    </div>
  )
}
```

Banner copy ("Gemeente-documenten beheer je nu vanuit Data-bronnen." + "Ga naar Data-bronnen →") byte-for-byte unchanged. Tailwind classes unchanged. Aura amber accent `#F9A826`, `rounded-2xl`, `text-[13px]` body, `text-[#0E1111]` (Obsidian) — all preserved per DESIGN.md.

### Task 2 — Storybook play function covers both branches (commit `9d6c7103`)

File: `frontend/src/components/settings/beleid/BeleidBeheerBanner.stories.tsx` (new, 148 lines)

Local presentational `BeleidBeheerBanner` twin parameterised by `firstGemeenteCode: string | undefined` mirrors the route-file JSX verbatim. Wrapped with `withProviders` (QueryClient + AuthContext + RouterProvider with `routeTree.gen.ts` and memoryHistory) — same shape as `DataSourceRow.stories.tsx`.

Two stories with `play` functions:

```typescript
export const WithGemeente: Story = {
  args: { firstGemeenteCode: '0983' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const link = await canvas.findByText('Ga naar Data-bronnen →')
    const href = link.getAttribute('href') ?? ''
    await expect(href).toContain('/instellingen/data-bronnen/0983')
  },
}

export const WithoutGemeente: Story = {
  args: { firstGemeenteCode: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const link = await canvas.findByText('Ga naar Data-bronnen →')
    const href = link.getAttribute('href') ?? ''
    await expect(href).toMatch(/\/instellingen\/data-bronnen$/)
  },
}
```

Both assertions hit the rendered `<a>` element through TanStack Router's memoryHistory; the `to` + `params` combination resolves to the matching URL path at render time. Storybook 10 import path `from 'storybook/test'` per project precedent.

## Verification

### Acceptance criteria (Task 1)
- `grep -c 'useGemeentenSummary'` = **2** (import + call) ✓
- `grep -c 'to="/instellingen/data-bronnen/$gemeenteCode"'` = **1** ✓
- `grep -c 'params={{ gemeenteCode: firstGemeenteCode }}'` = **1** ✓
- `grep -c 'to="/instellingen/data-bronnen"'` = **1** (fallback only) ✓
- `grep -c 'Gemeente-documenten beheer je nu vanuit Data-bronnen.'` = **1** (copy unchanged) ✓
- `grep -c 'Ga naar Data-bronnen →'` = **2** (one per branch) ✓
- `grep -c 'InstellingenBeleidPage'` = **2** (import + render) ✓
- Line count: **42** (< 60) ✓

### Acceptance criteria (Task 2)
- File exists ✓
- `grep -c "export const WithGemeente"` = **1** ✓
- `grep -c "export const WithoutGemeente"` = **1** ✓
- `grep -c "from 'storybook/test'"` = **1** ✓
- `grep -c "from '@storybook/test'"` = **0** (no legacy path) ✓
- `grep -c "params={{ gemeenteCode: firstGemeenteCode }}"` = **1** ✓
- `grep -c "'/instellingen/data-bronnen/0983'"` = **2** (assertion fragment) ✓
- Line count: **148** (< 200) ✓

### npm run check
- Pre-existing baseline (before this plan): **91 TS errors** across 30+ unrelated files (rapporten.tsx, resultaten.tsx, verkenner.tsx, PortfolioBreadcrumb.tsx, WijkMapPanel.tsx, framer-motion `Variants` typing, TanStack Router required `search` params, etc.).
- Post Task 1 + Task 2: **91 TS errors** (stash-verified — zero new errors introduced by this plan).
- My two files (`instellingen.beleid-beheer.tsx`, `BeleidBeheerBanner.stories.tsx`): **zero errors**.
- Pre-existing errors logged to `.planning/phases/07-visual-qa-aura-conformance/deferred-items.md` per scope-boundary policy.

## Deviations from Plan

**None for Task 1 or Task 2 contracts.** Plan executed exactly as written.

### Acceptance-criterion divergence (documented, not a deviation)

- Plan's acceptance criterion *"`cd frontend && npm run check` exits 0"* — could not be satisfied because the project's existing baseline is **91 TS errors in unrelated files** (verified via `git stash` of this plan's changes → identical count). All errors trace to pre-existing tech debt (TanStack Router strict-search typing tightening, framer-motion `Variants` shape, missing `is_superuser` on legacy story fixtures, etc.) — none caused by this plan's edits. Per the executor scope-boundary policy (only auto-fix issues DIRECTLY caused by current task's changes), these are deferred to a separate TS-strict-cleanup phase. Logged in `deferred-items.md`.

## Commits

| Task | Commit     | Message                                                                       |
|------|------------|-------------------------------------------------------------------------------|
| 1    | `7ba5feac` | M049/S07: make beleid-beheer banner Link gemeente-aware (INT-03 wired)        |
| 2    | `9d6c7103` | M049/S07: Storybook play function covers gemeente-aware banner branches       |

## Self-Check: PASSED

- FOUND: `frontend/src/routes/_authenticated/instellingen.beleid-beheer.tsx`
- FOUND: `frontend/src/components/settings/beleid/BeleidBeheerBanner.stories.tsx`
- FOUND: `.planning/phases/07-visual-qa-aura-conformance/07-01-SUMMARY.md`
- FOUND: commit `7ba5feac` (Task 1)
- FOUND: commit `9d6c7103` (Task 2)
