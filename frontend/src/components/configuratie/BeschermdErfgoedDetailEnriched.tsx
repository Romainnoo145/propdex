/**
 * Enriched Beschermd erfgoed detail for the configuratie source-detail view.
 *
 * Fetches erfgoed data and renders:
 *  - metric card with total beschermde gezichten
 *  - list of gezichten with type pills and metadata
 *
 * Design contract follows JurisprudentieDetailEnriched / BekendmakingenDetailEnriched:
 *  - space-y-5, no wrapping container
 *  - Cards: rounded-[16px] border border-[#EAEFEF] bg-white p-5
 *  - List items: border-b border-[#EAEFEF] py-3 last:border-0
 *  - Pills: bg-slate-100 text-slate-500 (neutral)
 *  - Colors: #0E1111, slate, #EAEFEF. No blue/indigo/violet.
 */
import { useErfgoed, type BeschermdGezichtResponse } from '@/hooks/useErfgoed'
import { Loader2 } from 'lucide-react'

interface Props {
  gemeenteNaam: string | null
}

/* ─── Lightweight state helpers ──────────────────────────────── */

function DetailLoading() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-[20px] border border-[#EAEFEF] bg-white p-12">
      <Loader2 className="size-5 animate-spin text-slate-400" />
      <span className="text-[13px] text-slate-400">Data laden…</span>
    </div>
  )
}

function DetailEmpty({ message }: { message?: string }) {
  return (
    <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
      <p className="text-[13px] text-slate-400">{message ?? 'Geen data beschikbaar.'}</p>
    </div>
  )
}

function DetailError({ error }: { error: Error | null }) {
  return (
    <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
      <p className="text-[13px] text-red-400">{error?.message ?? 'Er is een fout opgetreden.'}</p>
    </div>
  )
}

/* ─── Metric card ────────────────────────────────────────────── */

function MetricCard({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-4 text-center">
      <p className="text-[24px] font-bold text-[#0E1111]">{value ?? '—'}</p>
      <p className="mt-1 text-[11px] text-slate-400">{label}</p>
    </div>
  )
}

/* ─── Gezicht list item — same pattern as RulingListItem ──────── */

function GezichtItem({ gezicht }: { gezicht: BeschermdGezichtResponse }) {
  return (
    <div className="flex items-start gap-3 border-b border-[#EAEFEF] py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[#0E1111]">{gezicht.naam}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          {gezicht.type && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {gezicht.type}
            </span>
          )}
          {gezicht.aangewezen && (
            <>
              <span className="text-slate-300">·</span>
              <span>Aangewezen: {gezicht.aangewezen}</span>
            </>
          )}
          {gezicht.oppervlakte_ha != null && (
            <>
              <span className="text-slate-300">·</span>
              <span>{gezicht.oppervlakte_ha} ha</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────── */

export function BeschermdErfgoedDetailEnriched({ gemeenteNaam }: Props) {
  const { data, isLoading, error } = useErfgoed(gemeenteNaam)

  if (!gemeenteNaam) return <DetailEmpty message="Selecteer een gemeente." />
  if (isLoading) return <DetailLoading />
  if (error) return <DetailError error={error as Error} />

  const gezichten = data?.beschermde_gezichten ?? []
  const total = data?.total ?? 0

  if (total === 0) return <DetailEmpty message="Geen beschermde gezichten gevonden." />

  return (
    <div className="space-y-5">
      {/* Summary metric */}
      <MetricCard label={total === 1 ? 'Beschermd gezicht' : 'Beschermde gezichten'} value={total} />

      {/* Gezichten list — same pattern as recent rulings in JurisprudentieDetailEnriched */}
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
          Beschermde stads- en dorpsgezichten
        </p>
        <div className="max-h-[400px] overflow-y-auto">
          {gezichten.map((gezicht, i) => (
            <GezichtItem key={`${gezicht.naam}-${i}`} gezicht={gezicht} />
          ))}
        </div>
      </div>
    </div>
  )
}
