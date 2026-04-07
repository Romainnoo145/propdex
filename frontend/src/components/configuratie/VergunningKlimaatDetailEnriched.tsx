/**
 * Enriched Vergunning-klimaat detail for the configuratie source-detail view.
 *
 * Fetches the gemeente profile and renders:
 *  - severity badge with sample size
 *  - metric cards for goedkeuring/afwijzing/doorlooptijd
 *  - bekendmakingen trend counters (30d/90d/365d)
 *  - permit type distribution bar chart
 *
 * Design contract follows JurisprudentieDetailEnriched / BekendmakingenDetailEnriched:
 *  - space-y-5 between sections, no wrapping container
 *  - Cards: rounded-[16px] border border-[#EAEFEF] bg-white p-5
 *  - Headers: text-[12px] font-semibold uppercase tracking-wide text-slate-400
 *  - MetricCard: text-[24px] font-bold, text-[11px] label
 *  - Colors: #0E1111, #F9A826, #EAEFEF, #B07D18, slate. No blue/indigo/violet.
 */
import { useGemeenteProfile, SEVERITY_COLORS } from '@/hooks/useGemeenteProfile'
import { Loader2, ArrowRight } from 'lucide-react'

interface Props {
  gemeenteNaam: string | null
}

/* ─── Lightweight state helpers (same as JurisprudentieDetailEnriched) ── */

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

/* ─── Metric card (same as BekendmakingenDetailEnriched) ──────── */

function MetricCard({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-4 text-center">
      <p className="text-[24px] font-bold text-[#0E1111]">{value ?? '—'}</p>
      <p className="mt-1 text-[11px] text-slate-400">{label}</p>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────── */

export function VergunningKlimaatDetailEnriched({ gemeenteNaam }: Props) {
  const { data: profile, isLoading, error } = useGemeenteProfile(gemeenteNaam)

  if (!gemeenteNaam) return <DetailEmpty message="Selecteer een gemeente." />
  if (isLoading) return <DetailLoading />
  if (error) return <DetailError error={error as Error} />
  if (!profile) return <DetailEmpty />

  const sevColor = SEVERITY_COLORS[profile.severity_label] ?? SEVERITY_COLORS['Onbekend']
  const permitEntries = Object.entries(profile.permit_type_distribution ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
  const maxCount = permitEntries.length > 0 ? permitEntries[0][1] : 1

  return (
    <div className="space-y-5">
      {/* Severity + sample size */}
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold text-white"
          style={{ backgroundColor: sevColor }}
        >
          {profile.severity_label}
        </span>
        <span className="text-[12px] text-slate-400">op basis van {profile.sample_size} vergunningen</span>
      </div>

      {/* Core metrics */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          label="Goedkeuring"
          value={profile.approval_rate_pct != null ? `${profile.approval_rate_pct.toFixed(1)}%` : null}
        />
        <MetricCard
          label="Afwijzing"
          value={profile.rejection_rate_pct != null ? `${profile.rejection_rate_pct.toFixed(1)}%` : null}
        />
        <MetricCard
          label="Gem. doorlooptijd"
          value={profile.avg_doorlooptijd_days != null ? `${Math.round(profile.avg_doorlooptijd_days)} d` : null}
        />
      </div>

      {/* Bekendmakingen trend */}
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
          Bekendmakingen trend
        </p>
        <div className="grid grid-cols-3 gap-4">
          <MetricCard label="Afgelopen 30 dagen" value={profile.bekendmakingen_30d} />
          <MetricCard label="Afgelopen 90 dagen" value={profile.bekendmakingen_90d} />
          <MetricCard label="Afgelopen 365 dagen" value={profile.bekendmakingen_365d} />
        </div>
      </div>

      {/* Permit type distribution */}
      {permitEntries.length > 0 && (
        <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
            Vergunningtype verdeling
          </p>
          <div className="space-y-2.5">
            {permitEntries.map(([type, count]) => (
              <div key={type} className="flex items-center gap-3">
                <span className="w-[140px] truncate text-[12px] text-slate-500">{type}</span>
                <div className="flex-1 h-[6px] rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#F9A826]"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-[12px] font-bold text-[#0E1111] tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link to bekendmakingen */}
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
        <a
          href="/meldingen"
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#B07D18] hover:underline"
        >
          Bekijk alle bekendmakingen
          <ArrowRight size={14} />
        </a>
      </div>
    </div>
  )
}
