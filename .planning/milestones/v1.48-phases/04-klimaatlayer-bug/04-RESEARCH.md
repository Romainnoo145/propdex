# Phase 4: KlimaatLayer Bug - Research

**Researched:** 2026-04-25
**Domain:** React state lifecycle, TanStack Query cache, Storybook play-function testing
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUG-01 | KlimaatLayer shows correct gemeente verdict when user switches between gemeenten on the map (no stale gemeente data shown) | Root cause identified: two compounding bugs — missing `key` prop on `GemeenteContextPanel` and stale `activeLayer` state not reset between gemeente transitions. Fix is confined to `GemeenteContextPanel.tsx` and `map.tsx` render call-site. |

</phase_requirements>

---

## Summary

The KlimaatLayer stale-verdict bug has been fully diagnosed by reading the component tree. Two defects compound to produce the symptom.

**Defect A — no `key` on `GemeenteContextPanel`.**
`map.tsx` renders `<GemeenteContextPanel naam={activePanel.naam} code={activePanel.code} .../>` without a `key` prop. When the user switches from gemeente A to gemeente B, React reuses the existing `GemeenteContextPanel` instance and merely passes new props. The `GemeenteContextPanel` maintains its own `useState<GemeenteLayer | null>(null)` (`activeLayer`) which is NOT reset on a prop change. If the Vergunningen tab was active for gemeente A, it stays active for gemeente B — and React Query serves gemeente A's cached data for gemeente B's initial render because the query key `['gemeente-profile', gemeenteNaam]` changes, but the component's `isLoading` state is momentarily `false` on the stale entry before the new fetch resolves.

**Defect B — `activeLayer` internal state survives gemeente transition.**
Even if a `key` were present, `GemeenteContextPanel` would reset cleanly. But without it, `useState` on `activeLayer` keeps the previous tab open. This means `KlimaatLayer` stays mounted with the old `gemeenteNaam` prop for at least one render cycle before React Query's background refetch resolves, producing a visible ghost verdict.

**Why the ghost can persist indefinitely:** `useGemeenteProfile` has `staleTime: 5 * 60 * 1000`. If gemeente A was fetched recently, React Query returns gemeente A's cached data immediately and never marks the entry as stale — the query re-runs with the new key (`gemeenteNaam` changed) but the old data is visible until the fetch completes. When `GemeenteContextPanel` has no `key`, the queries for the OLD gemeente name still bind to the mounted component instance, so the verdict panel never clears.

**Primary recommendation:** Add `key={activePanel.code}` to `GemeenteContextPanel` at the render call-site in `map.tsx`. This is the minimal, idiomatic React fix — it forces a fresh component tree (including fresh `activeLayer = null` and fresh React Query bindings) on every gemeente switch. No query-layer changes are needed.

---

## Standard Stack

### Core (already in use — no new installs required)

| Library | Version (from package) | Purpose | Why Standard |
|---------|------------------------|---------|--------------|
| React | 19.x | Component lifecycle, `key` prop semantics | Project baseline |
| TanStack Query (React Query) | 5.x | Server-state cache keyed on `['gemeente-profile', gemeenteNaam]` | Project baseline |
| Framer Motion | 11.x | `AnimatePresence` + `key`-triggered exit/enter animations | Already used in panel |
| Storybook (react-vite) | 8.x + addon-vitest 10.x | Play-function component tests | Established pattern (PotentieLayer.stories.tsx) |

**Installation:** None required. All dependencies are already present.

---

## Architecture Patterns

### Gemeente panel state ownership

```
map.tsx (route)
  └── GemeenteContextPanel (naam, code)  ← NO key prop currently
        ├── useState: activeLayer = null | 'vergunningen' | 'regelgeving' | ...
        ├── KlimaatLayer (gemeenteNaam, gemeenteCode)
        │     ├── useGemeenteProfile(gemeenteNaam)    queryKey: ['gemeente-profile', gemeenteNaam]
        │     ├── useGemeenteAnalysisStatus(gemeenteNaam) queryKey: ['jurisprudence', 'analysis-status', gemeenteNaam]
        │     └── useDoorlooptijdStats(gemeenteNaam)  queryKey: ['jurisprudence', 'doorlooptijd', gemeenteNaam]
        ├── BestuurlijkLayer (gemeenteNaam)
        └── BeleidNieuwsLayer (gemeenteNaam, gemeenteCode)
```

**Gemeente selection flow:**
1. User clicks gemeente boundary on map
2. `activateGemeenteContext(gemeenteCode, gemeenteNaam, bbox)` in `map.tsx`
3. `setActivePanel({ kind: 'gemeente', code, naam, bbox })`
4. React re-renders `GemeenteContextPanel` with new `naam`/`code` props — but NO unmount/remount because there is no `key`

**The working siblings:** `BestuurlijkLayer` and `BeleidNieuwsLayer` exhibit the same latent bug but are less visually obvious because they show loading states sooner (their data sources are slower). The pattern is identical across all vier layers.

### Pattern 1: React `key` prop for component identity reset

**What:** Adding `key={activePanel.code}` to `GemeenteContextPanel` causes React to unmount the old instance and mount a fresh one when the gemeente code changes.

**When to use:** Any stateful component that receives identity-bearing props and must not carry over internal state between identity changes.

**Example:**
```tsx
// map.tsx — current (BUGGY)
{activePanel?.kind === 'gemeente' && (
  <GemeenteContextPanel
    naam={activePanel.naam}
    code={activePanel.code}
    ...
  />
)}

// map.tsx — fixed
{activePanel?.kind === 'gemeente' && (
  <GemeenteContextPanel
    key={activePanel.code}      // ← this single line is the fix
    naam={activePanel.naam}
    code={activePanel.code}
    ...
  />
)}
```

**Effect chain:**
- `key` changes → React destroys old instance → `activeLayer` state resets to `null` → `KlimaatLayer` unmounts → React Query subscriptions for old gemeente detach → fresh instance mounts → `useGemeenteProfile(gemeenteNaam)` fires with new key → `isLoading: true` → `VerdictHero` renders `score={null}` (shows "—") → fetch resolves → new verdict renders

### Pattern 2: Loading state in VerdictHero (already correct)

`KlimaatLayer` already passes `score={isLoading ? null : verdict.score}` to `VerdictHero`. When `isLoading` is true, `VerdictHero` shows "—" and the score bar renders at 0 width. This is the correct loading contract — the `key` fix ensures `isLoading` is `true` during the transition, which is all that's needed.

```tsx
// KlimaatLayer.tsx line 153-157 — already correct
<VerdictHero
  score={isLoading ? null : verdict.score}
  label={isLoading ? 'LADEN...' : verdict.label}
  subtitle={isLoading ? 'Vergunningdata ophalen...' : verdict.subtitle}
  color={verdict.color}
  icon={<verdict.Icon className="size-6 text-white" strokeWidth={2.5} />}
/>
```

### Pattern 3: `key={naam}` on motion.div inside GemeenteContextPanel

`GemeenteContextPanel` already uses `<motion.div key={naam} ...>` on its inner content div. This is a Framer Motion animation trigger — it does NOT cause React to reset state, because only the `key` on the React element itself (not a child) controls instance identity. The `key={naam}` on the `motion.div` only re-triggers the fade-in animation. This is a common misconception and explains why developers may think the panel "already handles" gemeente switching.

### Anti-Patterns to Avoid

- **Reset state via `useEffect`:** Adding `useEffect(() => setActiveLayer(null), [naam])` to `GemeenteContextPanel` would work but is fragile and fights React's data model. The `key` fix is cleaner and more idiomatic.
- **Clearing React Query cache on switch:** `queryClient.invalidateQueries(['gemeente-profile', oldNaam])` would cause flickering on the OLD gemeente if the user went back. Don't touch the query cache.
- **Nulling `VerdictHero` props at the parent level:** Conditional rendering guards in `GemeenteContextPanel` based on whether `naam` "just changed" are over-engineered. The `key` prop handles this atomically.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Component state reset on identity change | `useEffect` + explicit `setState(null)` for every state variable | React `key` prop | `key` is atomic, handled by React reconciler, no timing issues |
| Loading state during gemeente swap | Manual "isSwitching" boolean in parent | `isLoading` from `useQuery` (already present) | Query already provides this; `key` ensures it fires |
| Stale data prevention | Custom cache invalidation logic | `key` prop (forces remount = new query subscriptions) | Simpler, no query coupling |

---

## Common Pitfalls

### Pitfall 1: `key` on child div vs. key on component element

**What goes wrong:** Developer sees `<motion.div key={naam}>` inside `GemeenteContextPanel` and thinks gemeente transitions are already handled. Adds other fix attempts on top, creating a confused codebase.

**Why it happens:** `key` on a child element only affects that child's reconciliation and animation re-trigger. The parent component's `useState` hooks are bound to the parent element's identity, not its children's keys.

**How to avoid:** The `key` prop that resets state must be on the rendered `<GemeenteContextPanel ...>` element in `map.tsx`, not on any element inside `GemeenteContextPanel`.

**Warning signs:** Panel header fades in on gemeente switch (proving animation key works) but verdict content is still stale.

### Pitfall 2: `staleTime` masking the bug

**What goes wrong:** Developer tests with two gemeenten that were never fetched → query always fires → bug appears fixed. Tests with a previously visited gemeente → cached data serves instantly → bug reappears.

**Why it happens:** `useGemeenteProfile` has `staleTime: 5 * 60 * 1000`. If gemeente A data is fresh in cache, switching to gemeente B (which has different `naam`) fires a new query, but before that resolves, the component stays mounted and may show A's data depending on whether `isLoading` was true.

**How to avoid:** Test with gemeente A → navigate to gemeente B that was recently viewed → verify verdict panel clears immediately.

### Pitfall 3: `activeLayer` tab persisting across gemeente switch

**What goes wrong:** User is on "Vergunningen" tab for Venlo. Clicks Eindhoven. `GemeenteContextPanel` reuses same instance → `activeLayer` is still `'vergunningen'` → `KlimaatLayer` renders immediately with stale Venlo data → new fetch starts but OLD verdict is visible.

**Why it happens:** `useState` in a reused component instance is not reset when props change.

**How to avoid:** `key={activePanel.code}` causes unmount → `activeLayer` resets to `null` (overview) → no layer component mounts until user selects a tab.

---

## Code Examples

### Fix: Single line in map.tsx

```tsx
// Source: /frontend/src/routes/_authenticated/map.tsx, line ~2660
// Before:
{activePanel?.kind === 'gemeente' && (
  <GemeenteContextPanel
    naam={activePanel.naam}
    code={activePanel.code}
    wijkGeojson={wijkGeojson}
    scans={scanHistory?.scans ?? []}
    onClose={handleCloseGemeentePanel}
    onSelectWijk={handleGemeentePanelSelectWijk}
  />
)}

// After (add key={activePanel.code}):
{activePanel?.kind === 'gemeente' && (
  <GemeenteContextPanel
    key={activePanel.code}
    naam={activePanel.naam}
    code={activePanel.code}
    wijkGeojson={wijkGeojson}
    scans={scanHistory?.scans ?? []}
    onClose={handleCloseGemeentePanel}
    onSelectWijk={handleGemeentePanelSelectWijk}
  />
)}
```

### Repro steps on localhost:9300

1. Enable the Gemeenten layer toggle (map top-center)
2. Click gemeente A (e.g., Venlo)
3. In the panel, click the "Vergunningen" tab to open `KlimaatLayer`
4. Observe the verdict label (e.g., "ONTWIKKELKANSRIJK" with a score number)
5. Without closing the panel, click a different gemeente B (e.g., Eindhoven) on the map
6. **Bug:** Venlo's verdict label and score remain visible; the panel header shows "Eindhoven" but `KlimaatLayer` shows Venlo's data until Eindhoven's fetch resolves (up to several seconds)
7. For SC #3 (rapid switching): click Venlo → Eindhoven → Amsterdam in quick succession while on the Vergunningen tab — only Amsterdam's verdict should be visible

---

## Verdict Data Contract

The "verdict" is a derived object computed synchronously in `KlimaatLayer`:

```typescript
interface Verdict {
  score: number | null   // 0–100 composite klimaat score
  label: string          // 'ONTWIKKELKANSRIJK' | 'GEMIDDELD KLIMAAT' | 'LASTIG KLIMAAT' | 'ONBEKEND'
  color: string          // hex color string
  Icon: LucideIcon       // icon component
  subtitle: string       // one-liner explanation
}
```

During loading (`isLoading === true`): `score=null`, `label='LADEN...'`, `subtitle='Vergunningdata ophalen...'`. `VerdictHero` renders `score=null` as "—" with a grey color.

After the `key` fix: unmount → remount → `isLoading` starts `true` → verdict shows loading state → fetch resolves → correct gemeente's verdict renders.

---

## Siblings Analysis

All four layer components (`KlimaatLayer`, `BestuurlijkLayer`, `BeleidNieuwsLayer`, `ActiviteitLayer`) receive `gemeenteNaam` as a prop and call their own hooks internally. All are equally affected by the missing `key` defect. However, BUG-01 is specifically filed against `KlimaatLayer` because:

1. `KlimaatLayer` (Vergunningen tab) has the most visually prominent verdict display (large score number + colored label)
2. `useGemeenteProfile` has a 5-minute stale time — the cached verdict is served instantly and stays visible longest
3. `useGemeenteAnalysisStatus` and `useDoorlooptijdStats` also have 10-minute stale times

The single `key` fix heals all four layers simultaneously.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Reset child state via imperative ref or context | React `key` prop on the component element | React 16+ canonical pattern; no extra code in child |
| `useEffect` cleanup for prop-driven resets | `key` prop | Removes timing-sensitive effect logic |

---

## Open Questions

1. **Should the Vergunningen tab reopen automatically on re-entry?**
   - What we know: Currently `activeLayer` resets to `null` (overview) on gemeente switch
   - What's unclear: Whether users expect the previously active tab to persist across gemeente changes or reset
   - Recommendation: Reset to `null` (overview) — this is the correct UX; switching gemeente is a new context

2. **Do other tabs (BestuurlijkLayer, BeleidNieuwsLayer) need their own Storybook prop-swap tests?**
   - What we know: They have the same latent bug, fixed by the same `key`
   - Recommendation: The `KlimaatLayer.stories.tsx` prop-swap test covers the core invariant; add sibling tests only if requested in future phases

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Storybook 8.x + @storybook/addon-vitest 10.x (play-functions) |
| Config file | `frontend/.storybook/` (existing) |
| Quick run command | `pnpm storybook` (dev) or `pnpm test-storybook` |
| Full suite command | `pnpm test-storybook --ci` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUG-01 SC #1 | Switching gemeente A→B updates verdict within one render | Storybook play-function (prop swap) | `pnpm test-storybook --story "KlimaatLayer/PropSwap"` | ❌ Wave 0 |
| BUG-01 SC #2 | No ghost verdict from A visible after transition | Storybook play-function (DOM assertion) | same story | ❌ Wave 0 |
| BUG-01 SC #3 | Rapid 3-way switch shows only last gemeente | Storybook play-function (rapid swap) | `pnpm test-storybook --story "KlimaatLayer/RapidSwitch"` | ❌ Wave 0 |

### Storybook Story Design — `KlimaatLayer.stories.tsx`

**Location:** `frontend/src/stories/gemeente/KlimaatLayer.stories.tsx`

**Mock strategy:** The story wraps `KlimaatLayer` in a `QueryClientProvider` with all three queries pre-seeded via `queryClient.setQueryData(...)` — same pattern as `PotentieLayer.stories.tsx`. No network calls, no MSW required.

**Story 1: PropSwap (BUG-01 SC #1 + SC #2)**

```tsx
// Simulates parent switching gemeente A → B via React `key` and prop change
export const PropSwap: Story = {
  name: '1. Gemeente A→B prop-swap shows B verdict (BUG-01)',
  render: () => <KlimaatLayerSwitcher />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Initially shows gemeente A verdict
    await expect(canvas.getByText('VENLO')).toBeInTheDocument()          // or whatever label
    await expect(canvas.queryByText('EINDHOVEN')).not.toBeInTheDocument()

    // Click the "Switch to Eindhoven" button in the harness
    await userEvent.click(canvas.getByRole('button', { name: /switch/i }))

    // After switch: A's verdict is gone, B's verdict is visible
    await waitFor(() => {
      expect(canvas.queryByText('VENLO')).not.toBeInTheDocument()
      expect(canvas.getByText('EINDHOVEN')).toBeInTheDocument()
    }, { timeout: 2000 })
  },
}
```

The `KlimaatLayerSwitcher` harness component manages `useState<'venlo' | 'eindhoven'>` and renders `<KlimaatLayer key={gemeente} gemeenteNaam={gemeente} gemeenteCode={code} />` — the `key` prop mirrors the fix being validated.

**Story 2: RapidSwitch (BUG-01 SC #3)**

```tsx
export const RapidSwitch: Story = {
  name: '2. Rapid 3-way switch — only last gemeente visible (BUG-01 SC#3)',
  render: () => <KlimaatLayerSwitcher options={['venlo', 'eindhoven', 'amsterdam']} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Rapid fire: Venlo → Eindhoven → Amsterdam with no wait
    await userEvent.click(canvas.getByRole('button', { name: /eindhoven/i }))
    await userEvent.click(canvas.getByRole('button', { name: /amsterdam/i }))

    // Only Amsterdam visible
    await waitFor(() => {
      expect(canvas.queryByText('VENLO')).not.toBeInTheDocument()
      expect(canvas.queryByText('EINDHOVEN')).not.toBeInTheDocument()
      expect(canvas.getByText('AMSTERDAM')).toBeInTheDocument()
    }, { timeout: 2000 })
  },
}
```

**Story 3: Regression pin (no-stale-data invariant)**

```tsx
export const NoStaleDataOnSwitch: Story = {
  name: '3. Regression — stale A data never visible after B selected',
  render: () => <KlimaatLayerSwitcher preloadBoth />,   // pre-seeds BOTH gemeenten in cache
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Pre-seeded: both A and B are in cache (simulates the staleTime=5min scenario)
    // Switch to B
    await userEvent.click(canvas.getByRole('button', { name: /switch/i }))

    // At NO point should A's verdict label appear
    // Wait one tick and assert A is gone
    await waitFor(() => {
      expect(canvas.queryByText('VENLO_VERDICT_LABEL')).not.toBeInTheDocument()
    }, { timeout: 500 })
  },
}
```

### Mock data fixtures

Two complete `GemeenteProfile` fixtures (Venlo + Eindhoven) seeded via `queryClient.setQueryData`:
- `['gemeente-profile', 'Venlo']` → `{ severity_label: 'Gunstig', approval_rate_pct: 82, ... }`
- `['gemeente-profile', 'Eindhoven']` → `{ severity_label: 'Ongunstig', approval_rate_pct: 44, ... }`
- Same pattern for `['jurisprudence', 'analysis-status', gemeente]` and `['jurisprudence', 'doorlooptijd', gemeente]`

### Sampling Rate

- **Per task commit:** `pnpm --filter frontend test-storybook --story "KlimaatLayer"` (3 stories, < 15 seconds)
- **Per wave merge:** `pnpm --filter frontend test-storybook` (all stories)
- **Phase gate:** All 3 KlimaatLayer stories green + `npm run check` passes before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `frontend/src/stories/gemeente/KlimaatLayer.stories.tsx` — 3 play-function tests covering BUG-01 SC #1, #2, #3
- [ ] `frontend/src/stories/gemeente/` directory — does not exist yet

*(No new test framework needed — Storybook + addon-vitest already installed and configured)*

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `frontend/src/routes/_authenticated/map.tsx` (lines 2659–2668) — rendering call-site, confirms missing `key`
- Direct code inspection: `frontend/src/components/map/panels/GemeenteContextPanel.tsx` — confirms `useState<GemeenteLayer | null>(null)`, `key={naam}` on motion.div (animation only, not state reset)
- Direct code inspection: `frontend/src/components/map/panels/gemeente/KlimaatLayer.tsx` — confirms all three `useQuery` calls use `gemeenteNaam` as key segment; `isLoading` correctly guards verdict display
- Direct code inspection: `frontend/src/hooks/useGemeenteProfile.ts` — confirms `staleTime: 5 * 60 * 1000`, queryKey `['gemeente-profile', gemeenteNaam]`
- Direct code inspection: `frontend/src/hooks/useJurisprudence.ts` — confirms `staleTime: 10 * 60_000` for analysis-status + doorlooptijd
- Direct code inspection: `frontend/src/stories/parcel/PotentieLayer.stories.tsx` — establishes Storybook play-function pattern with `setQueryData` pre-seeding

### Secondary (MEDIUM confidence)
- React documentation on `key` prop: The `key` prop on a component element causes React to unmount the old instance and mount a fresh one. This is a stable React behavior since React 16 and is the canonical solution for this class of bug.

---

## Metadata

**Confidence breakdown:**
- Root cause identification: HIGH — confirmed by direct code read of all relevant files
- Fix specification: HIGH — single line change, idiomatic React, no ambiguity
- Storybook test design: HIGH — mirrors existing PotentieLayer.stories.tsx pattern exactly
- Scope of impact: HIGH — `key` fix heals all four gemeente layer components simultaneously

**Research date:** 2026-04-25
**Valid until:** Until GemeenteContextPanel or map.tsx rendering logic is restructured (stable)
