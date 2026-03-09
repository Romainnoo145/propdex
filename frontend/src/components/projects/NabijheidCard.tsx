import type { CbsNabijheid } from '@/lib/types/scan'

interface NabijheidCardProps {
  nabijheid: CbsNabijheid
}

const FACILITIES: { key: keyof CbsNabijheid['afstanden']; label: string; type: 'daily' | 'transport' }[] = [
  { key: 'supermarkt_km', label: 'Supermarkt', type: 'daily' },
  { key: 'huisarts_km', label: 'Huisarts', type: 'daily' },
  { key: 'basisschool_km', label: 'Basisschool', type: 'daily' },
  { key: 'kinderdagverblijf_km', label: 'Kinderdagverblijf', type: 'daily' },
  { key: 'treinstation_km', label: 'Treinstation', type: 'transport' },
  { key: 'overstapstation_km', label: 'Overstapstation', type: 'transport' },
]

/**
 * Returns Tailwind text color class based on distance and facility type.
 * Daily facilities: green <= 1km, amber <= 3km, red > 3km
 * Transport: green <= 3km, amber <= 10km, red > 10km
 */
function distanceColor(value: number | null, type: 'daily' | 'transport'): string {
  if (value == null) return 'text-neutral-500'

  if (type === 'daily') {
    if (value <= 1) return 'text-green-400'
    if (value <= 3) return 'text-amber-400'
    return 'text-red-400'
  }

  // transport
  if (value <= 3) return 'text-green-400'
  if (value <= 10) return 'text-amber-400'
  return 'text-red-400'
}

/**
 * Displays CBS facility proximity distances per wijk with color coding.
 * Returns null when ALL 6 distance values are null.
 */
export function NabijheidCard({ nabijheid }: NabijheidCardProps) {
  const hasAnyData = FACILITIES.some((f) => nabijheid.afstanden[f.key] != null)
  if (!hasAnyData) return null

  return (
    <section className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2.5">
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
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span className="text-xs font-medium uppercase tracking-wide text-aura-amber/70">
          Voorzieningen Nabijheid
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-2">
        {FACILITIES.map(({ key, label, type }) => {
          const value = nabijheid.afstanden[key]
          return (
            <div key={key} className="flex items-center justify-between">
              <span className="text-xs text-neutral-600">{label}</span>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-medium ${distanceColor(value, type)}`}>
                  {value != null ? `${value.toFixed(1)} km` : '--'}
                </span>
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    value == null
                      ? 'bg-neutral-400'
                      : distanceColor(value, type).replace('text-', 'bg-')
                  }`}
                />
              </div>
            </div>
          )
        })}

        {/* Source footer */}
        <div className="pt-1.5 border-t border-neutral-200">
          <span className="text-[10px] text-neutral-500">Bron: CBS {nabijheid.peiljaar}</span>
        </div>
      </div>
    </section>
  )
}
