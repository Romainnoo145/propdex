/**
 * RVO Subsidies enriched detail view for the configuratie source-detail page.
 *
 * Shows:
 *  - Summary bar with open/gesloten/doorlopend breakdown of curated landelijk subsidies
 *  - Curated landelijk subsidies with rich cards (status pills, budget, doelgroep)
 *  - Live RVO subsidies via useSubsidieExplorer with sector/target facet filters
 *  - External link to RVO.nl
 */

import { useMemo, useState } from 'react'
import {
  Banknote,
  ExternalLink,
  Loader2,
  AlertCircle,
  Search,
  Building2,
} from 'lucide-react'
import {
  useSubsidieExplorer,
  type SubsidieExplorerItem,
} from '@/hooks/useSubsidieExplorer'
import {
  CURATED_SUBSIDIES,
  type CuratedSubsidie,
  type SubsidieStatus,
} from '@/lib/subsidies/curatedSubsidies'
import { SectionInsightCard, SubCard } from '@/components/reports/components'

/* ─── Curated landelijk subsidies ────────────────────────────── */

const LANDELIJK_SUBSIDIES = CURATED_SUBSIDIES.filter(
  (s) => s.niveau === 'landelijk',
)

/* ─── Status helpers ─────────────────────────────────────────── */

const STATUS_CONFIG: Record<
  SubsidieStatus,
  { label: string; pill: string; dot: string }
> = {
  open: {
    label: 'Open',
    pill: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  gesloten: {
    label: 'Gesloten',
    pill: 'border border-red-200 bg-red-50 text-red-700',
    dot: 'bg-red-500',
  },
  doorlopend: {
    label: 'Doorlopend',
    pill: 'border border-slate-200 bg-slate-50 text-slate-600',
    dot: 'bg-slate-400',
  },
}

/* ─── Inline loading/error/empty state helpers ───────────────── */

function DetailLoading() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-[20px] border border-[#EAEFEF] bg-white p-12">
      <Loader2 className="size-5 animate-spin text-slate-400" />
      <span className="text-[13px] text-slate-400">Data laden…</span>
    </div>
  )
}

function DetailError({ error }: { error: Error | null }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-[20px] border border-[#EAEFEF] bg-white p-8">
      <AlertCircle className="size-5 text-red-400" />
      <p className="text-[13px] text-red-400">{error?.message ?? 'Er is een fout opgetreden.'}</p>
    </div>
  )
}

/* ─── Summary stats bar (contract-conform SectionInsightCard) ── */

function StatusSummaryBar({ subsidies }: { subsidies: CuratedSubsidie[] }) {
  const counts = useMemo(() => {
    const c = { open: 0, gesloten: 0, doorlopend: 0 }
    for (const s of subsidies) c[s.status]++
    return c
  }, [subsidies])

  return (
    <SectionInsightCard
      kicker="Overzicht"
      title="Landelijke subsidies"
      Icon={Banknote}
      badge={`${subsidies.length} regelingen`}
    >
      <div className="space-y-3">
        {/* Stacked bar */}
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
          {(['open', 'gesloten', 'doorlopend'] as const).map((status) => {
            const pct =
              subsidies.length > 0 ? (counts[status] / subsidies.length) * 100 : 0
            if (pct === 0) return null
            return (
              <div
                key={status}
                className={`${STATUS_CONFIG[status].dot} transition-all`}
                style={{ width: `${pct}%` }}
              />
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3">
          {(['open', 'gesloten', 'doorlopend'] as const).map((status) => {
            const cfg = STATUS_CONFIG[status]
            return (
              <span
                key={status}
                className="flex items-center gap-1.5 text-[11px]"
              >
                <span className={`size-2 rounded-full ${cfg.dot}`} />
                <span className="font-semibold text-slate-500">
                  {cfg.label}
                </span>
                <span className="tabular-nums text-slate-400">
                  {counts[status]}
                </span>
              </span>
            )
          })}
        </div>
      </div>
    </SectionInsightCard>
  )
}

/* ─── Curated subsidie card (SubCard-wrapped) ────────────────── */

function CuratedSubsidieCard({ subsidie }: { subsidie: CuratedSubsidie }) {
  const cfg = STATUS_CONFIG[subsidie.status]

  return (
    <SubCard className="space-y-2.5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-[13px] font-semibold leading-snug text-[#0E1111]">
          {subsidie.title}
        </h4>
        <span
          className={`inline-block shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.pill}`}
        >
          {cfg.label}
        </span>
      </div>

      {/* Beschrijving */}
      <p className="text-[12px] leading-relaxed text-slate-500 line-clamp-3">
        {subsidie.beschrijving}
      </p>

      {/* Meta row — neutral type-pills per §5 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#EAEFEF] bg-white px-2 py-0.5 text-[10px] font-medium text-[#0E1111]">
          {subsidie.doelgroep}
        </span>
        {subsidie.budget && (
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <Banknote className="size-3.5" />
            {subsidie.budget}
          </span>
        )}
        {subsidie.maxBedrag && (
          <span className="text-[11px] text-slate-400">
            Max: {subsidie.maxBedrag}
          </span>
        )}
        {subsidie.deadline && (
          <span className="text-[11px] text-slate-400">
            Deadline: {subsidie.deadline}
          </span>
        )}
      </div>

      {/* Voorwaarden */}
      <p className="text-[11px] leading-relaxed text-slate-400 line-clamp-2">
        <span className="font-semibold text-slate-500">Voorwaarden: </span>
        {subsidie.voorwaarden}
      </p>

      {/* External link — §11 pattern */}
      {subsidie.url && (
        <a
          href={subsidie.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#B07D18] hover:underline"
        >
          Bekijk op RVO.nl
          <ExternalLink size={12} />
        </a>
      )}
    </SubCard>
  )
}

/* ─── Live RVO subsidie item (SubCard-wrapped) ───────────────── */

function RvoSubsidieItem({ item }: { item: SubsidieExplorerItem }) {
  return (
    <SubCard className="space-y-2">
      <h5 className="line-clamp-2 text-[13px] font-semibold leading-snug text-[#0E1111]">
        {item.title}
      </h5>
      {item.intro && (
        <p className="line-clamp-2 text-[12px] leading-relaxed text-slate-500">
          {item.intro}
        </p>
      )}
      {/* Doelgroep pills only — sectors dropped (RVO's own taxonomy
          adds noise; results are already pre-filtered to vastgoed). */}
      {item.targets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.targets.map((t) => (
            <span
              key={t}
              className="rounded-full border border-[#EAEFEF] bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#B07D18] hover:underline"
        >
          Meer info
          <ExternalLink size={11} />
        </a>
      )}
    </SubCard>
  )
}

/* ─── Facet pill toggle ──────────────────────────────────────── */

function FacetPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
        active
          ? 'bg-[#0E1111] text-white'
          : 'bg-[#F2F6F3] text-[#0E1111] hover:bg-[#E5ECEA]'
      }`}
    >
      {label} ({count})
    </button>
  )
}

/* ─── Live RVO Subsidies section ─────────────────────────────── */

function LiveRvoSection() {
  const [targetFilter, setTargetFilter] = useState<string | undefined>()

  const { data, allCount, isLoading, error } = useSubsidieExplorer({
    target: targetFilter,
  })

  if (isLoading) return <DetailLoading />
  if (error) return <DetailError error={error} />

  if (!data || data.results.length === 0) {
    return (
      <SectionInsightCard
        kicker="Live"
        title="Actuele RVO regelingen"
        Icon={Search}
      >
        <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
          <p className="text-[13px] font-semibold text-[#0E1111]">
            Geen live RVO subsidies gevonden
          </p>
          <p className="mx-auto mt-2 max-w-sm text-[12px] text-slate-400">
            Probeer andere filters of raadpleeg rvo.nl direct.
          </p>
        </div>
      </SectionInsightCard>
    )
  }

  return (
    <SectionInsightCard
      kicker="Live"
      title="Actuele RVO regelingen"
      Icon={Search}
      badge={`${data.total_count}/${allCount}`}
    >
      <div className="space-y-4">
        {/* Target facets (doelgroep) — sector facet dropped: RVO's own
            taxonomy adds noise since backend already pre-filters all
            results to vastgoed/development-relevant subsidies. */}
        {data.facets.targets.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
              Doelgroep
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.facets.targets.map((f) => (
                <FacetPill
                  key={f.value}
                  label={f.value}
                  count={f.count}
                  active={targetFilter === f.value}
                  onClick={() =>
                    setTargetFilter(targetFilter === f.value ? undefined : f.value)
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* Results grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {data.results.map((item) => (
            <RvoSubsidieItem key={item.id} item={item} />
          ))}
        </div>
      </div>
    </SectionInsightCard>
  )
}

/* ─── Main component ─────────────────────────────────────────── */

export default function RvoSubsidiesDetailEnriched() {
  return (
    <div
      className="space-y-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Summary stats bar */}
      <StatusSummaryBar subsidies={LANDELIJK_SUBSIDIES} />

      {/* Curated landelijk subsidies — wrapped in SectionInsightCard */}
      <SectionInsightCard
        kicker="Subsidies"
        title="Landelijke woningbouwsubsidies"
        Icon={Building2}
      >
        <div className="grid gap-3">
          {LANDELIJK_SUBSIDIES.map((s) => (
            <CuratedSubsidieCard key={s.id} subsidie={s} />
          ))}
        </div>
      </SectionInsightCard>

      {/* Live RVO subsidies section */}
      <LiveRvoSection />

      {/* Footer — §11 external link pattern inside a neutral container */}
      <SectionInsightCard kicker="Bron" title="RVO.nl" Icon={ExternalLink}>
        <div className="flex items-start justify-between gap-4">
          <p className="text-[12px] leading-relaxed text-slate-500">
            Bekijk het volledige overzicht van rijkssubsidies en
            financieringsregelingen voor vastgoed en woningbouw op rvo.nl.
          </p>
          <a
            href="https://www.rvo.nl/subsidies-financiering"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 text-[13px] font-semibold text-[#B07D18] hover:underline"
          >
            Open RVO.nl
            <ExternalLink size={14} />
          </a>
        </div>
      </SectionInsightCard>
    </div>
  )
}
