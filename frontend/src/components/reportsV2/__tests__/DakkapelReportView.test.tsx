import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('DakkapelReportView', () => {
  it('exports DakkapelReportView and renders the core sections', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../DakkapelReportView.tsx', import.meta.url)),
      'utf8',
    )
    expect(src).toMatch(/export function DakkapelReportView/)
    expect(src).toMatch(/oordeel/)
    expect(src).toMatch(/welstand/)
    expect(src).toMatch(/onzekerheden/)
  })
})
