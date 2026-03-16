import { useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { usePortfolio, useParcelFavorites } from '@/hooks/useFavorites'
import type { GemeenteScopeCard, ProvinceOption } from '@/hooks/useMunicipalityWorkspaceStats'
import type { PipelineStage } from '@/lib/types/portfolio'
import { PortfolioBreadcrumb } from './PortfolioBreadcrumb'
import { PortfolioProvincieView } from './PortfolioProvincieView'
import { PortfolioGemeenteView } from './PortfolioGemeenteView'
import { PortfolioWijkView } from './PortfolioWijkView'
import { FavoritedParcelCard } from './FavoritedParcelCard'
import { PipelineStageFilter } from './PipelineStageFilter'

interface PortfolioViewProps {
  allGemeenteCards: GemeenteScopeCard[]
  provinceOptions: ProvinceOption[]
  provincieGeojson: GeoJSON.FeatureCollection | null | undefined
  gemeenteGeojson: GeoJSON.FeatureCollection | null | undefined
}

/**
 * Top-level portfolio mode orchestrator.
 *
 * Reads portfolio_provincie / portfolio_gemeente / portfolio_wijk from URL params
 * and renders the correct drill-down level:
 *   - No portfolio_provincie  → Province grid (PortfolioProvincieView)
 *   - Has portfolio_provincie → Gemeente grid (PortfolioGemeenteView)
 *   - Has portfolio_gemeente  → Wijk grid (PortfolioWijkView)
 *   - Has portfolio_wijk      → Favorited parcel cards (FavoritedParcelCard)
 *
 * Always renders PortfolioBreadcrumb above the level view.
 * PipelineStageFilter renders between breadcrumb and content, persists via URL.
 */
export function PortfolioView({
  allGemeenteCards,
  provinceOptions,
}: PortfolioViewProps) {
  const navigate = useNavigate()
  const search = useSearch({ from: '/_authenticated/projecten' })
  const { data: portfolio, isLoading } = usePortfolio()
  const { data: favorites } = useParcelFavorites()

  const selectedProvinceCode = search.portfolio_provincie ?? null
  const selectedGemeenteCode = search.portfolio_gemeente ?? null
  const selectedWijkNaam = search.portfolio_wijk ?? null
  const activeStageFilter: PipelineStage | undefined = search.portfolio_stage ?? undefined

  // Client-side filtered favorites based on active stage filter
  const filteredFavorites = useMemo(() => {
    if (!favorites || !activeStageFilter) return favorites ?? []
    return favorites.filter((f) => f.pipeline_stage === activeStageFilter)
  }, [favorites, activeStageFilter])

  // Derive favorite counts by province using allGemeenteCards province assignment
  const { favoriteCountByProvince, provinciesWithFavorites } = useMemo(() => {
    const countMap = new Map<string, number>()
    const withFavorites = new Set<string>()

    if (!portfolio) return { favoriteCountByProvince: countMap, provinciesWithFavorites: withFavorites }

    // Build gemeente_code → provinceCode lookup
    const gemeenteToProvince = new Map(allGemeenteCards.map((c) => [c.code, c.provinceCode]))

    if (activeStageFilter) {
      // When filter active: recompute from filteredFavorites
      for (const f of filteredFavorites) {
        if (!f.gemeente_code) continue
        const provinceCode = gemeenteToProvince.get(f.gemeente_code)
        if (!provinceCode) continue
        countMap.set(provinceCode, (countMap.get(provinceCode) ?? 0) + 1)
        withFavorites.add(provinceCode)
      }
    } else {
      // No filter: use portfolio API counts
      for (const gemeente of portfolio.gemeenten) {
        if (!gemeente.gemeente_code) continue
        const provinceCode = gemeenteToProvince.get(gemeente.gemeente_code)
        if (!provinceCode) continue
        const prev = countMap.get(provinceCode) ?? 0
        countMap.set(provinceCode, prev + gemeente.total_count)
        withFavorites.add(provinceCode)
      }
    }

    return { favoriteCountByProvince: countMap, provinciesWithFavorites: withFavorites }
  }, [portfolio, allGemeenteCards, activeStageFilter, filteredFavorites])

  // Resolve display names for breadcrumb
  const provincieName = useMemo(
    () => provinceOptions.find((p) => p.code === selectedProvinceCode)?.naam,
    [provinceOptions, selectedProvinceCode]
  )

  const gemeenteName = useMemo(
    () => allGemeenteCards.find((c) => c.code === selectedGemeenteCode)?.naam,
    [allGemeenteCards, selectedGemeenteCode]
  )

  // Province geometry for gemeente SVG dual-path
  const selectedProvinceGeometry = useMemo(
    () => provinceOptions.find((p) => p.code === selectedProvinceCode)?.geometry,
    [provinceOptions, selectedProvinceCode]
  )

  // Gemeenten in selected province, from portfolio data — filtered when stage active
  const gemeenteCardsForProvince = useMemo(() => {
    if (!portfolio || !selectedProvinceCode) return []
    const gemeenteToProvince = new Map(allGemeenteCards.map((c) => [c.code, c.provinceCode]))
    return portfolio.gemeenten.filter(
      (g) => g.gemeente_code && gemeenteToProvince.get(g.gemeente_code) === selectedProvinceCode
    )
  }, [portfolio, selectedProvinceCode, allGemeenteCards])

  // Filtered gemeente cards — when stage active, override counts and hide zero-count gemeenten
  const filteredGemeenteCards = useMemo(() => {
    if (!activeStageFilter) return gemeenteCardsForProvince
    const countMap = new Map<string, number>()
    for (const f of filteredFavorites) {
      if (!f.gemeente_code) continue
      countMap.set(f.gemeente_code, (countMap.get(f.gemeente_code) ?? 0) + 1)
    }
    return gemeenteCardsForProvince
      .map((g) => ({ ...g, total_count: countMap.get(g.gemeente_code ?? '') ?? 0 }))
      .filter((g) => g.total_count > 0)
  }, [activeStageFilter, gemeenteCardsForProvince, filteredFavorites])

  // Wijken for selected gemeente (unfiltered — used as base for filteredWijkenForGemeente)
  const wijkenForGemeente = useMemo(() => {
    if (!portfolio || !selectedGemeenteCode) return []
    const gem = portfolio.gemeenten.find((g) => g.gemeente_code === selectedGemeenteCode)
    return gem?.wijken ?? []
  }, [portfolio, selectedGemeenteCode])

  // Filtered wijk data — when stage active, recompute counts from filteredFavorites and hide zeros
  const filteredWijkenForGemeente = useMemo(() => {
    if (!activeStageFilter || !selectedGemeenteCode) return wijkenForGemeente
    const countMap = new Map<string, number>()
    for (const f of filteredFavorites) {
      if (f.gemeente_code !== selectedGemeenteCode) continue
      const key = f.wijk_naam ?? 'Onbekende wijk'
      countMap.set(key, (countMap.get(key) ?? 0) + 1)
    }
    return Array.from(countMap.entries())
      .filter(([, count]) => count > 0)
      .map(([wijk_naam, parcel_count]) => ({
        wijk_naam: wijk_naam === 'Onbekende wijk' ? null : wijk_naam,
        parcel_count,
      }))
  }, [activeStageFilter, selectedGemeenteCode, wijkenForGemeente, filteredFavorites])

  // Drill-down navigation handlers — preserve portfolio_stage across all levels
  const handleProvinceSelect = (code: string) => {
    navigate({
      to: '/projecten',
      search: { portfolio_mode: true, portfolio_provincie: code, portfolio_stage: activeStageFilter },
    })
  }

  const handleGemeenteSelect = (gemeenteCode: string) => {
    navigate({
      to: '/projecten',
      search: {
        portfolio_mode: true,
        portfolio_provincie: selectedProvinceCode ?? undefined,
        portfolio_gemeente: gemeenteCode,
        portfolio_stage: activeStageFilter,
      },
    })
  }

  const handleWijkSelect = (wijkNaam: string) => {
    navigate({
      to: '/projecten',
      search: {
        portfolio_mode: true,
        portfolio_provincie: selectedProvinceCode ?? undefined,
        portfolio_gemeente: selectedGemeenteCode ?? undefined,
        portfolio_wijk: wijkNaam || undefined,
        portfolio_stage: activeStageFilter,
      },
    })
  }

  // Empty state
  if (!isLoading && portfolio && portfolio.total_favorites === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 px-6 py-12 text-center">
        <p className="text-neutral-600">
          Nog geen percelen opgeslagen. Gebruik het hart-icoon op de kaart om percelen aan je portfolio toe te voegen.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PortfolioBreadcrumb
        provincieName={provincieName}
        gemeenteName={gemeenteName}
        wijkName={selectedWijkNaam ?? undefined}
      />

      {/* Stage filter pill bar — always visible in portfolio mode */}
      <PipelineStageFilter activeStage={activeStageFilter} />

      {/* Level 4: Parcel cards for selected wijk */}
      {selectedWijkNaam && selectedGemeenteCode && (() => {
        const wijkFavorites = filteredFavorites.filter((f) => {
          if (f.gemeente_code !== selectedGemeenteCode) return false
          // "Onbekende wijk" in URL matches favorites where wijk_naam is null
          if (selectedWijkNaam === 'Onbekende wijk') return f.wijk_naam === null
          return f.wijk_naam === selectedWijkNaam
        })

        return (
          <div>
            <p className="text-sm font-medium text-neutral-600 mb-3">
              {wijkFavorites.length} percelen in {selectedWijkNaam}
              {activeStageFilter && (
                <span className="ml-1 text-neutral-400">(gefilterd op {activeStageFilter})</span>
              )}
            </p>
            {wijkFavorites.length === 0 ? (
              <p className="text-sm text-neutral-500 px-1">Geen opgeslagen percelen in deze wijk.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {wijkFavorites.map((favorite) => (
                  <FavoritedParcelCard
                    key={favorite.id}
                    favorite={favorite}
                    onOpenMap={() => {
                      navigate({
                        to: '/map',
                        search: { gemeente_code: selectedGemeenteCode } as Record<string, string>,
                      })
                      toast.info('Zoek het perceel via het adres-zoekvenster')
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Level 3: Wijk cards for selected gemeente */}
      {!selectedWijkNaam && selectedGemeenteCode && (
        <PortfolioWijkView
          wijken={filteredWijkenForGemeente}
          gemeenteCode={selectedGemeenteCode}
          onWijkSelect={handleWijkSelect}
        />
      )}

      {/* Level 2: Gemeente cards for selected province */}
      {!selectedGemeenteCode && selectedProvinceCode && (
        <PortfolioGemeenteView
          gemeenten={filteredGemeenteCards}
          allGemeenteCards={allGemeenteCards}
          selectedProvinceGeometry={selectedProvinceGeometry}
          onGemeenteSelect={handleGemeenteSelect}
        />
      )}

      {/* Level 1: Province grid */}
      {!selectedProvinceCode && (
        <PortfolioProvincieView
          provinceOptions={provinceOptions}
          provinciesWithFavorites={provinciesWithFavorites}
          favoriteCountByProvince={favoriteCountByProvince}
          provincieGeojson={null}
          onProvinceSelect={handleProvinceSelect}
        />
      )}
    </div>
  )
}
