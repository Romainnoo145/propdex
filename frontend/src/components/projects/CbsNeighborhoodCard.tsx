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

  // Stedelijkheid badge color mapping
  function stedelijkheidBadgeClass(klasse: number): string {
    if (klasse === 1) return 'bg-amber-accent/20 text-amber-accent border border-amber-accent/30'
    if (klasse === 2) return 'bg-amber-accent/10 text-amber-accent/80 border border-amber-accent/20'
    if (klasse === 3) return 'bg-grey-700/50 text-grey-300 border border-grey-700'
    return 'bg-grey-800/50 text-grey-400 border border-grey-750'
  }

  const hasKoopHuur =
    demografie.percentage_koopwoningen != null && demografie.percentage_huurwoningen != null

  return (
    <section className="rounded-xl border border-overlay/5 bg-grey-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-overlay/5 px-4 py-2.5">
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
          className="text-amber-accent/70"
        >
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <span className="text-xs font-medium uppercase tracking-wide text-amber-accent/70">
          CBS Wijkstatistieken
        </span>
        <span className="ml-auto text-xs text-grey-600">
          Bron: CBS StatLine, peiljaar {peiljaar}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">

        {/* Stedelijkheid badge */}
        {stedelijkheid.klasse != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-grey-400">Stedelijkheid</span>
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
            <span className="text-xs text-grey-400">Gem. WOZ-waarde</span>
            <span className="text-xs font-medium text-grey-100">
              &euro;{Math.round(gemiddelde_woz_waarde * 1000).toLocaleString('nl-NL')}
            </span>
          </div>
        )}

        {/* Inwoners */}
        {demografie.aantal_inwoners != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-grey-400">Inwoners</span>
            <span className="text-xs font-medium text-grey-100">
              {demografie.aantal_inwoners.toLocaleString('nl-NL')}
            </span>
          </div>
        )}

        {/* Koop / Huur ratio bar */}
        {hasKoopHuur && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-grey-400">Koop / Huur</span>
              <span className="text-xs font-medium text-grey-300">
                {demografie.percentage_koopwoningen}% / {demografie.percentage_huurwoningen}%
              </span>
            </div>
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-grey-800">
              <div
                className="h-full rounded-full bg-amber-accent/70"
                style={{ width: `${demografie.percentage_koopwoningen}%` }}
              />
            </div>
          </div>
        )}

        {/* Omgevingsadressendichtheid */}
        {stedelijkheid.omgevingsadressendichtheid != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-grey-400">Adressendichtheid</span>
            <span className="text-xs font-medium text-grey-100">
              {stedelijkheid.omgevingsadressendichtheid.toLocaleString('nl-NL')} adressen/km&sup2;
            </span>
          </div>
        )}

        {/* Bouwjaar distributie */}
        {(bouwjaar_distributie.percentage_bouwjaar_voor_2000 != null ||
          bouwjaar_distributie.percentage_bouwjaar_vanaf_2000 != null) && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-grey-400">Bouwjaar voor 2000</span>
            <span className="text-xs font-medium text-grey-100">
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
