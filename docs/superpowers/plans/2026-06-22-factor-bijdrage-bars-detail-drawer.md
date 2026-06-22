# Bijdrage-bars layout + uniforme factor-detail-drawer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vervang de factor-rijenlijst in de Potentie/Risico-tabs door de "Bijdrage-bars" (Variant C) diverging-balken, en maak élke factor klikbaar naar één uniforme rechter slide-in drawer (cascades → editorial content, overige factoren → generieke uitleg uit bestaande backend-velden).

**Architecture:** Vier gedeelde units — `FactorDetailDrawer` (rechter slide-in chrome, geëxtraheerd uit de 5× herhaalde popup-chrome), `FactorExplainBody` (generieke uitleg uit `ScoreBreakdownModal`), `BijdrageBar` (diverging-balk visual), en een gedeelde `lib/factor-detail.ts` (types + parser + cascade-classifier). De twee layers (`PotentieLayer`, `RisicoLayer`) krijgen één `activeFactorKey`-state die de drawer voedt; de oude in-panel "overvloei"-drill-down (parent view-stack) vervalt.

**Tech Stack:** React + TypeScript, TanStack Router, framer-motion, Tailwind v4 (`@theme` Aura-tokens), Vitest (node-env pure-logic), Storybook (visuele convergence).

## Global Constraints

- **Design tokens:** alleen Aura CSS-variabelen / Tailwind-utilities; NOOIT brand-kleuren hardcoden buiten de tokens. Bron: `DESIGN.md` + `frontend/src/styles/index.css`. Canvas `#F2F6F3`, niet wit. Font: Plus Jakarta Sans. Light mode only.
- **Bestandsgrootte:** elk bestand < 300 regels; splits anders.
- **Testconventie (hard):** unit-tests zijn **node-env pure-logic** met Vitest — GEEN jsdom, GEEN `@testing-library/react`. Test geëxporteerde pure functies. React-rendering wordt gedekt via Storybook-stories (`frontend/src/stories/parcel/`). Mirror de precedents in `__tests__/OmgevingsvisiePopup.test.tsx` en `lib/__tests__/factor-list.test.ts`.
- **Quality-gate per taak:** `npm run check` (tsc + eslint + format) exit 0 én relevante `vitest` groen vóór commit.
- **Commit-prefix:** `M054/S03: <wat>` (slice-nummer; pas aan als GSD anders toewijst).
- **SCHEMA_VERSION onaangeroerd** — geen datawijziging, alleen presentatie. Editorial `*DetailContent`-bodies en `RandvoorwaardenSection` blijven 1:1.
- **Cascade-keys (de 5 met editorial):** `woonvisie_match`, `beleidsalignement`, `grondwaarde_fit` (potentie) · `splitsingsrisico`, `parkeerdruk` (risico).

---

### Task 1: Gedeelde `lib/factor-detail.ts` — types, parser, cascade-classifier

Extraheert de factor-types + parser uit `ScoreBreakdownModal.tsx` naar een gedeeld bestand zodat de modal én de nieuwe drawer dezelfde bron delen, en voegt de cascade-classifier toe.

**Files:**
- Create: `frontend/src/components/map/panels/parcel/lib/factor-detail.ts`
- Create: `frontend/src/components/map/panels/parcel/lib/__tests__/factor-detail.test.ts`
- Modify: `frontend/src/components/map/panels/parcel/ScoreBreakdownModal.tsx` (importeer types/parser uit de lib i.p.v. lokaal definiëren)

**Interfaces:**
- Produces: `interface ScoreFactor` (exact de shape uit `ScoreBreakdownModal.tsx:15-30`), `parseFactors(breakdown: Record<string, unknown> | null): { potentie: {name:string;factor:ScoreFactor}[]; risico: {...}[] }`, `formatFactorName(name: string): string`, `isWijkBreed(dataBronnen: string[] | null): boolean`, `CASCADE_FACTOR_KEYS: ReadonlySet<string>`, `isCascadeFactor(key: string): boolean`.
- Consumes: niets.

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/factor-detail.test.ts
import { describe, expect, it } from 'vitest'
import {
  parseFactors,
  formatFactorName,
  isWijkBreed,
  isCascadeFactor,
  CASCADE_FACTOR_KEYS,
} from '../factor-detail'

describe('parseFactors', () => {
  it('splits factors by categorie and sorts each by descending bijdrage', () => {
    const breakdown = {
      vrije_grond: { categorie: 'potentie', bijdrage: 8.5, gewicht: 10 },
      bestemming: { categorie: 'potentie', bijdrage: 5.0, gewicht: 6 },
      parkeerdruk: { categorie: 'risico', bijdrage: -2.8, gewicht: 4 },
    }
    const { potentie, risico } = parseFactors(breakdown)
    expect(potentie.map((f) => f.name)).toEqual(['vrije_grond', 'bestemming'])
    expect(risico.map((f) => f.name)).toEqual(['parkeerdruk'])
  })

  it('returns empty lists for null breakdown', () => {
    expect(parseFactors(null)).toEqual({ potentie: [], risico: [] })
  })

  it('skips entries without a categorie field', () => {
    const { potentie, risico } = parseFactors({ junk: { foo: 1 } })
    expect(potentie).toEqual([])
    expect(risico).toEqual([])
  })
})

describe('formatFactorName', () => {
  it('humanises a snake_case factor key', () => {
    expect(formatFactorName('woonvisie_match')).toMatch(/woonvisie/i)
  })
})

describe('isWijkBreed', () => {
  it('is true when a CBS source is present', () => {
    expect(isWijkBreed(['CBS StatLine'])).toBe(true)
  })
  it('is false for parcel-level sources', () => {
    expect(isWijkBreed(['Kadaster', 'BAG'])).toBe(false)
  })
  it('is false for null', () => {
    expect(isWijkBreed(null)).toBe(false)
  })
})

describe('isCascadeFactor', () => {
  it('is true for the five editorial cascade keys', () => {
    for (const key of ['woonvisie_match', 'beleidsalignement', 'grondwaarde_fit', 'splitsingsrisico', 'parkeerdruk']) {
      expect(isCascadeFactor(key)).toBe(true)
    }
  })
  it('is false for a plain computed factor', () => {
    expect(isCascadeFactor('vrije_grond')).toBe(false)
  })
  it('CASCADE_FACTOR_KEYS has exactly five members', () => {
    expect(CASCADE_FACTOR_KEYS.size).toBe(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/map/panels/parcel/lib/__tests__/factor-detail.test.ts`
Expected: FAIL — "Cannot find module '../factor-detail'".

- [ ] **Step 3: Create `lib/factor-detail.ts`**

Move the `ScoreFactor` interface verbatim from `ScoreBreakdownModal.tsx:15-30`, the `parseFactors` function verbatim from `ScoreBreakdownModal.tsx:69-116`, the `formatFactorName` function verbatim from `ScoreBreakdownModal.tsx:118-` (the full function body), and `isWijkBreed` verbatim from `ScoreBreakdownModal.tsx:47-50`. Export them all. Then append the classifier:

```ts
/* ── Cascade classifier ──────────────────────────────────────── */

/** The five factors that carry rich editorial detail content. */
export const CASCADE_FACTOR_KEYS: ReadonlySet<string> = new Set([
  'woonvisie_match',
  'beleidsalignement',
  'grondwaarde_fit',
  'splitsingsrisico',
  'parkeerdruk',
])

/** True when a factor has an editorial *DetailContent body (vs. generic explain). */
export function isCascadeFactor(key: string): boolean {
  return CASCADE_FACTOR_KEYS.has(key)
}
```

- [ ] **Step 4: Rewire `ScoreBreakdownModal.tsx` to import from the lib**

Delete the local `ScoreFactor` interface, `parseFactors`, `formatFactorName`, and `isWijkBreed` from `ScoreBreakdownModal.tsx`. Add at the top:

```ts
import {
  type ScoreFactor,
  parseFactors,
  formatFactorName,
  isWijkBreed,
} from './lib/factor-detail'
```

Keep `countMissingFactors` where it is (it stays exported from the modal — `ParcelDetailPanel` imports it from there). Verify no other local references break.

- [ ] **Step 5: Run tests + typecheck**

Run: `cd frontend && npx vitest run src/components/map/panels/parcel/lib/__tests__/factor-detail.test.ts && npm run check`
Expected: PASS (all factor-detail tests) and `npm run check` exit 0.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/map/panels/parcel/lib/factor-detail.ts \
        frontend/src/components/map/panels/parcel/lib/__tests__/factor-detail.test.ts \
        frontend/src/components/map/panels/parcel/ScoreBreakdownModal.tsx
git commit -m "M054/S03: extract shared factor-detail lib (types, parser, cascade classifier)"
```

---

### Task 2: `BijdrageBar` — diverging-balk geometry + component

**Files:**
- Modify: `frontend/src/components/map/panels/parcel/lib/factor-detail.ts` (add `barGeometry`)
- Modify: `frontend/src/components/map/panels/parcel/lib/__tests__/factor-detail.test.ts` (add geometry tests)
- Create: `frontend/src/components/map/panels/parcel/BijdrageBar.tsx`
- Create: `frontend/src/stories/parcel/BijdrageBar.stories.tsx`

**Interfaces:**
- Consumes: `PageCard` from `@/lib/factor-groups` (`{ label, value, sub, pts, factor_key, bron, missing? }`).
- Produces: `barGeometry(pts: number, maxAbs: number): { side: 'pos' | 'neg' | 'zero'; widthPct: number }`; `function BijdrageBar(props: { card: PageCard; tone: 'positive' | 'negative'; maxAbs: number; onClick?: () => void; comingSoon?: boolean }): JSX.Element`.

- [ ] **Step 1: Write the failing geometry test**

```ts
// append to lib/__tests__/factor-detail.test.ts
import { barGeometry } from '../factor-detail'

describe('barGeometry', () => {
  it('positive pts fill to the right', () => {
    expect(barGeometry(8.5, 8.5)).toEqual({ side: 'pos', widthPct: 100 })
  })
  it('negative pts fill to the left', () => {
    expect(barGeometry(-2.8, 8.5).side).toBe('neg')
  })
  it('width is the magnitude as a percentage of maxAbs', () => {
    expect(barGeometry(4.25, 8.5).widthPct).toBe(50)
  })
  it('zero / missing pts yield a zero-width neutral bar', () => {
    expect(barGeometry(0, 8.5)).toEqual({ side: 'zero', widthPct: 0 })
  })
  it('is safe when maxAbs is 0 (all factors zero)', () => {
    expect(barGeometry(0, 0)).toEqual({ side: 'zero', widthPct: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/map/panels/parcel/lib/__tests__/factor-detail.test.ts`
Expected: FAIL — "barGeometry is not a function".

- [ ] **Step 3: Implement `barGeometry` in `factor-detail.ts`**

```ts
/* ── Bijdrage-bar geometry (Variant C) ───────────────────────── */

export function barGeometry(
  pts: number,
  maxAbs: number,
): { side: 'pos' | 'neg' | 'zero'; widthPct: number } {
  if (pts === 0 || maxAbs <= 0) return { side: 'zero', widthPct: 0 }
  const widthPct = Math.round((Math.abs(pts) / maxAbs) * 100)
  return { side: pts > 0 ? 'pos' : 'neg', widthPct }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/map/panels/parcel/lib/__tests__/factor-detail.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `BijdrageBar.tsx`**

A presentational diverging bar mirroring `compare.html` Variant C. The whole bar is the button (same accessibility pattern as `FactorCard`). Use Aura tokens (green = `aura-green`/`text-green-600`, red = `text-red-600`/`red-400`; never raw hex).

```tsx
import { barGeometry } from './lib/factor-detail'
import type { PageCard } from '@/lib/factor-groups'

interface BijdrageBarProps {
  card: PageCard
  tone: 'positive' | 'negative'
  /** Max |pts| across the current list — normalises bar width. */
  maxAbs: number
  onClick?: () => void
  comingSoon?: boolean
}

export function BijdrageBar({ card, tone, maxAbs, onClick, comingSoon = false }: BijdrageBarProps) {
  const { side, widthPct } = barGeometry(card.pts, maxAbs)
  const isInteractive = !comingSoon && !!onClick

  const fillColor =
    comingSoon
      ? 'bg-slate-200'
      : side === 'pos'
        ? 'bg-gradient-to-r from-green-500/20 to-green-500/85'
        : side === 'neg'
          ? 'bg-gradient-to-l from-red-500/20 to-red-500/85'
          : 'bg-slate-200'

  const ptsLabel =
    card.pts > 0 ? `+${card.pts}` : card.pts < 0 ? `−${Math.abs(card.pts)}` : '—'

  const handleKey = (e: React.KeyboardEvent) => {
    if (!isInteractive) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.()
    }
  }

  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? `${card.label}: ${card.value} — bekijk details` : undefined}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={handleKey}
      className={`grid grid-cols-[92px_1fr] items-center gap-2 py-1.5 ${
        isInteractive ? 'cursor-pointer rounded-lg hover:bg-white/60' : ''
      } ${comingSoon ? 'opacity-60' : ''}`}
    >
      <span className="text-right text-[10px] font-extrabold uppercase tracking-wide leading-tight text-slate-500">
        {card.label}
      </span>
      <div className="relative h-[30px]">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200" />
        <div
          className={`absolute top-1 h-[22px] rounded-[7px] flex items-center ${fillColor} ${
            side === 'neg' ? 'right-1/2 justify-end' : 'left-1/2'
          }`}
          style={{ width: `${widthPct / 2}%` }}
        >
          <span className="px-2 text-[11px] font-extrabold text-white whitespace-nowrap">{ptsLabel}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create Storybook story**

```tsx
// frontend/src/stories/parcel/BijdrageBar.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { BijdrageBar } from '@/components/map/panels/parcel/BijdrageBar'

const meta: Meta<typeof BijdrageBar> = {
  title: 'Parcel/BijdrageBar',
  component: BijdrageBar,
}
export default meta
type Story = StoryObj<typeof BijdrageBar>

const base = { label: 'ONDERBENUTTING', value: '62% VRIJ', sub: '± 840 m² marge', factor_key: 'vrije_grond', bron: 'fysiek' as const }

export const Positive: Story = {
  args: { card: { ...base, pts: 8.5 }, tone: 'positive', maxAbs: 8.5, onClick: () => {} },
}
export const Negative: Story = {
  args: { card: { label: 'PARKEERDRUK', value: 'HOOG', sub: 'norm 1.5/woning', pts: -2.8, factor_key: 'parkeerdruk', bron: 'planologisch' }, tone: 'negative', maxAbs: 8.5, onClick: () => {} },
}
export const ComingSoon: Story = {
  args: { card: { label: 'WOONDEAL', value: '—', sub: 'Woondeal Limburg', pts: 0, factor_key: 'woondeal_boost', bron: 'gemeente_beleid' }, tone: 'positive', maxAbs: 8.5, comingSoon: true },
}
```

- [ ] **Step 7: Typecheck + commit**

Run: `cd frontend && npm run check`
Expected: exit 0.

```bash
git add frontend/src/components/map/panels/parcel/lib/factor-detail.ts \
        frontend/src/components/map/panels/parcel/lib/__tests__/factor-detail.test.ts \
        frontend/src/components/map/panels/parcel/BijdrageBar.tsx \
        frontend/src/stories/parcel/BijdrageBar.stories.tsx
git commit -m "M054/S03: BijdrageBar diverging-balk component + geometry"
```

---

### Task 3: `FactorExplainBody` — generieke uitleg-drawer-body

Extraheert de expanded-render uit `ScoreBreakdownModal`'s interne `FactorCard` (regels 391-499) naar een herbruikbare body voor niet-cascade-factoren.

**Files:**
- Create: `frontend/src/components/map/panels/parcel/FactorExplainBody.tsx`
- Modify: `frontend/src/components/map/panels/parcel/lib/factor-detail.ts` (add `hasExplainContent`)
- Modify: `frontend/src/components/map/panels/parcel/lib/__tests__/factor-detail.test.ts`
- Create: `frontend/src/stories/parcel/FactorExplainBody.stories.tsx`

**Interfaces:**
- Consumes: `ScoreFactor`, `formatFactorName`, `isWijkBreed` from `./lib/factor-detail`.
- Produces: `hasExplainContent(factor: ScoreFactor): boolean`; `function FactorExplainBody(props: { name: string; factor: ScoreFactor }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

```ts
// append to lib/__tests__/factor-detail.test.ts
import { hasExplainContent } from '../factor-detail'

const factor = (over = {}) => ({
  categorie: 'potentie', waarde: null, genormaliseerde_score: 70, gewicht: 10,
  bijdrage: 7, toelichting_kort: 'kort', toelichting_lang: null, missing: false,
  data_bronnen: null, succeskans_missing: null, succeskans_reason: null,
  dev_type_ruling_count: null, total_ruling_count: null, percentage_of_category: null,
  ...over,
})

describe('hasExplainContent', () => {
  it('is true when toelichting_lang is present', () => {
    expect(hasExplainContent(factor({ toelichting_lang: 'lange uitleg' }))).toBe(true)
  })
  it('is true when data_bronnen is non-empty', () => {
    expect(hasExplainContent(factor({ data_bronnen: ['CBS StatLine'] }))).toBe(true)
  })
  it('is false when only the short label exists', () => {
    expect(hasExplainContent(factor())).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/map/panels/parcel/lib/__tests__/factor-detail.test.ts`
Expected: FAIL — "hasExplainContent is not a function".

- [ ] **Step 3: Implement `hasExplainContent` in `factor-detail.ts`**

```ts
import type {} from './factor-detail' // (no-op; keep ScoreFactor in same file)

/** True when a factor carries body content worth a drawer (lang text or sources). */
export function hasExplainContent(factor: ScoreFactor): boolean {
  return (
    Boolean(factor.toelichting_lang) ||
    (factor.data_bronnen !== null && factor.data_bronnen.length > 0) ||
    (factor.dev_type_ruling_count !== null && factor.total_ruling_count !== null)
  )
}
```

(Place it in the same module as `ScoreFactor`; remove the stray import line above — it is illustrative only. `ScoreFactor` is already in scope.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/map/panels/parcel/lib/__tests__/factor-detail.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `FactorExplainBody.tsx`**

Build the body from the existing render in `ScoreBreakdownModal.tsx:391-499`: factor title (`formatFactorName`), short text, missing-reason, the score-opbouw line (`genormaliseerde_score` + `percentage_of_category`), `toelichting_lang`, ruling-count line, and `data_bronnen` chips + wijk-breed tag. Unlike the modal it renders **always expanded** (it lives inside the drawer, not a collapsible row). Aura tokens only.

```tsx
import { MapPin } from 'lucide-react'
import { type ScoreFactor, formatFactorName, isWijkBreed } from './lib/factor-detail'

export function FactorExplainBody({ name, factor }: { name: string; factor: ScoreFactor }) {
  const score = factor.genormaliseerde_score
  return (
    <div className="space-y-5">
      <header>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Factor</p>
        <h2 className="mt-1 text-xl font-extrabold tracking-tight text-[#0E1111]">{formatFactorName(name)}</h2>
      </header>

      {/* Wat meet deze factor */}
      <section className="space-y-1.5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">Wat meet deze factor</p>
        <p className="text-sm leading-relaxed text-slate-600">
          {factor.toelichting_lang ?? factor.toelichting_kort ?? 'Geen toelichting beschikbaar.'}
        </p>
        {factor.dev_type_ruling_count !== null && factor.total_ruling_count !== null && (
          <p className="text-xs italic text-slate-500">
            Gebaseerd op {factor.dev_type_ruling_count} van {factor.total_ruling_count} uitspraken na filtering op dev-types.
          </p>
        )}
      </section>

      {/* Score-opbouw */}
      <section className="space-y-1.5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">Score-opbouw</p>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-600">Genormaliseerd: <b className="text-[#0E1111] tabular-nums">{score !== null ? Math.round(score) : '—'}</b></span>
          {factor.gewicht !== null && (
            <span className="text-slate-600">Gewicht: <b className="text-[#0E1111] tabular-nums">{factor.gewicht}</b></span>
          )}
          {factor.bijdrage !== null && (
            <span className="text-slate-600">Bijdrage: <b className="text-[#0E1111] tabular-nums">{factor.bijdrage > 0 ? `+${factor.bijdrage}` : factor.bijdrage}</b></span>
          )}
        </div>
        {factor.percentage_of_category !== null && (
          <p className="text-xs text-slate-500">{Math.round(factor.percentage_of_category * 100)}% van deze categorie.</p>
        )}
      </section>

      {/* Databron */}
      {factor.data_bronnen && factor.data_bronnen.length > 0 && (
        <section className="space-y-2">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">Databron</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {factor.data_bronnen.map((bron) => (
              <span key={bron} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">{bron}</span>
            ))}
            {isWijkBreed(factor.data_bronnen) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#D1E2D8] px-2.5 py-1 text-xs font-semibold text-[#2D5F4C]">
                <MapPin size={11} strokeWidth={2} /> Wijk-breed
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Create Storybook story** (covers: full factor, missing factor)

```tsx
// frontend/src/stories/parcel/FactorExplainBody.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { FactorExplainBody } from '@/components/map/panels/parcel/FactorExplainBody'

const meta: Meta<typeof FactorExplainBody> = { title: 'Parcel/FactorExplainBody', component: FactorExplainBody }
export default meta
type Story = StoryObj<typeof FactorExplainBody>

const full = {
  categorie: 'risico' as const, waarde: null, genormaliseerde_score: 35, gewicht: 4, bijdrage: -2.8,
  toelichting_kort: 'Verhoogde parkeerdruk', toelichting_lang: 'De parkeernorm voor dit gebied is 1,5 plaats per woning…',
  missing: false, data_bronnen: ['Nota parkeernormen Venlo', 'CBS StatLine'], succeskans_missing: null,
  succeskans_reason: null, dev_type_ruling_count: null, total_ruling_count: null, percentage_of_category: 0.18,
}
export const Full: Story = { args: { name: 'parkeerdruk', factor: full } }
export const Missing: Story = {
  args: { name: 'optoppotentie', factor: { ...full, missing: true, toelichting_lang: 'Geen DSO-hoogtedata beschikbaar; score op neutraal gezet.', data_bronnen: ['PLU WMS', '3D BAG'], bijdrage: 0, genormaliseerde_score: null } },
}
```

- [ ] **Step 7: Typecheck + commit**

Run: `cd frontend && npm run check && npx vitest run src/components/map/panels/parcel/lib/__tests__/factor-detail.test.ts`
Expected: exit 0 + PASS.

```bash
git add frontend/src/components/map/panels/parcel/FactorExplainBody.tsx \
        frontend/src/components/map/panels/parcel/lib/factor-detail.ts \
        frontend/src/components/map/panels/parcel/lib/__tests__/factor-detail.test.ts \
        frontend/src/stories/parcel/FactorExplainBody.stories.tsx
git commit -m "M054/S03: FactorExplainBody — generic factor detail body"
```

---

### Task 4: `FactorDetailDrawer` — gedeelde rechter slide-in chrome + refactor 5 popups

Extraheert de identieke drawer-chrome (nu 5× herhaald) naar één component en herschrijft de 5 cascade-popups erop. Geen gedragswijziging voor de cascades.

**Files:**
- Create: `frontend/src/components/map/panels/parcel/FactorDetailDrawer.tsx`
- Modify: `OmgevingsvisiePopup.tsx`, `WoonvisiePopup.tsx`, `HuisvestingsverordeningPopup.tsx`, `GrondprijsPopup.tsx`, `ParkeernormenPopup.tsx` (vervang lokale chrome door `<FactorDetailDrawer>`)
- Create: `frontend/src/stories/parcel/FactorDetailDrawer.stories.tsx`

**Interfaces:**
- Produces: `function FactorDetailDrawer(props: { isOpen: boolean; onClose: () => void; children: React.ReactNode }): JSX.Element | null`.
- Consumes: niets nieuws.

- [ ] **Step 1: Create `FactorDetailDrawer.tsx`**

Lift the chrome verbatim from `OmgevingsvisiePopup.tsx:315-360` (portal, `AnimatePresence`, backdrop `bg-black/30 backdrop-blur-md justify-end`, panel `x:'100%'→0` `max-w-[680px] rounded-l-[32px] shadow-2xl`, close button, scroll container `px-12 py-12`), and add an `Esc`-to-close handler.

```tsx
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface FactorDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function FactorDetailDrawer({ isOpen, onClose, children }: FactorDetailDrawerProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="factor-drawer-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-stretch justify-end bg-black/30 backdrop-blur-md"
        onClick={onClose}
        role="dialog" aria-modal="true"
      >
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex h-full w-full max-w-[680px] flex-col rounded-l-[32px] bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button" onClick={onClose} aria-label="Sluiten"
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-[#F2F6F3] hover:text-[#0E1111]"
          >
            <X size={14} strokeWidth={2} />
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto px-12 py-12">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
```

- [ ] **Step 2: Refactor `OmgevingsvisiePopup.tsx`**

Replace the body of the exported `OmgevingsvisiePopup` (the `createPortal(...)` chrome at `:315-360`) with:

```tsx
import { FactorDetailDrawer } from './FactorDetailDrawer'
// ...
export function OmgevingsvisiePopup({ isOpen, onClose, gemeente, tijdshorizon, matched_policy, algemeen_citaat, verdict, randvoorwaarden }: OmgevingsvisiePopupProps) {
  return (
    <FactorDetailDrawer isOpen={isOpen} onClose={onClose}>
      <OmgevingsvisieDetailContent
        gemeente={gemeente} tijdshorizon={tijdshorizon} matched_policy={matched_policy}
        algemeen_citaat={algemeen_citaat} verdict={verdict} randvoorwaarden={randvoorwaarden}
      />
    </FactorDetailDrawer>
  )
}
```

Remove the now-unused `createPortal` / `motion` / `AnimatePresence` / `X` imports from this file **only if** no other code in the file still uses them (the `*DetailContent` body does not). Keep `OmgevingsvisieDetailContent` and all exported types/functions intact.

- [ ] **Step 3: Repeat Step 2 for the other four popups**

Apply the identical transform to `WoonvisiePopup.tsx`, `HuisvestingsverordeningPopup.tsx`, `GrondprijsPopup.tsx`, `ParkeernormenPopup.tsx`: wrap their existing `*DetailContent` (with the exact same props they pass today) in `<FactorDetailDrawer isOpen={isOpen} onClose={onClose}>`, and drop the duplicated chrome + now-unused imports. Do not touch their `*DetailContent` bodies or exported logic.

- [ ] **Step 4: Run existing popup tests + typecheck**

Run: `cd frontend && npx vitest run src/components/map/panels/parcel/__tests__ && npm run check`
Expected: PASS (the 4 popup logic-tests are unaffected — they test exported pure functions) and exit 0.

- [ ] **Step 5: Create Storybook story**

```tsx
// frontend/src/stories/parcel/FactorDetailDrawer.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { FactorDetailDrawer } from '@/components/map/panels/parcel/FactorDetailDrawer'

const meta: Meta<typeof FactorDetailDrawer> = { title: 'Parcel/FactorDetailDrawer', component: FactorDetailDrawer }
export default meta
type Story = StoryObj<typeof FactorDetailDrawer>
export const Open: Story = {
  args: { isOpen: true, onClose: () => {}, children: <div className="text-sm text-slate-600">Drawer-inhoud</div> },
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/map/panels/parcel/FactorDetailDrawer.tsx \
        frontend/src/components/map/panels/parcel/OmgevingsvisiePopup.tsx \
        frontend/src/components/map/panels/parcel/WoonvisiePopup.tsx \
        frontend/src/components/map/panels/parcel/HuisvestingsverordeningPopup.tsx \
        frontend/src/components/map/panels/parcel/GrondprijsPopup.tsx \
        frontend/src/components/map/panels/parcel/ParkeernormenPopup.tsx \
        frontend/src/stories/parcel/FactorDetailDrawer.stories.tsx
git commit -m "M054/S03: FactorDetailDrawer shared chrome; refactor 5 cascade popups onto it"
```

---

### Task 5: Wire `PotentieLayer` → Bijdrage-bars + uniforme drawer; retire `onOpen*`

**Files:**
- Modify: `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx`
- Verify: `frontend/src/components/map/panels/parcel/layers/__tests__/PotentieLayer.factor-coverage.test.tsx`

**Interfaces:**
- Consumes: `BijdrageBar`, `FactorDetailDrawer`, `FactorExplainBody`, `parseFactors`, `isCascadeFactor` from the new modules; `sortByWeight`, `PLANNED_POTENTIE` (unchanged); existing `WoonvisiePopup`/`OmgevingsvisiePopup`/`GrondprijsPopup` (now drawer-wrapped).
- Produces: `PotentieLayer` props lose `onOpenOmgevingsvisie` and `onOpenWoonvisie`.

- [ ] **Step 1: Check the coverage test still describes pure builders**

Run: `cd frontend && sed -n '1,40p' src/components/map/panels/parcel/layers/__tests__/PotentieLayer.factor-coverage.test.tsx`
Expected: it asserts on `buildPotentieCards` (pure) — unaffected by the render change. If it asserts on `onOpen*` props, update those expectations in Step 5.

- [ ] **Step 2: Remove `onOpen*` props + add unified state**

In `PotentieLayer.tsx`: delete `onOpenOmgevingsvisie?` / `onOpenWoonvisie?` from `PotentieLayerProps` and the function signature. Replace the three `useState` open-flags (`woonvisieOpen`, `omgevingsvisieOpen`, `grondprijsOpen`) with:

```tsx
const [activeFactorKey, setActiveFactorKey] = useState<string | null>(null)
```

Keep the existing `hasWoonvisieData` / `hasOmgevingsvisieData` / `hasGrondprijsData` guards and the `*Waarde` extractions.

- [ ] **Step 3: Rewrite `cardClick` to always open the drawer**

```tsx
function cardClick(card: PageCard): (() => void) | undefined {
  // Cascade cards only clickable when their data is present (verdict-gated).
  if (card.factor_key === 'woonvisie_match' && !hasWoonvisieData) return undefined
  if (card.factor_key === 'beleidsalignement' && !hasOmgevingsvisieData) return undefined
  if (card.factor_key === 'grondwaarde_fit' && !hasGrondprijsData) return undefined
  return () => setActiveFactorKey(card.factor_key)
}
```

- [ ] **Step 4: Replace the FactorCard list with BijdrageBars**

Compute `maxAbs` once and render bars. Replace the `sortedCards.map(...) <FactorCard .../>` block (`:481-490`) with:

```tsx
const maxAbs = Math.max(1, ...sortedCards.map((c) => Math.abs(c.pts)))
// ...
{sortedCards.map((card) => (
  <BijdrageBar
    key={card.factor_key}
    card={card}
    tone="positive"
    maxAbs={maxAbs}
    onClick={cardClick(card)}
  />
))}
```

Keep the "Binnenkort" placeholder section, but render each planned item as `<BijdrageBar ... comingSoon tone={planned.tone} maxAbs={maxAbs} card={{ label: planned.label, value: '—', sub: planned.source, pts: 0, factor_key: planned.key, bron: planned.bron }} />`.

- [ ] **Step 5: Replace the three popup mounts with one dispatching drawer**

Remove the three conditional `<WoonvisiePopup>` / `<OmgevingsvisiePopup>` / `<GrondprijsPopup>` blocks (`:508-549`). The drawer now renders once, dispatching by key. Cascades keep their dedicated editorial popups (already drawer-wrapped from Task 4) driven off `activeFactorKey`; everything else uses `FactorExplainBody`:

```tsx
const factors = parseFactors(parcel.score_breakdown as Record<string, unknown> | null)
const activeFactor = activeFactorKey
  ? factors.potentie.find((f) => f.name === activeFactorKey)?.factor ?? null
  : null
const close = () => setActiveFactorKey(null)
// ...
{/* Cascades: their own editorial popup, opened when their key is active */}
{hasWoonvisieData && (
  <WoonvisiePopup
    isOpen={activeFactorKey === 'woonvisie_match'} onClose={close}
    gemeente={gemeenteNaam} periode_start={woonvisieWaarde!.periode_start ?? 0}
    periode_einde={woonvisieWaarde!.periode_einde ?? 0} matched_policy={woonvisieWaarde!.matched_policy}
    algemeen_citaat={woonvisieWaarde!.algemeen_citaat ?? ''} project_type={projectType}
    randvoorwaarden={woonvisieWaarde!.randvoorwaarden}
  />
)}
{hasOmgevingsvisieData && (
  <OmgevingsvisiePopup
    isOpen={activeFactorKey === 'beleidsalignement'} onClose={close}
    gemeente={gemeenteNaam} tijdshorizon={omgevingsvisieWaarde!.tijdshorizon ?? 0}
    matched_policy={omgevingsvisieWaarde!.matched_policy} algemeen_citaat={omgevingsvisieWaarde!.algemeen_citaat ?? ''}
    project_type={projectType} verdict={omgevingsvisieWaarde!.verdict as BeleidsVerdict | undefined}
    randvoorwaarden={omgevingsvisieWaarde?.randvoorwaarden}
  />
)}
{hasGrondprijsData && (
  <GrondprijsPopup isOpen={activeFactorKey === 'grondwaarde_fit'} onClose={close} gemeente={gemeenteNaam}
    verdict={grondprijsWaarde!.verdict} grondproduct={grondprijsWaarde!.grondproduct}
    functiecategorie={grondprijsWaarde!.functiecategorie} prijs_per_m2_min={grondprijsWaarde!.prijs_per_m2_min}
    prijs_per_m2_max={grondprijsWaarde!.prijs_per_m2_max} prijsgrondslag={grondprijsWaarde!.prijsgrondslag}
    peiljaar={grondprijsWaarde!.peiljaar} grondbeleidstype={grondprijsWaarde!.grondbeleidstype}
    erfpacht_mogelijk={grondprijsWaarde!.erfpacht_mogelijk} randvoorwaarden={grondprijsWaarde!.randvoorwaarden} />
)}
{/* Generic factors: one shared explain-drawer */}
{activeFactorKey && !isCascadeFactor(activeFactorKey) && activeFactor && (
  <FactorDetailDrawer isOpen onClose={close}>
    <FactorExplainBody name={activeFactorKey} factor={activeFactor} />
  </FactorDetailDrawer>
)}
```

- [ ] **Step 6: Typecheck + run coverage test**

Run: `cd frontend && npm run check && npx vitest run src/components/map/panels/parcel/layers/__tests__/PotentieLayer.factor-coverage.test.tsx`
Expected: exit 0 + PASS. If `npm run check` flags unused imports (`FactorCard`), remove them.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx
git commit -m "M054/S03: PotentieLayer — bijdrage-bars + unified factor drawer; drop in-panel drill-down props"
```

---

### Task 6: Wire `RisicoLayer` → Bijdrage-bars + uniforme drawer

Same transform as Task 5, for the risico side (cascades: `splitsingsrisico`, `parkeerdruk`; tone `negative`). `RisicoLayer` has no `onOpen*` props to remove.

**Files:**
- Modify: `frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx`
- Verify: `frontend/src/components/map/panels/parcel/layers/__tests__/RisicoLayer.factor-coverage.test.tsx`

**Interfaces:**
- Consumes: same new modules; `buildRisicoCards`, `sortByWeight`, `PLANNED_RISICO` unchanged; `HuisvestingsverordeningPopup`, `ParkeernormenPopup` (drawer-wrapped).

- [ ] **Step 1: Add unified state**

Replace `splitsOpen` / `parkeerOpen` `useState` with `const [activeFactorKey, setActiveFactorKey] = useState<string | null>(null)`. Keep `hasSplitsData` / `hasParkeerData` guards.

- [ ] **Step 2: Rewrite `cardClick`**

```tsx
function cardClick(card: PageCard): (() => void) | undefined {
  if (card.factor_key === 'splitsingsrisico' && !hasSplitsData) return undefined
  if (card.factor_key === 'parkeerdruk' && !hasParkeerData) return undefined
  return () => setActiveFactorKey(card.factor_key)
}
```

- [ ] **Step 3: Replace FactorCard list with BijdrageBars (`tone="negative"`)**

Mirror Task 5 Step 4: compute `const maxAbs = Math.max(1, ...sortedCards.map((c) => Math.abs(c.pts)))`, render `<BijdrageBar ... tone="negative" maxAbs={maxAbs} onClick={cardClick(card)} />`, and the `PLANNED_RISICO` placeholders as `comingSoon` bars.

- [ ] **Step 4: Replace the two popup mounts with the dispatching drawer**

```tsx
const factors = parseFactors(parcel.score_breakdown as Record<string, unknown> | null)
const activeFactor = activeFactorKey
  ? factors.risico.find((f) => f.name === activeFactorKey)?.factor ?? null
  : null
const close = () => setActiveFactorKey(null)
// ...
{hasSplitsData && (
  <HuisvestingsverordeningPopup isOpen={activeFactorKey === 'splitsingsrisico'} onClose={close} /* …existing props verbatim… */ />
)}
{hasParkeerData && (
  <ParkeernormenPopup isOpen={activeFactorKey === 'parkeerdruk'} onClose={close} /* …existing props verbatim… */ />
)}
{activeFactorKey && !isCascadeFactor(activeFactorKey) && activeFactor && (
  <FactorDetailDrawer isOpen onClose={close}>
    <FactorExplainBody name={activeFactorKey} factor={activeFactor} />
  </FactorDetailDrawer>
)}
```

Keep the exact prop-lists currently passed to `HuisvestingsverordeningPopup` and `ParkeernormenPopup`; only `isOpen`/`onClose` change to the unified state.

- [ ] **Step 5: Typecheck + coverage test**

Run: `cd frontend && npm run check && npx vitest run src/components/map/panels/parcel/layers/__tests__/RisicoLayer.factor-coverage.test.tsx`
Expected: exit 0 + PASS. Remove unused `FactorCard` import if flagged.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx
git commit -m "M054/S03: RisicoLayer — bijdrage-bars + unified factor drawer"
```

---

### Task 7: Retire the parent in-panel view-stack + full verification

Removes the now-dead in-panel "overvloei" drill-down from `ParcelDetailPanel` (the `setView({ kind: 'omgevingsvisie' | 'woonvisie' })` branches) and runs the full gate.

**Files:**
- Modify: `frontend/src/components/map/panels/ParcelDetailPanel.tsx`

**Interfaces:**
- Consumes: `PotentieLayer` (no longer accepts `onOpen*`).

- [ ] **Step 1: Remove the `onOpen*` props passed to `PotentieLayer`**

Delete lines `:157-158` (`onOpenOmgevingsvisie={…}` / `onOpenWoonvisie={…}`). `PotentieLayer` is now `<PotentieLayer parcel={parcel} gemeenteNaam={…} />` (keep whatever non-drill-down props it still takes).

- [ ] **Step 2: Remove the in-panel view-stack branches**

Delete the `view.kind === 'omgevingsvisie'` and `view.kind === 'woonvisie'` render branches (around `:185` and `:216`, including the inline `<OmgevingsvisieDetailContent>` / `<WoonvisieDetailContent>` usage and their data-extraction). Remove the `'omgevingsvisie'` / `'woonvisie'` members from the `view` discriminated-union type and any `setView` calls that set them. Then remove the now-unused imports `OmgevingsvisieDetailContent` / `WoonvisieDetailContent` (`:16-17`) **if** nothing else in the file uses them.

- [ ] **Step 3: Full typecheck + complete frontend test run**

Run: `cd frontend && npm run check && npx vitest run`
Expected: `npm run check` exit 0; all Vitest suites pass (factor-detail, factor-list, the 4 popup suites, both layer coverage suites).

- [ ] **Step 4: Visual verification (per `feedback_screenshot_before_push`)**

Start the dev server (port 9300) and open a Venlo parcel; confirm: both tabs show the bijdrage-bars, every bar opens a right-side drawer, cascades show editorial content, generic factors show the explain-body, `Esc`/backdrop close. Capture a screenshot to show the user before push.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/map/panels/ParcelDetailPanel.tsx
git commit -m "M054/S03: retire in-panel drill-down view-stack (unified on right drawer)"
```

---

## Self-Review

**Spec coverage:**
- Variant C layout → Tasks 2 (component) + 5/6 (wired into both tabs). ✅
- Uniforme rechter drawer → Task 4 (chrome) + 5/6 (dispatch). ✅
- Elke factor klikbaar, generieke uitleg uit bestaande velden → Task 3 (`FactorExplainBody`) + 5/6 (dispatch for non-cascades). ✅
- Cascades behouden editorial 1:1 → Task 4 wraps existing `*DetailContent` unchanged. ✅
- In-panel "overvloei" vervalt → Task 7. ✅
- Gedeelde parser i.p.v. duplicatie → Task 1. ✅
- LOCKED-pattern / SCHEMA_VERSION onaangeroerd → geen datawijziging in enige taak. ✅
- Tests = node-env pure-logic → Tasks 1-3 unit-test exported pure functions; components via Storybook + tsc. ✅

**Placeholder scan:** Task 3 Step 3 contains an illustrative `import {} from './factor-detail'` line that is explicitly flagged as a no-op to delete — not a real placeholder. The "…existing props verbatim…" notes in Tasks 5/6 refer to prop-lists already shown in full in this plan (PotentieLayer Step 5) and in the current code; the implementer copies them unchanged. No TBD/TODO remain.

**Type consistency:** `ScoreFactor`, `parseFactors`, `isCascadeFactor`, `hasExplainContent`, `barGeometry` are defined in Task 1-3 and consumed with matching signatures in Tasks 2,3,5,6. `PageCard` shape (`{label,value,sub,pts,factor_key,bron,missing?}`) is used consistently in `BijdrageBar` and both layers. `FactorDetailDrawer` props (`isOpen,onClose,children`) match all call sites.
