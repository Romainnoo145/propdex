import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('useDakkapelReport', () => {
  it('exports useDakkapelReport hook', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../useDakkapelReport.ts', import.meta.url)),
      'utf8',
    )
    expect(src).toMatch(/export function useDakkapelReport/)
    expect(src).toMatch(/dakkapel-report/)
  })
})
