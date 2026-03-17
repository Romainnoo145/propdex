import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Bookmark, MapPin, ChevronDown, ChevronRight, Search } from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import { useParcelFavorites } from '@/hooks/useFavorites'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { toMapParcelSearch } from '@/lib/navigation/mapSearch'
import type { FavoriteResponse } from '@/lib/types/portfolio'

export const Route = createFileRoute('/_authenticated/opgeslagen')({
  component: OpgeslagenPage,
})

interface GemeenteGroup {
  gemeente_naam: string
  gemeente_code: string | null
  parcels: FavoriteResponse[]
}

function OpgeslagenPage() {
  const navigate = useNavigate()
  const { data: favorites, isLoading } = useParcelFavorites()
  const [expandedGemeenten, setExpandedGemeenten] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // Group favorites by gemeente
  const groups = useMemo(() => {
    if (!favorites?.length) return []

    const map = new Map<string, GemeenteGroup>()

    for (const fav of favorites) {
      const key = fav.gemeente_naam ?? 'Onbekend'
      if (!map.has(key)) {
        map.set(key, {
          gemeente_naam: key,
          gemeente_code: fav.gemeente_code,
          parcels: [],
        })
      }
      map.get(key)!.parcels.push(fav)
    }

    // Sort gemeenten alphabetically, parcels by most recently added
    const sorted = [...map.values()].sort((a, b) =>
      a.gemeente_naam.localeCompare(b.gemeente_naam, 'nl')
    )
    for (const group of sorted) {
      group.parcels.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }
    return sorted
  }, [favorites])

  // Filter by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups
    const q = searchQuery.toLowerCase().trim()
    return groups
      .map((g) => ({
        ...g,
        parcels: g.parcels.filter(
          (p) =>
            p.address?.toLowerCase().includes(q) ||
            p.parcel_id.toLowerCase().includes(q) ||
            g.gemeente_naam.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.parcels.length > 0)
  }, [groups, searchQuery])

  const totalCount = favorites?.length ?? 0

  const toggleGemeente = (naam: string) => {
    setExpandedGemeenten((prev) => {
      const next = new Set(prev)
      if (next.has(naam)) next.delete(naam)
      else next.add(naam)
      return next
    })
  }

  const navigateToParcel = (parcel: FavoriteResponse) => {
    navigate({
      to: '/map',
      search: toMapParcelSearch({
        parcelId: parcel.parcel_id,
        fallbackAddress: parcel.address,
      }),
    })
  }

  if (isLoading) {
    return (
      <ResultsShell>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </ResultsShell>
    )
  }

  return (
    <ResultsShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-aura-ink tracking-tight font-display">
            Opgeslagen
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {totalCount} {totalCount === 1 ? 'perceel' : 'percelen'} opgeslagen
          </p>
        </div>
      </div>

      {totalCount === 0 ? (
        <EmptyState
          icon={<Bookmark size={40} strokeWidth={1.5} className="text-slate-300" />}
          title="Geen opgeslagen percelen"
          description="Gebruik het hartje op de kaart om percelen op te slaan."
        />
      ) : (
        <>
          {/* Search */}
          <div className="relative mb-6">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Zoek op adres, perceel of gemeente..."
              className="w-full h-10 pl-10 pr-4 bg-[#F2F6F3] rounded-full text-[13px] text-aura-ink placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-aura-amber/30 transition"
            />
          </div>

          {/* Gemeente groups */}
          <div className="space-y-3">
            {filteredGroups.map((group) => {
              const isExpanded = expandedGemeenten.has(group.gemeente_naam)

              return (
                <div
                  key={group.gemeente_naam}
                  className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white/30 overflow-hidden"
                >
                  {/* Gemeente header */}
                  <button
                    onClick={() => toggleGemeente(group.gemeente_naam)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#F2F6F3]/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F2F6F3]">
                        <MapPin size={16} className="text-aura-ink" />
                      </div>
                      <div className="text-left">
                        <p className="text-[14px] font-bold text-aura-ink tracking-tight">
                          {group.gemeente_naam}
                        </p>
                        <p className="text-[12px] text-slate-500">
                          {group.parcels.length}{' '}
                          {group.parcels.length === 1 ? 'perceel' : 'percelen'}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown size={18} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={18} className="text-slate-400" />
                    )}
                  </button>

                  {/* Parcel list */}
                  {isExpanded && (
                    <div className="border-t border-[#EAEFEF]">
                      {group.parcels.map((parcel) => (
                        <ParcelRow
                          key={parcel.id}
                          parcel={parcel}
                          onNavigate={() => navigateToParcel(parcel)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {filteredGroups.length === 0 && searchQuery && (
            <div className="text-center py-12 text-[13px] text-slate-400">
              Geen resultaten voor &ldquo;{searchQuery}&rdquo;
            </div>
          )}
        </>
      )}
    </ResultsShell>
  )
}

function ParcelRow({
  parcel,
  onNavigate,
}: {
  parcel: FavoriteResponse
  onNavigate: () => void
}) {
  const address = parcel.address || parcel.parcel_id
  const subtitle = parcel.address ? parcel.parcel_id : null

  return (
    <button
      onClick={onNavigate}
      className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#F2F6F3]/50 transition-colors border-b border-[#EAEFEF] last:border-b-0"
    >
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[13px] font-semibold text-aura-ink truncate">
          {address}
        </p>
        {subtitle && (
          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      <span className="shrink-0 ml-3 text-[11px] font-bold text-aura-amber tracking-wide uppercase">
        Bekijk op kaart →
      </span>
    </button>
  )
}
