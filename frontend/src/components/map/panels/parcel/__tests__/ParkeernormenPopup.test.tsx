/**
 * ParkeernormenPopup — node-env unit tests (M054/S02).
 *
 * Project convention (vite.config.ts `unit` project): pure-logic tests in node
 * env, NO jsdom and NO @testing-library/react. React rendering is covered by
 * Storybook play functions (ParkeernormenPopup.stories.tsx). Mirrors the
 * GrondprijsPopup / HuisvestingsverordeningPopup test precedent.
 */
import { describe, it, expect } from 'vitest'

async function readSource(): Promise<string> {
  const fs = await import('node:fs/promises')
  return fs.readFile(new URL('../ParkeernormenPopup.tsx', import.meta.url), 'utf-8')
}

/* ── Test 1: renders nothing when closed ────────────────────────── */

describe('ParkeernormenPopup — isOpen=false', () => {
  it('returns null when isOpen is false', async () => {
    const src = await readSource()
    expect(src).toMatch(/if\s*\(!isOpen\)\s*return null/)
  })
})

/* ── Test 2: reuses the locked RandvoorwaardenSection ───────────── */

describe('ParkeernormenPopup — shared randvoorwaarden', () => {
  it('imports RandvoorwaardenSection from OmgevingsvisiePopup (single source of truth)', async () => {
    const src = await readSource()
    expect(src).toMatch(/import\s*\{[^}]*RandvoorwaardenSection[^}]*\}\s*from\s*['"]\.\/OmgevingsvisiePopup['"]/)
    expect(src).toMatch(/<RandvoorwaardenSection randvoorwaarden=\{randvoorwaarden\}/)
  })
})

/* ── Test 3: verdict copy — each verdict produces its focal line ── */

describe('ParkeernormenPopup — verdict copy coverage', () => {
  const VERDICTS = ['verhoogd', 'laag', 'geen_match']

  it('switch handles every backend verdict', async () => {
    const src = await readSource()
    for (const v of VERDICTS) {
      if (v === 'geen_match') {
        expect(src).toMatch(/case 'geen_match':/)
      } else {
        expect(src, `missing case '${v}'`).toContain(`case '${v}':`)
      }
    }
  })

  it('verhoogd carries the parkeerdruk-risico focal line', async () => {
    const src = await readSource()
    expect(src).toMatch(/Verhoogd parkeerdruk-risico/)
    expect(src).toMatch(/reëel ontwikkelrisico/)
  })

  it('laag notes a beheersbare parkeereis', async () => {
    const src = await readSource()
    expect(src).toMatch(/Beheersbare parkeereis/)
    expect(src).toMatch(/ruimte om de eis op te lossen/)
  })

  it('geen_match falls back to the neutral one-liner', async () => {
    const src = await readSource()
    expect(src).toMatch(/Geen parkeernorm-band sluit aan op de bestemming/)
  })
})

/* ── Test 4: risico-specific signals surface ────────────────────── */

describe('ParkeernormenPopup — risico signals', () => {
  it('surfaces the fietsnorm harde-eis, centrum-uitsluiting and 0-norm notes', async () => {
    const src = await readSource()
    expect(src).toMatch(/Fietsparkeernorm/)
    expect(src).toMatch(/openbare ruimte uitgesloten/)
    expect(src).toMatch(/kosteloos van de parkeereis af/)
  })
})
