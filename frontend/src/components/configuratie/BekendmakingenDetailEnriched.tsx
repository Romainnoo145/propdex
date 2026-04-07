/**
 * Enriched Bekendmakingen detail for the configuratie source-detail view.
 *
 * Fetches the recent bekendmakingen feed for the active gemeente via
 * `fetchAllChanges` and renders:
 *  - aggregate counters (30d / 90d / 365d) from the GemeenteProfile
 *  - scrollable list of the 15 most recent bekendmakingen with
 *    change_type indicators and category pills
 */

import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/useAuth'
import { fetchAllChanges } from '@/lib/api'
import type { ChangeRecord } from '@/lib/types/monitoring'
import type { GemeenteProfile } from '@/hooks/useGemeenteProfile'

/* ─── Date formatter ──────────────────────────────────────────── */

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/* ─── Lightweight state helpers (inline equiv of configuratie helpers) ── */

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

/* ─── Metric card (inline) ─────────────────────────────────────── */

function MetricCard({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-4 text-center">
      <p className="text-[24px] font-bold text-[#0E1111]">{value ?? '—'}</p>
      <p className="mt-1 text-[11px] text-slate-400">{label}</p>
    </div>
  )
}

/* ─── Change type pill ────────────────────────────────────────── */

function changeTypePill(changeType: ChangeRecord['change_type']) {
  switch (changeType) {
    case 'permit':
      return (
        <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
          Vergunning
        </span>
      )
    case 'zoning':
      return (
        <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-600">
          Bestemmingsplan
        </span>
      )
    default:
      return null
  }
}

/* ─── Bekendmaking list item ──────────────────────────────────── */

function BekendmakingListItem({ record }: { record: ChangeRecord }) {
  const formattedDate = record.change_date
    ? dateFmt.format(new Date(record.change_date))
    : null

  return (
    <div className="flex items-start gap-3 border-b border-[#EAEFEF] py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[#0E1111]">{record.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          {formattedDate && <span>{formattedDate}</span>}
          {changeTypePill(record.change_type)}
          {record.category_label && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {record.category_label}
            </span>
          )}
        </div>
      </div>
      {record.source_url && (
        <a
          href={record.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 flex-shrink-0 text-slate-400 hover:text-[#B07D18] transition-colors"
        >
          <ExternalLink size={14} />
        </a>
      )}
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────── */

export default function BekendmakingenDetailEnriched({
  gemeenteNaam,
  profile,
  profileLoading,
  profileError,
}: {
  gemeenteNaam: string | null
  profile?: GemeenteProfile
  profileLoading: boolean
  profileError: Error | null
}) {
  const { accessToken } = useAuth()

  const {
    data,
    isLoading: feedLoading,
    error: feedError,
  } = useQuery({
    queryKey: ['gemeente-bekendmakingen', gemeenteNaam],
    queryFn: () => fetchAllChanges(accessToken, 15, 0, false, gemeenteNaam!),
    enabled: !!gemeenteNaam,
  })

  if (!gemeenteNaam) return <DetailEmpty message="Selecteer een gemeente." />

  return (
    <div className="space-y-5">
      {/* Aggregate counters from profile */}
      {profileLoading ? (
        <DetailLoading />
      ) : profileError ? (
        <DetailError error={profileError} />
      ) : profile ? (
        <div className="grid grid-cols-3 gap-4">
          <MetricCard label="Afgelopen 30 dagen" value={profile.bekendmakingen_30d} />
          <MetricCard label="Afgelopen 90 dagen" value={profile.bekendmakingen_90d} />
          <MetricCard label="Afgelopen 365 dagen" value={profile.bekendmakingen_365d} />
        </div>
      ) : (
        <DetailEmpty message="Geen profieldata beschikbaar." />
      )}

      {/* Recent bekendmakingen feed */}
      {feedLoading ? (
        <DetailLoading />
      ) : feedError ? (
        <DetailError error={feedError as Error} />
      ) : !data || data.changes.length === 0 ? (
        <DetailEmpty message="Geen recente bekendmakingen gevonden." />
      ) : (
        <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
            Recente bekendmakingen
          </p>
          <div className="max-h-[400px] overflow-y-auto">
            {data.changes.map((record) => (
              <BekendmakingListItem key={record.id} record={record} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
