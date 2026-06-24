import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useAddressSuggest } from '@/hooks/useAddressSuggest'
import { useAuth } from '@/lib/auth/useAuth'
import { lookupPdokAddress, resolveParcelByAddress } from '@/lib/api'

export const Route = createFileRoute('/_authenticated/rapport-v2/')({
  component: RapportEntry,
})

function RapportEntry() {
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { data: suggestions } = useAddressSuggest(query)
  const { accessToken } = useAuth()
  const navigate = useNavigate()

  async function pick(pdokId: string) {
    setError(null)
    setLoading(true)
    try {
      const addr = await lookupPdokAddress(pdokId)
      const resolved = await resolveParcelByAddress(
        { street: addr.straatnaam, huisnummer: addr.huisnummer, postcode: addr.postcode },
        accessToken,
      )
      navigate({ to: '/rapport-v2/splitsing/$parcelId', params: { parcelId: resolved.parcel_id } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">Vergunningskansen — splitsing</h1>
      <input
        className="w-full rounded border px-3 py-2"
        placeholder="Typ een adres"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={loading}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm opacity-60">Adres opzoeken…</p>}
      <ul>
        {(suggestions ?? []).map((s) => (
          <li key={s.id}>
            <button
              className="w-full py-1 text-left hover:underline"
              onClick={() => pick(s.id)}
              disabled={loading}
            >
              {s.weergavenaam}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
