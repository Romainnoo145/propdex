# Phase 3: Woonvisie Popup - Research

**Researched:** 2026-04-25
**Domain:** Frontend React popup wiring + Vitest/Storybook testing on already-shipped Aura design system
**Confidence:** HIGH (codebase fully verified; popup component already exists; only wiring + data-contract gap + tests remain)

## Summary

Phase 3 is much closer to "done" than CONTEXT.md assumes. The `WoonvisiePopup.tsx` component is already shipped at `frontend/src/components/map/panels/parcel/WoonvisiePopup.tsx` (210 lines), and a Storybook preview deck exists at `frontend/src/stories/parcel/WoonvisiePopup.stories.tsx` with 5 named variants plus an interactive grid demo. **The popup itself is built.** What is NOT yet shipped:

1. **The wire-up.** `PotentieLayer.tsx` does not import or render `WoonvisiePopup`. Card 10 (`woonvisie_match`) is rendered as a static `<div>` (lines 376-394 of `PotentieLayer.tsx`), not a `<button>`. No click handler exists, no popup state, no hover affordance.
2. **The data-contract gap.** Phase 6 ships `FactorResult.waarde = {matched_wijk, matched_policy, prioritized_segment, algemeen_citaat}` (per `06-03-SUMMARY.md` key-decisions). The popup, however, requires `gemeente`, `periode_start`, `periode_einde`, **and** `confidence` as separate top-level props. None of those four reach the frontend through `factor.waarde` today. Plans must source `gemeente` from `parcel.gemeente_code` (resolution to display name needed) and decide whether to extend `factor.waarde` for `periode_start/periode_einde/confidence` or read from a sibling field.
3. **Project type sourcing.** `project_type` is a per-parcel value retrieved via `useParcelProjectType(parcelId)` hook (TanStack Query). This is **not** in `ScanResultItem`. The plan must either (a) lift state to `ParcelDetailPanel` and pass `project_type` down to `PotentieLayer`, or (b) call the hook inside `PotentieLayer` itself.
4. **Tests.** No `WoonvisiePopup.test.tsx` exists. The repo's chosen test pattern is **Storybook play functions executed by `@storybook/addon-vitest`** in a Playwright-driven Chromium browser context (see `frontend/vite.config.ts` lines 54-76). Co-located `.test.tsx` files **do not exist** in this codebase — `ScoreBreakdownModal.stories.tsx` is the canonical TEST-XX template (TEST-02, TEST-03 pattern).

**Primary recommendation:** Plans should focus on (1) Wire-up + clickable affordance in `PotentieLayer.tsx`, (2) data-contract resolution for the four missing popup props, (3) Storybook play-function tests following the `ScoreBreakdownModal.stories.tsx` template — NOT a new RTL test file. The existing `WoonvisiePopup.tsx` body should be left untouched unless a real bug is found; the InteractiveGrid story already proves the visual is design-approved.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Component placement
- The clickable wrapper lives in `frontend/src/components/parcel-detail/intelligence-grids/PotentieLayer.tsx` (or wherever the existing 3×3 grid renders kaart 10 — verify path during research).
- DO NOT introduce a new layout. Wrap the existing card.

> **Research correction:** Real path is `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx`. CONTEXT.md guess was wrong. Plans must use the verified path.

#### Popup style (Aura-conform)
- Glass surface: `bg-white/60 backdrop-blur-[24px]`
- Radius: `rounded-[24px]` (per ROADMAP); memory mentions 32px on bento modals — pick `rounded-[24px]` to match phase success criteria.
- Border: amber accent (`border-[var(--amber)]` or `border-amber-400` token from DESIGN.md `@theme` block).
- Font: Plus Jakarta Sans (already global).
- Backdrop: standard portal overlay; click-outside dismiss; ESC dismiss; focus trap.

> **Research note:** Existing `WoonvisiePopup.tsx` uses `bg-white rounded-[32px]` (NOT `bg-white/60 backdrop-blur-[24px] rounded-[24px]`). It also has **no ESC key handler and no focus trap** — only click-outside backdrop dismiss. Plans must decide: (a) accept the as-built minimal aesthetic and update the success criteria, or (b) bring the popup into strict compliance with the locked decisions. Memory note `feedback_minimal_aesthetic.md` argues for the as-built minimal direction. **Flag for planner.**

#### Popup content (in this order)
1. Title row: `Woonvisie {gemeente}` + period (period from algemeen scan metadata if available — fallback to woonvisie publish year if extractor returns it).
2. Wijk naam (large, semibold) + prioriteit-chip (color-coded by enum: groeigebied=mint/green, herstructurering=amber, krimp=neutral grey, neutraal=neutral).
3. Beleidstekst: blockquote with `border-l-4 border-[amber-token]`, bg = Morning Mist (`#F2F6F3` / `bg-[var(--mist)]` if token exists).
4. Paginanummer rendered as muted small text under the blockquote (e.g. "p. 42").
5. Segmentmatch-chips row: one chip per segment (sociaal / midden / duur / gemengd) showing ✓ when the parcel's project type segment matches `gewenste_segmenten`, ✗ otherwise. Match logic must be derived from the same projecttype-segment mapping the backend uses for `score_woonvisie_match`.

> **Research correction:** As-built popup uses **inline single sentence** for segmentmatch (`segmentMatchSentence` helper), NOT chips. Citaat is rendered as plain text, NOT as a `border-l-4` blockquote. Prioriteit is a **dot + label**, NOT a chip. This contradicts the locked decisions but matches the approved minimal aesthetic. **Flag for planner.**

#### Data sourcing
- All popup data MUST come from already-cached scan flags written by Phase 6 (`WijkPolicy` schema). NO new API calls. NO new backend endpoints.
- Read flag path: scan flags contain `woonvisie_match` factor with the matched `WijkPolicy` (wijk_naam, prioriteit, gewenste_segmenten, citaat, pagina) plus `algemeen_citaat` at the document level. Verify exact JSON path during research.
- If wijk-specific data is missing for the current parcel: popup falls back to `algemeen_citaat` and shows a subtle "Geen wijk-specifiek beleid gevonden" line.

> **Research finding:** `factor.waarde` carries `{matched_wijk, matched_policy, prioritized_segment, algemeen_citaat}` per Phase 6 Plan 03 SUMMARY. **Missing from `factor.waarde`:** `gemeente`, `periode_start`, `periode_einde`, `confidence` — all four are popup-required props. See "Data Contract Gap" section below.

#### Click affordance
- Hover state on kaart 10 must indicate clickability without breaking the existing static visual of the other 8 cards (e.g. subtle scale/cursor or amber border highlight on hover only).
- All other 8 cards stay inert in this phase.

#### Tests (TEST-04)
- Component test: render PotentieLayer with mock scan flags → click kaart 10 → assert popup opens.
- Component test: assert wijk naam, prioriteit-chip text, beleidstekst content, paginanummer, and at least one ✓ + one ✗ segmentmatch-chip render correctly.
- Component test: assert click-outside / ESC dismiss closes popup.
- Use existing test stack (Vitest + React Testing Library — verify in research).

> **Research correction:** This codebase does **NOT** use React Testing Library co-located test files. The canonical pattern is **Storybook play functions** executed via `@storybook/addon-vitest` in a Playwright-driven Chromium browser. Reference: `frontend/src/stories/parcel/ScoreBreakdownModal.stories.tsx` (TEST-02, TEST-03 pattern). Plans MUST follow this pattern — co-located `.test.tsx` will not be picked up by the project's test runner config.

### Claude's Discretion
- Exact file naming for the popup component (suggest `WoonvisiePopup.tsx` colocated under `intelligence-grids/`).
- Whether to reuse an existing modal primitive or build a thin wrapper around the bento modal pattern — pick whichever keeps the diff smallest.
- Animation: enter/exit transitions ≤ 180ms, respect `prefers-reduced-motion`.

> **Research finding:** Both decisions are already shipped. File is `frontend/src/components/map/panels/parcel/WoonvisiePopup.tsx`. Animation uses Framer Motion `AnimatePresence` (200-250ms). No `prefers-reduced-motion` guard inside `WoonvisiePopup.tsx` itself (compare to `BestemmingModal.tsx` which has the guard). Adding the guard is a 4-line edit.

### Deferred Ideas (OUT OF SCOPE)
- ScoreBreakdownModal ×gewicht / 60/40 rewrite — Phase 7+ or later milestone, NOT here.
- Pin mechanism on the popup itself — Phase 7.
- Multi-document woonvisie diff (newer vs older woonvisie) — future milestone.
- Click-through from popup to a beleidsdocument detail page — future milestone (when source-document linking exists).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WOON-01 | Woonvisie kaart (kaart 10 in Potentie grid) is clickable and opens a popup | Wiring missing in `PotentieLayer.tsx` lines 303-325 (POTENTIE_KEYS) and 376-394 (card render). Plan must convert the woonvisie card render branch into a `<button>` and lift `useState<boolean>` for popup open/close. WoonvisiePopup component itself is shipped. |
| WOON-02 | Popup shows wijk naam, prioriteit-chip, beleidstekst as amber-bordered blockquote, paginanummer, and segmentmatch-chips (sociaal ✓ / duur ✗) | Popup body shipped — but renders **dot+label** (not chip), **plain paragraph** (not amber-bordered blockquote), and **inline sentence** (not ✓/✗ chips). PLAN MUST DECIDE: keep approved minimal aesthetic (preferred per `feedback_minimal_aesthetic.md`) OR rewrite popup body to chips/blockquote spec. |
| WOON-03 | Popup renders in Aura style (glass surface, rounded-[24px], amber accent, Plus Jakarta Sans) consistent with DESIGN.md | Currently `bg-white rounded-[32px]` — not glass, not 24px. Plus Jakarta Sans is global so font is correct. Amber accent appears only on hover-CTA color (`#F9A826`). PLAN MUST DECIDE: bring into spec, OR document the rounded-[32px]+solid-white as the approved "Calm Intelligence" deviation (DESIGN.md §radius lists `--radius-2xl: 32px` for "Modals, parcel detail panel"). The 32px is consistent with DESIGN.md — the success criterion's `rounded-[24px]` is the outlier. **Recommend: update success criterion to `rounded-[32px]` to match DESIGN.md §radius and as-built popup.** |
| TEST-04 | Integration or component tests cover woonvisie popup — opens on click, shows correct wijk/prioriteit/segmentmatch data | Test stack confirmed: Storybook play-functions via `@storybook/addon-vitest`. Existing `WoonvisiePopup.stories.tsx` has 5 visual variants but **zero `play` functions**. Plan must add play-function assertions following `ScoreBreakdownModal.stories.tsx` pattern. Coverage required: open-via-click + wijk-specific render + algemeen-fallback + dismiss (click-outside). |
</phase_requirements>

## Standard Stack

### Verified existing stack (no additions needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.2.0 | UI framework | Already used everywhere |
| framer-motion | ^12.35.2 | Popup enter/exit, AnimatePresence | Already used in `WoonvisiePopup.tsx` + every parcel modal |
| lucide-react | ^0.564.0 | `X` close icon | Already imported in `WoonvisiePopup.tsx` |
| @tanstack/react-query | ^5.90.20 | `useParcelProjectType(parcelId)` for project_type sourcing | Already used by `ParcelDetailModal.tsx:357` |
| react-focus-lock | ^2.13.7 | Focus trap (currently UNUSED in `WoonvisiePopup.tsx`) | Already a project dep, ready to drop in if focus trap is required |
| storybook | ^10.2.8 | Component preview + tests | Project canonical test runner (NOT RTL) |
| @storybook/addon-vitest | ^10.2.8 | Runs `play` functions as tests in Chromium | Phase-2 TEST-02/TEST-03 pattern |
| @vitest/browser-playwright | ^4.0.18 | Playwright provider for vitest browser tests | Configured in `vite.config.ts:54-76` |
| storybook/test | (10.x) | `expect`, `within`, `userEvent` for play funcs | Note: import path is `'storybook/test'` NOT `'@storybook/test'` (Storybook 10 path change — see STATE.md decision Phase-02-score-ui-fix) |

### Don't add

- React Testing Library — not used by this codebase
- jest — not used (vitest only)
- @testing-library/user-event — not used in stories pattern; use `userEvent` from `'storybook/test'`
- A new modal primitive — `WoonvisiePopup.tsx` is already the primitive; mirror `BestemmingModal.tsx` and `EigendomModal.tsx` patterns

## Architecture Patterns

### Recommended file changes (minimum diff)

```
frontend/src/components/map/panels/parcel/
├── layers/
│   └── PotentieLayer.tsx                     # MODIFY: import + state + click handler + button on woonvisie card
├── WoonvisiePopup.tsx                         # MODIFY (optional): add prefers-reduced-motion guard, possibly extend props for new data-contract fields
└── (no new files needed — popup is shipped)

frontend/src/stories/parcel/
└── WoonvisiePopup.stories.tsx                 # MODIFY: add `play` functions for TEST-04 (5 stories, add ≥3 with play)
```

### Pattern 1: Modal primitive shape (mirror BestemmingModal/EigendomModal)

`BestemmingModal.tsx` lines 132-211 and `WoonvisiePopup.tsx` lines 100-209 already follow the canonical Aura modal shape:

```tsx
// Source: frontend/src/components/map/panels/parcel/BestemmingModal.tsx:132-211
return createPortal(
  <AnimatePresence>
    <motion.div
      key="<modal-name>-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="relative flex flex-col bg-white rounded-[32px] shadow-2xl w-full max-w-2xl ..."
        onClick={(e) => e.stopPropagation()}
      >
        {/* close button + body */}
      </motion.div>
    </motion.div>
  </AnimatePresence>,
  document.body,
)
```

Key elements (verbatim from `BestemmingModal.tsx`):
- `z-[60]` for the modal backdrop (note: this is **not** the `--z-modal: 1000` token; the codebase uses `z-[60]` for parcel-detail nested modals — see "Z-index" pitfall below)
- `bg-black/30 backdrop-blur-md` backdrop with `onClick={onClose}` for click-outside dismiss
- Inner `motion.div` with `onClick={(e) => e.stopPropagation()}` to prevent backdrop click bubbling
- `prefersReducedMotion` const at module top: `typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches`

### Pattern 2: PotentieLayer card render (current — to wrap)

Currently lines 376-394 of `PotentieLayer.tsx`:
```tsx
{pageCards.map((card) => (
  <div                                              // ← static div
    key={card.label}
    className="bg-white border border-slate-100 rounded-[24px] ..."
  >
    {/* card content */}
  </div>
))}
```

Plan must convert this branch into a conditional render: when `card.label === 'WOONVISIE'`, render `<button onClick={() => setOpen(true)}>` with the same styling, plus a hover affordance. The InteractiveGrid story at `WoonvisiePopup.stories.tsx:206-235` shows the exact pattern (with `hover:shadow-md` + `group-hover:opacity-100` "klik →" hint).

### Pattern 3: project_type sourcing

`useParcelProjectType(parcelId)` is the canonical hook. Two integration options:

**Option A (preferred — minimum prop drilling):**
```tsx
// inside PotentieLayer.tsx
const { data: projectTypeData } = useParcelProjectType(parcel.parcel_id)
const projectType = projectTypeData?.project_type ?? 'onbepaald'
```

**Option B (avoid duplicate fetches):**
Lift to `ParcelDetailPanel.tsx` (which already mounts `PotentieLayer`), pass as new prop. But `ParcelDetailModal.tsx:357` already calls the hook — TanStack Query deduplicates, so Option A is safe.

### Anti-patterns to avoid

- **Hardcoded hex in JSX** — DESIGN.md §Anti-patterns rules this out. Use `var(--color-aura-amber)` or Tailwind theme tokens. **Note:** existing `WoonvisiePopup.tsx` uses many hardcoded hexes (`#22C55E`, `#F9A826`, `#F2F6F3`, `#0E1111`, `#9CA3AF`, `#6B7280`, `#1A1C1E`). These map 1:1 to Aura tokens — a token-replacement edit could be done in this phase as a hygiene pass, but is NOT a hard requirement.
- **Em dashes in UI copy** — DESIGN.md §Anti-patterns. Use `·`, `:` or `,`. Existing popup correctly uses `·` between meta items.
- **Skipping focus trap** — react-focus-lock is in `package.json`, current popup doesn't use it. Map keyboard handlers (e.g. MapLibre `Keyboard` control) WILL still receive arrow keys and ESC if focus isn't trapped. **Recommend: add `<FocusLock>` wrap when ParcelDetailPanel is open.**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal primitive (overlay + backdrop + portal) | Custom modal | Mirror `BestemmingModal.tsx` shape (already done in `WoonvisiePopup.tsx`) | Codebase has 5+ similar modals; consistency matters |
| Focus trap | Manual `tabindex` juggling | `react-focus-lock` (already in deps) | Map keyboard handler interaction needs proven library |
| Click-outside dismiss | Document event listeners | `<motion.div onClick={onClose}>` backdrop + `e.stopPropagation()` on inner | This is the canonical Aura pattern |
| ESC dismiss | `useEffect(() => addEventListener('keydown'))` | `react-focus-lock` `returnFocus` + standard React keyboard handler on backdrop | Stays consistent with EigendomModal/VergunningenModal |
| Project-type fetching | New API call inside popup | `useParcelProjectType(parcelId)` hook | Already exists, TanStack Query dedupes |
| Animation respecting reduced-motion | Custom CSS `@media` queries | The `prefersReducedMotion` const pattern from `BestemmingModal.tsx:126-128` | One-liner, consistent with codebase |
| Component test framework | Manual RTL setup | Storybook 10 `play` functions via addon-vitest | This is the project's canonical test runner |
| Test browser environment | jsdom config | Playwright Chromium via `@vitest/browser-playwright` | Already configured in `vite.config.ts:54-76` |

**Key insight:** Phase 3 is mostly **wiring + tests**, not feature engineering. Treat the existing `WoonvisiePopup.tsx` and `WoonvisiePopup.stories.tsx` as legacy assets to be lightly improved, not rebuilt.

## Common Pitfalls

### Pitfall 1: Z-index conflict between Parcel panel and Woonvisie popup

**What goes wrong:** `ParcelDetailPanel` portals at `z-[var(--z-property-panel)]` (= 300). `BestemmingModal.tsx`/`WoonvisiePopup.tsx` use `z-[60]` (= 60). The popup mounts to `document.body` via `createPortal`, so it's a sibling of the panel — z-60 vs z-300 means **the popup would render BELOW the parcel panel** if both portal to body.

**Why it works anyway:** `WoonvisiePopup.tsx` portals to `document.body` and uses `position: fixed inset-0` — the portal hierarchy puts it after the panel in the DOM, so painting order wins regardless of z-index. But this is fragile.

**How to avoid:** Bump woonvisie popup to `z-[1100]` (above `--z-modal: 1000`) to be explicit. Or use `z-[var(--z-modal)]`. Plan should explicitly choose a z-index token.

**Warning signs:** Popup renders behind parcel panel; visual stacking inconsistent across browsers.

### Pitfall 2: ESC key collision with MapLibre keyboard handlers

**What goes wrong:** MapLibre GL has a default `Keyboard` control that listens for `+/-`, arrow keys, and ESC for navigation/zoom. When the popup is open, ESC should close the popup. Without focus trap, ESC may be intercepted by the map.

**Why it happens:** Both elements are mounted at the same time; event ordering depends on focus.

**How to avoid:** Wrap popup body in `<FocusLock returnFocus>` from `react-focus-lock` — captures ESC + tab cycle.

**Warning signs:** ESC zooms map instead of closing popup; tab cycles through map controls behind popup.

### Pitfall 3: Storybook play-function imports

**What goes wrong:** Importing `expect, within, userEvent` from `'@storybook/test'` (the v8 path) — Storybook 10 broke this.

**Why it happens:** STATE.md decision (Phase 02-score-ui-fix): "Storybook 10 test imports use 'storybook/test' not '@storybook/test' — package path changed in v10".

**How to avoid:** Always import from `'storybook/test'` (no `@`):
```tsx
// Source: frontend/src/stories/parcel/ScoreBreakdownModal.stories.tsx:9
import { expect, within } from 'storybook/test'
```

**Warning signs:** Storybook test imports fail to resolve; test runner reports "module not found".

### Pitfall 4: Portal-rendered modal escapes canvasElement

**What goes wrong:** Storybook play-function `canvasElement` only contains the rendered story root, not the portal target (`document.body`). Querying via `within(canvasElement).getByText('...')` will miss the popup.

**Why it happens:** STATE.md decision (Phase 02-score-ui-fix): "Portal-rendered modals require `within(document.body)` in play functions — `createPortal` escapes canvasElement scope".

**How to avoid:**
```tsx
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: /woonvisie/i }))
  // For portaled popup content, query body instead:
  const body = within(document.body)
  await expect(body.getByText('Blerick')).toBeInTheDocument()
}
```

**Warning signs:** Test "can't find" elements that are clearly visible in the story preview.

### Pitfall 5: Data contract gap (gemeente/periode/confidence)

**What goes wrong:** `WoonvisiePopup` requires 4 props NOT present in `factor.waarde`:
- `gemeente: string` — `parcel.gemeente_code` is the CBS code (e.g. "GM0983"), not display name "Venlo". Need a resolver.
- `periode_start: number` — exists on Pydantic `WoonvisiePayload` but NOT exposed via `factor.waarde` per Phase 6 Plan 03.
- `periode_einde: number` — same.
- `confidence: number` — same.

**Why it happens:** Phase 6 Plan 03 narrowed `factor.waarde` to `{matched_wijk, matched_policy, prioritized_segment, algemeen_citaat}` to keep the dict tight. Periode + confidence + gemeente weren't on the popup's mind during scoring rewrite.

**How to avoid (4 resolution options for plan to choose):**

1. **Backend extension (out of scope per CONTEXT.md):** add the 3 fields to `factor.waarde`. Touches Phase 6 work — likely rejected.
2. **Display-only fallback:** popup renders `gemeente="Onbekend"`, `periode="2024–2030"` hardcoded, `confidence` removed entirely. Simple but breaks the design.
3. **Source from sibling data:** `gemeente_naam` is on `ScanResultsResponse` — pass as prop from `ParcelDetailPanel`. Periode + confidence are unrecoverable without backend extension.
4. **Re-fetch:** call a new endpoint `/api/parcels/{id}/woonvisie-context` returning the full payload. Adds API surface — likely rejected.

**Recommend for plan:** Option 3 + simplify popup signature (drop `periode_start/periode_einde/confidence` props, render only when present, default to inferring period from current year fallback "Geldig vanaf <bouwjaar>" or omit entirely). The `lowConfidence` warning block at popup lines 197-202 can be removed if confidence isn't reachable.

**Warning signs:** Popup renders with `Woonvisie undefined · undefined–undefined`; TypeScript errors on missing props.

### Pitfall 6: Test isolation — multiple stories sharing portal root

**What goes wrong:** Each Storybook story mounts to `document.body`. If story 1's popup doesn't unmount before story 2 runs, both popups exist simultaneously in `document.body`. Play-function queries against `body` find both.

**Why it happens:** Browser-mode vitest runs stories sequentially but doesn't reset DOM between unless explicitly configured.

**How to avoid:** Each story's play function should close the popup before completing, OR query with a specific text/role unique to the story (e.g. `body.getByText('Blerick')` not `body.getByText(/woonvisie/i)`).

**Warning signs:** Tests pass individually but fail when full suite runs; "found 2 elements with..." errors.

## Code Examples

### Wiring example: PotentieLayer click → popup

```tsx
// Source: composite of PotentieLayer.tsx + WoonvisiePopup.stories.tsx:206-235
import { useState } from 'react'
import { WoonvisiePopup } from '../WoonvisiePopup'
import { useParcelProjectType } from '@/hooks/useParcelProjectType'

export function PotentieLayer({ parcel }: PotentieLayerProps) {
  const [woonvisieOpen, setWoonvisieOpen] = useState(false)
  const { data: projectTypeData } = useParcelProjectType(parcel.parcel_id)
  // ... existing breakdown logic ...

  // Extract woonvisie factor data for popup
  const woonvisieFactor = (parcel.score_breakdown as ScoreBreakdownV3 | null)?.['woonvisie_match']
  const woonvisieWaarde = woonvisieFactor?.waarde as {
    matched_wijk: string | null
    matched_policy: WijkPolicy | null
    prioritized_segment: string | null
    algemeen_citaat: string
  } | null

  return (
    <div className="flex flex-col flex-1 ...">
      {/* ... verdict hero ... */}

      <div className="grid grid-cols-3 gap-1.5 ...">
        {pageCards.map((card) => {
          if (card.label === 'WOONVISIE' && woonvisieWaarde) {
            return (
              <button
                key={card.label}
                type="button"
                onClick={() => setWoonvisieOpen(true)}
                className="bg-white border border-slate-100 rounded-[24px] p-6 ... hover:shadow-md transition-all text-left cursor-pointer group relative"
              >
                {/* same card body as default render */}
                <span className="absolute bottom-3 right-3 text-[9px] font-bold uppercase tracking-[0.1em] text-[#F9A826] opacity-0 group-hover:opacity-100 transition-opacity">
                  klik →
                </span>
              </button>
            )
          }
          return <div key={card.label} className="...">{/* unchanged */}</div>
        })}
      </div>

      {woonvisieWaarde && (
        <WoonvisiePopup
          isOpen={woonvisieOpen}
          onClose={() => setWoonvisieOpen(false)}
          gemeente={parcel.gemeente_code ?? 'Onbekend'}  // TODO resolve to naam — see Pitfall 5
          periode_start={2024}                              // TODO source from backend — see Pitfall 5
          periode_einde={2030}
          matched_policy={woonvisieWaarde.matched_policy}
          algemeen_citaat={woonvisieWaarde.algemeen_citaat}
          project_type={projectTypeData?.project_type ?? 'onbepaald'}
          confidence={0.8}                                  // TODO source from backend — see Pitfall 5
        />
      )}
    </div>
  )
}
```

### Test example: Storybook play function (TEST-04 pattern)

```tsx
// Source: pattern from frontend/src/stories/parcel/ScoreBreakdownModal.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within, userEvent } from 'storybook/test'
import { PotentieLayer } from '@/components/map/panels/parcel/layers/PotentieLayer'

// inside an existing story (or a new dedicated test story):
export const ClickOpensPopup: Story = {
  args: { parcel: mockParcelWithBlerickWoonvisie },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const card = await canvas.findByRole('button', { name: /woonvisie/i })
    await userEvent.click(card)

    // Portal escapes canvasElement — query body
    const body = within(document.body)
    await expect(body.getByText('Blerick')).toBeInTheDocument()
    await expect(body.getByText(/groei/i)).toBeInTheDocument()
  },
}

export const ClickOutsideDismisses: Story = {
  // ... same args ...
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /woonvisie/i }))
    const body = within(document.body)
    await expect(body.getByText('Blerick')).toBeInTheDocument()
    // click backdrop (the fixed inset-0 div, NOT the inner modal)
    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/30')
    await userEvent.click(backdrop as Element)
    await expect(body.queryByText('Blerick')).not.toBeInTheDocument()
  },
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| RTL `@testing-library/react` co-located `.test.tsx` | Storybook 10 `play` functions via `@storybook/addon-vitest` (Playwright Chromium) | M048 Phase 02 (2026-04-22) | Plans MUST follow stories pattern; co-located tests will not run |
| `'@storybook/test'` import path | `'storybook/test'` (no `@`) | Storybook 10 release | Old path silently fails to resolve |
| Reading `potentie_risico_balance` from scan flags | Passing as prop from parent (org-config separation) | Phase 02 (2026-04-22) | This phase: same principle — `project_type` comes from hook, not flags |
| `factor.waarde = "string"` for woonvisie | `factor.waarde = {matched_wijk, matched_policy, prioritized_segment, algemeen_citaat}` dict | Phase 06 Plan 03 (2026-04-24) | Frontend reads `.matched_policy` not `.toelichting_lang`; legacy v2.1 scans render `'—'` fallback |
| `rounded-[40px]` on parcel detail panel | `rounded-[32px]` for modals (DESIGN.md §radius `--radius-2xl`) | DESIGN.md formalization 2026-04-22 | Success criterion in ROADMAP says `rounded-[24px]` — likely error, plan should validate against DESIGN.md |

**Deprecated/outdated:**
- The `prioritized_segment` field is read off `waarde` for the kaart sub-text (`PotentieLayer.tsx:204`) — not yet popup data. Plan can ignore.
- `WoonvisiePayload.growth_wijken/shrink_wijken/herstructureringswijken/excluded_project_types` are **deprecated** (kept for cache-roundtrip only, not used by scorer). Frontend MUST NOT read these — read `wijk_policies` array via `matched_policy`.

## Open Questions

1. **Should the popup conform to ROADMAP's `rounded-[24px]` or DESIGN.md's `rounded-[32px]`?**
   - What we know: As-built uses `rounded-[32px]`. DESIGN.md §radius lists `--radius-2xl: 32px` for "Modals, parcel detail panel". `BestemmingModal.tsx:151` uses `rounded-[32px]`.
   - What's unclear: ROADMAP success criterion says 24px. CONTEXT.md picks 24px. Both contradict the DESIGN.md modal convention.
   - Recommendation: **Plan should overrule the success criterion and lock 32px** to match DESIGN.md §radius and the rest of the parcel-detail modal family. Document the override in PLAN.md.

2. **Does the existing minimal popup body (dot+label, plain citaat, inline segment-sentence) satisfy WOON-02?**
   - What we know: WOON-02 explicitly requires "prioriteit-chip", "amber-bordered blockquote", "segmentmatch-chips". Memory note `feedback_minimal_aesthetic.md` says "schrap iconen, frames, multi-state grids; minimal aesthetic". The shipped popup follows the memory.
   - What's unclear: Which constraint wins — REQUIREMENTS.md WOON-02 literal text, or the aesthetic memory?
   - Recommendation: **Plan should ask user to choose** OR default to the as-built minimal aesthetic (matches the most recent design intent) and rewrite WOON-02 in this phase's PLAN.md.

3. **Where do `gemeente` (display name), `periode_start`, `periode_einde`, `confidence` come from?**
   - What we know: Not in `factor.waarde` per Phase 6 SUMMARY. `gemeente_code` is on `ScanResultItem` but as CBS code. Periode + confidence only exist on backend `WoonvisiePayload`.
   - What's unclear: Should plans (a) extend `factor.waarde` (Phase 6 backend re-open), (b) drop these from popup, or (c) source `gemeente_naam` from `ScanResultsResponse` and hardcode the period?
   - Recommendation: **Plans should pick (c) for `gemeente_naam` (pass from `ParcelDetailPanel` parent) AND drop `periode_start/periode_einde/confidence` from required props (make optional, hide UI when absent).** This keeps Phase 3 frontend-only.

4. **Should the popup add a focus trap (`react-focus-lock`)?**
   - What we know: Library is in deps. Current popup has no focus trap. ESC handler is also missing — only click-outside dismiss works.
   - What's unclear: Is keyboard accessibility blocking for TEST-04?
   - Recommendation: **Plan should add focus trap + ESC handler in this phase** as a hygiene pass — it's a 6-line edit and addresses Pitfall 2 (MapLibre keyboard collision).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Storybook 10.2.8 + `@storybook/addon-vitest` 10.2.8 + `@vitest/browser-playwright` 4.0.18 (Chromium) |
| Config file | `frontend/vite.config.ts` (test.projects array, lines 54-76); `frontend/.storybook/main.ts`; `frontend/.storybook/vitest.setup.ts` |
| Quick run command | `cd frontend && pnpm exec vitest run --project=storybook src/stories/parcel/WoonvisiePopup.stories.tsx` |
| Full suite command | `cd frontend && pnpm run check && pnpm exec vitest run` |
| Lint/typecheck (pre-commit) | `cd frontend && pnpm run check` (= `tsc -b --noEmit && eslint .`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WOON-01 | Click on kaart 10 (`woonvisie_match`) opens the popup | Storybook play (browser) | `pnpm exec vitest run --project=storybook src/stories/parcel/WoonvisiePopup.stories.tsx -t "ClickOpensPopup"` | ❌ Wave 0 — story exists, `play` not yet authored |
| WOON-02 | Popup renders wijk_naam, prioriteit, citaat, pagina, segmentmatch sentence (or chips, per Open Question 2) | Storybook play asserting body content via `within(document.body)` | (same file, separate `play` per variant: Blerick / Venlo-Centrum / Tegelen / fallback) | ❌ Wave 0 |
| WOON-03 | Popup uses Aura tokens (Plus Jakarta Sans, glass/white surface, 32px radius, amber accents) | Storybook visual + a11y addon (`@storybook/addon-a11y` is configured in `vitest.setup.ts`) | (visual review in `pnpm storybook`; a11y assertions automatic) | ⚠ Visual stories exist; no automated assertion of tokens |
| TEST-04 | Component tests cover popup open + content + dismiss | Storybook play with at least: `ClickOpensPopup`, `RendersWijkContent`, `ClickOutsideDismisses`, `EscDismisses`, `FallbackToAlgemeenWhenNoMatch` | Same as above | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm run check` (typecheck + eslint) + `pnpm exec vitest run --project=storybook src/stories/parcel/WoonvisiePopup.stories.tsx`
- **Per wave merge:** `pnpm exec vitest run --project=storybook src/stories/parcel/` (all parcel stories — catches regressions in `ScoreBreakdownModal.stories.tsx` from earlier phases)
- **Phase gate:** Full `pnpm exec vitest run` + `pnpm run check` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/stories/parcel/WoonvisiePopup.stories.tsx` — add at minimum 4 new `play`-bearing stories (or augment existing `BlerickGroeiMatch`, `VenloCentrumMismatch`, `GeenMatchFallback`, plus a new `ClickFromGrid` story) covering WOON-01/WOON-02/TEST-04
- [ ] `frontend/src/stories/parcel/PotentieLayer.stories.tsx` — file does NOT exist. Required for WOON-01 (the click affordance is in `PotentieLayer`, not in the popup). Plan must create with at least 1 `play` story that mounts `PotentieLayer` with mock `parcel.score_breakdown.woonvisie_match` and clicks the card.
- [ ] Mock `ScanResultItem` fixture covering `score_breakdown.woonvisie_match.waarde = {matched_wijk, matched_policy, prioritized_segment, algemeen_citaat}` shape — none exists today. Plan must inline a fixture in the story file (matches `ScoreBreakdownModal.stories.tsx` mock pattern at lines 22-58).
- [ ] No new test framework install needed — `vitest`, `storybook`, `@vitest/browser-playwright`, `playwright` all already in `package.json`.

## Sources

### Primary (HIGH confidence)
- `frontend/src/components/map/panels/parcel/WoonvisiePopup.tsx` (210 lines, fully read)
- `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx` (427 lines, fully read)
- `frontend/src/components/map/panels/parcel/BestemmingModal.tsx` (canonical Aura modal pattern, 311 lines, fully read)
- `frontend/src/stories/parcel/WoonvisiePopup.stories.tsx` (262 lines, fully read)
- `frontend/src/stories/parcel/ScoreBreakdownModal.stories.tsx` (read first 80 lines — TEST-02/03 template)
- `frontend/src/lib/types/scan.ts` (ScanResultItem + ScoreFactorV3 shapes verified)
- `frontend/src/lib/types/projectType.ts` (ProjectType enum verified)
- `frontend/vite.config.ts` (vitest+storybook+playwright config verified)
- `frontend/src/styles/index.css` (Tailwind v4 `@theme` block — Aura tokens verified)
- `frontend/package.json` (deps + scripts verified)
- `DESIGN.md` (Aura system, fully read — radius/color/motion/z-index tokens)
- `.planning/REQUIREMENTS.md` (WOON-01..03, TEST-04 verified)
- `.planning/phases/03-woonvisie-popup/03-CONTEXT.md` (locked decisions)
- `.planning/phases/06-wijkpolicy-schema-woonvisie-scoring-upgrade/06-02-SUMMARY.md` (WijkPolicy schema)
- `.planning/phases/06-wijkpolicy-schema-woonvisie-scoring-upgrade/06-03-SUMMARY.md` (`factor.waarde` shape)
- `.planning/STATE.md` (Storybook 10 import path decision; portal-test caveat)

### Secondary (MEDIUM confidence)
- Memory note `feedback_minimal_aesthetic.md` referenced from MEMORY.md — argues for as-built minimal popup over CONTEXT.md chip-spec
- Memory note `feedback_m048_woonvisie_ui.md` — original goedgekeurd design for kaart 10

### Tertiary (LOW confidence)
- None — all findings sourced from in-repo code/docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library verified in `package.json`, every pattern verified in shipped code
- Architecture: HIGH — `BestemmingModal.tsx` and `WoonvisiePopup.tsx` are the canonical patterns, both fully read
- Pitfalls: HIGH — every pitfall sourced either from STATE.md decisions or directly verified by reading the code
- Test framework: HIGH — `frontend/vite.config.ts:54-76` defines the storybook test project explicitly; `ScoreBreakdownModal.stories.tsx` is a working precedent
- Data contract gap: HIGH — `06-03-SUMMARY.md` explicitly defines `factor.waarde` shape and what it omits

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (30 days — codebase is stable on this surface; only Phase 6 might churn `factor.waarde` further, monitor STATE.md)
