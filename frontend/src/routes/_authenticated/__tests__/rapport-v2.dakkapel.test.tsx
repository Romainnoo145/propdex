import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('dakkapel route', () => {
  it('wires hook + view at the dakkapel path', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../rapport-v2.dakkapel.$parcelId.tsx', import.meta.url)),
      'utf8',
    )
    expect(src).toMatch(/rapport-v2\/dakkapel\/\$parcelId/)
    expect(src).toMatch(/DakkapelReportView/)
  })
})
