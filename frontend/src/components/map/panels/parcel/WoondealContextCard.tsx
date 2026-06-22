/**
 * WoondealContextCard — calm gemeente-context block in the Potentie tab.
 * Context-only (NO contribution pill): the woondeal is identical for every parcel
 * in a gemeente, so it informs rather than scores. Deep-links to the /beleid hub.
 */
import { Building2 } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useWoondeal } from '@/hooks/useWoondeal'

interface WoondealContextCardProps {
  /** CBS gemeentecode, e.g. "0983" (no GM prefix). */
  gemeenteCode: string
  gemeenteNaam: string
}

export function WoondealContextCard({ gemeenteCode, gemeenteNaam }: WoondealContextCardProps) {
  const navigate = useNavigate()
  const { data } = useWoondeal(gemeenteCode, gemeenteNaam)
  if (!data?.heeft_woondeal || !data.opgave) return null

  const o = data.opgave
  const gmCode = gemeenteCode.startsWith('GM') ? gemeenteCode : `GM${gemeenteCode}`

  return (
    <button
      type="button"
      onClick={() =>
        navigate({
          to: '/beleid',
          search: {
            gemeente: gmCode,
            provincie: undefined,
            source: undefined,
            category: undefined,
            niveau: undefined,
          },
        })
      }
      className="w-full rounded-[16px] border border-violet-200 bg-violet-50/50 p-3 text-left transition-colors hover:bg-violet-50 group"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-100">
          <Building2 size={12} className="text-violet-600" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">
          Woondeal · geldt voor heel {gemeenteNaam}
        </span>
        <span className="ml-auto text-[10px] text-violet-400 group-hover:text-violet-600 transition-colors">
          Bekijk →
        </span>
      </div>
      <p className="text-[13px] font-semibold text-[#0E1111]">
        Opgave {o.toevoegingen?.toLocaleString('nl-NL') ?? '—'} woningen
        {data.periode ? ` tot ${data.periode.split('-').pop()}` : ''}
      </p>
      <p className="text-[11px] text-slate-500 mt-0.5">
        {o.plancapaciteit?.toLocaleString('nl-NL') ?? '—'} in plancapaciteit
        {data.aandeel_betaalbaar != null
          ? ` · ${Math.round(data.aandeel_betaalbaar * 100)}% betaalbaar`
          : ''}
      </p>
    </button>
  )
}
