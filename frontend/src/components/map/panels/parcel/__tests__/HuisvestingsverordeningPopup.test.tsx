/**
 * HuisvestingsverordeningPopup — node-env unit tests (M053/S12).
 *
 * Project convention (vite.config.ts `unit` project): pure-logic tests in node
 * env, NO jsdom and NO @testing-library/react. React rendering is covered by
 * Storybook play functions (HuisvestingsverordeningPopup.stories.tsx). Mirrors
 * the OmgevingsvisiePopup test precedent.
 *
 * Since the popup body is verdict-driven (no exported pure helpers like
 * alignmentSentence), these tests structurally assert the component source
 * carries the right verdict copy, the early-return guard, and reuses
 * RandvoorwaardenSection. The DOM-level focal-line + randvoorwaarden rendering
 * is asserted in the Storybook play functions.
 */
import { describe, it, expect } from 'vitest'

async function readSource(): Promise<string> {
  const fs = await import('node:fs/promises')
  return fs.readFile(new URL('../HuisvestingsverordeningPopup.tsx', import.meta.url), 'utf-8')
}

/* ── Test 1: renders nothing when closed ────────────────────────── */

describe('HuisvestingsverordeningPopup — isOpen=false', () => {
  it('renders nothing when closed — component returns null when isOpen is false', async () => {
    const src = await readSource()
    expect(src).toMatch(/if\s*\(!isOpen\)\s*return null/)
  })
})

/* ── Test 2: reuses the locked RandvoorwaardenSection ───────────── */

describe('HuisvestingsverordeningPopup — shared randvoorwaarden', () => {
  it('imports RandvoorwaardenSection from OmgevingsvisiePopup (single source of truth)', async () => {
    const src = await readSource()
    expect(src).toMatch(/import\s*\{[^}]*RandvoorwaardenSection[^}]*\}\s*from\s*['"]\.\/OmgevingsvisiePopup['"]/)
    expect(src).toMatch(/<RandvoorwaardenSection randvoorwaarden=\{randvoorwaarden\}/)
  })
})

/* ── Test 3: verdict copy — each verdict produces its focal line ── */

describe('HuisvestingsverordeningPopup — verdict copy coverage', () => {
  const VERDICTS = [
    'van_toepassing',
    'mogelijk_van_toepassing',
    'vergunningstelsel_voorraad',
    'boven_woz_grens',
    'buiten_beschermd_gebied',
    'niet_van_toepassing',
    'geen_regeling',
  ]

  it('switch handles every backend verdict', async () => {
    const src = await readSource()
    for (const v of VERDICTS) {
      // each verdict (except geen_regeling, which is the default) has a case label
      if (v === 'geen_regeling') {
        expect(src).toMatch(/case 'geen_regeling':/)
      } else {
        expect(src, `missing case '${v}'`).toContain(`case '${v}':`)
      }
    }
  })

  it('van_toepassing carries the verhuurverbod focal line', async () => {
    const src = await readSource()
    expect(src).toMatch(/Verhuurverbod \$\{duur_jaren\} jaar na aankoop/)
  })

  it('mogelijk_van_toepassing notes the unknown WOZ-waarde', async () => {
    const src = await readSource()
    expect(src).toMatch(/WOZ-waarde is onbekend/)
  })

  it('vergunningstelsel_voorraad describes procesrisico without verbod', async () => {
    const src = await readSource()
    expect(src).toMatch(/procesrisico, geen verbod/)
  })

  it('boven_woz_grens / buiten_beschermd_gebied / niet_van_toepassing carry neutral one-liners', async () => {
    const src = await readSource()
    expect(src).toMatch(/opkoopbescherming niet van toepassing/)
    expect(src).toMatch(/Buiten de aangewezen opkoopbeschermings-buurten/)
    expect(src).toMatch(/opkoopbescherming geldt voor bestaande woonruimte/)
  })

  it('geen_regeling / unknown falls back to "geen opkoopbescherming"', async () => {
    const src = await readSource()
    expect(src).toMatch(/Geen opkoopbescherming in deze gemeente/)
  })
})

/* ── Test 4: EUR formatting uses nl-NL ──────────────────────────── */

describe('HuisvestingsverordeningPopup — EUR formatting', () => {
  it('formats the woz-grens with nl-NL EUR formatting', async () => {
    const src = await readSource()
    expect(src).toMatch(/Intl\.NumberFormat\('nl-NL'/)
    expect(src).toMatch(/currency:\s*'EUR'/)
  })
})
