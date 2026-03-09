import { BentoPod } from '@/components/primitives/BentoPod'
import type { ScanResultItem } from '@/lib/types/scan'
import type { FysiekRisicoProfiel } from '@/lib/types/property'

type RiskLevel = 'hoog' | 'middel' | 'laag' | 'onbekend'

function riskDotColor(risk: RiskLevel): string {
  switch (risk) {
    case 'hoog':
      return 'bg-red-500'
    case 'middel':
      return 'bg-amber-500'
    case 'laag':
      return 'bg-aura-green'
    default:
      return 'bg-neutral-300'
  }
}

function riskLabel(risk: RiskLevel): string {
  switch (risk) {
    case 'hoog':
      return 'Hoog'
    case 'middel':
      return 'Middel'
    case 'laag':
      return 'Laag'
    default:
      return 'Onbekend'
  }
}

function SkeletonCards() {
  return (
    <div className="space-y-3 px-4 pb-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-neutral-200" />
      ))}
    </div>
  )
}

interface RisicoLayerProps {
  parcel: ScanResultItem
  riskProfile: FysiekRisicoProfiel | null
  isLoading?: boolean
}

export function RisicoLayer({ parcel: _parcel, riskProfile, isLoading }: RisicoLayerProps) {
  if (isLoading) return <SkeletonCards />

  if (!riskProfile) {
    return (
      <div className="px-4 py-6">
        <p className="text-sm text-neutral-400">Geen risicodata beschikbaar</p>
      </div>
    )
  }

  const bodemDossierCount = riskProfile.bodem_data?.dossiers?.length ?? 0

  return (
    <div className="space-y-3 px-4 pb-4">
      {/* Overall risk */}
      <BentoPod>
        <div className="flex items-center gap-2 mb-1">
          <span className={`h-3 w-3 rounded-full ${riskDotColor(riskProfile.overall_risk)}`} />
          <p className="text-sm font-semibold text-aura-ink capitalize">
            Risico: {riskLabel(riskProfile.overall_risk)}
          </p>
        </div>
        <p className="text-xs text-neutral-500">{riskProfile.overall_explanation}</p>
      </BentoPod>

      {/* Fundering */}
      <BentoPod>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-aura-ink">Fundering</p>
          {riskProfile.foundation_risk && (
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${riskDotColor(riskProfile.foundation_risk.risk)}`} />
              <span className="text-[11px] text-neutral-500">{riskLabel(riskProfile.foundation_risk.risk)}</span>
            </div>
          )}
        </div>
        {riskProfile.foundation_risk ? (
          <>
            <p className="text-xs text-neutral-600">{riskProfile.foundation_risk.reden}</p>
            {riskProfile.kcaf_cost && (
              <p className="mt-1 text-xs text-amber-500">
                Indicatieve kosten: EUR {riskProfile.kcaf_cost.low_eur.toLocaleString('nl-NL')} - {riskProfile.kcaf_cost.high_eur.toLocaleString('nl-NL')}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-neutral-400">Geen gegevens beschikbaar</p>
        )}
      </BentoPod>

      {/* Bodemtype */}
      <BentoPod>
        <p className="text-xs font-medium text-aura-ink mb-1">Bodemtype</p>
        {riskProfile.soil_profile ? (
          <>
            <p className="text-sm font-medium text-aura-ink">{riskProfile.soil_profile.dominant_type_label}</p>
            {riskProfile.soil_profile.soilname && (
              <p className="text-[11px] text-neutral-500">{riskProfile.soil_profile.soilname}</p>
            )}
          </>
        ) : (
          <p className="text-xs text-neutral-400">Geen gegevens beschikbaar</p>
        )}
      </BentoPod>

      {/* Asbest */}
      <BentoPod>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-aura-ink">Asbest</p>
          {riskProfile.asbest_indicator && (
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${riskDotColor(riskProfile.asbest_indicator.risk as RiskLevel)}`} />
              <span className="text-[11px] text-neutral-500">{riskLabel(riskProfile.asbest_indicator.risk as RiskLevel)}</span>
            </div>
          )}
        </div>
        {riskProfile.asbest_indicator ? (
          <p className="text-xs text-neutral-600">
            {riskProfile.asbest_indicator.reden}
            {riskProfile.asbest_indicator.gebruiksdoel_factor && ` (factor: ${riskProfile.asbest_indicator.gebruiksdoel_factor})`}
          </p>
        ) : (
          <p className="text-xs text-neutral-400">Geen gegevens beschikbaar</p>
        )}
      </BentoPod>

      {/* Bodemkwaliteit */}
      <BentoPod>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-aura-ink">Bodemkwaliteit</p>
          <span className="text-[11px] text-neutral-500">
            {bodemDossierCount > 0 ? `${bodemDossierCount} dossier${bodemDossierCount !== 1 ? 's' : ''}` : 'Geen dossiers'}
          </span>
        </div>
        {riskProfile.bodem_data ? (
          <p className="text-xs text-neutral-600">
            {bodemDossierCount > 0
              ? `${bodemDossierCount} WBB-dossier${bodemDossierCount !== 1 ? 's' : ''} in de omgeving`
              : 'Geen bekende bodemverontreinigingsdossiers'}
          </p>
        ) : (
          <p className="text-xs text-neutral-400">Geen gegevens beschikbaar</p>
        )}
      </BentoPod>
    </div>
  )
}
