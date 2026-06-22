import { GemeenteModal } from './GemeenteModal'
import { useWoondeal } from '@/hooks/useWoondeal'

interface WoondealModalProps {
  gemeenteCode: string
  gemeenteNaam: string
  onClose: () => void
}

export function WoondealModal({ gemeenteCode, gemeenteNaam, onClose }: WoondealModalProps) {
  const { data, isLoading } = useWoondeal(gemeenteCode, gemeenteNaam)
  const active = data?.heeft_woondeal ?? false
  const o = data?.opgave

  return (
    <GemeenteModal
      title="Woondeal"
      subtitle={active ? `${data?.regio_naam ?? 'Regionale'} woningbouwafspraak` : 'Geen woondeal-data'}
      onClose={onClose}
    >
      {isLoading && <p className="text-[13px] text-slate-400 text-center py-8">Laden...</p>}

      {!isLoading && !active && (
        <p className="text-[13px] text-slate-500 leading-relaxed">
          Geen woondeal-context beschikbaar voor deze gemeente.
        </p>
      )}

      {!isLoading && active && (
        <div className="space-y-6">
          {/* Opgave */}
          {o && (
            <div className="rounded-[16px] p-5 bg-[#F8FAF9] border border-[#EAEFEF]">
              <h3 className="text-[10px] font-black text-slate-400 uppercase mb-3" style={{ letterSpacing: '0.2em' }}>
                Woningbouwopgave {data?.periode ?? ''}
              </h3>
              <p className="text-[22px] font-bold text-[#0E1111]">
                {o.toevoegingen?.toLocaleString('nl-NL') ?? '—'} woningen
              </p>
              <p className="text-[12px] text-slate-500 mt-1">
                {o.plancapaciteit?.toLocaleString('nl-NL') ?? '—'} in plancapaciteit
                {o.gat != null && o.gat > 0 ? ` · ~${o.gat.toLocaleString('nl-NL')} opgave-gat` : ''}
              </p>
              {o.sleutelprojecten_aantal != null && (
                <p className="text-[12px] text-slate-500 mt-1">
                  {o.sleutelprojecten_aantal} sleutelprojecten
                  {o.sleutelprojecten_woningen != null ? ` · ${o.sleutelprojecten_woningen.toLocaleString('nl-NL')} woningen` : ''}
                </p>
              )}
            </div>
          )}

          {/* Segment */}
          {data?.aandeel_betaalbaar != null && (
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase mb-2" style={{ letterSpacing: '0.2em' }}>
                Segment (regio-afspraak)
              </h3>
              <p className="text-[13px] text-slate-600 leading-relaxed">
                {Math.round(data.aandeel_betaalbaar * 100)}% betaalbaar
                {data.betaalbaar_definitie ? ` — ${data.betaalbaar_definitie}` : ''}
              </p>
            </div>
          )}

          {/* Regelingen */}
          {data && data.regelingen.length > 0 && (
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase mb-2" style={{ letterSpacing: '0.2em' }}>
                Financiële rugwind
              </h3>
              <div className="flex flex-wrap gap-2">
                {data.regelingen.map((r) => (
                  <span key={r} className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 text-violet-700">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            Geldt voor heel {gemeenteNaam}. Informatief — telt niet mee in de perceelscore.
          </p>
        </div>
      )}
    </GemeenteModal>
  )
}
