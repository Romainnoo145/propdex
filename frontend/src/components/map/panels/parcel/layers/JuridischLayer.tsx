import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { BentoPod } from '@/components/primitives/BentoPod'
import { useParcelEnrichment } from '@/hooks/useScans'
import { useParcelChanges } from '@/hooks/useNotifications'
import type { ScanResultItem } from '@/lib/types/scan'

function getBestemmingColor(type: string | null | undefined): {
  border: string
  bg: string
  text: string
  dot: string
} {
  const t = (type ?? '').toLowerCase()
  if (t.includes('wonen') || t.includes('woongebied'))
    return { border: 'border-amber-500/30', bg: 'bg-amber-500/8', text: 'text-amber-500', dot: 'bg-amber-400' }
  if (t.includes('groen') || t.includes('natuur') || t.includes('bos'))
    return { border: 'border-emerald-500/30', bg: 'bg-emerald-500/8', text: 'text-emerald-500', dot: 'bg-emerald-400' }
  if (t.includes('bedrijf') || t.includes('bedrijventerrein'))
    return { border: 'border-violet-500/30', bg: 'bg-violet-500/8', text: 'text-violet-500', dot: 'bg-violet-400' }
  if (t.includes('centrum') || t.includes('gemengd') || t.includes('detailhandel'))
    return { border: 'border-sky-500/30', bg: 'bg-sky-500/8', text: 'text-sky-500', dot: 'bg-sky-400' }
  if (t.includes('maatschappelijk'))
    return { border: 'border-rose-500/30', bg: 'bg-rose-500/8', text: 'text-rose-500', dot: 'bg-rose-400' }
  if (t.includes('recreatie') || t.includes('sport'))
    return { border: 'border-teal-500/30', bg: 'bg-teal-500/8', text: 'text-teal-500', dot: 'bg-teal-400' }
  if (t.includes('agrarisch'))
    return { border: 'border-lime-500/30', bg: 'bg-lime-500/8', text: 'text-lime-500', dot: 'bg-lime-400' }
  if (t.includes('verkeer'))
    return { border: 'border-slate-500/30', bg: 'bg-slate-500/8', text: 'text-slate-500', dot: 'bg-slate-400' }
  if (t.includes('water'))
    return { border: 'border-blue-500/30', bg: 'bg-blue-500/8', text: 'text-blue-500', dot: 'bg-blue-400' }
  return { border: 'border-neutral-300', bg: 'bg-aura-glass-white/40', text: 'text-neutral-600', dot: 'bg-neutral-400' }
}

interface JuridischLayerProps {
  parcel: ScanResultItem
}

export function JuridischLayer({ parcel }: JuridischLayerProps) {
  const [vergunningenOpen, setVergunningenOpen] = useState(false)
  const [meldingenOpen, setMeldingenOpen] = useState(false)

  const enrichment = useParcelEnrichment(parcel.parcel_id)
  const parcelChanges = useParcelChanges(parcel.parcel_id)

  const bestemmingen = parcel.bestemmingen
  const hasBestemmingen = Array.isArray(bestemmingen) && bestemmingen.length > 0

  const vergunningen = enrichment.data?.enrichment_data?.vergunningen ?? []
  const vergunningenError = enrichment.data?.enrichment_data?.error ?? null

  const meldingen = parcelChanges.data ?? []

  return (
    <div className="space-y-3 px-4 pb-4">
      {/* Bestemmingen */}
      <div>
        <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Bestemmingsplan</p>
        {hasBestemmingen ? (
          <div className="space-y-2">
            {bestemmingen.map((bestemming, idx) => {
              const b = bestemming as {
                type?: string | null
                naam?: string | null
                max_bebouwingspercentage?: number | null
                max_floor_area_ratio?: number | null
              }
              const colors = getBestemmingColor(b.type)
              return (
                <BentoPod key={idx} className={`${colors.border} ${colors.bg}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${colors.dot}`} />
                      <p className="text-sm font-medium text-aura-ink">
                        {b.naam || b.type || 'Onbekend'}
                      </p>
                    </div>
                    {b.type && (
                      <span className={`rounded px-2 py-0.5 text-[11px] ${colors.text} ${colors.bg}`}>
                        {b.type}
                      </span>
                    )}
                  </div>
                  {(b.max_bebouwingspercentage != null || b.max_floor_area_ratio != null) && (
                    <div className="mt-1.5 ml-4 flex gap-4 text-xs text-neutral-600">
                      {b.max_bebouwingspercentage != null && (
                        <span>Bebouwing max {b.max_bebouwingspercentage}%</span>
                      )}
                      {b.max_floor_area_ratio != null && (
                        <span>FAR {b.max_floor_area_ratio}</span>
                      )}
                    </div>
                  )}
                </BentoPod>
              )
            })}
          </div>
        ) : (
          <BentoPod>
            <p className="text-xs text-neutral-400">Geen bestemmingsplan data</p>
          </BentoPod>
        )}
      </div>

      {/* Vergunningen accordion */}
      <div>
        <BentoPod
          interactive
          onClick={() => setVergunningenOpen((v) => !v)}
          className="cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-aura-ink">Vergunningen</p>
              {vergunningen.length > 0 && (
                <span className="rounded-full bg-aura-amber/15 px-2 py-0.5 text-[10px] font-medium text-aura-amber tabular-nums">
                  {vergunningen.length}
                </span>
              )}
            </div>
            {vergunningenOpen ? (
              <ChevronUp className="h-4 w-4 text-neutral-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-neutral-400" />
            )}
          </div>
        </BentoPod>

        {vergunningenOpen && (
          <div className="mt-1 space-y-1">
            {enrichment.isLoading ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-200" />
                ))}
              </div>
            ) : vergunningenError ? (
              <BentoPod size="compact">
                <p className="text-xs text-neutral-500">{vergunningenError}</p>
              </BentoPod>
            ) : vergunningen.length === 0 ? (
              <BentoPod size="compact">
                <p className="text-xs text-neutral-400">Geen vergunningen gevonden</p>
              </BentoPod>
            ) : (
              vergunningen.map((v) => (
                <BentoPod key={v.identifier} size="compact">
                  <p className="text-xs font-medium text-aura-ink line-clamp-2">{v.title}</p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500">
                    <span>{v.type}</span>
                    <span>{v.date}</span>
                  </div>
                  {v.url && (
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[11px] text-aura-amber hover:text-aura-amber/80"
                    >
                      Bekijk <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </BentoPod>
              ))
            )}
          </div>
        )}
      </div>

      {/* Meldingen accordion */}
      <div>
        <BentoPod
          interactive
          onClick={() => setMeldingenOpen((v) => !v)}
          className="cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-aura-ink">Meldingen</p>
              {meldingen.length > 0 && (
                <span className="rounded-full bg-aura-amber/15 px-2 py-0.5 text-[10px] font-medium text-aura-amber tabular-nums">
                  {meldingen.length}
                </span>
              )}
            </div>
            {meldingenOpen ? (
              <ChevronUp className="h-4 w-4 text-neutral-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-neutral-400" />
            )}
          </div>
        </BentoPod>

        {meldingenOpen && (
          <div className="mt-1 space-y-1">
            {parcelChanges.isLoading ? (
              <div className="space-y-2 p-3">
                {[0, 1].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-200" />
                ))}
              </div>
            ) : meldingen.length === 0 ? (
              <BentoPod size="compact">
                <p className="text-xs text-neutral-400">Geen meldingen</p>
              </BentoPod>
            ) : (
              meldingen.map((change) => (
                <BentoPod key={change.id} size="compact">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-aura-amber" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-neutral-700 line-clamp-2">{change.title}</p>
                      <p className="mt-0.5 text-[11px] text-neutral-500">
                        {new Intl.DateTimeFormat('nl-NL', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }).format(new Date(change.change_date))}
                      </p>
                    </div>
                    {change.source_url && (
                      <a
                        href={change.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-neutral-400 hover:text-aura-amber"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </BentoPod>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
