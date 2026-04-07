/**
 * Enriched Huisvestingsverordening detail for the configuratie source-detail view.
 *
 * Fetches verordening data and renders:
 *  - status badge (actief / niet gevonden)
 *  - detail card with titel, kenmerk, datum
 *  - subject text
 *  - external link
 *
 * Design contract follows JurisprudentieDetailEnriched / BekendmakingenDetailEnriched.
 */
import { useHuisvestingsverordening } from '@/hooks/useHuisvestingsverordening'
import { ExternalLink, ArrowRight, Loader2 } from 'lucide-react'

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

/* ─── Main component ─────────────────────────────────────────── */

export function HuisvestingsverordeningDetailEnriched({ gemeenteNaam }: Props) {
  const { data, isLoading, error } = useHuisvestingsverordening(gemeenteNaam)

  if (!gemeenteNaam) return <DetailEmpty message="Selecteer een gemeente." />
  if (isLoading) return <DetailLoading />
  if (error) return <DetailError error={error as Error} />

  if (!data || !data.heeft_verordening) {
    return <DetailEmpty message="Geen huisvestingsverordening gevonden voor deze gemeente." />
  }

  return (
    <div className="space-y-5">
      {/* Status badge — same pattern as severity badge in VergunningKlimaat */}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[12px] font-bold text-emerald-600">
          Actieve verordening
        </span>
      </div>

      {/* Verordening details — same card + row pattern as ruling list items */}
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
        {data.title && (
          <div className="border-b border-[#EAEFEF] pb-3 mb-3">
            <p className="text-[14px] font-semibold text-[#0E1111]">{data.title}</p>
          </div>
        )}
        <div className="space-y-2">
          {data.identifier && (
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-400">Kenmerk</span>
              <span className="font-semibold text-[#0E1111]">{data.identifier}</span>
            </div>
          )}
          {data.modified && (
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-400">Laatst gewijzigd</span>
              <span className="font-semibold text-[#0E1111]">{data.modified}</span>
            </div>
          )}
        </div>
      </div>

      {/* Subject */}
      {data.subject && (
        <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Onderwerp</p>
          <p className="text-[13px] leading-relaxed text-slate-500">{data.subject}</p>
        </div>
      )}

      {/* External link — same pattern as jurisprudentie explorer link */}
      {data.url && (
        <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
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
    </div>
  )
}
