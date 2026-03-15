import { useNavigate } from '@tanstack/react-router'
import type { ProvinceOption, GemeenteScopeCard } from '@/hooks/useMunicipalityWorkspaceStats'
import { GemeenteCard } from './GemeenteCard'
import { GemeenteCardGrid, GemeenteCardGridSkeleton } from './GemeenteCardGrid'
import {
  geoJsonToSvgPath,
  geoJsonToSvgDualPath,
} from '@/lib/geo-utils'
import { toProjectenGemeenteSearch } from '@/lib/navigation/workspaceSearch'
import { ProvinceStatIcon, GemeenteStatIcon } from './ProjectIcons'

interface ProvincieViewProps {
  provinceOptions: ProvinceOption[]
  selectedProvince: ProvinceOption | null
  selectedProvinceCode: string | null
  provinceStatsByCode: Map<string, { gemeenten: number; meldingen: number }>
  recentCards: GemeenteScopeCard[]
  favoriteSelectedProvinceCards: GemeenteScopeCard[]
  nonFavoriteSelectedProvinceCards: GemeenteScopeCard[]
  selectedProvinceGemeenteCards: GemeenteScopeCard[]
  favoriteCodeSet: Set<string>
  standaloneWijkCountInSelectedProvince: number
  gemeenteGeojson: GeoJSON.FeatureCollection | null | undefined
  provincieGeojson: GeoJSON.FeatureCollection | null | undefined
  onProvinceSelect: (code: string) => void
  onToggleFavoriteGemeente: (code: string) => void
  onRegisterRecentGemeente: (code: string) => void
}

export function ProvincieView({
  provinceOptions,
  selectedProvince,
  selectedProvinceCode,
  provinceStatsByCode,
  recentCards,
  favoriteSelectedProvinceCards,
  nonFavoriteSelectedProvinceCards,
  selectedProvinceGemeenteCards,
  favoriteCodeSet,
  standaloneWijkCountInSelectedProvince,
  gemeenteGeojson,
  provincieGeojson,
  onProvinceSelect,
  onToggleFavoriteGemeente,
  onRegisterRecentGemeente,
}: ProvincieViewProps) {
  const navigate = useNavigate()

  const renderGemeenteCard = (card: GemeenteScopeCard) => {
    const siblings = selectedProvinceGemeenteCards
      .filter((candidate) => candidate.code !== card.code)
      .map((candidate) => candidate.geometry)
    const svgData = selectedProvince?.geometry
      ? geoJsonToSvgDualPath(card.geometry, selectedProvince.geometry, siblings)
      : geoJsonToSvgPath(card.geometry)

    const normalizedSvgData = 'primaryD' in svgData
      ? svgData
      : { primaryD: svgData.d, viewBox: svgData.viewBox }

    return (
      <GemeenteCard
        key={card.code}
        gemeenteName={card.naam}
        gemeenteCode={card.code}
        svgData={normalizedSvgData}
        totalUnread={card.totalUnread}
        stats={{
          linkedWijken: card.linkedWijken,
          completedWijken: card.completedWijken,
          rapporten: card.rapporten,
          meldingen: card.meldingen,
        }}
        isFavorite={favoriteCodeSet.has(card.code)}
        onToggleFavorite={() => onToggleFavoriteGemeente(card.code)}
        onClick={() => {
          onRegisterRecentGemeente(card.code)
          if (card.project) {
            navigate({
              to: '/projecten',
              search: toProjectenGemeenteSearch({
                gemeenteId: card.project.id,
                gemeenteCode: card.code,
                provincieCode: selectedProvinceCode ?? card.provinceCode,
              }),
            })
            return
          }
          navigate({
            to: '/projecten',
            search: toProjectenGemeenteSearch({
              gemeenteCode: card.code,
              provincieCode: selectedProvinceCode ?? card.provinceCode,
            }),
          })
        }}
      />
    )
  }

  if (!gemeenteGeojson || !provincieGeojson) {
    return <GemeenteCardGridSkeleton count={12} />
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.65fr)]">
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-aura-glass-white/60">
          <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2.5">
            <ProvinceStatIcon />
            <span className="text-xs font-medium uppercase tracking-wide text-aura-amber/70">
              Provincies
            </span>
            <span className="ml-auto text-xs text-neutral-500">{provinceOptions.length}</span>
          </div>
          <div className="max-h-[680px] overflow-y-auto p-3">
            <div className="space-y-2">
              {provinceOptions.map((province) => {
                const stats = provinceStatsByCode.get(province.code) ?? { gemeenten: 0, meldingen: 0 }
                const isActive = selectedProvince?.code === province.code
                return (
                  <button
                    key={province.code}
                    onClick={() => onProvinceSelect(province.code)}
                    className={`relative w-full overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'border-aura-amber/35 bg-neutral-50 shadow-[0_0_0_1px_rgba(217,170,56,0.14)]'
                        : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-50'
                    }`}
                  >
                    <span className={`absolute inset-y-1 left-0 w-1 rounded-r ${isActive ? 'bg-aura-amber' : 'bg-transparent'}`} />
                    <p className="truncate pl-1 text-sm font-semibold text-aura-ink">
                      {province.naam}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 pl-1 text-[11px] text-neutral-500">
                      <span>{stats.gemeenten} gemeenten</span>
                      <span className="text-neutral-500">&middot;</span>
                      <span className={stats.meldingen > 0 ? 'text-aura-amber' : 'text-neutral-500'}>
                        {stats.meldingen} meldingen
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-aura-glass-white/60">
          <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2.5">
            <GemeenteStatIcon />
            <span className="text-xs font-medium uppercase tracking-wide text-aura-amber/70">
              Kies gemeente {selectedProvince ? `· ${selectedProvince.naam}` : ''}
            </span>
            <span className="ml-auto text-xs text-neutral-500">{selectedProvinceGemeenteCards.length}</span>
          </div>
          <div className="space-y-4 p-4">
            {selectedProvince && standaloneWijkCountInSelectedProvince > 0 && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
                {standaloneWijkCountInSelectedProvince} losse wijkprojecten zijn automatisch meegeteld bij gemeenten in {selectedProvince.naam}.
              </div>
            )}
            {selectedProvince && recentCards.length > 0 && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Recent bekeken</p>
                <div className="flex flex-wrap gap-2">
                  {recentCards.map((card) => (
                    <button
                      key={`recent-${card.code}`}
                      onClick={() => {
                        onRegisterRecentGemeente(card.code)
                        if (card.project) {
                          navigate({
                            to: '/projecten',
                            search: toProjectenGemeenteSearch({
                              gemeenteId: card.project.id,
                              gemeenteCode: card.code,
                              provincieCode: selectedProvinceCode ?? card.provinceCode,
                            }),
                          })
                          return
                        }
                        navigate({
                          to: '/projecten',
                          search: toProjectenGemeenteSearch({
                            gemeenteCode: card.code,
                            provincieCode: selectedProvinceCode ?? card.provinceCode,
                          }),
                        })
                      }}
                      className="rounded-full border border-neutral-200/[0.1] bg-neutral-50 px-3 py-1 text-xs text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-aura-ink"
                    >
                      {card.naam}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {favoriteSelectedProvinceCards.length > 0 && (
              <GemeenteCardGrid>
                {favoriteSelectedProvinceCards.map((card) => renderGemeenteCard(card))}
              </GemeenteCardGrid>
            )}
            {favoriteSelectedProvinceCards.length > 0 && nonFavoriteSelectedProvinceCards.length > 0 && (
              <div className="my-4 flex items-center gap-3 px-1">
                <div className="h-px flex-1 bg-neutral-50" />
                <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                  Overige gemeenten
                </span>
                <div className="h-px flex-1 bg-neutral-50" />
              </div>
            )}
            {nonFavoriteSelectedProvinceCards.length > 0 && (
              <GemeenteCardGrid>
                {nonFavoriteSelectedProvinceCards.map((card) => renderGemeenteCard(card))}
              </GemeenteCardGrid>
            )}
            {selectedProvince && selectedProvinceGemeenteCards.length === 0 && (
              <p className="text-sm text-neutral-500">
                Geen gemeenten gevonden voor {selectedProvince.naam}.
              </p>
            )}
            {!selectedProvince && (
              <p className="text-sm text-neutral-500">
                Selecteer links een provincie.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
