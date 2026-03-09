import { BentoPod } from '@/components/primitives/BentoPod'
import type { ScanResultItem, BuildingMetrics } from '@/lib/types/scan'

function formatScoreLabel(score: number | null): string {
  if (score == null) return 'Onbekend'
  if (score >= 70) return 'Zeer interessant'
  if (score >= 50) return 'Interessant'
  if (score >= 30) return 'Twijfelachtig'
  return 'Laag potentieel'
}

function scoreColor(score: number | null): string {
  if (score == null) return 'text-neutral-400'
  if (score >= 70) return 'text-aura-green'
  if (score >= 50) return 'text-aura-amber'
  if (score >= 30) return 'text-amber-500'
  return 'text-neutral-400'
}

function hasResidentialMixedBestemming(
  bestemmingen: ScanResultItem['bestemmingen'],
): boolean {
  if (!Array.isArray(bestemmingen)) return false
  return bestemmingen.some((b) => {
    const type = (b as { type?: string | null }).type ?? ''
    const naam = (b as { naam?: string | null }).naam ?? ''
    const candidate = `${type} ${naam}`.toLowerCase()
    return candidate.includes('wonen') || candidate.includes('gemengd') || candidate.includes('centrum')
  })
}

function deriveTransformatiePotentie(
  metrics: BuildingMetrics | null,
  bouwjaar: number | null,
  supportsResidentialMixed: boolean,
  area_m2: number | null,
): { score: number; label: string } {
  const bouwhoogte = metrics?.max_bouwhoogte ?? null
  const bouwlagen = metrics?.max_bouwlagen ?? null
  const hasDSOData = bouwhoogte != null || bouwlagen != null
  const actualHoogte = metrics?.actual_bouwhoogte ?? null
  const actualLagen = metrics?.actual_bouwlagen ?? null
  const has3DData = actualHoogte != null || actualLagen != null

  if (has3DData && hasDSOData) {
    const hoogteHeadroom =
      actualHoogte != null && bouwhoogte != null && bouwhoogte > 0
        ? Math.max(0, 1 - actualHoogte / bouwhoogte)
        : null
    const lagenHeadroom =
      actualLagen != null && bouwlagen != null && bouwlagen > 0
        ? Math.max(0, 1 - actualLagen / bouwlagen)
        : null
    const headroom =
      hoogteHeadroom != null && lagenHeadroom != null
        ? Math.max(hoogteHeadroom, lagenHeadroom)
        : (hoogteHeadroom ?? lagenHeadroom ?? 0)
    const headroomPts = headroom >= 0.6 ? 50 : headroom >= 0.4 ? 35 : headroom >= 0.2 ? 20 : 10
    const bestemmingPts = supportsResidentialMixed ? 20 : 5
    const areaScore = area_m2 == null ? 8 : area_m2 > 5000 ? 15 : area_m2 > 1000 ? 12 : area_m2 > 200 ? 8 : 3
    const score = Math.min(100, headroomPts + bestemmingPts + areaScore)
    const parts: string[] = []
    if (actualLagen != null) parts.push(`${actualLagen}/${bouwlagen ?? '?'} lagen`)
    if (actualHoogte != null) parts.push(`${actualHoogte}/${bouwhoogte ?? '?'}m`)
    parts.push(supportsResidentialMixed ? 'wonen ok' : 'geen wonen')
    return { score, label: parts.join(' \u00b7 ') }
  }

  if (hasDSOData) {
    const hoogtePts = bouwhoogte == null ? 0 : bouwhoogte >= 15 ? 35 : bouwhoogte >= 10 ? 25 : bouwhoogte >= 7 ? 18 : bouwhoogte >= 4 ? 10 : 5
    const lagenPts = bouwlagen == null ? 0 : bouwlagen >= 5 ? 30 : bouwlagen >= 4 ? 25 : bouwlagen >= 3 ? 18 : bouwlagen >= 2 ? 10 : 5
    const buildingPts = bouwhoogte != null && bouwlagen != null ? Math.max(hoogtePts, lagenPts) : hoogtePts + lagenPts
    const bestemmingPts = supportsResidentialMixed ? 20 : 5
    const areaScore = area_m2 == null ? 3 : area_m2 >= 2000 ? 15 : area_m2 >= 1000 ? 10 : area_m2 >= 500 ? 6 : 3
    const score = Math.min(100, buildingPts + bestemmingPts + areaScore)
    const parts: string[] = []
    if (bouwlagen != null) parts.push(`${bouwlagen} lagen`)
    if (bouwhoogte != null) parts.push(`${bouwhoogte}m`)
    parts.push(supportsResidentialMixed ? 'wonen ok' : 'geen wonen')
    return { score, label: parts.join(' \u00b7 ') }
  }

  const bouwjaarScore = bouwjaar == null ? 10 : bouwjaar < 1960 ? 30 : bouwjaar < 1980 ? 22 : bouwjaar < 2000 ? 14 : bouwjaar < 2010 ? 8 : 3
  const bestemmingScore = supportsResidentialMixed ? 30 : 10
  const areaScore = area_m2 == null ? 5 : area_m2 >= 2000 ? 20 : area_m2 >= 1000 ? 15 : area_m2 >= 500 ? 10 : 3
  const score = bouwjaarScore + bestemmingScore + areaScore
  const parts: string[] = []
  if (bouwjaar != null) parts.push(`Bouwjaar ${bouwjaar}`)
  parts.push(supportsResidentialMixed ? 'wonen ok' : 'niet-wonen')
  return { score, label: parts.join(' \u00b7 ') }
}

function formatPandStatusLabel(status: string | null | undefined, hasPand: boolean): string {
  if (!status) return hasPand ? 'Onbekend' : 'Geen gebouw'
  const n = status.trim().toLowerCase()
  if (n.includes('in gebruik')) return 'Pand in gebruik'
  if (n.includes('verbouwing')) return 'In verbouwing'
  if (n.includes('gesloopt')) return 'Gesloopt'
  if (n.includes('buiten gebruik')) return 'Buiten gebruik'
  if (n.includes('bouw gestart')) return 'Bouw gestart'
  return status
}

interface PotentieLayerProps {
  parcel: ScanResultItem
}

export function PotentieLayer({ parcel }: PotentieLayerProps) {
  const supportsResidentialMixed = hasResidentialMixedBestemming(parcel.bestemmingen)
  const rawPandOpp = parcel.building_metrics?.pand_oppervlakte_m2 ?? null
  const pandOppervlaktM2 = rawPandOpp === 0 && parcel.has_pand ? null : rawPandOpp
  const vrijeRuimtePct =
    pandOppervlaktM2 != null && parcel.area_m2 != null && parcel.area_m2 > 0
      ? Math.max(0, Math.min(100, (1 - pandOppervlaktM2 / parcel.area_m2) * 100))
      : null
  const transformatie = deriveTransformatiePotentie(
    parcel.building_metrics,
    parcel.bouwjaar,
    supportsResidentialMixed,
    parcel.area_m2,
  )
  const statusLabel = formatPandStatusLabel(parcel.pand_status, parcel.has_pand)

  if (parcel.score == null && vrijeRuimtePct == null && transformatie.score === 0) {
    return (
      <div className="px-4 py-6">
        <p className="text-sm text-neutral-400">Geen potentie data beschikbaar</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 px-4 pb-4">
      {/* Overall score */}
      <BentoPod>
        <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Propdex Score</p>
        <div className="flex items-baseline gap-3">
          <span className={`text-3xl font-bold tabular-nums ${scoreColor(parcel.score)}`}>
            {parcel.score != null ? Math.round(parcel.score) : '--'}
          </span>
          <span className="text-sm text-neutral-500">{formatScoreLabel(parcel.score)}</span>
        </div>
      </BentoPod>

      {/* Vrije ruimte */}
      <BentoPod>
        <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Vrije ruimte</p>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold tabular-nums text-aura-ink">
            {vrijeRuimtePct != null ? `${Math.round(vrijeRuimtePct)}%` : '--'}
          </span>
          {pandOppervlaktM2 != null && parcel.area_m2 != null && (
            <span className="text-xs text-neutral-500">
              {Math.round(pandOppervlaktM2)} m\u00b2 bebouwd van {Math.round(parcel.area_m2)} m\u00b2
            </span>
          )}
        </div>
        {vrijeRuimtePct != null && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-aura-amber"
              style={{ width: `${Math.round(vrijeRuimtePct)}%` }}
            />
          </div>
        )}
      </BentoPod>

      {/* Transformatiepotentie */}
      <BentoPod>
        <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Transformatiepotentie</p>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold tabular-nums text-aura-ink">
            {transformatie.score}%
          </span>
          <span className="text-xs text-neutral-500">{transformatie.label}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-aura-amber"
            style={{ width: `${Math.min(100, transformatie.score)}%` }}
          />
        </div>
      </BentoPod>

      {/* Property basics 2-col grid */}
      <BentoPod>
        <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Gebouwinformatie</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <p className="text-[11px] text-neutral-400">Oppervlak</p>
            <p className="font-medium text-aura-ink tabular-nums">
              {parcel.area_m2 != null ? `${Math.round(parcel.area_m2).toLocaleString('nl-NL')} m\u00b2` : '--'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Bouwjaar</p>
            <p className="font-medium text-aura-ink">{parcel.bouwjaar ?? 'Onbekend'}</p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Gebouw</p>
            <p className="font-medium text-aura-ink">{parcel.has_pand ? 'Ja' : 'Nee'}</p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Status</p>
            <p className="font-medium text-aura-ink">{statusLabel}</p>
          </div>
        </div>
      </BentoPod>
    </div>
  )
}
