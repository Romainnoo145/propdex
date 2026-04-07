/**
 * Enriched Huisvestingsverordening detail for the configuratie source-detail view.
 *
 * Reuses shared report components: SectionInsightCard, SubCard, KVRow.
 */
import { useHuisvestingsverordening } from '@/hooks/useHuisvestingsverordening'
import { Home, ExternalLink, ArrowRight, Loader2 } from 'lucide-react'
import { SectionInsightCard, SubCard, KVRow } from '@/components/reports/components'

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

export function HuisvestingsverordeningDetailEnriched({ gemeenteNaam }: Props) {
  const { data, isLoading, error } = useHuisvestingsverordening(gemeenteNaam)

  if (!gemeenteNaam || isLoading) return <DetailLoading />
  if (error) {
    return (
      <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
        <p className="text-[13px] text-slate-400">Fout bij laden van huisvestingsverordening.</p>
      </div>
    )
  }

  if (!data || !data.heeft_verordening) {
    return (
      <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
        <p className="text-[13px] text-slate-400">Geen huisvestingsverordening gevonden voor deze gemeente.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Main card — reuses SectionInsightCard */}
      <SectionInsightCard
        kicker="Huisvestingsverordening"
        title={data.title ?? 'Actieve verordening'}
        Icon={Home}
      >
        {/* Key-value details — reuses KVRow */}
        <KVRow label="Kenmerk" value={data.identifier} />
        <KVRow label="Laatst gewijzigd" value={data.modified} />

        {/* Subject */}
        {data.subject && (
          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Onderwerp</p>
            <p className="text-[13px] leading-relaxed text-slate-500">{data.subject}</p>
          </div>
        )}

        {/* External link */}
        {data.url && (
          <div className="mt-4">
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#B07D18] hover:underline"
            >
              Bekijk volledige verordening
              <ExternalLink size={14} />
            </a>
          </div>
        )}
      </SectionInsightCard>

      {/* Relevance — uses SubCard */}
      <SubCard>
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-3">
          Relevant voor vastgoedontwikkeling
        </p>
        <div className="space-y-2">
          {[
            'Regels voor woningvorming, splitsing en kamerverhuur',
            'Vergunningplicht voor onttrekking aan de woningvoorraad',
            'Mogelijke quota voor sociale huur of middenhuur bij nieuwbouw',
            'Opkoopbescherming (zelfbewoningsplicht) in aangewezen wijken',
          ].map((item) => (
            <div key={item} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#F9A826] shrink-0" />
              <span className="text-[12px] text-slate-500">{item}</span>
            </div>
          ))}
        </div>
      </SubCard>
    </div>
  )
}
