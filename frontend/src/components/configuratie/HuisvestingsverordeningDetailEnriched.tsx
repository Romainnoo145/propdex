/**
 * HuisvestingsverordeningDetailEnriched — enriched detail view for huisvestingsverordening source.
 * Shows structured verordening info with key fields and external link.
 */
import { useHuisvestingsverordening } from '@/hooks/useHuisvestingsverordening'
import { Home, ExternalLink, Loader2, AlertCircle, CheckCircle2, XCircle, FileText, Calendar, Hash } from 'lucide-react'

interface Props {
  gemeenteNaam: string | null
}

export function HuisvestingsverordeningDetailEnriched({ gemeenteNaam }: Props) {
  const { data, isLoading, error } = useHuisvestingsverordening(gemeenteNaam)

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
        <p className="text-[13px] text-slate-400">Huisvestingsverordening kon niet worden geladen.</p>
      </div>
    )
  }

  if (!data || !data.heeft_verordening) {
    return (
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <XCircle size={20} className="text-slate-400" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-[#0E1111]">Geen huisvestingsverordening</p>
            <p className="text-[12px] text-slate-500">Deze gemeente heeft geen actieve huisvestingsverordening gevonden.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 size={20} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</p>
            <p className="text-[16px] font-black text-emerald-600">Actieve verordening</p>
          </div>
        </div>

        {/* Verordening details */}
        <div className="space-y-3">
          {data.title && (
            <InfoRow icon={FileText} label="Titel" value={data.title} />
          )}
          {data.identifier && (
            <InfoRow icon={Hash} label="Kenmerk" value={data.identifier} />
          )}
          {data.modified && (
            <InfoRow icon={Calendar} label="Laatst gewijzigd" value={data.modified} />
          )}
        </div>
      </div>

      {/* Subject / description */}
      {data.subject && (
        <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Onderwerp</p>
          <p className="text-[13px] leading-relaxed text-slate-600">{data.subject}</p>
        </div>
      )}

      {/* Key rules explainer */}
      <div className="rounded-[16px] border border-[#EAEFEF] bg-amber-50/50 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Home size={16} className="text-amber-600" />
          <p className="text-[13px] font-bold text-[#0E1111]">Relevantie voor vastgoedontwikkeling</p>
        </div>
        <ul className="space-y-2 text-[12px] text-slate-600">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>Regels voor woningvorming, splitsing en kamerverhuur — bepaalt of je een woning mag splitsen of omzetten.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>Vergunningplicht voor onttrekking aan de woningvoorraad — relevant bij transformatie van wonen naar commercieel.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>Mogelijke quota voor sociale huur, middenhuur, of koopwoningen bij nieuwbouw of transformatieprojecten.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>Opkoopbescherming (zelfbewoningsplicht) — beperkt buy-to-let mogelijkheden in aangewezen wijken.</span>
          </li>
        </ul>
      </div>

      {/* External link */}
      {data.url && (
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-[12px] border border-[#EAEFEF] bg-white px-4 py-3 text-[13px] font-semibold text-[#0E1111] hover:bg-slate-50 transition-colors"
        >
          Bekijk volledige verordening
          <ExternalLink size={14} className="text-slate-400" />
        </a>
      )}
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] bg-slate-50 px-4 py-2.5">
      <Icon size={14} className="text-slate-400 shrink-0" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-[100px] shrink-0">{label}</span>
      <span className="text-[13px] text-[#0E1111]">{value}</span>
    </div>
  )
}
