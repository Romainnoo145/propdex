import { useNavigate, useSearch } from '@tanstack/react-router'
import { useProfessionals } from '@/hooks/useProfessionals'
import { ProfessionalCard } from './ProfessionalCard'
import { Select, Input } from '@/components/primitives'

/**
 * Browsable, filterable directory of kwaliteitsborgers.
 *
 * Reads gemeente and gevolgklasse filters from URL search params
 * (via the /_authenticated/professionals route validateSearch).
 * Filter changes update URL params — enabling pre-fill from property reports.
 *
 * Layout: responsive 3-col desktop / 2-col tablet / 1-col mobile grid.
 */
export function ProfessionalDirectory() {
  const navigate = useNavigate()
  const { gemeente, gevolgklasse } = useSearch({ from: '/_authenticated/professionals' })

  const { data, isLoading, isError } = useProfessionals({ gemeente, gevolgklasse })

  const professionals = data?.professionals ?? []
  const total = data?.total ?? 0

  const handleGemeenteChange = (value: string) => {
    void navigate({
      to: '/professionals',
      search: (prev) => ({
        ...prev,
        gemeente: value.trim() || undefined,
      }),
      replace: true,
    })
  }

  const handleGevolgklasseChange = (value: string) => {
    void navigate({
      to: '/professionals',
      search: (prev) => ({
        ...prev,
        gevolgklasse: (value as 'GK1' | 'GK2' | 'GK3') || undefined,
      }),
      replace: true,
    })
  }

  const filterDescription = [
    gemeente ? `gemeente "${gemeente}"` : null,
    gevolgklasse ? gevolgklasse : null,
  ]
    .filter(Boolean)
    .join(' en ')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold text-grey-100">Kwaliteitsborgers</h1>
        {!isLoading && (
          <span className="inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium bg-grey-850 text-grey-400 border border-grey-800">
            {total} gevonden
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <Input
            type="text"
            placeholder="Filter op gemeente..."
            value={gemeente ?? ''}
            onChange={(e) => handleGemeenteChange(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="w-48">
          <Select
            value={gevolgklasse ?? ''}
            onChange={(e) => handleGevolgklasseChange(e.target.value)}
          >
            <option value="">Alle gevolgklassen</option>
            <option value="GK1">GK1</option>
            <option value="GK2">GK2</option>
            <option value="GK3">GK3</option>
          </Select>
        </div>
      </div>

      {/* Loading state — skeleton cards */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-overlay/[0.08] bg-grey-900 p-4 space-y-3 animate-pulse"
            >
              <div className="h-5 w-3/4 rounded bg-grey-800" />
              <div className="h-4 w-1/2 rounded bg-grey-850" />
              <div className="flex gap-1.5">
                <div className="h-5 w-10 rounded bg-grey-800" />
                <div className="h-5 w-10 rounded bg-grey-800" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div className="rounded-lg border border-error/25 bg-error/10 px-4 py-3 text-sm text-error">
          Er is een fout opgetreden bij het laden van kwaliteitsborgers. Probeer de pagina te vernieuwen.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && professionals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-grey-400 text-sm">
            {filterDescription
              ? `Geen kwaliteitsborgers gevonden voor ${filterDescription}`
              : 'Geen kwaliteitsborgers gevonden'}
          </p>
        </div>
      )}

      {/* Card grid */}
      {!isLoading && !isError && professionals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {professionals.map((professional) => (
            <ProfessionalCard key={professional.id} professional={professional} />
          ))}
        </div>
      )}
    </div>
  )
}
