/**
 * RescoreProgressBanner — fase-2 polling status display.
 *
 * Eng-plan AD3 states (4 total, derived from useRescorePoll phase):
 *   - idle    → null (no render)
 *   - polling → "Onderzoeksscore wordt bijgewerkt… (stap N van 30)"
 *   - success → "✓ Bijgewerkt. Score nu in fase 1." + Link to /opgeslagen/perceel/$parcelId
 *   - timeout → "Bijwerken duurt langer dan verwacht. Vernieuw fase 1 over enkele minuten."
 *               (NO retry button — AD3 explicit "geen retry-loop")
 *
 * The pure derivation (deriveBannerView) is exported for unit-testing in the
 * node-env unit project — see __tests__/BrkPersistPanel.test.tsx.
 *
 * Aura tokens per DESIGN.md: Pure Glass surface, sage-mint success accent,
 * Plus Jakarta Sans (inherits from root), Warm Amber for polling intelligence.
 */
import { Link } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { useRescorePoll, MAX_TICKS, type RescorePollPhase } from '@/hooks/useRescorePoll'

export interface BannerViewState {
  kind: 'polling' | 'success' | 'timeout'
  copy: string
  showFase1Link: boolean
  showRetryButton: boolean
}

/**
 * Pure derivation: phase + tickCount → banner render-state (or null for idle).
 */
export function deriveBannerView(input: {
  phase: RescorePollPhase
  tickCount: number
}): BannerViewState | null {
  const { phase, tickCount } = input
  if (phase === 'idle') return null
  if (phase === 'polling') {
    return {
      kind: 'polling',
      copy: `Onderzoeksscore wordt bijgewerkt… (stap ${tickCount} van ${MAX_TICKS})`,
      showFase1Link: false,
      showRetryButton: false,
    }
  }
  if (phase === 'success') {
    return {
      kind: 'success',
      copy: 'Bijgewerkt. Score nu in fase 1.',
      showFase1Link: true,
      showRetryButton: false,
    }
  }
  // timeout
  return {
    kind: 'timeout',
    copy: 'Bijwerken duurt langer dan verwacht. Vernieuw fase 1 over enkele minuten.',
    showFase1Link: false,
    showRetryButton: false,
  }
}

export interface RescoreProgressBannerProps {
  parcelId: string
  pollStartAt: number
  enabled?: boolean
}

export function RescoreProgressBanner(props: RescoreProgressBannerProps) {
  const { parcelId, pollStartAt, enabled = true } = props
  const { phase, tickCount } = useRescorePoll({ parcelId, pollStartAt, enabled })
  const view = deriveBannerView({ phase, tickCount })
  if (view === null) return null

  if (view.kind === 'polling') {
    return (
      <div className="bg-white/60 backdrop-blur-[24px] border border-white/40 rounded-[24px] p-5 mb-4 flex items-center gap-3">
        <Loader2 size={20} strokeWidth={1.5} className="text-aura-amber animate-spin" />
        <p className="text-[13px] text-aura-ink">{view.copy}</p>
      </div>
    )
  }

  if (view.kind === 'success') {
    return (
      <div className="bg-emerald-50/80 backdrop-blur-[24px] border border-emerald-100 rounded-[24px] p-5 mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={20} strokeWidth={1.5} className="text-emerald-600" />
          <p className="text-[13px] text-emerald-800 font-medium">{view.copy}</p>
        </div>
        <Link
          to="/opgeslagen/perceel/$parcelId"
          params={{ parcelId }}
          search={{ stage: undefined }}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 hover:text-emerald-900"
        >
          Bekijk fase 1
          <ArrowRight size={14} strokeWidth={1.5} />
        </Link>
      </div>
    )
  }

  // timeout
  return (
    <div className="bg-white/60 backdrop-blur-[24px] border border-white/40 rounded-[24px] p-5 mb-4 flex items-center gap-3">
      <Clock size={20} strokeWidth={1.5} className="text-slate-400" />
      <p className="text-[13px] text-slate-600">{view.copy}</p>
    </div>
  )
}
