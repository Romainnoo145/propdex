/**
 * S6 Vergunningen & Precedenten — Due Diligence Dashboard section 6
 */

import { motion } from 'framer-motion'
import { FileText, Scale, Lightbulb, ExternalLink } from 'lucide-react'
import type { PropertyReportResponse } from '@/lib/types/property'
import { SectionInsightCard } from '../components/SectionInsightCard'
import { SectionNotes, SubCard } from '../components'

export interface S6VergunningenPrecedentenProps {
  data: PropertyReportResponse
  sourceParcelId?: string | null
}

interface OutcomeConfig { label: string; color: string; bg: string; border: string }

const OUTCOME_CONFIG_OTHER: OutcomeConfig = { label: 'Overig', color: 'text-slate-500', bg: 'bg-slate-300', border: 'border-slate-200 bg-slate-50' }

const OUTCOME_CONFIG: Record<string, OutcomeConfig> = {
  granted:   { label: 'Verleend',    color: 'text-emerald-700', bg: 'bg-emerald-500', border: 'border-emerald-200 bg-emerald-50' },
  requested: { label: 'Aangevraagd', color: 'text-aura-amber-dark', bg: 'bg-aura-amber', border: 'border-aura-amber/30 bg-aura-amber/10' },
  rejected:  { label: 'Geweigerd',   color: 'text-red-700',     bg: 'bg-red-500',     border: 'border-red-200 bg-red-50' },
  withdrawn: { label: 'Ingetrokken', color: 'text-slate-600',   bg: 'bg-slate-400',   border: 'border-slate-200 bg-slate-50' },
  other:     OUTCOME_CONFIG_OTHER,
}

function OutcomeBar({ distribution }: { distribution: Record<string, number> }) {
  const total = Object.values(distribution).reduce((s, n) => s + n, 0)
  if (total === 0) return null
  const ordered = ['granted', 'requested', 'rejected', 'withdrawn', 'other']
  const segments = ordered
    .map(k => ({ key: k, count: distribution[k] ?? 0 }))
    .filter(seg => seg.count > 0)
    .map(seg => ({ ...seg, pct: (seg.count / total) * 100 }))
  return (
    <div className="space-y-2">
      <div className="flex h-6 w-full overflow-hidden rounded-full bg-slate-100">
        {segments.map((seg, i) => (
          <motion.div key={seg.key}
            className={`h-full ${OUTCOME_CONFIG[seg.key]?.bg ?? 'bg-slate-300'} ${i === 0 ? 'rounded-l-full' : ''} ${i === segments.length - 1 ? 'rounded-r-full' : ''}`}
            initial={{ width: 0 }} animate={{ width: `${seg.pct}%` }}
            transition={{ duration: 0.6, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {segments.map(seg => {
          const cfg = OUTCOME_CONFIG[seg.key]
          return (
            <span key={seg.key} className="flex items-center gap-1.5 text-[11px]">
              <span className={`h-2 w-2 rounded-full ${cfg?.bg ?? 'bg-slate-300'}`} />
              <span className={`font-semibold ${cfg?.color ?? 'text-slate-500'}`}>{cfg?.label ?? seg.key}</span>
              <span className="text-slate-400 tabular-nums">{seg.count}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function bekendmakingUrl(identifier: string | undefined): string | null {
  if (!identifier) return null
  return `https://zoek.officielebekendmakingen.nl/${identifier}.html`
}

function TimelineRow({ vg, idx, total, dotColor = 'bg-aura-amber' }: {
  vg: Record<string, unknown>; idx: number; total: number; dotColor?: string
}) {
  const title = (vg.title as string) ?? (vg.onderwerp as string) ?? 'Onbekend'
  const date = vg.date as string | undefined
  const type = vg.type as string | undefined
  const url = bekendmakingUrl(vg.identifier as string | undefined)
  return (
    <div className="flex gap-3 py-3 border-b border-[#EAEFEF] last:border-b-0">
      <div className="flex flex-col items-center pt-1.5">
        <span className={`h-2 w-2 rounded-full ${dotColor} shrink-0`} />
        {idx < total - 1 && <span className="w-px flex-1 bg-[#EAEFEF] mt-1" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-[#0E1111] leading-snug line-clamp-2">
          {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-aura-amber transition-colors">{title}</a> : title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          {date && <span>{new Date(date).toLocaleDateString('nl-NL')}</span>}
          {type && <span className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-1.5 py-0.5 text-[10px]">{type}</span>}
          {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-[#0E1111]"><ExternalLink size={9} /></a>}
        </div>
      </div>
    </div>
  )
}

/** Extract "Straatnaam Nr" from a display address for title matching */
function extractStreetAndNumber(address: string | null | undefined): string | null {
  if (!address) return null
  // String.split always yields at least one element, so index 0 is defined
  const beforeComma = address.split(',')[0]!.trim()
  if (!/\d/.test(beforeComma)) return null
  return beforeComma.toLowerCase()
}

function splitByAddress(
  records: Record<string, unknown>[],
  address: string | null | undefined,
): { direct: Record<string, unknown>[]; nearby: Record<string, unknown>[] } {
  const streetNum = extractStreetAndNumber(address)
  if (!streetNum) return { direct: records, nearby: [] }

  const direct: Record<string, unknown>[] = []
  const nearby: Record<string, unknown>[] = []
  for (const r of records) {
    const title = ((r.title as string) ?? '').toLowerCase()
    if (title.includes(streetNum)) {
      direct.push(r)
    } else {
      nearby.push(r)
    }
  }
  return { direct, nearby }
}

export function S6VergunningenPrecedenten({ data, sourceParcelId }: S6VergunningenPrecedentenProps) {
  const vergunningen = data.vergunningen_data
  const benchmark = data.permit_precedents
  const allRecords: Record<string, unknown>[] = vergunningen
    ? (Array.isArray(vergunningen) ? vergunningen : (vergunningen as Record<string, unknown>).records as Record<string, unknown>[] ?? [])
    : []
  const displayAddress = `${data.address.straat} ${data.address.huisnummer}${data.address.huisletter ?? ''}${data.address.toevoeging ?? ''}`
  const { direct, nearby } = splitByAddress(allRecords, displayAddress)
  const hasData = allRecords.length > 0 || !!benchmark

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

      {/* ── Bekendmakingen — dit adres ──────────────────────── */}
      {direct.length > 0 && (
        <SectionInsightCard kicker="Dit adres" title={`Vergunningen (${direct.length})`} Icon={FileText}>
          <div className="space-y-0">
            {direct.slice(0, 10).map((vg, idx) => (
              <TimelineRow key={idx} vg={vg} idx={idx} total={Math.min(direct.length, 10)} />
            ))}
            {direct.length > 10 && (
              <p className="mt-2 text-center text-[11px] text-slate-400">+{direct.length - 10} meer</p>
            )}
          </div>
        </SectionInsightCard>
      )}

      {/* ── Bekendmakingen — omgeving ────────────────────────── */}
      {nearby.length > 0 && (
        <SectionInsightCard kicker="Omgeving" title={`Vergunningen in de buurt (${nearby.length})`} Icon={FileText}>
          <div className="space-y-0">
            {nearby.slice(0, 10).map((vg, idx) => (
              <TimelineRow key={idx} vg={vg} idx={idx} total={Math.min(nearby.length, 10)} dotColor="bg-slate-300" />
            ))}
            {nearby.length > 10 && (
              <p className="mt-2 text-center text-[11px] text-slate-400">+{nearby.length - 10} meer</p>
            )}
          </div>
        </SectionInsightCard>
      )}

      {/* ── Geen vergunningen gevonden ────────────────────────── */}
      {allRecords.length > 0 && direct.length === 0 && nearby.length === 0 && (
        <SectionInsightCard kicker="Bekendmakingen" title={`Vergunningen (${allRecords.length})`} Icon={FileText}>
          <div className="space-y-0">
            {allRecords.slice(0, 10).map((vg, idx) => (
              <TimelineRow key={idx} vg={vg} idx={idx} total={Math.min(allRecords.length, 10)} />
            ))}
          </div>
        </SectionInsightCard>
      )}

      {/* ── Benchmark ─────────────────────────────────────────── */}
      {benchmark && (
        <SectionInsightCard kicker="Precedenten" title="Vergunningsbenchmark" badge={benchmark.gemeente_scope} Icon={Scale}>
          <div className="space-y-4">
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
            {Object.keys(benchmark.outcome_distribution).length > 0 && (
              <OutcomeBar distribution={benchmark.outcome_distribution} />
            )}
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
              const cfg = OUTCOME_CONFIG[ref.outcome] ?? OUTCOME_CONFIG_OTHER
              return (
                <SubCard key={ref.change_record_id} className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-semibold text-[#0E1111] leading-snug line-clamp-2 min-w-0 flex-1">{ref.title}</p>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.border} ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span>{new Date(ref.change_date).toLocaleDateString('nl-NL')}</span>
                    {ref.source_url && (
                      <a href={ref.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-500 hover:text-[#0E1111]">
                        <ExternalLink size={10} /> Publicatie
                      </a>
                    )}
                  </div>
                </SubCard>
              )
            })}
          </div>
        </SectionInsightCard>
      )}

      {/* ── Notes ─────────────────────────────────────────────── */}
      <SectionInsightCard kicker="Notities" title="Sectienotities" Icon={Lightbulb}>
        <SectionNotes parcelId={sourceParcelId} documentTypes={['vergunninghistorie']} />
      </SectionInsightCard>
    </div>
  )
}
