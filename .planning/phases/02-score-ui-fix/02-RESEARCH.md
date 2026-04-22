# Phase 2: Score UI Fix - Research

**Researched:** 2026-04-22
**Domain:** React/TypeScript frontend — component refactor, prop drilling, unit tests via Storybook + Vitest
**Confidence:** HIGH (all findings from direct codebase inspection)

## Summary

Phase 2 has three precisely bounded changes inside a single component (`ScoreBreakdownModal`) and its direct parent (`ParcelBentoOverview`). The hardcoded values are easy to locate: `60%` and `40%` are literal strings on lines 243 and 253 of `ScoreBreakdownModal.tsx`, driven by `flex-[6]` and `flex-[4]` CSS ratios. The balance source is `weightsData?.weights.potentie_risico_balance` (a 0.0–1.0 float) already available in the parent via `useOrgScoreWeights`. The parent already fetches this data — it just does not pass it down to the modal.

The `×{factor.gewicht}` label on line 393 of `ScoreBreakdownModal.tsx` must be replaced with `percentage_of_category` expressed as a rounded integer percentage (e.g., "34%"). The field `percentage_of_category` is a float (0.0–1.0) stored in the JSONB `score_breakdown` by the backend via `dataclasses.asdict()`. It is present in the serialized data for all scans produced after M047. The `ScoreFactor` interface inside `ScoreBreakdownModal.tsx` does not yet include `percentage_of_category` — it must be added there and parsed in `parseFactors()`.

For testing, the project uses Storybook 10 + `@storybook/addon-vitest` running under Vitest 4 with Playwright/Chromium. Tests are written as Storybook stories under `frontend/src/stories/`. The test runner is `npx storybook test` (runs Vitest in browser mode via Chromium headless). No standalone Vitest config exists outside of `vite.config.ts`. There are no existing stories for `ScoreBreakdownModal` — new stories must be created, following the same pattern as `InspectorPanel.stories.tsx` (mock data as typed objects, `render:` function, meaningful story names).

**Primary recommendation:** Add `potentie_risico_balance` as a required number prop on `ScoreBreakdownModal`, derive it from `weightsData.weights.potentie_risico_balance` in the parent, and replace the `×{gewicht}` label with `Math.round(percentage_of_category * 100)%`. Add a new story file that asserts the prop flows correctly.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCORE-01 | ScoreBreakdownModal displays potentie/risico balance dynamically from org-profile (`potentie_risico_balance` prop via `useOrgScoreWeights`) — not hardcoded 60%/40% | Hardcoded strings at lines 243 + 253 in `ScoreBreakdownModal.tsx`; parent already has `weightsData` from `useOrgScoreWeights` |
| SCORE-02 | ScoreBreakdownModal displays `percentage_of_category` (0–100%) per factor instead of raw `×{gewicht}` integer label | `×{factor.gewicht}` on line 393 of `ScoreBreakdownModal.tsx`; `percentage_of_category` stored in JSONB by `asdict(factor)` in `area_scan.py:984` |
| SCORE-03 | `potentie_risico_balance` is passed as prop to ScoreBreakdownModal from parent (not read from scan flags) | Parent `ParcelBentoOverview` already has `weightsData`; modal props interface is at line 53 of `ScoreBreakdownModal.tsx` |
| TEST-02 | Unit tests cover ScoreBreakdownModal balance display — percentage reflects `potentie_risico_balance` prop value (not hardcoded) | No existing stories for `ScoreBreakdownModal`; story file must be created at `frontend/src/stories/` |
| TEST-03 | Unit tests cover `percentage_of_category` display — factor percentage shown correctly from scan data | Same story file; mock scan data must include `percentage_of_category` field |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | Component framework | Project stack |
| TypeScript | 5.9.3 | Type safety | Project stack |
| Storybook | 10.2.8 | Component dev + test harness | Already configured with `@storybook/addon-vitest` |
| Vitest | 4.0.18 | Test runner (runs stories as tests) | Configured in `vite.config.ts` `test` block |
| `@storybook/react-vite` | 10.2.8 | Storybook + Vite integration | Project devDependency |
| framer-motion | 12.35.2 | Animations in modal | Already used in `ScoreBreakdownModal.tsx` |

No new dependencies needed.

**Installation:** None required.

---

## Architecture Patterns

### Relevant File Locations
```
frontend/src/components/map/panels/parcel/
├── ScoreBreakdownModal.tsx         # TARGET: add prop + fix display logic
└── ParcelBentoOverview.tsx         # PARENT: pass potentie_risico_balance prop

frontend/src/hooks/useScoreWeights.ts           # Source hook (already used by parent)
frontend/src/lib/types/scoreWeights.ts          # ScoreWeightsConfig.potentie_risico_balance: number (0.0–1.0)
frontend/src/lib/types/scan.ts                  # ScoreFactor — needs percentage_of_category added

frontend/src/stories/                           # NEW story file goes here
```

### Pattern 1: Adding a Prop to an Existing Modal

**What:** Add `potentie_risico_balance: number` to `ScoreBreakdownModalProps`. Remove hardcoded `60%`/`40%` strings. Derive display percentages from the prop.

**When to use:** When the parent owns the data source and the modal must be stateless with respect to org config.

**Example (current state):**
```typescript
// ScoreBreakdownModal.tsx — lines 234–256 (hardcoded)
<div className="flex-[6] ...">
  <span>60%</span>        // HARDCODED — must become Math.round(potentieRisicoBalance * 100)%
</div>
<div className="flex-[4] ...">
  <span>40%</span>        // HARDCODED — must become Math.round((1 - potentieRisicoBalance) * 100)%
</div>
```

**Example (target state):**
```typescript
// Props interface — add one field
interface ScoreBreakdownModalProps {
  // ... existing props
  potentieRisicoBalance: number   // 0.0–1.0 from useOrgScoreWeights
}

// Display — replace literals
const potentiePct = Math.round(potentieRisicoBalance * 100)
const risicoPct = 100 - potentiePct

// CSS flex ratio mirrors the balance — flex-[X] using inline style or dynamic class
// Simplest: keep flex container but set widths via percentage
<div style={{ flex: potentiePct }}>
  <span>{potentiePct}%</span>
</div>
<div style={{ flex: risicoPct }}>
  <span>{risicoPct}%</span>
</div>
```

**Parent call site (ParcelBentoOverview.tsx — line 335):**
```typescript
// Already has: const { data: weightsData } = useOrgScoreWeights()
// Add prop:
<ScoreBreakdownModal
  // ... existing props
  potentieRisicoBalance={weightsData?.weights.potentie_risico_balance ?? 0.7}
  onClose={() => setShowScoreBreakdown(false)}
/>
```

### Pattern 2: Adding `percentage_of_category` to Factor Display

**What:** The `ScoreFactor` interface in `ScoreBreakdownModal.tsx` does not include `percentage_of_category`. It must be added there and parsed in `parseFactors()`. The display label `×{factor.gewicht}` must be replaced.

**Backend serialization chain (confirmed):**
1. `score_v3.py` `FactorResult.percentage_of_category` is set (line 410, 417)
2. `area_scan.py` line 984: `asdict(factor)` — serializes ALL fields including `percentage_of_category`
3. Stored in `scan_results.flags["score_breakdown"]` as JSON
4. Returned as `score_breakdown` in `ScanResultItem` — typed as `Record<string, unknown>`

**Example (target state in FactorCard):**
```typescript
// Replace ×{factor.gewicht} with percentage_of_category
{factor.percentage_of_category !== null && (
  <span className="text-[10px] text-[#94a3b8] tabular-nums">
    {Math.round(factor.percentage_of_category * 100)}%
  </span>
)}
```

**Type addition (ScoreFactor interface in ScoreBreakdownModal.tsx):**
```typescript
interface ScoreFactor {
  // ... existing fields
  percentage_of_category: number | null   // ADD: backend float 0.0–1.0
}
```

**parseFactors() addition:**
```typescript
percentage_of_category: typeof f.percentage_of_category === 'number'
  ? f.percentage_of_category
  : null,
```

### Pattern 3: Storybook Story for Modal Testing

**What:** Create a story file that renders `ScoreBreakdownModal` with controlled props. The Vitest/Storybook integration auto-runs stories as smoke tests. For behavioral assertions (TEST-02, TEST-03), use `play` functions.

**Story file location:** `frontend/src/stories/parcel/ScoreBreakdownModal.stories.tsx`

**Example structure:**
```typescript
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'
import { ScoreBreakdownModal } from '@/components/map/panels/parcel/ScoreBreakdownModal'

const meta: Meta<typeof ScoreBreakdownModal> = {
  title: 'Parcel/ScoreBreakdownModal',
  component: ScoreBreakdownModal,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof ScoreBreakdownModal>

// Minimal mock breakdown with percentage_of_category
const mockBreakdown = {
  vrije_grond: {
    categorie: 'potentie',
    genormaliseerde_score: 0.8,
    gewicht: 13,
    bijdrage: 10.4,
    percentage_of_category: 0.13,    // 13% of potentie category
    missing: false,
    // ...
  },
}

// TEST-02: Balance displays from prop, not hardcoded
export const BalanceFromProp: Story = {
  args: {
    score: 75,
    potentieScore: 80,
    risicScore: 40,
    scoreBreakdown: mockBreakdown,
    address: 'Test 1, Amsterdam',
    isCustomProfile: false,
    potentieRisicoBalance: 0.6,   // 60%/40%
    onClose: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('60%')).toBeInTheDocument()
    await expect(canvas.getByText('40%')).toBeInTheDocument()
  },
}

// TEST-02: Different balance — verify it reflects the prop, not hardcode
export const CustomBalance70_30: Story = {
  args: {
    ...BalanceFromProp.args,
    potentieRisicoBalance: 0.7,   // 70%/30%
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('70%')).toBeInTheDocument()
    await expect(canvas.getByText('30%')).toBeInTheDocument()
  },
}

// TEST-03: Factor shows percentage_of_category, not ×gewicht
export const FactorPercentageDisplay: Story = {
  args: {
    ...BalanceFromProp.args,
    scoreBreakdown: mockBreakdown,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('13%')).toBeInTheDocument()
    // Ensure ×13 (old gewicht label) is NOT present
    const crossLabels = canvas.queryAllByText(/×\d+/)
    await expect(crossLabels).toHaveLength(0)
  },
}
```

### Anti-Patterns to Avoid
- **Reading `scan.flags` inside the modal for balance**: balance is org-config, not scan-data. The modal must never import `useOrgScoreWeights` itself (SCORE-03 requirement).
- **Using `weightsData.potentie_weights` to compute percentage inside frontend**: `percentage_of_category` already comes pre-computed from the backend in `score_breakdown`. Use it — don't recompute.
- **Fallback to `gewicht / 100` when `percentage_of_category` is null**: `percentage_of_category` was introduced in M047. Scans before M047 will have `null` for this field. The display should fall back to hiding the label (render nothing), not showing `×gewicht`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Balance percentage computation | Custom math in multiple places | Single `Math.round(balance * 100)` at render time | One source, one change |
| Test assertions for rendered text | Custom DOM traversal | `@storybook/test` `within()` + `expect()` | Already in devDependencies |
| Flex ratio visual for balance bar | Custom SVG or canvas | CSS `flex` property on containers (already pattern used) | Simplest, already works |

---

## Common Pitfalls

### Pitfall 1: Flex Ratio Drift
**What goes wrong:** `flex-[6]` and `flex-[4]` are Tailwind classes that resolve to fixed integers. If `potentieRisicoBalance` is 0.85, `flex-[85]` must be generated dynamically — Tailwind's JIT cannot generate arbitrary numbers from variables.
**Why it happens:** Tailwind v4 generates utility classes at build time from static strings.
**How to avoid:** Use inline `style={{ flex: potentiePct }}` and `style={{ flex: risicoPct }}` instead of Tailwind `flex-[N]` classes. This is already the pattern for other dynamic values in this codebase (see `style={{ color: ... }}` usage throughout `ScoreBreakdownModal.tsx`).
**Warning signs:** If you see `flex-[${variable}]` template literals — that won't work.

### Pitfall 2: `percentage_of_category` Null for Pre-M047 Scans
**What goes wrong:** Scans created before M047 do not have `percentage_of_category` in their `score_breakdown` JSON. Accessing it as a required number will throw or render `NaN%`.
**Why it happens:** The field was added to `FactorResult` in M047. Pre-M047 scan data lacks it.
**How to avoid:** Type as `number | null` in the `ScoreFactor` interface. Guard with `factor.percentage_of_category !== null`. Do not show the label when null (no fallback to `gewicht`).

### Pitfall 3: Balance Prop Default When Hook Is Loading
**What goes wrong:** `useOrgScoreWeights` is async. On first render, `weightsData` is undefined. If the parent passes `undefined` as `potentieRisicoBalance`, the modal renders NaN%.
**Why it happens:** TanStack Query starts in `loading` state.
**How to avoid:** Always use nullish coalescing in the parent: `weightsData?.weights.potentie_risico_balance ?? 0.7`. The constant `0.7` matches `DEFAULT_WEIGHTS.potentie_risico_balance` from `scoreWeights.ts`.

### Pitfall 4: TypeScript `check` Failures from Missing Prop
**What goes wrong:** Adding a required prop `potentieRisicoBalance` to `ScoreBreakdownModalProps` will cause TypeScript errors at every existing call site.
**Why it happens:** Only one call site exists (`ParcelBentoOverview.tsx` line 335), but there are also stories in the test suite.
**How to avoid:** Update `ParcelBentoOverview.tsx` in the same commit as the prop addition. Also update any mock story files. Run `npm run check` after each change. The GemeenteModal.tsx and other files that show the modal (if any) must also be checked.

---

## Code Examples

### Complete Change Surface for ScoreBreakdownModal

**1. Interface addition (line 53–61):**
```typescript
// Source: direct codebase inspection — ScoreBreakdownModal.tsx
interface ScoreBreakdownModalProps {
  score: number | null
  potentieScore: number | null
  risicScore: number | null
  scoreBreakdown: Record<string, unknown> | null
  address: string | null
  isCustomProfile: boolean
  potentieRisicoBalance: number    // ADD — 0.0-1.0 from useOrgScoreWeights
  onClose: () => void
}
```

**2. ScoreFactor interface (line 15–29):**
```typescript
interface ScoreFactor {
  // ... existing fields unchanged
  percentage_of_category: number | null    // ADD — backend float 0.0-1.0
}
```

**3. parseFactors() addition (line 79–95):**
```typescript
percentage_of_category: typeof f.percentage_of_category === 'number'
  ? f.percentage_of_category
  : null,
```

**4. Component signature (line 125–133):**
```typescript
export function ScoreBreakdownModal({
  score,
  potentieScore,
  risicScore,
  scoreBreakdown,
  address,
  isCustomProfile,
  potentieRisicoBalance,    // ADD to destructure
  onClose,
}: ScoreBreakdownModalProps) {
  const potentiePct = Math.round(potentieRisicoBalance * 100)
  const risicoPct = 100 - potentiePct
  // ...
```

**5. Weight distribution blocks (lines 232–256, replace hardcoded):**
```typescript
<div className="flex gap-2 mb-6">
  <div
    className="rounded-[16px] p-4 flex items-center justify-between"
    style={{
      flex: potentiePct,
      background: 'rgba(249, 168, 38, 0.08)',
      border: '1px solid rgba(249, 168, 38, 0.3)'
    }}
  >
    <span>Potentie</span>
    <span>{potentiePct}%</span>
  </div>
  <div
    className="rounded-[16px] p-4 flex items-center justify-between"
    style={{ flex: risicoPct, background: '#F2F6F3', border: '1px solid #EAEFEF' }}
  >
    <span>Risico</span>
    <span>{risicoPct}%</span>
  </div>
</div>
```

**6. FactorCard weight label (lines 391–395, replace ×gewicht):**
```typescript
// BEFORE (remove):
{factor.gewicht !== null && (
  <span className="text-[10px] text-[#94a3b8] tabular-nums">
    ×{factor.gewicht}
  </span>
)}

// AFTER:
{factor.percentage_of_category !== null && (
  <span className="text-[10px] text-[#94a3b8] tabular-nums">
    {Math.round(factor.percentage_of_category * 100)}%
  </span>
)}
```

**7. Parent call site — ParcelBentoOverview.tsx (line 334–345):**
```typescript
<ScoreBreakdownModal
  score={parcel.score}
  potentieScore={parcel.potentie_score ?? null}
  risicScore={parcel.risico_score ?? null}
  scoreBreakdown={parcel.score_breakdown}
  address={parcel.address}
  isCustomProfile={weightsData?.is_custom ?? false}
  potentieRisicoBalance={weightsData?.weights.potentie_risico_balance ?? 0.7}  // ADD
  onClose={() => setShowScoreBreakdown(false)}
/>
```

---

## Call Site Audit

Other files that import `ScoreBreakdownModal` must also pass the new prop (or be checked for compile errors):

```
frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx
frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx
frontend/src/components/map/panels/gemeente/GemeenteModal.tsx
frontend/src/components/map/panels/ParcelDetailPanel.tsx
```

**Confirmed via grep:** These files were found by the initial search for "ScoreBreakdown" but they do NOT necessarily call `<ScoreBreakdownModal>` directly — they may only reference the exported helper `countMissingFactors` or `isWijkBreed`. The planner must verify each file at implementation time. The only confirmed render call site is `ParcelBentoOverview.tsx`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Storybook 10.2.8 + Vitest 4.0.18 + `@storybook/addon-vitest` |
| Config file | `frontend/vite.config.ts` (test block with storybook plugin) |
| Quick run command | `cd frontend && npx storybook test --testPathPattern ScoreBreakdown` |
| Full suite command | `cd frontend && npx storybook test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCORE-01 | Balance % derived from prop, not hardcoded | Storybook play assertion | `npx storybook test --testPathPattern ScoreBreakdown` | Wave 0 |
| SCORE-02 | Factor row shows `percentage_of_category` as "X%" | Storybook play assertion | `npx storybook test --testPathPattern ScoreBreakdown` | Wave 0 |
| SCORE-03 | Prop-only, no scan.flags read inside modal | TypeScript compile check | `cd frontend && npm run check` | N/A (enforced by tsc) |
| TEST-02 | Balance prop value reflected in rendered text | Storybook play assertion | `npx storybook test --testPathPattern ScoreBreakdown` | Wave 0 |
| TEST-03 | `percentage_of_category` renders correctly | Storybook play assertion | `npx storybook test --testPathPattern ScoreBreakdown` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd /home/klarifai/Documents/klarifai/clientprojects/propdex/frontend && npm run check`
- **Per wave merge:** `cd /home/klarifai/Documents/klarifai/clientprojects/propdex/frontend && npx storybook test`
- **Phase gate:** Full Storybook test suite green + `npm run check` clean before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/stories/parcel/ScoreBreakdownModal.stories.tsx` — covers TEST-02 + TEST-03 (does not exist yet, must be created in the plan)
- [ ] `frontend/src/stories/parcel/` directory — does not exist, must be created alongside the story file

*(No new framework install needed — Storybook + Vitest already installed and configured)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `60%`/`40%` balance display | Dynamic from `potentie_risico_balance` prop | M048 Phase 2 | Balance reflects org settings |
| `×{gewicht}` raw weight label | `{percentage_of_category * 100}%` | M048 Phase 2 (data-contract P3 from pre-M047) | Meaningful display for users |
| `ScoreFactor.percentage_of_category` absent from TS interface | Added to interface | M048 Phase 2 | Type safety for new field |

**Existing in codebase (no change needed):**
- `useOrgScoreWeights` hook in `ParcelBentoOverview` — already fetches balance
- `percentage_of_category` in backend `FactorResult` — already computed and serialized
- `weightsData?.is_custom` already passed to `isCustomProfile` prop — same pattern to follow for balance

---

## Open Questions

1. **GemeenteModal and other import sites**
   - What we know: 4 files grep-match "ScoreBreakdown"; only `ParcelBentoOverview` confirmed as a render call site
   - What's unclear: Whether `GemeenteModal.tsx`, `PotentieLayer.tsx`, `RisicoLayer.tsx`, `ParcelDetailPanel.tsx` render `<ScoreBreakdownModal>` or only import helper functions
   - Recommendation: Planner should inspect each file at plan time to determine if the prop must be passed there too. If they render the modal, add the prop; if they only use helpers, no change needed.

2. **Stories directory structure**
   - What we know: Stories live in `frontend/src/stories/` with subdirs `primitives/` and `layout/`
   - What's unclear: Whether to add a `parcel/` subdir or another grouping
   - Recommendation: Use `frontend/src/stories/parcel/` to match the component's location under `components/map/panels/parcel/`.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `ScoreBreakdownModal.tsx` (full file read, hardcoded values at lines 243, 253, 393 confirmed)
- Direct codebase inspection — `ParcelBentoOverview.tsx` (full file read, `useOrgScoreWeights` already imported, call site at line 335 confirmed)
- Direct codebase inspection — `useScoreWeights.ts` + `scoreWeights.ts` (type structure, `potentie_risico_balance: number` confirmed)
- Direct codebase inspection — `area_scan.py` line 984 (`asdict(factor)` serializes `percentage_of_category`)
- Direct codebase inspection — `score_v3.py` lines 410, 417 (`percentage_of_category` set on `FactorResult`)
- Direct codebase inspection — `vite.config.ts` + `package.json` (Vitest 4 + Storybook 10 + `@storybook/addon-vitest` confirmed)
- Direct codebase inspection — `scan.ts` (`ScoreFactorV3` interface missing `percentage_of_category`)

### Secondary (MEDIUM confidence)
- Direct inspection of `InspectorPanel.stories.tsx` as reference for story pattern (confirmed working format)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed from `package.json` and `vite.config.ts`
- Architecture: HIGH — all change locations pinpointed to exact line numbers
- Pitfalls: HIGH — derived from direct code reading (Tailwind dynamic class limitation, null-safety for pre-M047 data, loading state)

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable codebase, no fast-moving dependencies in scope)
