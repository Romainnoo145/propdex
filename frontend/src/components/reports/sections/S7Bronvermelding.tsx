/**
 * S7 Bronvermelding — Due Diligence Dashboard section 7
 *
 * Displays: data source attribution table, data completeness summary, disclaimer
 * No upload zone (bronvermelding is auto-generated).
 */

import type { PropertyReportResponse } from '@/lib/types/property'

/* ─── Props ─────────────────────────────────────────────────── */

export interface S7BronvermeldingProps {
  data: PropertyReportResponse
}

/* ─── Types ─────────────────────────────────────────────────── */

type SourceStatus = 'ok' | 'unlinked' | 'blocked' | 'error'

interface SourceRow {
  source: string
  age_seconds: number | null
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null
  status: SourceStatus
  note?: string
}

/* ─── Helpers ────────────────────────────────────────────────── */

function classifyIssue(message?: string | null, source?: string): 'unlinked' | 'blocked' | 'error' {
  const msg = (message ?? '').toLowerCase()
  const src = (source ?? '').toLowerCase()
  if (!msg) return 'unlinked'
  if (src.includes('monumenten: rce') && msg.includes('403')) return 'blocked'
  const unlinkedHints = [
    'api key', 'apikey', 'not configured', 'niet geconfigureerd',
    'forbidden', 'unauthorized', '401', '403', 'permission', 'toegang',
    'niet gekoppeld', 'disabled', 'not enabled', 'geen verblijfsobject',
    'geen kadastraal',
  ]
  return unlinkedHints.some((hint) => msg.includes(hint)) ? 'unlinked' : 'error'
}

function sanitizeNote(note?: string | null): string | undefined {
  if (!note) return undefined
  let cleaned = note.trim().replace(/https?:\/\/\S+/gi, '').replace(/\s+/g, ' ').trim()
  if (!cleaned) cleaned = note.trim()
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned
}

function formatAge(s: number | null): string {
  if (s == null) return 'Onbekend'
  if (s < 60) return 'Zojuist'
  if (s < 3600) return `${Math.floor(s / 60)} min geleden`
  if (s < 86400) return `${Math.floor(s / 3600)} uur geleden`
  return `${Math.floor(s / 86400)} dagen geleden`
}

/* ─── Status badge ───────────────────────────────────────────── */

function StatusBadge({ status }: { status: SourceStatus }) {
  const cls =
    status === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : status === 'blocked'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : status === 'unlinked'
          ? 'border-[#EAEFEF] bg-[#F8FAFA] text-slate-600'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  const label =
    status === 'error' ? 'Fout' : status === 'blocked' ? 'Geblokkeerd' : status === 'unlinked' ? 'Niet gekoppeld' : 'OK'

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>
  )
}

function ConfidenceBadge({ confidence }: { confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null }) {
  if (!confidence) return null
  const cls =
    confidence === 'HIGH'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : confidence === 'MEDIUM'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-red-200 bg-red-50 text-red-700'
  const label = confidence === 'HIGH' ? 'Hoog' : confidence === 'MEDIUM' ? 'Middel' : 'Laag'

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>
  )
}

/* ─── Section ────────────────────────────────────────────────── */

export function S7Bronvermelding({ data }: S7BronvermeldingProps) {
  // Build deduplicated source rows (same logic as BronnenSection in ReportDetailPage)
  const byKey = new Map<string, SourceRow>()
  const statusPriority: Record<SourceStatus, number> = { ok: 0, unlinked: 1, blocked: 2, error: 3 }

  function addRow(row: SourceRow) {
    const key = row.source.toLowerCase()
    if (!byKey.has(key)) { byKey.set(key, row); return }
    const existing = byKey.get(key)!
    byKey.set(key, {
      ...existing,
      ...row,
      age_seconds: row.age_seconds ?? existing.age_seconds,
      note: row.note ?? existing.note,
      status: statusPriority[row.status] >= statusPriority[existing.status] ? row.status : existing.status,
    })
  }

  // data_sources
  for (const src of data.data_sources ?? []) {
    addRow({ source: src.source, age_seconds: src.age_seconds, confidence: src.confidence ?? null, status: 'ok' })
  }

  // section_sources
  for (const section of data.section_sources ?? []) {
    for (const src of section.sources ?? []) {
      addRow({ source: src.source, age_seconds: src.age_seconds, confidence: src.confidence ?? null, status: 'ok' })
    }
  }

  // monument sources
  for (const src of data.monuments?.sources ?? []) {
    addRow({
      source: `Monumenten: ${src.source}`,
      age_seconds: src.age_seconds ?? null,
      confidence: null,
      status: src.error ? classifyIssue(src.error, `Monumenten: ${src.source}`) : 'ok',
      note: sanitizeNote(src.error ?? (src.is_monument ? 'Beschermd' : 'Niet beschermd')),
    })
  }

  // EP-Online
  const energyErr = (data.errors ?? []).find((e) => e.toLowerCase().includes('energielabel') || e.toLowerCase().includes('ep-online'))
  addRow({
    source: 'EP-Online V5',
    age_seconds: null,
    confidence: null,
    status: data.energy_label ? 'ok' : energyErr ? classifyIssue(energyErr) : 'ok',
    note: data.energy_label
      ? (data.energy_label.is_geregistreerd ? `Label ${data.energy_label.energieklasse ?? ''}`.trim() : data.energy_label.niet_geregistreerd_reden ?? undefined)
      : sanitizeNote(energyErr ?? 'Geen energielabel beschikbaar'),
  })

  // WOZ
  const wozErr = (data.errors ?? []).find((e) => e.toLowerCase().includes('woz'))
  addRow({
    source: data.woz_data?.bron ?? 'WOZ Waardeloket',
    age_seconds: null,
    confidence: null,
    status: data.woz_data ? 'ok' : wozErr ? classifyIssue(wozErr) : 'ok',
    note: data.woz_data?.low_confidence_reden ?? sanitizeNote(wozErr ?? undefined),
  })

  // BRK
  addRow({
    source: 'BRK Bevragen V2',
    age_seconds: null,
    confidence: null,
    status: !data.brk_ownership ? 'unlinked' : data.brk_ownership.status === 'available' ? 'ok' : classifyIssue(data.brk_ownership.reason),
    note: !data.brk_ownership ? 'Niet opgeslagen (Kadaster Tier 3)' : (data.brk_ownership.reason ?? undefined),
  })

  const sources = Array.from(byKey.values()).sort((a, b) => a.source.localeCompare(b.source, 'nl'))

  const okCount = sources.filter((s) => s.status === 'ok').length
  const errorCount = sources.filter((s) => s.status === 'error').length
  const unlinkedCount = sources.filter((s) => s.status === 'unlinked' || s.status === 'blocked').length

  return (
    <div className="space-y-4">
      {/* Completeness summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-2xl font-black text-emerald-700">{okCount}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-emerald-600">Bronnen OK</p>
        </div>
        <div className="rounded-[20px] border border-[#EAEFEF] bg-[#F8FAFA] p-4 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-2xl font-black text-slate-600">{unlinkedCount}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">Niet gekoppeld</p>
        </div>
        <div className="rounded-[20px] border border-red-200 bg-red-50 p-4 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-2xl font-black text-red-700">{errorCount}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-red-600">Fouten</p>
        </div>
      </div>

      {/* Source table */}
      <div className="rounded-[20px] border border-[#EAEFEF] bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="border-b border-[#EAEFEF] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
            Databronnen ({sources.length})
          </p>
        </div>
        {sources.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[13px] text-slate-500">Geen broninformatie beschikbaar</p>
          </div>
        ) : (
          <div className="divide-y divide-[#EAEFEF]">
            {sources.map((src, idx) => (
              <div key={idx} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#0E1111]">{src.source}</p>
                  <p className="text-[11px] text-slate-500">{formatAge(src.age_seconds)}</p>
                  {src.note && (
                    <p className="mt-0.5 text-[11px] text-slate-500 break-words">{src.note}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={src.status} />
                  <ConfidenceBadge confidence={src.confidence} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="rounded-[20px] border border-[#EAEFEF] bg-[#F8FAFA] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Disclaimer</p>
        <p className="text-[13px] text-slate-600 leading-relaxed">
          De data in dit rapport is afkomstig van openbare bronnen (BAG, Kadaster, DSO, etc.) en wordt uitsluitend ter
          informatie aangeboden. Propdex garandeert niet de volledigheid, juistheid of actualiteit van de gegevens.
          Raadpleeg voor juridisch bindende informatie altijd de officiële bronnen en bevoegde instanties.
          Gegevens kunnen verouderd zijn — controleer datums bij kritieke beslissingen.
        </p>
        <p className="mt-2 text-[11px] text-slate-400">
          Rapport gegenereerd op {new Date(data.resolved_at).toLocaleString('nl-NL')}
        </p>
      </div>
    </div>
  )
}
