/**
 * AanpakCard composition + Contact-handoff CTA tests (Plan 08-07, M050/S06 cont., AD1).
 *
 * SCOPE: pure-logic structural pinning + composition snapshot (vitest 'unit'
 * project = node env, no DOM). Same precedent as OnderzoekPhaseView.parity.test.tsx
 * + RisicoLayer.factor-coverage.test.tsx. React-rendering smoke tests live in
 * Storybook play functions per MEMORY.md "Storybook = convergence smoke layer".
 *
 * These tests pin:
 *   1. Contact-handoff CTA rendered when nextStep.kind === 'contact-handoff'
 *      (Link to /opgeslagen/perceel/$parcelId/$phase with phase='2-contact')
 *   2. BRK CTA absent from AanpakCard.tsx source (Plan 08-07 / AD1)
 *   3. Contact-handoff link target is the 2-contact phase route
 *   4. Other next-step kinds ('default') still render the rapport/contact CTAs
 *      (parity with pre-08-07 AANPAK card structure)
 *
 * The composition snapshot reads AanpakCard.tsx via fs and regex-asserts the
 * critical imports/strings/JSX shape — any regression on the Contact-handoff
 * wire-up fails this test before it can ship.
 */
import { describe, expect, it } from 'vitest'

let src: string

async function loadAanpakCardSource(): Promise<string> {
  if (src) return src
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const here = path.dirname(fileURLToPath(import.meta.url))
  const aanpakPath = path.resolve(here, '..', 'AanpakCard.tsx')
  src = await fs.readFile(aanpakPath, 'utf-8')
  return src
}

describe('AanpakCard — Contact-handoff CTA (Plan 08-07, AD1)', () => {
  it('test_renders_contact_handoff_cta_when_next_step_is_contact_handoff', async () => {
    const source = await loadAanpakCardSource()
    // The render branch must check nextStep.kind === 'contact-handoff'
    expect(source).toMatch(/nextStep\.kind\s*===\s*['"]contact-handoff['"]/)
    // And render a TanStack Link with the route + phase param
    expect(source).toMatch(/<Link\b/)
    expect(source).toMatch(/from\s+['"]@tanstack\/react-router['"]/)
    // CTA label is sourced from nextStep.cta.label (not a hardcoded string in card)
    expect(source).toMatch(/nextStep\.cta\.label/)
  })

  it('test_does_not_render_brk_cta_anywhere', async () => {
    const source = await loadAanpakCardSource()
    // BRK CTA strings + the 'brk-persist' discriminator must NOT appear
    // anywhere in AanpakCard.tsx — Plan 08-07 / AD1 removed BRK from fase-1.
    expect(source).not.toMatch(/Vraag BRK eigendom/)
    expect(source).not.toMatch(/Vraag eigendomsinfo op/)
    expect(source).not.toMatch(/Controleer eigendom/)
    expect(source).not.toMatch(/brk-persist/)
  })

  it('test_contact_handoff_link_targets_2_contact_phase', async () => {
    const source = await loadAanpakCardSource()
    // The Link must use nextStep.cta.to + nextStep.cta.params.phase
    // (NOT a hardcoded route string — that lives in deriveNextStep so the
    // route target stays single-source-of-truth).
    expect(source).toMatch(/to=\{nextStep\.cta\.to\}/)
    expect(source).toMatch(/phase:\s*nextStep\.cta\.params\.phase/)
    // parcelId must be passed via params (TanStack Link contract)
    expect(source).toMatch(/parcelId/)
    // The CTA passes search={{ stage: undefined }} to satisfy /opgeslagen
    // route's validateSearch contract (per STATE.md decision).
    expect(source).toMatch(/search=\{\{\s*stage:\s*undefined\s*\}\}/)
  })

  it('test_renders_other_next_step_kinds_unchanged', async () => {
    const source = await loadAanpakCardSource()
    // The 'default' kind branch still renders the rapport + contact action
    // cluster (favorite.has_report ternary + Genereer/Bekijk rapport buttons +
    // Neem contact op).
    expect(source).toMatch(/favorite\.has_report/)
    expect(source).toMatch(/Genereer rapport/)
    expect(source).toMatch(/Bekijk rapport/)
    expect(source).toMatch(/Neem contact op/)
    // onGenerateReport + onOpenContact props still wired
    expect(source).toMatch(/onGenerateReport/)
    expect(source).toMatch(/onOpenContact/)
  })

  it('AanpakCard imports NextStep type from cockpit-derivations (single-source-of-truth)', async () => {
    const source = await loadAanpakCardSource()
    // NextStep discriminated union lives in cockpit-derivations.ts — AanpakCard
    // consumes it, doesn't re-declare it. Prevents shape drift between caller
    // (OnderzoekPhaseView) + producer (deriveNextStep) + consumer (AanpakCard).
    expect(source).toMatch(/import\s+type\s+\{\s*NextStep\s*\}\s+from\s+['"]@\/lib\/cockpit\/cockpit-derivations['"]/)
  })

  it('parcelId is part of AanpakCardProps (required for Contact-handoff Link params)', async () => {
    const source = await loadAanpakCardSource()
    // parcelId must be a typed prop (not optional). TanStack Link params={{ parcelId, phase }}
    // requires it at compile-time on /opgeslagen/perceel/$parcelId/$phase.
    expect(source).toMatch(/parcelId:\s*string/)
  })
})
