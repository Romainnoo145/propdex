/**
 * Enriched Bekendmakingen detail for the configuratie source-detail view.
 *
 * Follows CONFIGURATIE-DESIGN-CONTRACT.md strictly:
 * - SectionInsightCard wrappers
 * - SubCard for stat grids
 * - TimelineRow-style list items
 * - Neutral bg-[#F8FAFA] type pills (NO blue/purple)
 * - space-y-6 top-level with Plus Jakarta font
 */

import { useQuery } from '@tanstack/react-query'
import { Bell, ExternalLink, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/useAuth'
import { fetchAllChanges } from '@/lib/api'
import type { ChangeRecord } from '@/lib/types/monitoring'
import type { GemeenteProfile } from '@/hooks/useGemeenteProfile'
import { SectionInsightCard } from '@/components/reports/components/SectionInsightCard'
import { SubCard } from '@/components/reports/components'

/* ─── Date formatter ──────────────────────────────────────────── */

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/* ─── State helpers (contract §10) ────────────────────────────── */

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
      <p className="text-[13px] font-semibold text-[#0E1111]">{message ?? 'Geen data beschikbaar.'}</p>
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

/* ─── Change type label (contract §5: neutral pills) ──────────── */

function changeTypeLabel(changeType: ChangeRecord['change_type']): string | null {
  switch (changeType) {
    case 'permit':
      return 'Vergunning'
    case 'zoning':
      return 'Bestemmingsplan'
    default:
      return null
  }
}

/* ─── Bekendmaking list item (contract §6: TimelineRow) ───────── */

function BekendmakingListItem({ record, idx, total }: { record: ChangeRecord; idx: number; total: number }) {
  const formattedDate = record.change_date ? dateFmt.format(new Date(record.change_date)) : null
  const typeLabel = changeTypeLabel(record.change_type)

  return (
    <div className="flex gap-3 py-3 border-b border-[#EAEFEF] last:border-b-0">
      <div className="flex flex-col items-center pt-1.5">
        <span className="h-2 w-2 rounded-full bg-aura-amber shrink-0" />
        {idx < total - 1 && <span className="w-px flex-1 bg-[#EAEFEF] mt-1" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-[#0E1111] leading-snug line-clamp-2">
          {record.source_url ? (
            <a
              href={record.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-aura-amber transition-colors"
            >
              {record.title}
            </a>
          ) : (
            record.title
          )}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          {formattedDate && <span>{formattedDate}</span>}
          {typeLabel && (
            <span className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-1.5 py-0.5 text-[10px]">
              {typeLabel}
            </span>
          )}
          {record.category_label && (
            <span className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-1.5 py-0.5 text-[10px]">
              {record.category_label}
            </span>
          )}
          {record.source_url && (
            <a
              href={record.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-slate-400 hover:text-[#0E1111]"
            >
              <ExternalLink size={9} />
            </a>
          )}
        </div>
      </div>
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
    <div className="space-y-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Aggregate counters */}
      {profileLoading ? (
        <DetailLoading />
      ) : profileError ? (
        <DetailError error={profileError} />
      ) : profile ? (
        <SectionInsightCard kicker="Activiteit" title="Aantal bekendmakingen" Icon={Bell}>
          <div className="grid grid-cols-3 gap-3">
            <SubCard>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Afgelopen 30 dagen</p>
              <p className="mt-1 text-[22px] font-bold tabular-nums text-[#0E1111]">
                {profile.bekendmakingen_30d}
              </p>
            </SubCard>
            <SubCard>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Afgelopen 90 dagen</p>
              <p className="mt-1 text-[22px] font-bold tabular-nums text-[#0E1111]">
                {profile.bekendmakingen_90d}
              </p>
            </SubCard>
            <SubCard>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Afgelopen 365 dagen</p>
              <p className="mt-1 text-[22px] font-bold tabular-nums text-[#0E1111]">
                {profile.bekendmakingen_365d}
              </p>
            </SubCard>
          </div>
        </SectionInsightCard>
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
        <SectionInsightCard
          kicker="Bekendmakingen"
          title={`Recente publicaties (${data.changes.length})`}
          Icon={Bell}
        >
          <div className="max-h-[480px] overflow-y-auto">
            {data.changes.map((record, idx) => (
              <BekendmakingListItem
                key={record.id}
                record={record}
                idx={idx}
                total={data.changes.length}
              />
            ))}
          </div>
        </SectionInsightCard>
      )}
    </div>
  )
}
