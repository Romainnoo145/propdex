/**
 * ContactPhaseView — fase-2 (Contact) top-level dispatcher.
 *
 * Mounted by `routes/_authenticated/opgeslagen.perceel.$parcelId.$phase.tsx`
 * when `phase === '2-contact'` (wired in Plan 08-05).
 *
 * Composes (eng-plan AD6):
 *   - useBrkRecords(parcelId) read-path hook (data from Plan 08-02)
 *   - BrkPersistPanel: 5-state machine (CTA + LOADING + ERROR + EMPTY + SUCCESS)
 *   - BrkOwnerCard / BrkHypotheekCard / BrkKoopwaardeTimeline: gated on records.length > 0
 *   - RescoreProgressBanner: gated on (pollStartAt !== null && hasRecords) per AD3
 *
 * Back-link to /opgeslagen/perceel/$parcelId (fase 1, Onderzoek) uses TanStack
 * Link with ArrowLeft icon — matches existing $phase.tsx convention.
 *
 * Aura tokens per DESIGN.md: ResultsShell wrap, Pure Glass cards inside.
 */
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Mail } from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import { useBrkRecords } from '@/hooks/useBrkRecords'
import { BrkPersistPanel } from './BrkPersistPanel'
import { BrkOwnerCard } from './BrkOwnerCard'
import { BrkHypotheekCard } from './BrkHypotheekCard'
import { BrkKoopwaardeTimeline } from './BrkKoopwaardeTimeline'
import { RescoreProgressBanner } from './RescoreProgressBanner'

// ============================================================================
// Pure dispatcher derivation — exported for unit tests
// ============================================================================

export interface ContactDispatchInput {
  isLoading: boolean
  hasRecords: boolean
  pollStartAt: number | null
}

export interface ContactDispatchView {
  showSkeleton: boolean
  showPersistPanel: boolean
  showRecordDisplay: boolean
  showRescoreBanner: boolean
}

/**
 * Pure branching logic for the ContactPhaseView render.
 *
 *   isLoading                                 → skeleton-only
 *   !isLoading                                → persist-panel always rendered
 *   !isLoading && hasRecords                  → 3 record cards rendered
 *   !isLoading && hasRecords && pollStartAt   → rescore banner rendered (AD3)
 */
export function deriveContactDispatch(input: ContactDispatchInput): ContactDispatchView {
  const { isLoading, hasRecords, pollStartAt } = input
  return {
    showSkeleton: isLoading,
    showPersistPanel: !isLoading,
    showRecordDisplay: !isLoading && hasRecords,
    showRescoreBanner: !isLoading && hasRecords && pollStartAt !== null,
  }
}

// ============================================================================
// Component
// ============================================================================

export interface ContactPhaseViewProps {
  parcelId: string
}

function SkeletonState() {
  return (
    <div className="space-y-4">
      <div className="h-24 w-full animate-pulse bg-white/40 rounded-[24px]" />
      <div className="h-32 w-full animate-pulse bg-white/40 rounded-[24px]" />
    </div>
  )
}

export function ContactPhaseView({ parcelId }: ContactPhaseViewProps) {
  const { data: records, isLoading } = useBrkRecords(parcelId)
  const [pollStartAt, setPollStartAt] = useState<number | null>(null)

  const recs = records ?? []
  const hasRecords = recs.length > 0
  const dispatch = deriveContactDispatch({ isLoading, hasRecords, pollStartAt })

  const onPersistSuccess = () => {
    setPollStartAt(Date.now())
  }

  return (
    <ResultsShell>
      <div className="px-6 pt-6 pb-12 max-w-3xl">
        {/* Back-link to fase 1 (Onderzoek) */}
        <Link
          to="/opgeslagen/perceel/$parcelId"
          params={{ parcelId }}
          search={{ stage: undefined }}
          className="inline-flex items-center gap-2 text-[13px] text-slate-500 hover:text-aura-ink mb-6"
        >
          <ArrowLeft size={14} strokeWidth={1.5} /> Terug naar Onderzoek
        </Link>

        {/* Phase header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/60 backdrop-blur-[24px] border border-white/40">
            <Mail size={22} strokeWidth={1.5} className="text-aura-amber" />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold text-aura-ink">2. Contact</h1>
            <p className="text-[12px] text-slate-500">
              Eigendom-data + outreach voorbereiden
            </p>
          </div>
        </div>

        {dispatch.showSkeleton && <SkeletonState />}

        {dispatch.showRescoreBanner && pollStartAt !== null && (
          <RescoreProgressBanner parcelId={parcelId} pollStartAt={pollStartAt} />
        )}

        {dispatch.showPersistPanel && (
          <BrkPersistPanel
            parcelId={parcelId}
            records={recs}
            onPersistSuccess={onPersistSuccess}
          />
        )}

        {dispatch.showRecordDisplay && (
          <>
            <BrkOwnerCard records={recs} />
            <BrkHypotheekCard records={recs} />
            <BrkKoopwaardeTimeline records={recs} />
          </>
        )}
      </div>
    </ResultsShell>
  )
}
