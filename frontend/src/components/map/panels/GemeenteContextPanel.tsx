import { Users, Scale, Bell, MapPin, X } from 'lucide-react'
import { LeftPanelShell } from './LeftPanelShell'

export type GemeenteCardCategory = 'demografie' | 'juridisch' | 'meldingen' | 'wijken'

interface GemeenteContextPanelProps {
  naam: string
  code: string
  wijkGeojson: GeoJSON.FeatureCollection | null
  scannedWijkNames: string[]
  onClose: () => void
  onSelectWijk: (wijkCode: string, wijkNaam: string) => void
  onCardClick: (category: GemeenteCardCategory) => void
}

const SUMMARY_CARDS: {
  category: GemeenteCardCategory
  icon: React.ReactNode
  title: string
  description: string
}[] = [
  {
    category: 'demografie',
    icon: <Users size={20} />,
    title: 'Demografie',
    description: 'Bevolkingsopbouw en statistieken',
  },
  {
    category: 'juridisch',
    icon: <Scale size={20} />,
    title: 'Juridisch Klimaat',
    description: 'Vergunningen en jurisprudentie',
  },
  {
    category: 'meldingen',
    icon: <Bell size={20} />,
    title: 'Meldingen',
    description: 'Bestemmingsplanwijzigingen',
  },
  {
    category: 'wijken',
    icon: <MapPin size={20} />,
    title: 'Wijken',
    description: 'Wijkoverzicht en scans',
  },
]

export function GemeenteContextPanel({
  naam,
  code,
  wijkGeojson,
  scannedWijkNames,
  onClose,
  onSelectWijk,
  onCardClick,
}: GemeenteContextPanelProps) {
  const features = wijkGeojson?.features ?? []
  const wijkCount = features.length
  const scannedCount = scannedWijkNames.length

  return (
    <LeftPanelShell onClose={onClose}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-aura-ink">{naam}</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Gemeente · {code}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:text-aura-ink hover:bg-neutral-200/60 transition-colors"
            aria-label="Sluiten"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex gap-2 mb-5">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-neutral-200/80 text-neutral-700">
            {wijkCount} wijken
          </span>
          {scannedCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100/80 text-emerald-700">
              {scannedCount} gescand
            </span>
          )}
        </div>

        {/* Summary cards grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {SUMMARY_CARDS.map((card) => (
            <button
              key={card.category}
              onClick={() => onCardClick(card.category)}
              className="flex flex-col items-start gap-2 rounded-xl border border-white/30 bg-white/40 p-3.5 text-left transition-all hover:bg-white/60 hover:shadow-sm group"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-aura-amber/10 text-aura-amber transition-colors group-hover:bg-aura-amber/20">
                {card.icon}
              </span>
              <div>
                <h3 className="text-sm font-medium text-aura-ink leading-tight">
                  {card.category === 'wijken' ? `${wijkCount} ${card.title.toLowerCase()}` : card.title}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5 leading-snug">{card.description}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-neutral-200/60 mb-4" />

        {/* Wijk list */}
        <div>
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2.5">
            Wijken
          </h3>
          {features.length === 0 ? (
            <p className="text-sm text-neutral-500 py-2">Wijken laden...</p>
          ) : (
            <ul className="space-y-0.5">
              {features.map((feature) => {
                const code = (feature.properties?.statcode as string) ?? ''
                const name = (feature.properties?.statnaam as string) ?? code
                const isScanned = scannedWijkNames.includes(name)
                return (
                  <li key={code}>
                    <button
                      onClick={() => onSelectWijk(code, name)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-aura-ink hover:bg-white/60 transition-colors flex items-center justify-between group"
                    >
                      <span className="truncate">{name}</span>
                      {isScanned && (
                        <span className="text-xs text-emerald-600 opacity-70 group-hover:opacity-100">
                          gescand
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </LeftPanelShell>
  )
}
