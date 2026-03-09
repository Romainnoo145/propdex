import type { FysiekRisicoProfiel } from '@/lib/types/property'

type RiskLevel = 'hoog' | 'middel' | 'laag' | 'onbekend'

function getRiskBadgeClasses(risk: RiskLevel): string {
  switch (risk) {
    case 'hoog':
      return 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
    case 'middel':
      return 'bg-amber-500/15 text-amber-400/80 border border-amber-400/20'
    case 'laag':
      return 'bg-grey-800 text-grey-400 border border-grey-700'
    case 'onbekend':
    default:
      return 'bg-grey-800 text-grey-500 border border-grey-700'
  }
}

function getRiskLabel(risk: RiskLevel): string {
  switch (risk) {
    case 'hoog':
      return 'Hoog'
    case 'middel':
      return 'Middel'
    case 'laag':
      return 'Laag'
    case 'onbekend':
    default:
      return 'Onbekend'
  }
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-[10px] font-medium ${getRiskBadgeClasses(risk)}`}
    >
      {getRiskLabel(risk)}
    </span>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-md bg-grey-800"
        />
      ))}
    </div>
  )
}

interface FysiekRisicoprofielSectionProps {
  profiel: FysiekRisicoProfiel | null | undefined
  isLoading: boolean
  isError: boolean
}

export function FysiekRisicoprofielSection({
  profiel,
  isLoading,
  isError,
}: FysiekRisicoprofielSectionProps) {
  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-grey-100">Fysiek Risicoprofiel</h3>
          <span className="rounded px-2 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-400/80 border border-amber-400/20">
            indicatief
          </span>
        </div>
        <SkeletonGrid />
      </div>
    )
  }

  if (isError || !profiel) {
    return (
      <div className="rounded-md border border-grey-800 bg-grey-850 p-4">
        <p className="text-xs text-grey-500">Fysiek risicoprofiel niet beschikbaar</p>
      </div>
    )
  }

  const hasElevatedRisk = profiel.overall_risk === 'hoog' || profiel.overall_risk === 'middel'
  const wrapperClass = hasElevatedRisk
    ? 'border border-amber-500/20 rounded-md p-4 bg-amber-500/[0.02]'
    : ''

  const bodemDossierCount = profiel.bodem_data?.dossiers?.length ?? 0

  return (
    <div className={wrapperClass}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-grey-100">Fysiek Risicoprofiel</h3>
        <span className="rounded px-2 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-400/80 border border-amber-400/20">
          indicatief
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Card 1: Fundering */}
        <div className="rounded-md border border-grey-800 bg-grey-850 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-grey-200">Fundering</p>
            {profiel.foundation_risk && (
              <RiskBadge risk={profiel.foundation_risk.risk} />
            )}
          </div>
          {profiel.foundation_risk && (
            <>
              <p className="mt-1.5 text-xs text-grey-400 line-clamp-3">
                {profiel.foundation_risk.reden}
              </p>
              {profiel.kcaf_cost && (
                <p className="mt-1 text-xs text-amber-400/80">
                  Indicatieve kosten: EUR{' '}
                  {profiel.kcaf_cost.low_eur.toLocaleString('nl-NL')} -{' '}
                  {profiel.kcaf_cost.high_eur.toLocaleString('nl-NL')}
                </p>
              )}
              <p className="mt-2 text-[10px] text-grey-600 italic">
                {profiel.foundation_risk.disclaimer}
              </p>
            </>
          )}
          {!profiel.foundation_risk && (
            <p className="mt-1.5 text-xs text-grey-500">Geen gegevens beschikbaar</p>
          )}
        </div>

        {/* Card 2: Bodemtype */}
        <div className="rounded-md border border-grey-800 bg-grey-850 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-grey-200">Bodemtype</p>
          </div>
          {profiel.soil_profile ? (
            <>
              <p className="mt-1.5 text-sm font-medium text-grey-100">
                {profiel.soil_profile.dominant_type_label}
              </p>
              {profiel.soil_profile.soilname && (
                <p className="mt-0.5 text-[10px] text-grey-500">
                  {profiel.soil_profile.soilname}
                </p>
              )}
              <p className="mt-2 text-[10px] text-grey-600 italic">
                {profiel.soil_profile.disclaimer}
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-xs text-grey-500">Geen gegevens beschikbaar</p>
          )}
        </div>

        {/* Card 3: Asbest */}
        <div className="rounded-md border border-grey-800 bg-grey-850 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-grey-200">Asbest</p>
            {profiel.asbest_indicator && (
              <RiskBadge risk={profiel.asbest_indicator.risk as RiskLevel} />
            )}
          </div>
          {profiel.asbest_indicator ? (
            <>
              <p className="mt-1.5 text-xs text-grey-400 line-clamp-3">
                {profiel.asbest_indicator.reden}
                {profiel.asbest_indicator.gebruiksdoel_factor &&
                  ` (factor: ${profiel.asbest_indicator.gebruiksdoel_factor})`}
              </p>
              <p className="mt-2 text-[10px] text-grey-600 italic">
                Indicatieve inschatting op basis van bouwjaar. Geen vervanging voor
                asbestinventarisatie.
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-xs text-grey-500">Geen gegevens beschikbaar</p>
          )}
        </div>

        {/* Card 4: Verontreiniging */}
        <div className="rounded-md border border-grey-800 bg-grey-850 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-grey-200">Bodemkwaliteit</p>
            {bodemDossierCount > 0 ? (
              <span className="rounded px-2 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-400/80 border border-amber-400/20">
                Dossiers
              </span>
            ) : (
              <span className="rounded px-2 py-0.5 text-[10px] font-medium bg-grey-800 text-grey-500 border border-grey-700">
                Geen dossiers
              </span>
            )}
          </div>
          {profiel.bodem_data ? (
            <>
              <p className="mt-1.5 text-xs text-grey-400">
                {bodemDossierCount > 0
                  ? `${bodemDossierCount} WBB-dossier${bodemDossierCount !== 1 ? 's' : ''} in de omgeving`
                  : 'Geen bekende bodemverontreinigingsdossiers'}
              </p>
              <p className="mt-2 text-[10px] text-grey-600 italic">
                {profiel.bodem_data.disclaimer}
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-xs text-grey-500">Geen gegevens beschikbaar</p>
          )}
        </div>
      </div>
    </div>
  )
}
