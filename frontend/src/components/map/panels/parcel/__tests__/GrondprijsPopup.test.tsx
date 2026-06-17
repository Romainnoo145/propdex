/**
 * GrondprijsPopup — node-env unit tests (M054/S01).
 *
 * Project convention (vite.config.ts `unit` project): pure-logic tests in node
 * env, NO jsdom and NO @testing-library/react. React rendering is covered by
 * Storybook play functions (GrondprijsPopup.stories.tsx). Mirrors the
 * HuisvestingsverordeningPopup test precedent.
 */
import { describe, it, expect } from 'vitest'

async function readSource(): Promise<string> {
  const fs = await import('node:fs/promises')
  return fs.readFile(new URL('../GrondprijsPopup.tsx', import.meta.url), 'utf-8')
}

/* ── Test 1: renders nothing when closed ────────────────────────── */

describe('GrondprijsPopup — isOpen=false', () => {
  it('returns null when isOpen is false', async () => {
    const src = await readSource()
    expect(src).toMatch(/if\s*\(!isOpen\)\s*return null/)
  })
})

/* ── Test 2: reuses the locked RandvoorwaardenSection ───────────── */

describe('GrondprijsPopup — shared randvoorwaarden', () => {
  it('imports RandvoorwaardenSection from OmgevingsvisiePopup (single source of truth)', async () => {
    const src = await readSource()
    expect(src).toMatch(/import\s*\{[^}]*RandvoorwaardenSection[^}]*\}\s*from\s*['"]\.\/OmgevingsvisiePopup['"]/)
    expect(src).toMatch(/<RandvoorwaardenSection randvoorwaarden=\{randvoorwaarden\}/)
  })
})

/* ── Test 3: verdict copy — each verdict produces its focal line ── */

describe('GrondprijsPopup — verdict copy coverage', () => {
  const VERDICTS = ['passend', 'context', 'geen_match']

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

  it('passend carries the residuele-grondwaarde focal line', async () => {
    const src = await readSource()
    expect(src).toMatch(/Residuele grondwaarde haalbaar/)
    expect(src).toMatch(/volgt het ontwikkelprogramma/)
  })

  it('context notes geen residu-ruimte / faciliterend', async () => {
    const src = await readSource()
    expect(src).toMatch(/geen grond uit/)
    expect(src).toMatch(/geen residu-ruimte/)
  })

  it('geen_match falls back to the neutral one-liner', async () => {
    const src = await readSource()
    expect(src).toMatch(/Geen grondprijsband sluit aan op de bestemming/)
  })
})

/* ── Test 4: EUR formatting uses nl-NL ──────────────────────────── */

describe('GrondprijsPopup — EUR formatting', () => {
  it('formats grondprijs with nl-NL EUR formatting', async () => {
    const src = await readSource()
    expect(src).toMatch(/Intl\.NumberFormat\('nl-NL'/)
    expect(src).toMatch(/currency:\s*'EUR'/)
  })
})
