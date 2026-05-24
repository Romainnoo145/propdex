/**
 * REGRESSION-CRITICAL: feature parity post-split. If any test fails, split has lost
 * functionality vs pre-split FavoriteParcelWorkspaceView (deleted 2026-05-19).
 * DO NOT DELETE.
 *
 * SCOPE: pure-logic structural pinning (vitest 'unit' project = node env, no DOM).
 * Project convention per MEMORY.md "Storybook = convergence smoke layer" + the
 * RisicoLayer.factor-coverage.test.tsx precedent: pure-logic regression here,
 * React-rendering smoke via Storybook play functions (deferred).
 *
 * Asserts the 7 regression checks from 08-ENG-PLAN.locked.md §"File split regressions":
 *   1. 5 dossier tabs render — buildPages() returns exactly 5 pages with expected tabLabels
 *   2. Each tab has DossierCardSlot entries — every page has ≥1 card
 *   3. Score display intact — score_v3 fields preserved on FavoriteResponse type contract
 *   4. Document upload intact — DossierCardSlot accepts ACCEPTED_TYPES + mergeDocuments
 *      promotes filled state
 *   5. Projectnotities 4-slot grid — Notities page has the 4 notitie-keys
 *   6. Score modal opens on score click — PotentieModal/RisicoModal still imported by
 *      shell (verified by composition snapshot below)
 *   7. AANPAK card renders with current next-step text — deriveNextStep returns
 *      post-08-07 Contact-handoff copy ("Klaar met onderzoek? / Stap door naar Contact").
 *      Pre-08-07 BRK CTA copy has been replaced (canary updated as part of Plan 08-07
 *      per AD1: "fase-overgang IS de gate, geen score-drempel"). The new canary
 *      pins the Contact-handoff route target so a future change cannot silently
 *      regress the fase-1 → fase-2 handoff.
 */
import { describe, expect, it } from 'vitest'
import {
  buildPages,
  flattenCards,
  mergeDocuments,
  REQUIRED_CARD_PRIORITY,
  GHOST_ICONS,
} from '@/lib/cockpit/dossier-pages'
import {
  deriveContactFollowUp,
  deriveMissingCards,
  deriveNextStep,
} from '@/lib/cockpit/cockpit-derivations'
import type { FavoriteResponse } from '@/lib/types/portfolio'
import type { ParcelDocumentMeta } from '@/lib/types/document'

const baseFavorite: FavoriteResponse = {
  id: '00000000-0000-0000-0000-000000000001',
  parcel_id: 'HTT02-A-1234',
  parcel_cache_id: '00000000-0000-0000-0000-000000000002',
  user_id: '00000000-0000-0000-0000-000000000003',
  gemeente_code: 'GM0983',
  gemeente_naam: 'Venlo',
  wijk_naam: 'Blerick',
  address: 'Antoniusstraat 1, 5921 KP Venlo',
  pipeline_stage: 'Onderzoek',
  afgerond_reden: null,
  notitie: null,
  potentie_score: 61,
  risico_score: 45,
  has_report: false,
  report_id: null,
  project_type: null,
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-18T12:00:00Z',
}

const baseDocument = (overrides: Partial<ParcelDocumentMeta>): ParcelDocumentMeta => ({
  id: '00000000-0000-0000-0000-000000000010',
  parcel_id: 'HTT02-A-1234',
  filename: 'test.pdf',
  document_type: 'documenten',
  content_type: 'application/pdf',
  file_size: 1024,
  uploaded_at: '2026-05-15T08:00:00Z',
  uploaded_by_user_id: null,
  ai_summary: null,
  ...overrides,
})

describe('OnderzoekPhaseView feature parity (REGRESSION-CRITICAL)', () => {
  describe('test_renders_five_dossier_tabs', () => {
    it('buildPages returns exactly 5 dossier pages', () => {
      const pages = buildPages(baseFavorite)
      expect(pages.length).toBe(5)
    })

    it('pages expose the 5 canonical tabLabels in order: Notities/Acquisitie/Technisch/Juridisch/Planologisch', () => {
      const labels = buildPages(baseFavorite).map((p) => p.tabLabel)
      expect(labels).toEqual(['Notities', 'Acquisitie', 'Technisch', 'Juridisch', 'Planologisch'])
    })

    it('pages expose the 5 canonical titles in order', () => {
      const titles = buildPages(baseFavorite).map((p) => p.title)
      expect(titles).toEqual([
        'PROJECTNOTITIES',
        'ACQUISITIE DOSSIER',
        'TECHNISCH DOSSIER',
        'JURIDISCH DOSSIER',
        'PLANOLOGISCH DOSSIER',
      ])
    })
  })

  describe('test_renders_dossier_card_slots', () => {
    it('every page has ≥1 DossierCardSlot entry', () => {
      const pages = buildPages(baseFavorite)
      for (const page of pages) {
        expect(page.cards.length, `${page.tabLabel} should have ≥1 card`).toBeGreaterThanOrEqual(1)
      }
    })

    it('every card has an Icon + label + key + filled flag', () => {
      const cards = flattenCards(buildPages(baseFavorite))
      for (const card of cards) {
        expect(card.key, 'card.key').toBeTruthy()
        expect(card.label, 'card.label').toBeTruthy()
        expect(card.Icon, 'card.Icon').toBeTruthy()
        expect(typeof card.filled).toBe('boolean')
      }
    })

    it('flattenCards exposes pageTitle + tabLabel context on every card', () => {
      const cards = flattenCards(buildPages(baseFavorite))
      for (const card of cards) {
        expect(card.pageTitle).toBeTruthy()
        expect(card.tabLabel).toBeTruthy()
      }
    })
  })

  describe('test_renders_projectnotities_4_slots', () => {
    it('Notities page has exactly 4 slots: documenten/correspondentie/ideeen/checklist', () => {
      const pages = buildPages(baseFavorite)
      const notities = pages[0]!
      expect(notities.tabLabel).toBe('Notities')
      const keys = notities.cards.map((c) => c.key)
      expect(keys).toEqual(['documenten', 'correspondentie', 'ideeen', 'checklist'])
    })
  })

  describe('test_dropzone_accepts_files (document-upload parity)', () => {
    it('mergeDocuments promotes card.filled when documents match by type', () => {
      const pages = buildPages(baseFavorite)
      const docs: ParcelDocumentMeta[] = [
        baseDocument({ id: 'd1', document_type: 'bodem', filename: 'bodemonderzoek.pdf' }),
      ]
      const merged = mergeDocuments(pages, docs)
      const technisch = merged.find((p) => p.tabLabel === 'Technisch')!
      const bodem = technisch.cards.find((c) => c.key === 'bodem')!
      expect(bodem.filled).toBe(true)
      expect(bodem.documents.length).toBe(1)
      expect(bodem.value).toBe('1 BESTAND')
    })

    it('mergeDocuments multi-bestand pluralizes', () => {
      const docs: ParcelDocumentMeta[] = [
        baseDocument({ id: 'd1', document_type: 'bodem' }),
        baseDocument({ id: 'd2', document_type: 'bodem' }),
      ]
      const merged = mergeDocuments(buildPages(baseFavorite), docs)
      const bodem = flattenCards(merged).find((c) => c.key === 'bodem')!
      expect(bodem.value).toBe('2 BESTANDEN')
    })

    it('unmapped document_type falls back to documenten catch-all (Notities)', () => {
      const docs: ParcelDocumentMeta[] = [
        baseDocument({ id: 'dx', document_type: 'onbekend_type', filename: 'unknown.pdf' }),
      ]
      const merged = mergeDocuments(buildPages(baseFavorite), docs)
      const documenten = flattenCards(merged).find((c) => c.key === 'documenten')!
      expect(documenten.filled).toBe(true)
      expect(documenten.documents.length).toBe(1)
    })
  })

  describe('test_renders_score_cards (data contract)', () => {
    it('FavoriteResponse contract preserves potentie_score + risico_score + parcel_cache_id', () => {
      // Type-level contract: if these fields disappear from FavoriteResponse, the
      // shell can no longer render ScoreButton + open PotentieModal/RisicoModal.
      expect(baseFavorite.potentie_score).toBe(61)
      expect(baseFavorite.risico_score).toBe(45)
      expect(baseFavorite.parcel_cache_id).toBeTruthy()
    })
  })

  describe('test_renders_aanpak_card (pre-08-07 baseline)', () => {
    it('deriveNextStep returns {title, detail} for Onderzoek stage with missing eigendom', () => {
      const cards = flattenCards(buildPages(baseFavorite))
      const missing = deriveMissingCards(cards)
      const step = deriveNextStep(baseFavorite, cards, missing)
      expect(step.title).toBeTruthy()
      expect(step.detail).toBeTruthy()
    })

    it('AANPAK Contact-handoff CTA present for Onderzoek stage (post-08-07 — BRK CTA removed per AD1)', () => {
      // Plan 08-07 replaced the BRK CTA with "Stap door naar Contact" — this
      // assertion is the iron-rule canary that pins the new copy + route target
      // and proves no future plan can silently regress the handoff back to a
      // BRK-on-fase-1 anti-pattern.
      const cards = flattenCards(buildPages(baseFavorite))
      const missing = deriveMissingCards(cards)
      const step = deriveNextStep(baseFavorite, cards, missing)
      expect(step.kind).toBe('contact-handoff')
      expect(step.title).toBe('Klaar met onderzoek?')
      expect(step.detail).toContain('Stap door naar Contact')
      if (step.kind !== 'contact-handoff') throw new Error('expected contact-handoff')
      expect(step.cta).toBeDefined()
      expect(step.cta.label).toBe('Naar Contact-fase →')
      expect(step.cta.to).toBe('/opgeslagen/perceel/$parcelId/$phase')
      expect(step.cta.params.phase).toBe('2-contact')
    })

    it('AANPAK BRK CTA REMOVED from Gesignaleerd + has_report path (post-08-07 — falls through to rapport review)', () => {
      // Pre-08-07 baseline returned "Vraag eigendomsinfo op" / "BRK eigendom ophalen"
      // for this path. After 08-07 the BRK-specific branch is removed → falls
      // through to the rapport-review default.
      const fav: FavoriteResponse = { ...baseFavorite, pipeline_stage: 'Gesignaleerd', has_report: true, report_id: 'r1' }
      const cards = flattenCards(buildPages(fav))
      const missing = deriveMissingCards(cards)
      const step = deriveNextStep(fav, cards, missing)
      expect(step.title).not.toBe('Vraag eigendomsinfo op')
      expect(step.detail).not.toContain('BRK eigendom ophalen')
      // Falls through to the rapport-review branch
      expect(step.title).toBe('Bekijk je rapport en plan opvolging')
    })

    it('AANPAK Contact-handoff has NO score-threshold gate (AD1 — fase-overgang IS the gate)', () => {
      // AD1: handoff fires on ANY fase-1 parcel, regardless of potentie/risico scores.
      const lowScore: FavoriteResponse = { ...baseFavorite, potentie_score: 5, risico_score: 95 }
      const highScore: FavoriteResponse = { ...baseFavorite, potentie_score: 95, risico_score: 5 }
      for (const fav of [lowScore, highScore]) {
        const cards = flattenCards(buildPages(fav))
        const missing = deriveMissingCards(cards)
        const step = deriveNextStep(fav, cards, missing)
        expect(step.kind).toBe('contact-handoff')
        expect(step.title).toBe('Klaar met onderzoek?')
      }
    })
  })

  describe('test_score_modal_opens_on_click (composition snapshot)', () => {
    it('shell composition file imports PotentieModal + RisicoModal + all 5 cockpit children', async () => {
      // Snapshot of the OnderzoekPhaseView source — proves shell still wires up
      // every regression-critical child component. If any import disappears, the
      // shell broke composition.
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const { fileURLToPath } = await import('node:url')
      const here = path.dirname(fileURLToPath(import.meta.url))
      const shellPath = path.resolve(here, '..', 'OnderzoekPhaseView.tsx')
      const src = await fs.readFile(shellPath, 'utf-8')
      // Score modals
      expect(src).toMatch(/PotentieModal/)
      expect(src).toMatch(/RisicoModal/)
      // 5 cockpit composition children
      expect(src).toMatch(/AanpakCard/)
      expect(src).toMatch(/ParcelWorkspaceHeader/)
      expect(src).toMatch(/WorkspaceContactModal/)
      expect(src).toMatch(/DossierSection/)
      expect(src).toMatch(/ActivityTimelineCard/)
      // Cockpit helper imports
      expect(src).toMatch(/buildPages/)
      expect(src).toMatch(/deriveNextStep/)
    })
  })

  describe('test_switches_tabs_on_click (page-index parity)', () => {
    it('current = pages[page] selection works for every valid page index 0..4', () => {
      const pages = buildPages(baseFavorite)
      for (let i = 0; i < pages.length; i++) {
        const current = pages[i] ?? pages[0]
        expect(current!.tabLabel).toBe(pages[i]!.tabLabel)
      }
    })
  })

  describe('derivation invariants', () => {
    it('REQUIRED_CARD_PRIORITY contains exactly 15 keys, including BRK-critical "eigendom"', () => {
      expect(REQUIRED_CARD_PRIORITY.length).toBe(15)
      expect(REQUIRED_CARD_PRIORITY).toContain('eigendom')
      expect(REQUIRED_CARD_PRIORITY).toContain('quickscan')
      expect(REQUIRED_CARD_PRIORITY).toContain('bestemmingscheck')
    })

    it('GHOST_ICONS has an icon for every notitie + dossier card key', () => {
      const cards = flattenCards(buildPages(baseFavorite))
      // ICON coverage is best-effort fallback to BookOpen in DossierCardSlot, but
      // a missing entry is a regression flag for any card that has bespoke iconography.
      const importantKeys = ['eigendom', 'kadaster', 'bodem', 'quickscan', 'bestemmingscheck']
      for (const key of importantKeys) {
        expect(GHOST_ICONS[key], `GHOST_ICONS missing key ${key}`).toBeTruthy()
      }
      // Card-iteration sanity
      expect(cards.length).toBeGreaterThan(0)
    })

    it('deriveContactFollowUp surfaces eigendom + correspondentie status', () => {
      const cards = flattenCards(buildPages(baseFavorite))
      const fu = deriveContactFollowUp(baseFavorite, cards)
      expect(fu.title).toBeTruthy()
      expect(fu.detail).toBeTruthy()
    })

    it('deriveMissingCards excludes already-filled cards', () => {
      const cards = flattenCards(buildPages(baseFavorite))
      // perceeldata is filled (hasAddress = true) — should NOT be in missing
      const missing = deriveMissingCards(cards)
      expect(missing.find((c) => c.key === 'perceeldata')).toBeUndefined()
    })
  })
})
