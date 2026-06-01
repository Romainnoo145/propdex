import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import ResultsShell from '@/components/layout/ResultsShell'
import {
  useDashboardBanner,
  useGemeenteSignalen,
  useOffMarketKansen,
  usePijplijn,
  type Kans,
} from '@/hooks/useDashboard'

// Demo: Hauzer werkt in Venlo. De gemeente-scope switcher impliceert multi-gemeente.
const GEMEENTE = 'Venlo'

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
const IconFile = () => (
  <svg viewBox="0 0 24 24" className={ic}>
    <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
    <path d="M14 2v5a1 1 0 0 0 1 1h5" />
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

function KansCard({ kans, onDismiss }: { kans: Kans; onDismiss: () => void }) {
  return (
    <div className="mb-2.5 rounded-[15px] border border-[#EEF1F1] bg-white p-3.5 transition-colors hover:border-neutral-300">
      <div className="flex items-center gap-3">
        <ScoreRing score={kans.potentie_score} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-aura-ink">{kans.address ?? kans.parcel_id}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-400">
            <span className="h-[5px] w-[5px] rounded-full bg-aura-amber" />
            Ontwikkelpotentie
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
      <div className="mt-2.5 flex gap-2">
        <button className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-aura-amber/40 bg-aura-amber/[0.12] text-[12.5px] font-semibold text-aura-amber-hover hover:bg-aura-amber/20">
          <IconFile />
          Bekijk rapport
        </button>
        <button
          title="Op kaart"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-aura-obsidian text-aura-amber"
        >
          <IconMap />
        </button>
      </div>
    </div>
  )
}

function DashboardPage() {
  const banner = useDashboardBanner(GEMEENTE)
  const signalen = useGemeenteSignalen(GEMEENTE)
  const kansen = useOffMarketKansen(GEMEENTE)
  const pijplijn = usePijplijn()
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())

  const visibleKansen = (kansen.data?.kansen ?? []).filter((k) => !dismissed.has(k.parcel_id))

  return (
    <ResultsShell>
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
          <button className="inline-flex items-center gap-2.5 rounded-full border border-white/70 bg-white/70 py-2 pl-4 pr-3 text-sm font-bold text-aura-ink">
            <span className="h-[7px] w-[7px] rounded-full bg-aura-amber" />
            {GEMEENTE}
            <span className="text-[11px] font-semibold text-neutral-400">3 actief</span>
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 fill-none stroke-[1.8] stroke-neutral-500 [stroke-linecap:round]"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
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
            <button className="inline-flex items-center gap-1.5 rounded-full bg-aura-obsidian px-3.5 py-2 text-xs font-semibold text-white">
              Bekijk op kaart <IconArrow />
            </button>
          </div>
        )}

        <div className="grid grid-cols-[1.45fr_1fr] items-start gap-[18px] max-lg:grid-cols-1">
          {/* LINKS — gemeentesignalen */}
          <div>
            <SectionHead>Gemeentesignalen</SectionHead>
            <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/55">
              {signalen.isLoading && <Empty>Laden…</Empty>}
              {signalen.isSuccess && signalen.data.length === 0 && (
                <Empty>Nog geen bekendmakingen voor {GEMEENTE}.</Empty>
              )}
              {signalen.data?.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex cursor-pointer items-center gap-3.5 px-[18px] py-3 hover:bg-white/70 ${i > 0 ? 'border-t border-aura-ink/5' : ''}`}
                >
                  <span className="w-12 flex-none text-[11px] text-neutral-400">
                    {fmtDate(s.change_date)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-aura-ink">
                      {s.title}
                    </div>
                    <div className="truncate text-xs text-neutral-400">
                      {s.address ?? s.gemeente_naam}
                    </div>
                  </div>
                  <span className="flex-none text-neutral-400">
                    <IconMap />
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* RECHTS — off-market kansen */}
          <div>
            <SectionHead>Off-market kansen</SectionHead>
            <div className="rounded-[20px] border border-white/60 bg-white/55 p-4">
              <p className="mb-3.5 text-xs text-neutral-500">
                Ontwikkelpotentie in je gemeenten · nog niet benaderd
              </p>
              {kansen.isLoading && <Empty>Laden…</Empty>}
              {kansen.isSuccess && visibleKansen.length === 0 && <Empty>Geen open kansen.</Empty>}
              {visibleKansen.map((k) => (
                <KansCard
                  key={k.parcel_id}
                  kans={k}
                  onDismiss={() => setDismissed((d) => new Set(d).add(k.parcel_id))}
                />
              ))}
            </div>
          </div>
        </div>

        {/* pijplijn strip */}
        <div className="mt-[18px] flex flex-wrap items-center gap-2 rounded-2xl border border-white/60 bg-white/50 px-[18px] py-3.5">
          <span className="mr-1.5 text-[13px] font-bold text-aura-ink">
            Pijplijn · {pijplijn.data?.total ?? 0}
          </span>
          {(pijplijn.data?.stages ?? []).map((s) => (
            <span key={s.stage} className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
              {s.stage} <b className="font-bold text-aura-ink">{s.count}</b>
            </span>
          ))}
          <span className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-aura-amber-hover">
            Open pijplijn <IconArrow />
          </span>
        </div>
      </div>
    </ResultsShell>
  )
}
