import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import ResultsShell from '@/components/layout/ResultsShell'
import { ScoreAnalysePanel } from '@/components/projects/ScoreAnalysePanel'
import {
  useDashboardBanner,
  useDismissKans,
  useGemeenteSignalen,
  useOffMarketKansen,
  usePipelineParcels,
  type Kans,
} from '@/hooks/useDashboard'

// Demo: Hauzer werkt in Venlo. De gemeente-scope switcher impliceert multi-gemeente.
const GEMEENTE = 'Venlo'

// Read-state for gemeentesignalen lives client-side (localStorage). A signal is
// "nieuw" until the user clicks it or marks all read. Move to a per-user backend
// table (cf. DismissedKans) if cross-device read-state is needed.
const READ_SIGNALEN_KEY = 'propdex:read-signalen'

// Cap how many signalen render at once — the full feed (often 100) is an
// unbearable scroll. "Toon alle" expands on demand.
const SIGNALEN_CAP = 12

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

// --- inline icons (geen icon-lib dependency) ---
const ic =
  'h-[18px] w-[18px] fill-none stroke-[1.7] stroke-current [stroke-linecap:round] [stroke-linejoin:round]'
const IconArrow = () => (
  <svg viewBox="0 0 24 24" className={ic}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
)
const IconMap = () => (
  <svg viewBox="0 0 24 24" className={ic}>
    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)
const IconGauge = () => (
  <svg viewBox="0 0 24 24" className={ic}>
    <path d="m12 14 4-4" />
    <path d="M3.34 19a10 10 0 1 1 17.32 0" />
  </svg>
)
const IconSpark = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-none fill-none stroke-aura-amber-hover stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]">
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
  </svg>
)
const IconScale = () => (
  <svg viewBox="0 0 24 24" className={ic}>
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="M7 21h10" />
    <path d="M12 3v18" />
    <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
  </svg>
)

function ScoreRing({ score }: { score: number | null }) {
  const pct = Math.max(0, Math.min(100, score ?? 0))
  const dash = `${(pct / 100) * 100.5} 100.5`
  return (
    <svg viewBox="0 0 36 36" className="h-11 w-11 flex-none">
      <circle cx="18" cy="18" r="16" fill="none" stroke="#E6EAE7" strokeWidth="3.2" />
      <circle
        cx="18"
        cy="18"
        r="16"
        fill="none"
        stroke="#22C55E"
        strokeWidth="3.2"
        strokeDasharray={dash}
        strokeLinecap="round"
        transform="rotate(-90 18 18)"
      />
      <text x="18" y="22" textAnchor="middle" fontSize="12" fontWeight="800" fill="#0f8a5f">
        {score != null ? Math.round(score) : '-'}
      </text>
    </svg>
  )
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.06em] text-aura-ink">
      {children}
    </h2>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-8 text-center text-sm text-neutral-400">{children}</div>
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function KansCard({
  kans,
  onDismiss,
  onScores,
  onView,
}: {
  kans: Kans
  onDismiss: () => void
  onScores: () => void
  onView: () => void
}) {
  return (
    <div className="mb-2.5 rounded-[15px] border border-[#EEF1F1] bg-white p-3.5 transition-colors hover:border-neutral-300">
      <div className="flex items-center gap-3">
        <ScoreRing score={kans.potentie_score} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-aura-ink">
            {kans.address ?? 'Ontwikkelkavel'}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-400">
            <span className="h-[5px] w-[5px] rounded-full bg-aura-amber" />
            {kans.projecttype ?? 'Ontwikkelpotentie'}
            {kans.wijk ? ` · ${kans.wijk}` : ''}
          </div>
        </div>
        <button
          onClick={onDismiss}
          title="Verberg deze kans"
          className="flex-none self-start px-1 text-lg leading-none text-neutral-300 hover:text-neutral-500"
        >
          &times;
        </button>
      </div>
      {kans.reason && (
        <div className="mt-2.5 flex items-start gap-2 rounded-[9px] bg-aura-canvas px-2.5 py-2 text-xs leading-snug text-aura-ink/70">
          <span className="mt-0.5">
            <IconSpark />
          </span>
          {kans.reason}
        </div>
      )}
      <div className="mt-2.5 flex gap-2">
        <button
          onClick={onScores}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-aura-amber/40 bg-aura-amber/[0.12] text-[12.5px] font-semibold text-aura-amber-hover hover:bg-aura-amber/20"
        >
          <IconGauge />
          Bekijk scores
        </button>
        <button
          onClick={onView}
          title="Op kaart"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-aura-obsidian text-aura-amber hover:bg-aura-obsidian/90"
        >
          <IconMap />
        </button>
      </div>
    </div>
  )
}

function DashboardPage() {
  const navigate = useNavigate()
  const banner = useDashboardBanner(GEMEENTE)
  const signalen = useGemeenteSignalen(GEMEENTE)
  const kansen = useOffMarketKansen(GEMEENTE)
  const pipelineParcels = usePipelineParcels()
  const pipelineSet = new Set(pipelineParcels.data ?? [])
  const dismissKans = useDismissKans()
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [scoresKans, setScoresKans] = useState<Kans | null>(null)
  const [readSignalen, setReadSignalen] = useState<Set<string>>(() => {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(READ_SIGNALEN_KEY) ?? '[]'))
    } catch {
      return new Set<string>()
    }
  })

  const persistRead = (next: Set<string>) => {
    setReadSignalen(next)
    try {
      localStorage.setItem(READ_SIGNALEN_KEY, JSON.stringify([...next]))
    } catch {
      /* localStorage unavailable — read-state just won't persist */
    }
  }
  const markSignaalRead = (id: string) => {
    if (readSignalen.has(id)) return
    persistRead(new Set(readSignalen).add(id))
  }
  const markAllSignalenRead = () => {
    const next = new Set(readSignalen)
    for (const s of signalen.data ?? []) next.add(s.id)
    persistRead(next)
  }
  const unreadSignalen = (signalen.data ?? []).filter((s) => !readSignalen.has(s.id)).length
  const [showAllSignalen, setShowAllSignalen] = useState(false)
  const allSignalen = signalen.data ?? []
  const shownSignalen = showAllSignalen ? allSignalen : allSignalen.slice(0, SIGNALEN_CAP)

  const visibleKansen = (kansen.data?.kansen ?? []).filter((k) => !dismissed.has(k.parcel_id))

  const handleDismiss = (parcelId: string) => {
    setDismissed((d) => new Set(d).add(parcelId)) // instant feedback
    dismissKans.mutate(parcelId) // persist server-side
  }

  // Open een perceel op de kaart (ParcelDetailModal = scan/rapport-weergave).
  const openOnMap = (parcelId?: string | null) =>
    navigate({ to: '/map', search: parcelId ? { parcel_id: parcelId } : {} })

  return (
    <ResultsShell fullWidth>
      <div className="mx-auto max-w-[1180px] px-8 py-8">
        {/* header */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight text-aura-ink">
              Goedemorgen, Hauzer
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              <span className="font-bold text-aura-ink">{visibleKansen.length} kansen</span>
              {' · '}
              {signalen.data?.length ?? 0} bekendmakingen in jouw gemeenten
            </p>
          </div>
          {/* Eén gemeente in scope (Hauzer = Venlo) — statische badge, geen dropdown. */}
          <span className="inline-flex items-center gap-2.5 rounded-full border border-white/70 bg-white/70 py-2 pl-4 pr-4 text-sm font-bold text-aura-ink">
            <span className="h-[7px] w-[7px] rounded-full bg-aura-amber" />
            {GEMEENTE}
          </span>
        </div>

        {/* conditional beleid banner */}
        {banner.data?.banner && (
          <div className="mb-5 flex items-center gap-3.5 rounded-2xl border border-[#F3DFBD] bg-gradient-to-r from-[#FFF3DD] to-[#FFFBF4] px-5 py-3.5">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-aura-amber/15 text-aura-amber-hover">
              <IconScale />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wide text-aura-amber-hover">
                Beleidswijziging
              </div>
              <div className="mt-0.5 text-sm font-bold text-aura-ink">{banner.data.banner.title}</div>
            </div>
            <button
              onClick={() => navigate({ to: '/map' })}
              className="inline-flex items-center gap-1.5 rounded-full bg-aura-obsidian px-3.5 py-2 text-xs font-semibold text-white hover:bg-aura-obsidian/90"
            >
              Bekijk op kaart <IconArrow />
            </button>
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] items-start gap-[18px] max-lg:grid-cols-1">
          {/* LINKS — gemeentesignalen */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-aura-ink">
                Gemeentesignalen
              </h2>
              {unreadSignalen > 0 && (
                <button
                  type="button"
                  onClick={markAllSignalenRead}
                  className="ml-auto text-[11px] font-semibold text-aura-amber-hover hover:text-aura-amber"
                >
                  Markeer alles als gelezen
                </button>
              )}
            </div>
            <div className="h-[calc(100vh-320px)] min-h-[360px] overflow-y-auto rounded-2xl border border-white/60 bg-white/55">
              {signalen.isLoading && <Empty>Laden…</Empty>}
              {signalen.isSuccess && signalen.data.length === 0 && (
                <Empty>Nog geen bekendmakingen voor {GEMEENTE}.</Empty>
              )}
              {shownSignalen.map((s, i) => {
                const inPipeline = !!s.matched_parcel_id && pipelineSet.has(s.matched_parcel_id)
                const isRead = readSignalen.has(s.id)
                return (
                  <div
                    key={s.id}
                    onClick={() => markSignaalRead(s.id)}
                    className={`group flex cursor-pointer items-center gap-3.5 px-[18px] py-3.5 transition-colors hover:bg-white/60 ${i > 0 ? 'border-t border-aura-ink/[0.04]' : ''}`}
                  >
                    {/* New = bold black title + amber date; reading it (row click) calms
                        it to muted. Title wraps to 2 lines so it's fully readable. */}
                    <span
                      className={`w-11 flex-none text-[11px] tabular-nums ${isRead ? 'text-neutral-400' : 'font-semibold text-aura-amber-hover'}`}
                    >
                      {fmtDate(s.change_date)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`line-clamp-2 text-[13px] leading-snug ${isRead ? 'font-medium text-aura-ink/60' : 'font-semibold text-aura-ink'}`}
                      >
                        {s.title}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-neutral-400">
                        {s.address ?? s.gemeente_naam}
                      </div>
                    </div>
                    <button
                      type="button"
                      title="Op kaart"
                      onClick={(e) => {
                        e.stopPropagation()
                        markSignaalRead(s.id)
                        openOnMap(s.matched_parcel_id)
                      }}
                      className={`flex-none ${inPipeline ? 'text-aura-amber-hover' : 'text-neutral-300 group-hover:text-aura-amber-hover'}`}
                    >
                      <IconMap />
                    </button>
                  </div>
                )
              })}
              {allSignalen.length > SIGNALEN_CAP && (
                <button
                  type="button"
                  onClick={() => setShowAllSignalen((v) => !v)}
                  className="w-full border-t border-aura-ink/[0.04] px-[18px] py-3 text-left text-[12px] font-semibold text-aura-amber-hover hover:bg-white/60 hover:text-aura-amber"
                >
                  {showAllSignalen
                    ? 'Toon minder'
                    : `Toon alle ${allSignalen.length} bekendmakingen`}
                </button>
              )}
            </div>
          </div>

          {/* RECHTS — off-market kansen */}
          <div>
            <SectionHead>Off-market kansen</SectionHead>
            <div className="h-[calc(100vh-320px)] min-h-[360px] overflow-y-auto rounded-[20px] border border-white/60 bg-white/55 p-4">
              <p className="mb-3.5 text-xs text-neutral-500">
                Ontwikkelpotentie in je gemeenten · nog niet benaderd
              </p>
              {kansen.isLoading && <Empty>Laden…</Empty>}
              {kansen.isSuccess && visibleKansen.length === 0 && <Empty>Geen open kansen.</Empty>}
              {visibleKansen.map((k) => (
                <KansCard
                  key={k.parcel_id}
                  kans={k}
                  onDismiss={() => handleDismiss(k.parcel_id)}
                  onScores={() => setScoresKans(k)}
                  onView={() => openOnMap(k.parcel_id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {scoresKans && (
        <ScoreAnalysePanel kans={scoresKans} onClose={() => setScoresKans(null)} />
      )}
    </ResultsShell>
  )
}
