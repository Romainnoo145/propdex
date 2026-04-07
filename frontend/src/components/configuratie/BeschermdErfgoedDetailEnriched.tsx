/**
 * BeschermdErfgoedDetailEnriched — enriched detail view for beschermd-erfgoed source.
 * Shows monument count, stadsgezicht list with category badges and details.
 */
import { useErfgoed, type BeschermdGezichtResponse } from '@/hooks/useErfgoed'
import { Landmark, Loader2, AlertCircle, MapPin, Calendar, Maximize2 } from 'lucide-react'

interface Props {
  gemeenteNaam: string | null
}

const TYPE_COLORS: Record<string, string> = {
  'beschermd stadsgezicht': 'bg-violet-100 text-violet-700',
  'beschermd dorpsgezicht': 'bg-indigo-100 text-indigo-700',
}

export function BeschermdErfgoedDetailEnriched({ gemeenteNaam }: Props) {
  const { data, isLoading, error } = useErfgoed(gemeenteNaam)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-slate-300 mb-2" />
        <p className="text-[13px] text-slate-400">Erfgoeddata kon niet worden geladen.</p>
      </div>
    )
  }

  const gezichten = data?.beschermde_gezichten ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
            <Landmark size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="text-[20px] font-black text-[#0E1111]">
              {total} <span className="text-[14px] font-bold text-slate-400">{total === 1 ? 'beschermd gezicht' : 'beschermde gezichten'}</span>
            </p>
            <p className="text-[12px] text-slate-500">Rijksmonumenten en beschermde stadsgezichten via het RCE-register</p>
          </div>
        </div>
      </div>

      {/* Relevance explainer */}
      <div className="rounded-[16px] border border-[#EAEFEF] bg-amber-50/50 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Landmark size={16} className="text-amber-600" />
          <p className="text-[13px] font-bold text-[#0E1111]">Impact op vastgoedontwikkeling</p>
        </div>
        <ul className="space-y-2 text-[12px] text-slate-600">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>Binnen beschermde gezichten gelden strengere welstandseisen — verbouwingen moeten bij het historische karakter passen.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>Sloop- en nieuwbouwplannen vereisen vaak een omgevingsvergunning met uitgebreide procedure.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>Subsidies beschikbaar voor restauratie en verduurzaming van monumenten (Rijksdienst, provincie, gemeente).</span>
          </li>
        </ul>
      </div>

      {/* Gezichten list */}
      {gezichten.length > 0 ? (
        <div className="rounded-[16px] border border-[#EAEFEF] bg-white divide-y divide-[#EAEFEF] overflow-hidden">
          {gezichten.map((gezicht, idx) => (
            <GezichtItem key={`${gezicht.naam}-${idx}`} gezicht={gezicht} />
          ))}
        </div>
      ) : (
        <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-8 text-center">
          <p className="text-[13px] text-slate-400">Geen beschermde gezichten gevonden in deze gemeente.</p>
        </div>
      )}
    </div>
  )
}

function GezichtItem({ gezicht }: { gezicht: BeschermdGezichtResponse }) {
  const typeClass = TYPE_COLORS[gezicht.type?.toLowerCase() ?? ''] ?? 'bg-slate-100 text-slate-500'

  return (
    <div className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={14} className="text-slate-400 shrink-0" />
            <p className="text-[14px] font-bold text-[#0E1111]">{gezicht.naam}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-[22px]">
            {gezicht.type && (
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${typeClass}`}>
                {gezicht.type}
              </span>
            )}
            {gezicht.aangewezen && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Calendar size={10} />
                Aangewezen: {gezicht.aangewezen}
              </span>
            )}
            {gezicht.oppervlakte_ha != null && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Maximize2 size={10} />
                {gezicht.oppervlakte_ha} ha
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
