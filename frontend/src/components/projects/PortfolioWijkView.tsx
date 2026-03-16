import { useNavigate } from '@tanstack/react-router'
import type { PortfolioWijkGroup } from '@/lib/types/portfolio'

interface PortfolioWijkViewProps {
  /** Wijk groups from portfolio API */
  wijken: PortfolioWijkGroup[]
  /** For ghost button navigation to map */
  gemeenteCode: string
  onWijkSelect: (wijkNaam: string) => void
}

/**
 * Grid of wijk cards for the selected gemeente.
 *
 * Each card shows the wijk name and an amber count badge (FAV-04).
 * Null wijk_naam gracefully falls back to "Onbekende wijk".
 * Ghost button navigates to map filtered by gemeente.
 */
export function PortfolioWijkView({
  wijken,
  gemeenteCode,
  onWijkSelect,
}: PortfolioWijkViewProps) {
  const navigate = useNavigate()

  if (wijken.length === 0) {
    return (
      <p className="text-sm text-neutral-500 px-1">
        Geen wijken met opgeslagen percelen gevonden voor deze gemeente.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {wijken.map((wijk, idx) => {
        const displayName = wijk.wijk_naam ?? 'Onbekende wijk'
        return (
          <div
            key={`${wijk.wijk_naam ?? 'unknown'}-${idx}`}
            onClick={() => onWijkSelect(wijk.wijk_naam ?? '')}
            className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 p-4 cursor-pointer transition-all hover:border-aura-amber/40 hover:shadow-[0_0_0_1px_rgba(217,170,56,0.10)]"
          >
            {/* Name + badge row */}
            <div className="flex items-start justify-between gap-2">
              <p className="text-base font-semibold text-aura-ink leading-tight">
                {displayName}
              </p>
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-aura-amber/15 px-2.5 py-0.5 text-xs font-semibold text-aura-amber">
                {wijk.parcel_count}
                <span className="font-normal text-aura-amber/80">percelen</span>
              </span>
            </div>

            {/* Ghost button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate({ to: '/map', search: { gemeente_code: gemeenteCode } as Record<string, string> })
              }}
              className="mt-3 text-xs text-aura-amber underline underline-offset-2 hover:text-aura-amber/80 transition-colors"
            >
              Bekijk op kaart &rarr;
            </button>
          </div>
        )
      })}
    </div>
  )
}
