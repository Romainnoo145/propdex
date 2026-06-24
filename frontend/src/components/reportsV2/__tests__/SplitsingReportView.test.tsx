/**
 * Unit tests for SplitsingReportView — node-env structural smoke.
 *
 * Project convention (vite.config.ts `unit` project): pure-logic +
 * structural source-text assertions in node env, no jsdom / browser.
 * Mirrors the ContactPhaseView.test.tsx precedent.
 *
 * Required assertions (task-6 brief):
 *   - address rendered (perceel.adres)
 *   - beleid samenvatting text rendered
 *   - ECLI string rendered
 *   - aandachtspunt rendered
 *
 * Structural assertions verify four-block composition:
 *   - header block with perceel.adres
 *   - "Wat geldt hier" (beleid) block with beleid.samenvatting
 *   - "Wat zegt de rechter" (jurisprudentie) block with ecli
 *   - aandachtspunten block + aanvraag-CTA + disclaimers footer
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'

const SRC_PATH = new URL('../SplitsingReportView.tsx', import.meta.url)

describe('SplitsingReportView structural composition', () => {
  it('renders perceel.adres (header block)', async () => {
    const src = await fs.readFile(SRC_PATH, 'utf-8')
    // header block renders the address
    expect(src).toMatch(/perceel\.adres/)
  })

  it('renders beleid.samenvatting ("Wat geldt hier" block)', async () => {
    const src = await fs.readFile(SRC_PATH, 'utf-8')
    expect(src).toMatch(/beleid\.samenvatting/)
    expect(src).toMatch(/Wat geldt hier/i)
  })

  it('renders ecli string ("Wat zegt de rechter" block)', async () => {
    const src = await fs.readFile(SRC_PATH, 'utf-8')
    expect(src).toMatch(/c\.ecli/)
    expect(src).toMatch(/Wat zegt de rechter/i)
  })

  it('renders aandachtspunten + aanvraag-CTA + disclaimers', async () => {
    const src = await fs.readFile(SRC_PATH, 'utf-8')
    expect(src).toMatch(/aandachtspunten/)
    expect(src).toMatch(/aanvraag_url/)
    expect(src).toMatch(/disclaimers/)
  })

  it('imports SplitsingReport type from @/lib/reportsV2', async () => {
    const src = await fs.readFile(SRC_PATH, 'utf-8')
    expect(src).toMatch(/@\/lib\/reportsV2/)
    expect(src).toMatch(/SplitsingReport/)
  })

  it('exports SplitsingReportView as named export', async () => {
    const src = await fs.readFile(SRC_PATH, 'utf-8')
    expect(src).toMatch(/export function SplitsingReportView/)
  })

  it('four distinct section blocks present', async () => {
    const src = await fs.readFile(SRC_PATH, 'utf-8')
    // header + three <section> elements = four visual blocks
    expect(src).toMatch(/<header/)
    expect((src.match(/<section/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })
})
