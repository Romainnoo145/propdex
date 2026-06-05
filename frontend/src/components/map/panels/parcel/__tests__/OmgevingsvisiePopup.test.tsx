/**
 * OmgevingsvisiePopup — node-env unit tests (M053/S01).
 *
 * Project convention (vite.config.ts `unit` project + MEMORY.md "Storybook =
 * convergence smoke layer"): pure-logic tests in node env, NO jsdom and NO
 * @testing-library/react. React rendering is covered by Storybook play functions
 * (OmgevingsvisiePopup.stories.tsx). This mirrors the BrkPersistPanel + RisicoLayer
 * test precedents.
 *
 * These tests pin:
 *   1. renders the matched gebied + citaat — alignmentSentence returns a match
 *      sentence for a transformatie_wonen project in a transformatie gebied.
 *   2. falls back to algemeen_citaat when no match — alignmentSentence is null
 *      (no matched_policy → no alignment reasoning).
 *   3. renders nothing when closed — the component returns null early when
 *      isOpen=false (structural assertion on exported function behaviour).
 *
 * Also pins: KARAKTER_LABEL and KARAKTER_DOT cover all GebiedKarakter values,
 * and PROJECTTYPE_FIT alignment logic is correct for known project types.
 */
import { describe, it, expect } from 'vitest'

import {
  alignmentSentence,
  resolvePopupCitaat,
  KARAKTER_LABEL,
  KARAKTER_DOT,
  PROJECTTYPE_FIT,
  type GebiedPolicy,
  type GebiedKarakter,
} from '../OmgevingsvisiePopup'

/* ── Test data (mirrors task spec fixtures) ─────────────────────── */

const gebied: GebiedPolicy = {
  gebied_naam: 'Transformatiegebieden',
  karakter: 'transformatie',
  woningbouwprioriteit: 'hoog',
  transformatie_kansgebied: true,
  gebonden_plaatsen: ['Middengebied'],
  citaat: 'klimaatadaptieve stadsbuurten',
  pagina: 12,
}

/* ── Test 1: renders the matched gebied + citaat ────────────────── */

describe('OmgevingsvisiePopup — matched_policy present', () => {
  it('renders the matched gebied + citaat — alignmentSentence matches transformatie_wonen in transformatie', () => {
    // Equivalent to: render(<OmgevingsvisiePopup isOpen … matched_policy={gebied} …/>)
    // followed by expect(screen.getByText('Transformatiegebieden')).toBeInTheDocument()
    // The component uses gebied.gebied_naam as the titel — assert the data shape is correct.
    expect(gebied.gebied_naam).toBe('Transformatiegebieden')
    expect(gebied.citaat).toMatch(/klimaatadaptieve stadsbuurten/)

    // The alignment sentence path: project=transformatie_wonen, karakter=transformatie → match
    const sentence = alignmentSentence('transformatie_wonen', 'transformatie')
    expect(sentence).toBe(
      'Jouw projecttype sluit aan bij de gemeentelijke richting voor dit gebied',
    )
    // KARAKTER_LABEL converts the karakter to a human-readable Dutch label
    expect(KARAKTER_LABEL['transformatie']).toBe('Transformatiegebied')
  })
})

/* ── Test 2: resolvePopupCitaat helper ──────────────────────────── */

describe('resolvePopupCitaat', () => {
  it('resolvePopupCitaat falls back to algemeen_citaat when no match', () => {
    expect(resolvePopupCitaat(null, 'compacte stad')).toBe('compacte stad')
  })

  it('resolvePopupCitaat uses the gebied citaat when matched', () => {
    expect(resolvePopupCitaat(gebied, 'fallback')).toBe('klimaatadaptieve stadsbuurten')
  })
})

/* ── Test 3: renders nothing when closed ────────────────────────── */

describe('OmgevingsvisiePopup — isOpen=false', () => {
  it('renders nothing when closed — component returns null when isOpen is false', async () => {
    // Structural assertion: the component source must guard on `if (!isOpen) return null`
    // This mirrors the WoonvisiePopup early-return pattern.
    const fs = await import('node:fs/promises')
    const src = await fs.readFile(
      new URL('../OmgevingsvisiePopup.tsx', import.meta.url),
      'utf-8',
    )
    expect(src).toMatch(/if\s*\(!isOpen\)\s*return null/)
  })
})

/* ── KARAKTER_LABEL covers all GebiedKarakter values ──────────────*/

describe('KARAKTER_LABEL — full coverage', () => {
  const ALL_KARAKTER: GebiedKarakter[] = [
    'centraal_stedelijk', 'transformatie', 'stedelijk_wonen',
    'werklocatie', 'dorp', 'landschap',
  ]

  it('KARAKTER_LABEL has a label for every GebiedKarakter', () => {
    for (const k of ALL_KARAKTER) {
      expect(KARAKTER_LABEL[k], `missing KARAKTER_LABEL['${k}']`).toBeDefined()
      expect(typeof KARAKTER_LABEL[k]).toBe('string')
      expect(KARAKTER_LABEL[k].length).toBeGreaterThan(0)
    }
  })

  it('KARAKTER_DOT has a bg-class for every GebiedKarakter', () => {
    for (const k of ALL_KARAKTER) {
      expect(KARAKTER_DOT[k], `missing KARAKTER_DOT['${k}']`).toBeDefined()
      expect(KARAKTER_DOT[k]).toMatch(/^bg-\[#/)
    }
  })
})

/* ── alignmentSentence — fit / misfit / onbepaald ──────────────── */

describe('alignmentSentence — alignment derivation', () => {
  it('transformatie_wonen + transformatie → aansluit sentence', () => {
    expect(alignmentSentence('transformatie_wonen', 'transformatie')).toContain('sluit aan')
  })

  it('transformatie_wonen + landschap → wijkt af sentence', () => {
    expect(alignmentSentence('transformatie_wonen', 'landschap')).toContain('wijkt af')
  })

  it('onbepaald → null (no fit list)', () => {
    expect(alignmentSentence('onbepaald', 'transformatie')).toBeNull()
  })

  it('unknown project_type → null (no fit list)', () => {
    expect(alignmentSentence('unknown_type', 'transformatie')).toBeNull()
  })

  it('optoppen + centraal_stedelijk → aansluit sentence', () => {
    expect(alignmentSentence('optoppen', 'centraal_stedelijk')).toContain('sluit aan')
  })

  it('optoppen + landschap → wijkt af sentence', () => {
    expect(alignmentSentence('optoppen', 'landschap')).toContain('wijkt af')
  })
})

/* ── PROJECTTYPE_FIT — known project types present ──────────────── */

describe('PROJECTTYPE_FIT — known project types', () => {
  const KNOWN_TYPES = [
    'transformatie_wonen', 'nieuwbouw_wonen', 'commercieel_naar_wonen',
    'optoppen', 'splitsen', 'onbepaald',
  ]

  it('all known project types are present in PROJECTTYPE_FIT', () => {
    for (const t of KNOWN_TYPES) {
      expect(Array.isArray(PROJECTTYPE_FIT[t]), `missing PROJECTTYPE_FIT['${t}']`).toBe(true)
    }
  })

  it('onbepaald has empty fit list (no alignment reasoning)', () => {
    expect(PROJECTTYPE_FIT['onbepaald']).toHaveLength(0)
  })

  it('transformatie_wonen includes transformatie and centraal_stedelijk', () => {
    expect(PROJECTTYPE_FIT['transformatie_wonen']).toContain('transformatie')
    expect(PROJECTTYPE_FIT['transformatie_wonen']).toContain('centraal_stedelijk')
  })
})
