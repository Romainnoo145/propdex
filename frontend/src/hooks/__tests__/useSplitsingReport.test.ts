import { describe, expect, it, vi } from 'vitest'
import { fetchSplitsingReport } from '@/lib/reportsV2'

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(async (url: string) => ({ url })),
}))

describe('fetchSplitsingReport', () => {
  it('calls the reports-v2 splitsing endpoint', async () => {
    const res = (await fetchSplitsingReport('HTT02-A-1', 'tok')) as unknown as { url: string }
    expect(res.url).toBe('/api/reports-v2/splitsing/HTT02-A-1')
  })
})
