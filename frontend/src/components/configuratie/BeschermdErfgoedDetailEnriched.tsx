/**
 * Enriched Beschermd erfgoed detail for the configuratie source-detail view.
 *
 * Reuses shared report components: SectionInsightCard, SubCard.
 */
import { useErfgoed, type BeschermdGezichtResponse } from '@/hooks/useErfgoed'
import { Landmark, Loader2 } from 'lucide-react'
import { SectionInsightCard } from '@/components/reports/components'

interface Props {
  gemeenteNaam: string | null
}

function DetailLoading() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-[20px] border border-[#EAEFEF] bg-white p-12">
      <Loader2 className="size-5 animate-spin text-slate-400" />
      <span className="text-[13px] text-slate-400">Data laden…</span>
    </div>
  )
}

/* ─── Gezicht list item — same structure as RulingListItem ────── */

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

  if (!gemeenteNaam || isLoading) return <DetailLoading />
  if (error) {
    return (
      <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
        <p className="text-[13px] text-slate-400">Fout bij laden van erfgoeddata.</p>
      </div>
    )
  }

  const gezichten = data?.beschermde_gezichten ?? []
  const total = data?.total ?? 0

  if (total === 0) {
    return (
      <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
        <p className="text-[13px] text-slate-400">Geen beschermde gezichten gevonden.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Main card — reuses SectionInsightCard */}
      <SectionInsightCard
        kicker="Beschermd erfgoed"
        title={`${total} ${total === 1 ? 'beschermd gezicht' : 'beschermde gezichten'}`}
        Icon={Landmark}
      >
        {/* Gezichten list — same pattern as rulings list */}
        <div className="max-h-[400px] overflow-y-auto">
          {gezichten.map((gezicht, i) => (
            <GezichtItem key={`${gezicht.naam}-${i}`} gezicht={gezicht} />
          ))}
        </div>
      </SectionInsightCard>
    </div>
  )
}
