import type { CbsNeighborhoodMetrics } from '@/lib/types/scan'

interface CbsNeighborhoodCardProps {
  metrics: CbsNeighborhoodMetrics
}

/**
 * Displays CBS Wijkstatistieken for a scanned wijk.
 *
 * Returns null when all key metrics are unavailable.
 * Individual null metrics are simply not rendered (partial data is fine).
 */
export function CbsNeighborhoodCard({ metrics }: CbsNeighborhoodCardProps) {
  const { data, peiljaar } = metrics
  const { gemiddelde_woz_waarde, stedelijkheid, demografie, bouwjaar_distributie } = data

  // Return null when all key metrics are null — no broken empty card
  const hasAnyData =
    gemiddelde_woz_waarde != null ||
    stedelijkheid.klasse != null ||
    demografie.aantal_inwoners != null

  if (!hasAnyData) return null

  // Stedelijkheid badge color mapping — amber palette
  function stedelijkheidBadgeClass(klasse: number): string {
    if (klasse === 1) return 'bg-aura-amber/20 text-aura-amber border border-aura-amber/30'
    if (klasse === 2) return 'bg-aura-amber/15 text-aura-amber/80 border border-aura-amber/20'
    if (klasse === 3) return 'bg-amber-100/60 text-amber-700 border border-amber-200'
    if (klasse === 4) return 'bg-amber-50/60 text-amber-600 border border-amber-100'
    return 'bg-amber-50/40 text-amber-500 border border-amber-100/60'
  }

  const hasKoopHuur =
    demografie.percentage_koopwoningen != null && demografie.percentage_huurwoningen != null

  return (
    <section className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2.5">
        {/* Bar chart icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-aura-amber/70"
        >
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <span className="text-xs font-medium uppercase tracking-wide text-aura-amber/70">
          CBS Wijkstatistieken
        </span>
        <span className="ml-auto text-xs text-neutral-500">
          Bron: CBS StatLine, peiljaar {peiljaar}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">

        {/* Stedelijkheid badge */}
        {stedelijkheid.klasse != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-600">Stedelijkheid</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${stedelijkheidBadgeClass(stedelijkheid.klasse)}`}
            >
              <span className="font-bold">{stedelijkheid.klasse}</span>
              <span>{stedelijkheid.omschrijving}</span>
            </span>
          </div>
        )}

        {/* WOZ gemiddelde */}
        {gemiddelde_woz_waarde != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-600">Gem. WOZ-waarde</span>
            <span className="text-xs font-medium text-aura-ink">
              &euro;{Math.round(gemiddelde_woz_waarde * 1000).toLocaleString('nl-NL')}
            </span>
          </div>
        )}

        {/* Inwoners */}
        {demografie.aantal_inwoners != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-600">Inwoners</span>
            <span className="text-xs font-medium text-aura-ink">
              {demografie.aantal_inwoners.toLocaleString('nl-NL')}
            </span>
          </div>
        )}

        {/* Koop / Huur ratio bar */}
        {hasKoopHuur && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-600">Koop / Huur</span>
              <span className="text-xs font-medium text-neutral-700">
                {demografie.percentage_koopwoningen}% / {demografie.percentage_huurwoningen}%
              </span>
            </div>
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-aura-amber/70"
                style={{ width: `${demografie.percentage_koopwoningen}%` }}
              />
            </div>
          </div>
        )}

        {/* Omgevingsadressendichtheid */}
        {stedelijkheid.omgevingsadressendichtheid != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-600">Adressendichtheid</span>
            <span className="text-xs font-medium text-aura-ink">
              {stedelijkheid.omgevingsadressendichtheid.toLocaleString('nl-NL')} adressen/km&sup2;
            </span>
          </div>
        )}

        {/* Bouwjaar distributie */}
        {(bouwjaar_distributie.percentage_bouwjaar_voor_2000 != null ||
          bouwjaar_distributie.percentage_bouwjaar_vanaf_2000 != null) && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-600">Bouwjaar voor 2000</span>
            <span className="text-xs font-medium text-aura-ink">
              {bouwjaar_distributie.percentage_bouwjaar_voor_2000 != null
                ? `${bouwjaar_distributie.percentage_bouwjaar_voor_2000}%`
                : '—'}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
