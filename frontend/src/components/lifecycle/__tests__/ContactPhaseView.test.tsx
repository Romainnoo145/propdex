/**
 * Unit tests for ContactPhaseView — node-env structural smoke + composition.
 *
 * Project convention (vite.config.ts `unit` project + MEMORY.md): pure-logic
 * + structural source-text assertions in node env. React rendering of the
 * dispatcher is out of scope for the unit project — covered by Storybook
 * play functions (deferred). This mirrors the Plan 08-06
 * OnderzoekPhaseView.parity.test.tsx precedent exactly.
 *
 * Structural assertions pin AD6 dispatcher composition:
 *   - useBrkRecords hook imported + invoked
 *   - BrkPersistPanel always rendered (idle/error/empty/success all handled inside)
 *   - BrkOwnerCard / BrkHypotheekCard / BrkKoopwaardeTimeline gated on hasRecords
 *   - RescoreProgressBanner gated on pollStartAt !== null AND hasRecords
 *   - Back-to-Onderzoek link present
 *   - Skeleton state when isLoading
 *
 * Pure derivation `deriveContactDispatch` pins the dispatcher branch logic.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'

import { deriveContactDispatch } from '../ContactPhaseView'

const SRC_PATH = new URL('../ContactPhaseView.tsx', import.meta.url)

// ============================================================================
// Pure dispatcher derivation
// ============================================================================

describe('deriveContactDispatch — dispatcher branch logic', () => {
  it('test_renders_skeleton_when_loading → "skeleton" branch', () => {
    const dispatch = deriveContactDispatch({
      isLoading: true,
      hasRecords: false,
      pollStartAt: null,
    })
    expect(dispatch.showSkeleton).toBe(true)
    expect(dispatch.showRecordDisplay).toBe(false)
    expect(dispatch.showRescoreBanner).toBe(false)
  })

  it('test_renders_persist_panel_when_no_records → persist panel always rendered post-load', () => {
    const dispatch = deriveContactDispatch({
      isLoading: false,
      hasRecords: false,
      pollStartAt: null,
    })
    expect(dispatch.showSkeleton).toBe(false)
    expect(dispatch.showPersistPanel).toBe(true)
    expect(dispatch.showRecordDisplay).toBe(false)
  })

  it('test_renders_owner_card_when_records_present → showRecordDisplay true', () => {
    const dispatch = deriveContactDispatch({
      isLoading: false,
      hasRecords: true,
      pollStartAt: null,
    })
    expect(dispatch.showRecordDisplay).toBe(true)
    expect(dispatch.showPersistPanel).toBe(true)  // SUCCESS chip
  })

  it('test_renders_hypotheek_card_when_records_present → covered by showRecordDisplay', () => {
    const dispatch = deriveContactDispatch({
      isLoading: false,
      hasRecords: true,
      pollStartAt: null,
    })
    expect(dispatch.showRecordDisplay).toBe(true)
  })

  it('test_renders_koopwaarde_timeline_when_records_present → covered by showRecordDisplay', () => {
    const dispatch = deriveContactDispatch({
      isLoading: false,
      hasRecords: true,
      pollStartAt: null,
    })
    expect(dispatch.showRecordDisplay).toBe(true)
  })

  it('test_no_rescore_banner_before_persist → pollStartAt === null hides banner', () => {
    const dispatch = deriveContactDispatch({
      isLoading: false,
      hasRecords: true,
      pollStartAt: null,
    })
    expect(dispatch.showRescoreBanner).toBe(false)
  })

  it('rescore banner shows ONLY when pollStartAt set AND hasRecords (AD3)', () => {
    const withPollNoRecords = deriveContactDispatch({
      isLoading: false,
      hasRecords: false,
      pollStartAt: 1_700_000_000_000,
    })
    expect(withPollNoRecords.showRescoreBanner).toBe(false)

    const withPollAndRecords = deriveContactDispatch({
      isLoading: false,
      hasRecords: true,
      pollStartAt: 1_700_000_000_000,
    })
    expect(withPollAndRecords.showRescoreBanner).toBe(true)
  })
})

// ============================================================================
// Structural composition — pin AD6 dispatcher requirements
// ============================================================================

describe('ContactPhaseView.tsx structural composition (AD6)', () => {
  it('test_back_to_onderzoek_link_present — Link + Terug naar Onderzoek copy', async () => {
    const src = await fs.readFile(SRC_PATH, 'utf-8')
    expect(src).toMatch(/from '@tanstack\/react-router'/)
    expect(src).toMatch(/Terug naar Onderzoek/i)
    // ArrowLeft icon (matches existing $phase.tsx route convention)
    expect(src).toMatch(/ArrowLeft/)
  })

  it('imports useBrkRecords + mounts BrkPersistPanel + sub-components + banner', async () => {
    const src = await fs.readFile(SRC_PATH, 'utf-8')
    expect(src).toMatch(/useBrkRecords/)
    expect(src).toMatch(/BrkPersistPanel/)
    expect(src).toMatch(/BrkOwnerCard/)
    expect(src).toMatch(/BrkHypotheekCard/)
    expect(src).toMatch(/BrkKoopwaardeTimeline/)
    expect(src).toMatch(/RescoreProgressBanner/)
  })

  it('manages pollStartAt useState + onPersistSuccess wiring', async () => {
    const src = await fs.readFile(SRC_PATH, 'utf-8')
    expect(src).toMatch(/pollStartAt/)
    // Stamps Date.now() on persist success
    expect(src).toMatch(/Date\.now\(\)/)
    expect(src).toMatch(/onPersistSuccess/)
  })
})
