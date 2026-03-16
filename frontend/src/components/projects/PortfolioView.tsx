import { useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { usePortfolio } from '@/hooks/useFavorites'
import type { GemeenteScopeCard, ProvinceOption } from '@/hooks/useMunicipalityWorkspaceStats'
import { PortfolioBreadcrumb } from './PortfolioBreadcrumb'
import { PortfolioProvincieView } from './PortfolioProvincieView'
import { PortfolioGemeenteView } from './PortfolioGemeenteView'
import { PortfolioWijkView } from './PortfolioWijkView'

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
 *   - Has portfolio_wijk      → Placeholder parcel list (plan 2 will add FavoritedParcelCard)
 *
 * Always renders PortfolioBreadcrumb above the level view.
 */
export function PortfolioView({
  allGemeenteCards,
  provinceOptions,
}: PortfolioViewProps) {
  const navigate = useNavigate()
  const search = useSearch({ from: '/_authenticated/projecten' })
  const { data: portfolio, isLoading } = usePortfolio()

  const selectedProvinceCode = search.portfolio_provincie ?? null
  const selectedGemeenteCode = search.portfolio_gemeente ?? null
  const selectedWijkNaam = search.portfolio_wijk ?? null

  // Derive favorite counts by province using allGemeenteCards province assignment
  const { favoriteCountByProvince, provinciesWithFavorites } = useMemo(() => {
    const countMap = new Map<string, number>()
    const withFavorites = new Set<string>()

    if (!portfolio) return { favoriteCountByProvince: countMap, provinciesWithFavorites: withFavorites }

    // Build gemeente_code → provinceCode lookup
    const gemeenteToProvince = new Map(allGemeenteCards.map((c) => [c.code, c.provinceCode]))

    for (const gemeente of portfolio.gemeenten) {
      if (!gemeente.gemeente_code) continue
      const provinceCode = gemeenteToProvince.get(gemeente.gemeente_code)
      if (!provinceCode) continue
      const prev = countMap.get(provinceCode) ?? 0
      countMap.set(provinceCode, prev + gemeente.total_count)
      withFavorites.add(provinceCode)
    }

    return { favoriteCountByProvince: countMap, provinciesWithFavorites: withFavorites }
  }, [portfolio, allGemeenteCards])

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

  // Gemeenten in selected province, from portfolio data
  const gemeenteCardsForProvince = useMemo(() => {
    if (!portfolio || !selectedProvinceCode) return []
    const gemeenteToProvince = new Map(allGemeenteCards.map((c) => [c.code, c.provinceCode]))
    return portfolio.gemeenten.filter(
      (g) => g.gemeente_code && gemeenteToProvince.get(g.gemeente_code) === selectedProvinceCode
    )
  }, [portfolio, selectedProvinceCode, allGemeenteCards])

  // Wijken for selected gemeente
  const wijkenForGemeente = useMemo(() => {
    if (!portfolio || !selectedGemeenteCode) return []
    const gem = portfolio.gemeenten.find((g) => g.gemeente_code === selectedGemeenteCode)
    return gem?.wijken ?? []
  }, [portfolio, selectedGemeenteCode])

  // Drill-down navigation handlers
  const handleProvinceSelect = (code: string) => {
    navigate({
      to: '/projecten',
      search: { portfolio_mode: true, portfolio_provincie: code },
    })
  }

  const handleGemeenteSelect = (gemeenteCode: string) => {
    navigate({
      to: '/projecten',
      search: {
        portfolio_mode: true,
        portfolio_provincie: selectedProvinceCode ?? undefined,
        portfolio_gemeente: gemeenteCode,
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

      {/* Level 4: Parcel list for selected wijk */}
      {selectedWijkNaam && selectedGemeenteCode && (
        <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 px-6 py-8 text-center">
          <p className="text-sm text-neutral-600">
            Percelen voor <span className="font-semibold">{selectedWijkNaam}</span> worden hier getoond in plan 2.
          </p>
        </div>
      )}

      {/* Level 3: Wijk cards for selected gemeente */}
      {!selectedWijkNaam && selectedGemeenteCode && (
        <PortfolioWijkView
          wijken={wijkenForGemeente}
          gemeenteCode={selectedGemeenteCode}
          onWijkSelect={handleWijkSelect}
        />
      )}

      {/* Level 2: Gemeente cards for selected province */}
      {!selectedGemeenteCode && selectedProvinceCode && (
        <PortfolioGemeenteView
          gemeenten={gemeenteCardsForProvince}
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
