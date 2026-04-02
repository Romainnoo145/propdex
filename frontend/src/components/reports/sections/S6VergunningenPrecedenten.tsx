/**
 * S6 Vergunningen & Precedenten — Due Diligence Dashboard section 6
 *
 * Redesign: visual outcome bar, clean bekendmakingen timeline,
 * structured benchmark stats, and linked references.
 */

import { motion } from 'framer-motion'
import { FileText, Scale, Lightbulb, ExternalLink } from 'lucide-react'
import type { PropertyReportResponse } from '@/lib/types/property'
import { SectionInsightCard } from '../components/SectionInsightCard'
import { SectionNotes, SubCard, KVRow } from '../components'

export interface S6VergunningenPrecedentenProps {
  data: PropertyReportResponse
  sourceParcelId?: string | null
}

/* ─── Outcome colors ─────────────────────────────────────────── */

const OUTCOME_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  granted:   { label: 'Verleend',    color: 'text-emerald-700', bg: 'bg-emerald-500', border: 'border-emerald-200 bg-emerald-50' },
  requested: { label: 'Aangevraagd', color: 'text-aura-amber-dark', bg: 'bg-aura-amber', border: 'border-aura-amber/30 bg-aura-amber/10' },
  rejected:  { label: 'Geweigerd',   color: 'text-red-700',     bg: 'bg-red-500',     border: 'border-red-200 bg-red-50' },
  withdrawn: { label: 'Ingetrokken', color: 'text-slate-600',   bg: 'bg-slate-400',   border: 'border-slate-200 bg-slate-50' },
  other:     { label: 'Overig',      color: 'text-slate-500',   bg: 'bg-slate-300',   border: 'border-slate-200 bg-slate-50' },
}

/* ─── Outcome distribution bar ───────────────────────────────── */

function OutcomeBar({ distribution }: { distribution: Record<string, number> }) {
  const total = Object.values(distribution).reduce((s, n) => s + n, 0)
  if (total === 0) return null

  const ordered = ['granted', 'requested', 'rejected', 'withdrawn', 'other']
  const segments = ordered
    .filter(k => distribution[k] > 0)
    .map(k => ({ key: k, count: distribution[k], pct: (distribution[k] / total) * 100 }))

  return (
    <div className="space-y-2">
      {/* Stacked bar */}
      <div className="flex h-6 w-full overflow-hidden rounded-full bg-slate-100">
        {segments.map((seg, i) => (
          <motion.div
            key={seg.key}
            className={`h-full ${OUTCOME_CONFIG[seg.key]?.bg ?? 'bg-slate-300'} ${i === 0 ? 'rounded-l-full' : ''} ${i === segments.length - 1 ? 'rounded-r-full' : ''}`}
            initial={{ width: 0 }}
            animate={{ width: `${seg.pct}%` }}
            transition={{ duration: 0.6, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {segments.map(seg => {
          const cfg = OUTCOME_CONFIG[seg.key]
          return (
            <span key={seg.key} className="flex items-center gap-1.5 text-[11px]">
              <span className={`h-2 w-2 rounded-full ${cfg?.bg ?? 'bg-slate-300'}`} />
              <span className={`font-semibold ${cfg?.color ?? 'text-slate-500'}`}>
                {cfg?.label ?? seg.key}
              </span>
              <span className="text-slate-400 tabular-nums">{seg.count}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Bekendmaking link helper ───────────────────────────────── */

function bekendmakingUrl(identifier: string | undefined): string | null {
  if (!identifier) return null
  return `https://zoek.officielebekendmakingen.nl/${identifier}.html`
}

/* ─── Section ────────────────────────────────────────────────── */

export function S6VergunningenPrecedenten({ data, sourceParcelId }: S6VergunningenPrecedentenProps) {
  const vergunningen = data.vergunningen_data
  const benchmark = data.permit_precedents
  const hasData = (vergunningen && vergunningen.length > 0) || !!benchmark

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <p className="text-[13px] font-semibold text-[#0E1111]">Geen vergunningendata beschikbaar</p>
          <p className="mx-auto mt-2 max-w-sm text-[12px] text-slate-400">
            Vergunningsprecedenten worden opgehaald bij het genereren van een scan op dit adres.
          </p>
        </div>
        <SectionInsightCard kicker="Notities" title="Sectienotities" Icon={Lightbulb}>
          <SectionNotes parcelId={sourceParcelId ?? null} documentTypes={['vergunninghistorie']} />
        </SectionInsightCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Benchmark hero ────────────────────────────────────── */}
      {benchmark && (
        <SectionInsightCard
          kicker="Precedenten"
          title="Vergunningsbenchmark"
          badge={benchmark.gemeente_scope}
          Icon={Scale}
        >
          <div className="space-y-4">
            {/* Key stats row */}
            <div className="grid grid-cols-3 gap-3">
              <SubCard>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Steekproef</p>
                <p className="mt-1 text-[22px] font-bold tabular-nums text-[#0E1111]">{benchmark.sample_size}</p>
                <p className="text-[10px] text-slate-400">{benchmark.lookback_days} dagen</p>
              </SubCard>
              <SubCard>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Doorlooptijd</p>
                <p className="mt-1 text-[22px] font-bold tabular-nums text-[#0E1111]">
                  {benchmark.median_processing_days ?? '–'}<span className="text-[14px] font-normal text-slate-400"> d</span>
                </p>
                <p className="text-[10px] text-slate-400">mediaan</p>
              </SubCard>
              <SubCard>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">P75</p>
                <p className="mt-1 text-[22px] font-bold tabular-nums text-[#0E1111]">
                  {benchmark.p75_processing_days ?? '–'}<span className="text-[14px] font-normal text-slate-400"> d</span>
                </p>
                <p className="text-[10px] text-slate-400">75e percentiel</p>
              </SubCard>
            </div>

            {/* Outcome distribution bar */}
            {Object.keys(benchmark.outcome_distribution).length > 0 && (
              <OutcomeBar distribution={benchmark.outcome_distribution} />
            )}

            {/* Low sample warning */}
            {benchmark.low_sample_warning && (
              <div className="rounded-[16px] border border-aura-amber/30 bg-aura-amber/[0.08] px-4 py-3">
                <p className="text-[11px] text-aura-amber-dark">{benchmark.low_sample_warning}</p>
              </div>
            )}
          </div>
        </SectionInsightCard>
      )}

      {/* ── Recent references ─────────────────────────────────── */}
      {benchmark && benchmark.references.length > 0 && (
        <SectionInsightCard kicker="Referenties" title={`Recente besluiten (${benchmark.references.length})`} Icon={FileText}>
          <div className="space-y-2">
            {benchmark.references.map((ref) => {
              const cfg = OUTCOME_CONFIG[ref.outcome] ?? OUTCOME_CONFIG.other
              return (
                <SubCard key={ref.change_record_id} className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-[#0E1111] leading-snug line-clamp-2">{ref.title}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.border} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span>{new Date(ref.change_date).toLocaleDateString('nl-NL')}</span>
                    {ref.source_url && (
                      <a
                        href={ref.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-slate-500 transition-colors hover:text-[#0E1111]"
                      >
                        <ExternalLink size={10} />
                        Publicatie
                      </a>
                    )}
                  </div>
                </SubCard>
              )
            })}
          </div>
        </SectionInsightCard>
      )}

      {/* ── Bekendmakingen timeline ───────────────────────────── */}
      {vergunningen && vergunningen.length > 0 && (
        <SectionInsightCard kicker="Bekendmakingen" title={`Omgeving (${vergunningen.length})`} Icon={FileText}>
          <p className="text-[11px] text-slate-400 mb-3">
            Vergunningen en bekendmakingen in het postcodegebied. Perceelspecifieke vergunningen worden binnenkort toegevoegd.
          </p>
          <div className="space-y-0">
            {vergunningen.slice(0, 8).map((v, idx) => {
              const vg = v as Record<string, unknown>
              const title = (vg.title as string | undefined) ?? (vg.onderwerp as string | undefined) ?? 'Onbekend'
              const date = vg.date as string | undefined
              const type = vg.type as string | undefined
              const identifier = vg.identifier as string | undefined
              const url = bekendmakingUrl(identifier)

              return (
                <div key={idx} className="flex gap-3 py-3 border-b border-[#EAEFEF] last:border-b-0">
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center pt-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-300 shrink-0" />
                    {idx < Math.min(vergunningen.length, 8) - 1 && (
                      <span className="w-px flex-1 bg-[#EAEFEF] mt-1" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-[#0E1111] leading-snug line-clamp-2">
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-aura-amber transition-colors">
                          {title}
                        </a>
                      ) : title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      {date && <span>{new Date(date).toLocaleDateString('nl-NL')}</span>}
                      {type && (
                        <span className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-1.5 py-0.5 text-[10px]">
                          {type}
                        </span>
                      )}
                      {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-[#0E1111]">
                          <ExternalLink size={9} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {vergunningen.length > 8 && (
            <p className="mt-2 text-center text-[11px] text-slate-400">
              +{vergunningen.length - 8} meer bekendmakingen in de omgeving
            </p>
          )}
        </SectionInsightCard>
      )}

      {/* ── Notes ─────────────────────────────────────────────── */}
      <SectionInsightCard kicker="Notities" title="Sectienotities" Icon={Lightbulb}>
        <SectionNotes parcelId={sourceParcelId} documentTypes={['vergunninghistorie']} />
      </SectionInsightCard>
    </div>
  )
}
